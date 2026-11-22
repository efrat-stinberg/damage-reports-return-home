// ASSESSMENTS domain (appraisers' portal team).
// Owns: appraiser assessments. Reads buildings ONLY through the Buildings public API.
// Public API (used by other domains): DAMAGE_LEVELS, getAssessment(buildingId), saveAssessment(buildingId, data, actor).
// Everything under ./internal is private to this domain.
const { send, readJson } = require('../../platform/http');
const { ServiceError } = require('../../platform/errors');
const { requireUser } = require('../../platform/auth');
const service = require('./internal/assessmentService');

function create({ buildings, users, audit }) {
  const api = {
    DAMAGE_LEVELS: service.DAMAGE_LEVELS,
    getAssessment: (buildingId) => service.get(buildingId),
    // actor = the logged-in user; every save is written to the audit log.
    saveAssessment(buildingId, data, actor) {
      if (!buildings.exists(buildingId)) throw new ServiceError('Not found', 404);
      const saved = service.save(buildingId, data);
      audit.record({ user: actor, action: audit.ACTIONS.ASSESSMENT_UPDATED, entityType: 'BUILDING', entityId: buildingId });
      return saved;
    },
  };

  // Portal row: building summary (from the Buildings API) + this domain's assessment.
  const row = (b) => ({ ...b, hasAssessment: !!service.get(b.id), assessment: service.get(b.id) });

  // HTTP API of the appraisers' portal (any logged-in user). Returns false when the path is not this domain's.
  async function handle(req, res, url) {
    if (!url.pathname.startsWith('/assessor/')) return false;
    const user = requireUser(users, req, res);
    if (!user) return;
    const parts = url.pathname.split('/').filter(Boolean); // ['assessor', 'buildings', id, 'assessment']
    if (parts[1] !== 'buildings') return send(res, 404, { error: 'Not found' });
    if (parts.length === 2 && req.method === 'GET') return send(res, 200, buildings.listSummaries().map(row));
    const summary = buildings.getSummary(parts[2]);
    if (!summary) return send(res, 404, { error: 'Not found' });
    if (parts.length === 3 && req.method === 'GET') return send(res, 200, row(summary));
    if (parts.length === 4 && parts[3] === 'assessment' && req.method === 'PUT') {
      api.saveAssessment(summary.id, await readJson(req), user);
      return send(res, 200, row(summary));
    }
    send(res, 404, { error: 'Not found' });
  }

  return { api, handle };
}

module.exports = { create };
