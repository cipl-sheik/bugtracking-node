'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');
const path = require('path');
const { randomUUID } = require('crypto');
const { getConfig, VERSION } = require('./config');

const MAX_FRAMES = 30;

/**
 * Builds the BugTrack ingest payload from an Error and posts it.
 * Reporting must never replace or delay the original failure.
 */
async function report(error, context = {}) {
  const config = getConfig();

  if (
    !config.enabled ||
    !config.url ||
    !config.key ||
    isIgnored(error, config)
  ) {
    return;
  }

  try {
    const payload = buildPayload(normalizeError(error), config, context);
    await send(config.url, config.key, payload, config);
  } catch {
    // swallow — never interfere with the host app
  }
}

function normalizeError(error) {
  if (error instanceof Error) {
    return error;
  }

  const wrapper = new Error(
    typeof error === 'string' ? error : JSON.stringify(error)
  );
  wrapper.name = typeof error === 'object' && error !== null
    ? error.name || 'Error'
    : 'Error';
  return wrapper;
}

function isIgnored(error, config) {
  if (!(error instanceof Error)) {
    return false;
  }

  for (const ignored of config.ignore) {
    if (typeof ignored === 'function' && error instanceof ignored) {
      return true;
    }
    if (typeof ignored === 'string' && error.name === ignored) {
      return true;
    }
  }

  // Express / http-errors style status codes under 500
  const status = error.status || error.statusCode;
  if (typeof status === 'number' && status < 500) {
    return true;
  }

  return false;
}

function buildPayload(error, config, context) {
  const culprit = firstCulprit(error);
  const payload = {
    event_id: randomUUID(),
    level: error.name === 'FatalError' ? 'fatal' : 'error',
    environment: String(config.environment || 'production'),
    platform: 'node',
    timestamp: new Date().toISOString(),
    culprit,
    exception: {
      type: error.name || 'Error',
      message: error.message || error.name || 'Error',
      file: relative(error.fileName || parseTopFrame(error).filename, config),
      line: error.lineNumber || parseTopFrame(error).lineno || 0,
      function: culprit,
    },
    stacktrace: frames(error, config),
    request: requestContext(context.req),
    user: userContext(context.user),
    sdk: { name: 'bugtrack-node', version: VERSION },
  };

  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== null && value !== undefined)
  );
}

function frames(error, config) {
  // V8 stacks already include the throw site as the first frame (unlike PHP
  // getTrace(), which omits it — so Laravel prepends it separately).
  return parseStack(error)
    .slice(0, MAX_FRAMES)
    .map((frame) => {
      const file = relative(frame.filename || '', config);
      return {
        filename: file,
        function: frame.function || '',
        lineno: frame.lineno || 0,
        in_app: isInApp(file),
      };
    });
}

function firstCulprit(error) {
  const top = parseStack(error)[0];
  return (top && top.function) || '';
}

function parseTopFrame(error) {
  return parseStack(error)[0] || { filename: '', lineno: 0, function: '' };
}

/**
 * Parse V8-style stack traces into frame objects.
 */
function parseStack(error) {
  if (!error || !error.stack) {
    return [];
  }

  const frames = [];
  const lines = String(error.stack).split('\n').slice(1);

  for (const line of lines) {
    const trimmed = line.trim();
    // at FunctionName (filename:line:col)
    let match = trimmed.match(/^at\s+(.*?)\s+\((.+):(\d+):(\d+)\)$/);
    if (match) {
      frames.push({
        function: match[1],
        filename: match[2],
        lineno: Number(match[3]),
      });
      continue;
    }

    // at filename:line:col
    match = trimmed.match(/^at\s+(.+):(\d+):(\d+)$/);
    if (match) {
      frames.push({
        function: '',
        filename: match[1],
        lineno: Number(match[2]),
      });
    }
  }

  return frames;
}

function isInApp(file) {
  if (!file) {
    return false;
  }
  const normalized = file.replace(/\\/g, '/');
  return (
    !normalized.includes('node_modules/') &&
    !normalized.startsWith('node:') &&
    normalized !== 'internal'
  );
}

function relative(file, config) {
  if (!file) {
    return '';
  }

  const normalized = path.resolve(file);
  const base = path.resolve(config.rootPath || process.cwd());

  if (normalized.startsWith(base + path.sep) || normalized === base) {
    return path.relative(base, normalized).replace(/\\/g, '/');
  }

  return normalized.replace(/\\/g, '/');
}

function requestContext(req) {
  if (!req) {
    return null;
  }

  const protocol =
    req.protocol ||
    (req.socket && req.socket.encrypted ? 'https' : 'http');
  const host = req.get ? req.get('host') : req.headers && req.headers.host;
  const originalUrl = req.originalUrl || req.url || '';
  const url = host ? `${protocol}://${host}${originalUrl}` : originalUrl;

  return {
    method: req.method || 'GET',
    url,
  };
}

function userContext(user) {
  if (!user) {
    return null;
  }

  const id =
    user.id !== undefined && user.id !== null
      ? String(user.id)
      : user._id !== undefined && user._id !== null
        ? String(user._id)
        : null;

  const email = user.email || null;

  if (!id && !email) {
    return null;
  }

  return Object.fromEntries(
    Object.entries({ id, email }).filter(
      ([, value]) => value !== null && value !== ''
    )
  );
}

function send(url, key, payload, config) {
  return new Promise((resolve) => {
    let body;
    try {
      body = JSON.stringify(payload);
    } catch {
      resolve();
      return;
    }

    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      resolve();
      return;
    }

    const transport = parsed.protocol === 'http:' ? http : https;
    const connectTimeoutMs = config.connectTimeoutMs || 2000;
    const timeoutMs = config.timeoutMs || 3000;

    const req = transport.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'http:' ? 80 : 443),
        path: `${parsed.pathname}${parsed.search}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'X-Bugtrack-Key': key,
        },
        timeout: timeoutMs,
      },
      (res) => {
        res.resume();
        res.on('end', resolve);
      }
    );

    const connectTimer = setTimeout(() => {
      req.destroy();
      resolve();
    }, connectTimeoutMs);

    req.on('socket', (socket) => {
      socket.setTimeout(timeoutMs);
      socket.on('timeout', () => {
        req.destroy();
        resolve();
      });
      socket.on('connect', () => clearTimeout(connectTimer));
    });

    req.on('error', () => {
      clearTimeout(connectTimer);
      resolve();
    });

    req.on('timeout', () => {
      clearTimeout(connectTimer);
      req.destroy();
      resolve();
    });

    req.write(body);
    req.end();
  });
}

module.exports = {
  report,
  buildPayload,
  isIgnored,
  normalizeError,
};
