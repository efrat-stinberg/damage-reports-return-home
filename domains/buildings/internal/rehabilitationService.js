// "שיקום מבנים" - all business logic about the rehabilitation readiness of a damaged building.
const { ServiceError } = require('../../../platform/errors');

const STATUSES = ['NEW', 'IN_REVIEW', 'REHAB_IN_PROGRESS', 'REHAB_COMPLETED'];
const STATUS_LABELS = {
  NEW: 'חדש',
  IN_REVIEW: 'בבדיקה',
  REHAB_IN_PROGRESS: 'מבנה בתהליך שיקום',
  REHAB_COMPLETED: 'תהליך שיקום הסתיים',
};
const REHAB_COMPLETED = 'REHAB_COMPLETED';

// Data that must exist before rehabilitation can start.
const REHAB_REQUIREMENTS = [
  { key: 'hasDamagePhotos', label: 'תמונות נזק' },
  { key: 'hasEngineerReport', label: 'דו"ח מהנדס' },
  { key: 'eligibilityChecked', label: 'בדיקת זכאות' },
];

// Labels of the requirements that are still missing.
function getMissingForRehabilitation(report) {
  return REHAB_REQUIREMENTS.filter((r) => report[r.key] !== true).map((r) => r.label);
}

// "ניתן להתחיל שיקום" vs "חסר מידע להתחלת שיקום"
function canStartRehabilitation(report) {
  return getMissingForRehabilitation(report).length === 0;
}

// "ממתין בתור לעבודה" requires an engineer report and a completed eligibility check.
const WORK_QUEUE_REQUIREMENTS = REHAB_REQUIREMENTS.filter((r) => r.key !== 'hasDamagePhotos');

function getMissingForWorkQueue(report) {
  return WORK_QUEUE_REQUIREMENTS.filter((r) => report[r.key] !== true).map((r) => r.label);
}

function isInWorkQueue(report) {
  return getMissingForWorkQueue(report).length === 0;
}

function isRehabilitationCompleted(report) {
  return report.status === REHAB_COMPLETED;
}

const statusLabel = (status) => STATUS_LABELS[status] || status;
const eligibilityLabel = (report) => (report.eligibilityChecked === true ? 'בוצעה' : 'לא בוצעה');

// Statuses as served to the UI.
const listStatuses = () => STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }));

function describe(report) {
  const missing = getMissingForRehabilitation(report);
  return { canStart: missing.length === 0, missing, inWorkQueue: isInWorkQueue(report) };
}

// ---------- state changes ----------
function setStatus(report, status) {
  if (!STATUSES.includes(status)) throw new ServiceError('status must be one of: ' + STATUSES.join(', '));
  report.status = status;
  return report;
}

function setEligibilityChecked(report, value) {
  if (typeof value !== 'boolean') throw new ServiceError('eligibilityChecked must be boolean');
  report.eligibilityChecked = value;
  return report;
}

module.exports = {
  REHAB_COMPLETED,
  getMissingForWorkQueue,
  isRehabilitationCompleted,
  statusLabel,
  eligibilityLabel,
  listStatuses,
  getMissingForRehabilitation,
  canStartRehabilitation,
  describe,
  setStatus,
  setEligibilityChecked,
};
