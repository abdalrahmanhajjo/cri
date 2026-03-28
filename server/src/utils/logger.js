'use strict';

const useJson = process.env.LOG_FORMAT === 'json' || process.env.LOG_FORMAT === 'structured';

function basePayload(level, extra) {
  return {
    ts: new Date().toISOString(),
    level,
    ...extra,
  };
}

function logInfo(msg, extra = {}) {
  if (useJson) {
    console.log(JSON.stringify(basePayload('info', { msg, ...extra })));
  } else {
    console.log(msg, Object.keys(extra).length ? extra : '');
  }
}

function logWarn(msg, extra = {}) {
  if (useJson) {
    console.warn(JSON.stringify(basePayload('warn', { msg, ...extra })));
  } else {
    console.warn(msg, Object.keys(extra).length ? extra : '');
  }
}

function logError(msg, extra = {}) {
  if (useJson) {
    console.error(JSON.stringify(basePayload('error', { msg, ...extra })));
  } else {
    console.error(msg, Object.keys(extra).length ? extra : '');
  }
}

module.exports = { logInfo, logWarn, logError, useJson };
