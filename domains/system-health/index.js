// SYSTEM HEALTH domain. Owns: nothing - it only calculates a snapshot from data other parts already collect.
// Reads settlement process statistics through the Settlement Processes public API and the technical log.
const { send } = require('../../platform/http');
const { requireUser } = require('../../platform/auth');
const logger = require('../../platform/logger');
const { calculate } = require('./internal/healthMetrics');

function create({ settlementProcesses, users }) {
  // GET /system-health (any logged-in user)
  async function handle(req, res, url) {
    if (url.pathname !== '/system-health') return false;
    if (!requireUser(users, req, res)) return;
    if (req.method !== 'GET') return send(res, 404, { error: 'Not found' });
    return send(res, 200, calculate({ processStats: settlementProcesses.getStats(), logRecords: logger.readAll() }));
  }
  return { handle };
}

module.exports = { create };
