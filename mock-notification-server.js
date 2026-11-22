// Mock Notification Server - simulates an EXTERNAL system that sends e-mails (no real mail is sent).
// Lives inside the project but is used only through its HTTP API:  POST /notifications/send  and  GET /notifications.
// Every request is logged as one new CSV row.   Run standalone: node mock-notification-server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CSV_FILE = process.env.NOTIFICATIONS_CSV || path.join(__dirname, 'data', 'notifications.csv');
const COLUMNS = ['messageId', 'buildingId', 'email', 'subject', 'dateTime', 'status', 'idempotencyKey'];

// ---------- CSV log ----------
const csvCell = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';

function appendRow(row) {
  fs.mkdirSync(path.dirname(CSV_FILE), { recursive: true });
  if (!fs.existsSync(CSV_FILE)) fs.writeFileSync(CSV_FILE, COLUMNS.join(',') + '\n', 'utf8');
  fs.appendFileSync(CSV_FILE, COLUMNS.map((c) => csvCell(row[c])).join(',') + '\n', 'utf8');
}

// Minimal CSV parser (quoted cells, "" escapes, newlines inside quotes).
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function readLog() {
  if (!fs.existsSync(CSV_FILE)) return [];
  const [header, ...rows] = parseCsv(fs.readFileSync(CSV_FILE, 'utf8'));
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

// ---------- behaviour mode (chosen from the notifications center) ----------
const MODES = {
  SUCCESS: 'Success',
  ALWAYS_FAIL: 'Always Fail',
  FAIL_FIRST_ATTEMPT: 'Fail First Attempt', // the first request of every building fails, the next ones succeed
  RANDOM_FAILURE: 'Random Failure (~30%)',
  RESPONSE_LOST: 'Response Lost (Timeout)', // the message IS sent and logged as SENT, but no answer ever reaches the caller
};
const RANDOM_FAILURE_RATE = 0.3;
let mode = 'SUCCESS';
const requestsPerBuilding = new Map(); // buildingId -> number of requests seen since the mode was set

function shouldFail(buildingId) {
  const seen = requestsPerBuilding.get(buildingId) || 0;
  requestsPerBuilding.set(buildingId, seen + 1);
  if (mode === 'ALWAYS_FAIL') return true;
  if (mode === 'FAIL_FIRST_ATTEMPT') return seen === 0;
  if (mode === 'RANDOM_FAILURE') return Math.random() < RANDOM_FAILURE_RATE;
  return false;
}

// ---------- API ----------
const json = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 50 * 1024) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error('Invalid JSON')); } });
  });
}

async function handle(req, res) {
  const { pathname } = new URL(req.url, 'http://localhost');

  if (pathname === '/notifications/send' && req.method === 'POST') {
    const b = await readBody(req);
    const missing = ['buildingId', 'email', 'subject', 'body', 'idempotencyKey'].filter((f) => typeof b[f] !== 'string' || !b[f].trim());
    if (missing.length) return json(res, 400, { error: 'Missing fields: ' + missing.join(', ') });

    // Idempotency: a message with this key was already SENT -> send nothing and log nothing.
    const previous = readLog().find((r) => r.idempotencyKey === b.idempotencyKey && r.status === 'SENT');
    if (previous) return json(res, 200, { status: 'ALREADY_SENT', messageId: previous.messageId });

    const status = mode !== 'RESPONSE_LOST' && shouldFail(b.buildingId) ? 'FAILED' : 'SENT';
    const messageId = 'MSG-' + crypto.randomUUID();
    appendRow({ messageId, buildingId: b.buildingId, email: b.email, subject: b.subject, dateTime: new Date().toISOString(), status, idempotencyKey: b.idempotencyKey });
    if (mode === 'RESPONSE_LOST') return req.socket.destroy(); // connection lost: the caller gets no answer
    return json(res, 200, { status, messageId });
  }

  if (pathname === '/notifications/mode' && req.method === 'GET') return json(res, 200, { mode, modes: MODES });
  if (pathname === '/notifications/mode' && req.method === 'PUT') {
    const b = await readBody(req);
    if (!MODES[b.mode]) return json(res, 400, { error: 'Unknown mode' });
    mode = b.mode;
    requestsPerBuilding.clear();
    return json(res, 200, { mode, modes: MODES });
  }

  if (pathname === '/notifications' && req.method === 'GET') return json(res, 200, readLog());

  json(res, 404, { error: 'Not found' });
}

function start(port) {
  return http.createServer((req, res) => handle(req, res).catch((e) => json(res, 400, { error: e.message })))
    .listen(port, () => console.log(`Mock Notification Server running at http://localhost:${port}`));
}

module.exports = { start };

if (require.main === module) start(process.env.MOCK_NOTIFICATION_PORT || 4000);
