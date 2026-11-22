// Technical logging (platform kernel). Plain Node, no dependencies: one JSON object per line (JSON Lines)
// appended to a file that can be opened at any time:  logs/settlement-processes.log
// Never write passwords, tokens, e-mail addresses or document contents here - only ids and technical messages.
const fs = require('fs');
const path = require('path');
const { AsyncLocalStorage } = require('async_hooks');

const LOG_FILE = process.env.SETTLEMENT_LOG_FILE || path.join(__dirname, '..', 'logs', 'settlement-processes.log');
const context = new AsyncLocalStorage(); // values every record written inside withContext() should carry

// Runs fn with extra context (e.g. { settlementName }, { buildingId }); nested calls add to the outer context.
const withContext = (ctx, fn) => context.run({ ...context.getStore(), ...ctx }, fn);

// A record: timestamp, level (INFO | WARN | ERROR), event + the relevant ones of:
// processId (the SettlementProcess it belongs to), settlementName, buildingId, notificationAttempt, errorMessage
// (+ eligibleCount on the "eligible buildings" event).
function write(level, event, fields = {}) {
  const record = { timestamp: new Date().toISOString(), level, event, ...context.getStore(), ...fields };
  if (record.errorMessage) record.errorMessage = String(record.errorMessage).slice(0, 300);
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, JSON.stringify(record) + '\n', 'utf8');
  } catch (e) {
    console.error('Logging failed:', e.message); // logging must never break the business flow
  }
}

// All records written so far (corrupt lines are skipped).
function readAll() {
  if (!fs.existsSync(LOG_FILE)) return [];
  return fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean).flatMap((line) => { try { return [JSON.parse(line)]; } catch { return []; } });
}

module.exports = {
  LOG_FILE,
  readAll,
  withContext,
  info: (event, fields) => write('INFO', event, fields),
  warn: (event, fields) => write('WARN', event, fields),
  error: (event, fields) => write('ERROR', event, fields),
};
