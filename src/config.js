'use strict';

const DEFAULTS = {
  enabled: false,
  url: '',
  key: '',
  environment: process.env.NODE_ENV || 'production',
  ignore: [],
  connectTimeoutMs: 2000,
  timeoutMs: 3000,
  rootPath: process.cwd(),
};

let state = { ...DEFAULTS };

function envBool(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function envInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Merge options with environment defaults.
 * Env vars mirror the Laravel package:
 * BUGTRACK_ENABLED, BUGTRACK_URL, BUGTRACK_KEY / BUG_TRCAK_KEY,
 * BUGTRACK_ENVIRONMENT, BUGTRACK_CONNECT_TIMEOUT_MS, BUGTRACK_TIMEOUT_MS
 */
function init(options = {}) {
  state = {
    ...DEFAULTS,
    enabled: envBool(process.env.BUGTRACK_ENABLED, DEFAULTS.enabled),
    url: process.env.BUGTRACK_URL || DEFAULTS.url,
    key: process.env.BUGTRACK_KEY || process.env.BUG_TRCAK_KEY || DEFAULTS.key,
    environment:
      process.env.BUGTRACK_ENVIRONMENT ||
      process.env.NODE_ENV ||
      DEFAULTS.environment,
    connectTimeoutMs: envInt(
      process.env.BUGTRACK_CONNECT_TIMEOUT_MS,
      DEFAULTS.connectTimeoutMs
    ),
    timeoutMs: envInt(process.env.BUGTRACK_TIMEOUT_MS, DEFAULTS.timeoutMs),
    ...options,
    ignore: Array.isArray(options.ignore) ? options.ignore : DEFAULTS.ignore,
  };

  return getConfig();
}

function getConfig() {
  return { ...state, ignore: [...state.ignore] };
}

function setConfig(patch = {}) {
  state = {
    ...state,
    ...patch,
    ignore: Array.isArray(patch.ignore) ? patch.ignore : state.ignore,
  };

  return getConfig();
}

module.exports = {
  init,
  getConfig,
  setConfig,
  VERSION: '1.0.0',
};
