// "אישור רשות מקומית" - the local authorities' data and rules. This domain owns municipal approvals and nothing else.
const { ServiceError } = require('../../../platform/errors');

const CHECKS = [
  { key: 'waterOk', label: 'אספקת מים תקינה' },
  { key: 'electricityOk', label: 'אספקת חשמל תקינה' },
  { key: 'accessRoadsOpen', label: 'דרכי גישה פתוחות' },
  { key: 'hazardsCleared', label: 'מפגעים סביבתיים פונו' },
];
const MAX_NOTES = 1000;

const store = new Map(); // buildingId -> approval (the only copy of this data)

// Copies are returned so callers can never modify the stored data.
const get = (buildingId) => (store.has(buildingId) ? { ...store.get(buildingId) } : null);

function save(buildingId, data) {
  const errors = {};
  for (const c of CHECKS) if (typeof data[c.key] !== 'boolean') errors[c.key] = 'ערך לא חוקי';
  const notes = typeof data.notes === 'string' ? data.notes.trim() : '';
  if (data.notes !== undefined && typeof data.notes !== 'string') errors.notes = 'ערך לא חוקי';
  else if (notes.length > MAX_NOTES) errors.notes = `הערות ארוכות מדי (עד ${MAX_NOTES} תווים)`;
  if (typeof data.approved !== 'boolean') errors.approved = 'יש לסמן אישור רשות מקומית: כן / לא';
  if (Object.keys(errors).length) throw Object.assign(new ServiceError('יש לתקן את השדות המסומנים', 400), { fields: errors });

  store.set(buildingId, {
    ...Object.fromEntries(CHECKS.map((c) => [c.key, data[c.key]])),
    notes,
    approved: data.approved,
    updatedAt: new Date().toISOString(),
  });
  return get(buildingId);
}

module.exports = { CHECKS, get, save };
