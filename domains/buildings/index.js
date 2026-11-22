// BUILDINGS domain (Housing Ministry).
// Owns: building data, the rehabilitation process, budget requests, return-home packages, family notifications
// and the "ready to open a settlement" calculation.
// Reads assessments and municipal approvals ONLY through those domains' public APIs (injected via `create`).
// Public API (used by other domains): exists(id), getSummary(id), listSummaries() - read-only copies;
// canGenerateReturnHomePackage(id), generateReturnHomePackage(id) - the existing single-building return-home mechanism.
// Everything under ./internal is private to this domain.
const store = require('./internal/store');
const collaborators = require('./internal/collaborators');
const { getSettlement } = require('./internal/addressService');
const routes = require('./routes');
const returnHomePackage = require('./internal/returnHomePackageService');
const { ServiceError } = require('../../platform/errors');

// deps: { users, audit, assessments: () => AssessmentsApi, municipal: () => MunicipalApprovalsApi }
// (assessments / municipal are lazy, to allow the mutual references)
function create(deps) {
  collaborators.set(deps);

  const summary = (b) => ({ id: b.id, address: b.address, settlement: getSettlement(b.address), status: b.status });
  const api = {
    exists: (id) => store.has(id),
    getSummary: (id) => (store.has(id) ? summary(store.get(id)) : null),
    listSummaries: () => store.list().map(summary),
    canGenerateReturnHomePackage: (id) => store.has(id) && returnHomePackage.canGenerate(store.get(id)),
    generateReturnHomePackage(id) {
      if (!store.has(id)) throw new ServiceError('Not found', 404);
      return returnHomePackage.generate(store.get(id));
    },
  };

  return { api, handle: routes.create({ users: deps.users, audit: deps.audit }) };
}

module.exports = { create };
