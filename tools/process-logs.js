// Finds the log lines of one settlement activation (SettlementProcess) by its id.
//   node tools/process-logs.js              -> lists the activations found in the log (processId, settlement, start time)
//   node tools/process-logs.js <processId>  -> prints every log line of that activation (an id prefix is enough)
const fs = require('fs');
const logger = require('../platform/logger');

if (!fs.existsSync(logger.LOG_FILE)) { console.error('No log file yet: ' + logger.LOG_FILE); process.exit(1); }
const records = fs.readFileSync(logger.LOG_FILE, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const wanted = process.argv[2];

if (!wanted) {
  for (const r of records.filter((x) => x.event === 'settlement_process_started')) console.log(`${r.processId}  ${r.timestamp}  ${r.settlementName}`);
  process.exit(0);
}
const lines = records.filter((r) => r.processId && r.processId.startsWith(wanted));
if (!lines.length) { console.error('No log lines for process ' + wanted); process.exit(1); }
for (const r of lines) {
  const extra = [r.buildingId && `building=${r.buildingId}`, r.notificationAttempt && `attempt=${r.notificationAttempt}`, r.eligibleCount !== undefined && `eligible=${r.eligibleCount}`, r.errorMessage && `error="${r.errorMessage}"`].filter(Boolean).join(' ');
  console.log(`${r.timestamp} ${r.level.padEnd(5)} ${r.event} ${extra}`.trimEnd());
}
