// AUDIT domain. Owns: the action log (who did what, on which entity, when).
// Public API (used by other domains): ACTIONS, record({ user, action, entityType, entityId }).
const { send } = require('../../platform/http');
const { requireUser } = require('../../platform/auth');
const auditLog = require('./internal/auditLog');

function create({ users }) {
  const api = {
    ACTIONS: Object.fromEntries(Object.keys(auditLog.ACTIONS).map((k) => [k, k])),
    record: auditLog.record,
  };

  // GET /audit?entityType=BUILDING&entityId=<id> - the history of one entity (any logged-in user).
  async function handle(req, res, url) {
    if (url.pathname !== '/audit') return false;
    if (!requireUser(users, req, res)) return;
    if (req.method !== 'GET') return send(res, 404, { error: 'Not found' });
    const entityType = url.searchParams.get('entityType'), entityId = url.searchParams.get('entityId');
    if (!entityType || !entityId) return send(res, 400, { error: 'entityType and entityId are required' });
    return send(res, 200, auditLog.list({ entityType, entityId }));
  }

  return { api, handle };
}

module.exports = { create };
