'use strict';

const { init, getConfig, setConfig, VERSION } = require('./config');
const { report } = require('./reporter');
const {
  errorHandler,
  requestHandler,
  captureProcessErrors,
} = require('./middleware');

module.exports = {
  init,
  getConfig,
  setConfig,
  report,
  errorHandler,
  requestHandler,
  captureProcessErrors,
  VERSION,
};
