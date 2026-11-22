// Audit log: one new record per user action; records are never changed or deleted.
const crypto = require('crypto');

// The actions that are audited (code -> label shown in the history).
const ACTIONS = {
  ASSESSMENT_UPDATED: 'עדכון שמאות',
  BUILDING_APPROVED: 'אישור מבנה',
  BUILDING_REJECTED: 'דחיית מבנה',
  BUDGET_REQUEST_OPENED: 'פתיחת בקשת תקציב',
};

const log = [];

function record({ user, action, entityType, entityId }) {
  if (!ACTIONS[action]) throw new Error('Unknown audited action: ' + action);
  const entry = {
    id: crypto.randomUUID(),
    userId: user.id,
    userName: user.fullName,
    action,
    entityType,
    entityId,
    timestamp: new Date().toISOString(),
  };
  log.push(entry);
  return { ...entry };
}

// Newest first, with the display label of the action.
const list = ({ entityType, entityId }) => log
  .filter((e) => e.entityType === entityType && e.entityId === entityId)
  .map((e) => ({ ...e, actionLabel: ACTIONS[e.action] }))
  .reverse();

module.exports = { ACTIONS, record, list };
