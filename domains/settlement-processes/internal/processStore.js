// The only place that holds SettlementProcess records (in-memory).
const crypto = require('crypto');

const processes = []; // oldest first

// SettlementProcess: { id, settlementName, startedBy, startedAt, completedAt, status: PROCESSING | COMPLETED }
function start({ settlementName, startedBy }) {
  const p = { id: crypto.randomUUID(), settlementName, startedBy, startedAt: new Date().toISOString(), completedAt: null, status: 'PROCESSING' };
  processes.push(p);
  return { ...p };
}

function complete(id) {
  const p = processes.find((x) => x.id === id);
  p.completedAt = new Date().toISOString();
  p.status = 'COMPLETED';
  return { ...p };
}

// Newest first; copies, so callers cannot change the stored records.
const list = () => processes.map((p) => ({ ...p })).reverse();

// Counts and the average duration (ms) of completed processes (null when none has completed yet).
function stats() {
  const done = processes.filter((p) => p.status === 'COMPLETED');
  const total = done.reduce((sum, p) => sum + (Date.parse(p.completedAt) - Date.parse(p.startedAt)), 0);
  return { completed: done.length, processing: processes.length - done.length, averageDurationMs: done.length ? total / done.length : null };
}

module.exports = { start, complete, list, stats };
