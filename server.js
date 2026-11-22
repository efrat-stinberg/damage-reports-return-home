// Damage Reports MVP. Run: node server.js
// Composition root: wires the business domains together and routes HTTP requests to them.
//   platform/                     shared kernel (http helpers, route guard, errors) - no business data
//   domains/users                 users, login / logout
//   domains/audit                 action log (who did what, when)
//   domains/buildings             buildings, rehabilitation, budget, return-home package, settlement-opening rule
//   domains/assessments           appraisers' assessments
//   domains/municipal-approvals   local authorities' approvals
//   domains/settlement-processes  one record per "generate packages for a settlement" activation
//   domains/system-health         health metrics calculated from the data the system collects
// Domains talk to each other ONLY through the public API each one exposes in its index.js.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { send } = require('./platform/http');

const PORT = process.env.PORT || 3000;

// Wiring (APIs are passed lazily because buildings <-> assessments/municipal reference each other).
const users = require('./domains/users').create();
const audit = require('./domains/audit').create({ users: users.api });
const buildings = require('./domains/buildings').create({ users: users.api, audit: audit.api, assessments: () => assessments.api, municipal: () => municipal.api });
const assessments = require('./domains/assessments').create({ buildings: buildings.api, users: users.api, audit: audit.api });
const municipal = require('./domains/municipal-approvals').create({ buildings: buildings.api, users: users.api, audit: audit.api });
const settlementProcesses = require('./domains/settlement-processes').create({ buildings: buildings.api, users: users.api });
const systemHealth = require('./domains/system-health').create({ settlementProcesses: settlementProcesses.api, users: users.api });

const handlers = [users.handle, audit.handle, assessments.handle, municipal.handle, settlementProcesses.handle, systemHealth.handle, buildings.handle];

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    for (const handler of handlers) if ((await handler(req, res, url)) !== false) return;
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
    }
    send(res, 404, { error: 'Not found' });
  } catch (e) {
    send(res, e.status || 400, { error: e.message, fields: e.fields });
  }
}).listen(PORT, () => {
  // The notification server is an external system: use NOTIFICATIONS_URL if given, otherwise start the bundled mock.
  if (!process.env.NOTIFICATIONS_URL) {
    const mockPort = process.env.MOCK_NOTIFICATION_PORT || Number(PORT) + 1000;
    process.env.NOTIFICATIONS_URL = `http://localhost:${mockPort}`;
    require('./mock-notification-server').start(mockPort);
  }
  console.log(`Damage Reports running at http://localhost:${PORT}`);
  if (process.env.SEED_DEMO) {
    require('./seed').seed(`http://localhost:${PORT}`).then((n) => console.log(`Demo data: ${n} buildings`)).catch((e) => console.error('Seed failed:', e.message));
  }
  console.log(users.startupHint());
});
