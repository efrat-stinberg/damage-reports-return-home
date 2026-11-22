// MUNICIPAL APPROVALS domain (local authorities' portal team).
// Owns: municipal approvals. Reads buildings ONLY through the Buildings public API.
// Public API (used by other domains): CHECKS, getApproval(buildingId), saveApproval(buildingId, data, actor).
// Everything under ./internal is private to this domain.
const { send, readJson } = require('../../platform/http');
const { ServiceError } = require('../../platform/errors');
const { requireUser } = require('../../platform/auth');
const service = require('./internal/municipalApprovalService');

function create({ buildings, users, audit }) {
  const api = {
    CHECKS: service.CHECKS,
    getApproval: (buildingId) => service.get(buildingId),
    // actor = the logged-in user; the authority's yes/no is audited as approving / rejecting the building.
    saveApproval(buildingId, data, actor) {
      if (!buildings.exists(buildingId)) throw new ServiceError('Not found', 404);
      const saved = service.save(buildingId, data);
      audit.record({
        user: actor,
        action: saved.approved ? audit.ACTIONS.BUILDING_APPROVED : audit.ACTIONS.BUILDING_REJECTED,
        entityType: 'BUILDING',
        entityId: buildingId,
      });
      return saved;
    },
  };

  // Portal row: building summary (from the Buildings API) + this domain's approval.
  const row = (b) => {
    const approval = service.get(b.id);
    return { ...b, hasApproval: approval?.approved === true, hasRecord: !!approval, approval };
  };

  // HTTP API of the local authorities' portal (any logged-in user). Returns false when the path is not this domain's.
  async function handle(req, res, url) {
    if (!url.pathname.startsWith('/municipal/')) return false;
    const user = requireUser(users, req, res);
    if (!user) return;
    const parts = url.pathname.split('/').filter(Boolean); // ['municipal', 'buildings', id, 'approval']
    if (parts[1] !== 'buildings') return send(res, 404, { error: 'Not found' });
    if (parts.length === 2 && req.method === 'GET') return send(res, 200, buildings.listSummaries().map(row));
    const summary = buildings.getSummary(parts[2]);
    if (!summary) return send(res, 404, { error: 'Not found' });
    if (parts.length === 3 && req.method === 'GET') return send(res, 200, row(summary));
    if (parts.length === 4 && parts[3] === 'approval' && req.method === 'PUT') {
      api.saveApproval(summary.id, await readJson(req), user);
      return send(res, 200, row(summary));
    }
    send(res, 404, { error: 'Not found' });
  }

  return { api, handle };
}

module.exports = { create };
