// SETTLEMENT PROCESSES domain.
// Owns: SettlementProcess records - one per activation of "generate return-home packages for a settlement".
// The work itself is done by the Buildings domain: each building is handled by Buildings' existing
// single-building mechanism, reached only through the Buildings public API.
// Public API (used by other domains): list(), getStats() -> { completed, processing, averageDurationMs }.
const { send, readJson } = require('../../platform/http');
const { ServiceError } = require('../../platform/errors');
const { requireUser } = require('../../platform/auth');
const store = require('./internal/processStore');
const logger = require('../../platform/logger');

const ALL_SETTLEMENTS = 'כל היישובים'; // an activation that is not limited to one settlement
const MAX_BUILDINGS = 500;

function create({ buildings, users }) {
  const api = { list: () => store.list(), getStats: () => store.stats() };

  function parse(body) {
    const name = body.settlementName;
    if (name !== undefined && name !== null && (typeof name !== 'string' || name.length > 100)) throw new ServiceError('settlementName is invalid');
    const ids = body.buildingIds;
    if (!Array.isArray(ids) || ids.length > MAX_BUILDINGS || ids.some((id) => typeof id !== 'string')) throw new ServiceError('buildingIds must be a list of building ids');
    return { settlementName: name && name.trim() ? name.trim() : ALL_SETTLEMENTS, buildingIds: [...new Set(ids)] };
  }

  // One activation: create the process, run the existing generation for every eligible building, close the process.
  async function run({ settlementName, buildingIds }, user) {
    const process = store.start({ settlementName, startedBy: user.fullName });
    let generated = 0, failed = 0, notificationFailed = 0;
    // Every record written while this process runs (PDF, notifications, retries, end) carries the process id.
    await logger.withContext({ processId: process.id, settlementName }, async () => {
      logger.info('settlement_process_started');
      try {
        const eligible = buildingIds.filter((id) => buildings.canGenerateReturnHomePackage(id));
        logger.info('eligible_buildings_found', { eligibleCount: eligible.length });
        const results = await Promise.allSettled(eligible.map((id) => buildings.generateReturnHomePackage(id)));
        generated = results.filter((r) => r.status === 'fulfilled').length;
        failed = results.length - generated; // per-building failures are handled (logged by Buildings) and counted
        // The package exists but the family was not reached (already logged as notification_failed by Buildings).
        notificationFailed = results.filter((r) => r.status === 'fulfilled' && !['SENT', 'ALREADY_SENT'].includes(r.value?.notification?.status)).length;
        logger.info('settlement_process_completed');
      } catch (e) {
        logger.error('settlement_process_failed', { errorMessage: e.message }); // unhandled failure of the whole process
        throw e;
      } finally {
        process.completedAt = store.complete(process.id).completedAt; // the process has ended
      }
    });
    return { process: { ...process, status: 'COMPLETED' }, generated, failed, notificationFailed };
  }

  async function handle(req, res, url) {
    if (url.pathname !== '/settlement-processes') return false;
    const user = requireUser(users, req, res);
    if (!user) return;
    if (req.method === 'GET') return send(res, 200, store.list());
    if (req.method === 'POST') return send(res, 201, await run(parse(await readJson(req)), user));
    send(res, 404, { error: 'Not found' });
  }

  return { api, handle };
}

module.exports = { create };
