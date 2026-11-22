// "הערכת שמאי" - the appraisers' data and rules. This domain owns assessments and nothing else.
const { ServiceError } = require('../../../platform/errors');

const DAMAGE_LEVELS = [
  { value: 'LIGHT', label: 'קל' },
  { value: 'MEDIUM', label: 'בינוני' },
  { value: 'SEVERE', label: 'חמור' },
];
const MAX_NOTES = 1000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const store = new Map(); // buildingId -> assessment (the only copy of this data)

// Copies are returned so callers can never modify the stored data.
const get = (buildingId) => (store.has(buildingId) ? { ...store.get(buildingId) } : null);

// Validates the portal form and stores the assessment (a new save replaces the previous one).
function save(buildingId, data) {
  const errors = {};
  if (!DAMAGE_LEVELS.some((l) => l.value === data.damageLevel)) errors.damageLevel = 'יש לבחור דרגת נזק';
  const notes = typeof data.notes === 'string' ? data.notes.trim() : '';
  if (data.notes !== undefined && typeof data.notes !== 'string') errors.notes = 'ערך לא חוקי';
  else if (notes.length > MAX_NOTES) errors.notes = `הערות ארוכות מדי (עד ${MAX_NOTES} תווים)`;
  if (typeof data.inspectionDate !== 'string' || !DATE_PATTERN.test(data.inspectionDate) || Number.isNaN(Date.parse(data.inspectionDate))) {
    errors.inspectionDate = 'יש להזין תאריך בדיקה תקין';
  } else if (data.inspectionDate > new Date().toISOString().slice(0, 10)) {
    errors.inspectionDate = 'תאריך הבדיקה לא יכול להיות בעתיד';
  }
  if (typeof data.requiresReinspection !== 'boolean') errors.requiresReinspection = 'יש לציין אם נדרשת בדיקה חוזרת';
  if (Object.keys(errors).length) throw Object.assign(new ServiceError('יש לתקן את השדות המסומנים', 400), { fields: errors });

  store.set(buildingId, {
    damageLevel: data.damageLevel,
    notes,
    inspectionDate: data.inspectionDate,
    requiresReinspection: data.requiresReinspection,
    updatedAt: new Date().toISOString(),
  });
  return get(buildingId);
}

module.exports = { DAMAGE_LEVELS, get, save };
