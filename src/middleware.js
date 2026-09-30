'use strict';

const { report } = require('./reporter');

/**
 * Express error middleware — call after all routes:
 *
 *   app.use(bugtrack.errorHandler());
 *   app.use(yourFallbackErrorHandler);
 *
 * Passes the error through with next(err) so existing handlers still run.
 */
function errorHandler(options = {}) {
  return function bugtrackErrorHandler(err, req, res, next) {
    const user =
      typeof options.getUser === 'function'
        ? options.getUser(req)
        : req.user || null;

    // Fire-and-forget; never block the response path
    Promise.resolve(report(err, { req, user })).catch(() => {});

    next(err);
  };
}

/**
 * Optional request middleware that attaches req.bugtrack.report(error).
 */
function requestHandler() {
  return function bugtrackRequestHandler(req, res, next) {
    req.bugtrack = {
      report(error, extra = {}) {
        return report(error, { req, user: req.user || null, ...extra });
      },
    };
    next();
  };
}

/**
 * Capture process-level failures. Call once after init().
 */
function captureProcessErrors() {
  process.on('uncaughtException', (error) => {
    Promise.resolve(report(error)).catch(() => {});
  });

  process.on('unhandledRejection', (reason) => {
    const error =
      reason instanceof Error ? reason : new Error(String(reason));
    Promise.resolve(report(error)).catch(() => {});
  });
}

module.exports = {
  errorHandler,
  requestHandler,
  captureProcessErrors,
};
