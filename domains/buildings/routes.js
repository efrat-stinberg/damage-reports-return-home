// HTTP API of the Buildings domain: damage reports / buildings, rehabilitation, budget, return-home package,
// family notifications center and the shared UI metadata.
const fs = require('fs');
const { send, readJson } = require('../../platform/http');
const { requireUser } = require('../../platform/auth');
const store = require('./internal/store');
const collaborators = require('./internal/collaborators');
const buildingService = require('./internal/buildingService');
const rehabilitation = require('./internal/rehabilitationService');
const budget = require('./internal/budgetService');
const returnHomePackage = require('./internal/returnHomePackageService');
const settlementOpening = require('./internal/settlementOpeningService');
const familyNotification = require('./internal/familyNotificationService');
const { getSettlement } = require('./internal/addressService');

// Building as sent to staff: own data + conclusions computed by this domain's services, plus the data of the
// other domains obtained through THEIR public APIs (the UI only renders it).
const view = (b) => ({
  ...b,
  rehabilitation: rehabilitation.describe(b),
  budget: budget.describe(b),
  returnHomePackage: returnHomePackage.describe(b),
  settlement: getSettlement(b.address),
  assessment: collaborators.assessments().getAssessment(b.id),
  municipalApproval: collaborators.municipal().getApproval(b.id),
  settlementOpening: settlementOpening.describe(b),
});

// deps: { users, audit } - public APIs of the Users and Audit domains.
let deps;

// Returns false when the path does not belong to this domain.
async function handle(req, res, url) {
  const { pathname } = url;
  const parts = pathname.split('/').filter(Boolean);

  // ---- shared UI metadata ----
  if (pathname === '/meta' && req.method === 'GET') {
    return send(res, 200, {
      statuses: rehabilitation.listStatuses(),
      damageLevels: collaborators.assessments().DAMAGE_LEVELS,
      municipalChecks: collaborators.municipal().CHECKS,
      damageTypes: buildingService.DAMAGE_TYPES,
      rules: Object.fromEntries(Object.entries(buildingService.RULES).map(([k, r]) => [k, { min: r.min, max: r.max }])),
    });
  }

  // ---- return-home package ----
  if (pathname.startsWith('/buildings/')) {
    if (!requireUser(deps.users, req, res)) return;
    if (parts.length === 3 && parts[2] === 'return-home-package' && req.method === 'POST') {
      const building = store.get(parts[1]);
      if (!building) return send(res, 404, { error: 'Not found' });
      return send(res, 201, await returnHomePackage.generate(building));
    }
    return send(res, 404, { error: 'Not found' });
  }
  if (pathname.startsWith('/files/')) {
    if (!requireUser(deps.users, req, res)) return;
    if (req.method !== 'GET' || !pathname.startsWith(returnHomePackage.URL_PREFIX)) return send(res, 404, { error: 'Not found' });
    const file = returnHomePackage.resolveFile(pathname.slice(returnHomePackage.URL_PREFIX.length));
    if (!file) return send(res, 404, { error: 'Not found' });
    res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="return-home-package.pdf"', 'Cache-Control': 'no-store' });
    return fs.createReadStream(file).pipe(res);
  }

  // ---- notifications center ----
  if (pathname.startsWith('/notification-center')) {
    if (!requireUser(deps.users, req, res)) return;
    if (pathname === '/notification-center' && req.method === 'GET') {
      return send(res, 200, await familyNotification.getLog((id) => store.get(id)?.address || ''));
    }
    if (pathname === '/notification-center/mode' && req.method === 'GET') return send(res, 200, await familyNotification.getMode());
    if (pathname === '/notification-center/mode' && req.method === 'PUT') {
      return send(res, 200, await familyNotification.setMode((await readJson(req)).mode));
    }
    return send(res, 404, { error: 'Not found' });
  }

  // ---- reports / buildings ----
  if (pathname !== '/reports' && !pathname.startsWith('/reports/')) return false;

  // Citizens: submit a new report (public)
  if (parts.length === 1 && req.method === 'POST') {
    const { errors, building } = buildingService.create(await readJson(req));
    if (errors) return send(res, 400, { error: 'יש לתקן את השדות המסומנים', fields: errors });
    return send(res, 201, { id: building.id, status: building.status });
  }

  // Everything below needs a logged-in user
  const user = requireUser(deps.users, req, res);
  if (!user) return;
  if (parts.length === 1 && req.method === 'GET') return send(res, 200, store.list().map(view));

  const building = store.get(parts[1]);
  if (parts.length >= 2 && !building) return send(res, 404, { error: 'Not found' });
  if (parts.length === 2 && req.method === 'GET') return send(res, 200, view(building));

  // Rehabilitation (שיקום מבנים)
  if (parts.length === 3 && parts[2] === 'status' && req.method === 'PATCH') {
    return send(res, 200, view(rehabilitation.setStatus(building, (await readJson(req)).status)));
  }
  if (parts.length === 3 && parts[2] === 'eligibility' && req.method === 'PATCH') {
    return send(res, 200, view(rehabilitation.setEligibilityChecked(building, (await readJson(req)).eligibilityChecked)));
  }

  // Budget (תקציב)
  if (parts.length === 3 && parts[2] === 'social-approval' && req.method === 'PATCH') {
    return send(res, 200, view(budget.setSocialApproval(building, (await readJson(req)).socialApproval)));
  }
  if (parts.length === 3 && parts[2] === 'budget-request' && req.method === 'POST') {
    const opened = budget.openRequest(building);
    deps.audit.record({ user, action: deps.audit.ACTIONS.BUDGET_REQUEST_OPENED, entityType: 'BUILDING', entityId: building.id });
    return send(res, 201, view(opened));
  }
  if (parts.length === 4 && parts[2] === 'budget-request' && parts[3] === 'approve' && req.method === 'POST') {
    return send(res, 200, view(budget.approveRequest(building)));
  }

  send(res, 404, { error: 'Not found' });
}

module.exports = { create: (injected) => { deps = injected; return handle; } };
