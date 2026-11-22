// Building (damage report) data: validation and creation. Owned by the Buildings domain.
const crypto = require('crypto');
const store = require('./store');

const DAMAGE_TYPES = ['נזקי מים / הצפה', 'שריפה', 'נזק מבני', 'חשמל', 'סערה', 'ונדליזם', 'אחר'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RULES = {
  reporterName: { label: 'שם המדווח', min: 2, max: 60, pattern: /^[\p{L}][\p{L}\s'".\-]*$/u, patternMsg: 'השם יכול להכיל אותיות בלבד' },
  address: { label: 'כתובת', min: 5, max: 120 },
  description: { label: 'תיאור', min: 10, max: 1000 },
};

function validate(b) {
  const errors = {};
  for (const [f, r] of Object.entries(RULES)) {
    const v = typeof b[f] === 'string' ? b[f].trim().replace(/\s+/g, ' ') : '';
    if (!v) errors[f] = 'שדה חובה';
    else if (v.length < r.min) errors[f] = `${r.label} קצר מדי (לפחות ${r.min} תווים)`;
    else if (v.length > r.max) errors[f] = `${r.label} ארוך מדי (עד ${r.max} תווים)`;
    else if (r.pattern && !r.pattern.test(v)) errors[f] = r.patternMsg;
  }
  const dt = typeof b.damageType === 'string' ? b.damageType.trim() : '';
  if (!dt) errors.damageType = 'שדה חובה';
  else if (!DAMAGE_TYPES.includes(dt)) errors.damageType = 'סוג נזק לא חוקי';
  if (b.hasDamagePhotos !== undefined && typeof b.hasDamagePhotos !== 'boolean') errors.hasDamagePhotos = 'ערך לא חוקי';
  if (b.hasEngineerReport !== undefined && typeof b.hasEngineerReport !== 'boolean') errors.hasEngineerReport = 'ערך לא חוקי';
  const email = typeof b.familyEmail === 'string' ? b.familyEmail.trim() : '';
  if (!email) errors.familyEmail = 'שדה חובה';
  else if (email.length > 254 || !EMAIL_PATTERN.test(email)) errors.familyEmail = 'כתובת אימייל לא תקינה';
  const n = b.apartmentCount;
  if (n === undefined || n === null || n === '') errors.apartmentCount = 'שדה חובה';
  else if (!Number.isInteger(n) || n < 1 || n > 500) errors.apartmentCount = 'מספר דירות חייב להיות מספר שלם בין 1 ל-500';
  return errors;
}

// Returns { errors } when invalid, otherwise { building } (already stored).
function create(b) {
  const errors = validate(b);
  if (Object.keys(errors).length) return { errors };
  const building = {
    id: crypto.randomUUID(),
    reporterName: b.reporterName.trim().replace(/\s+/g, ' '),
    address: b.address.trim().replace(/\s+/g, ' '),
    damageType: b.damageType.trim(),
    description: b.description.trim(),
    hasDamagePhotos: b.hasDamagePhotos === true,
    hasEngineerReport: b.hasEngineerReport === true,
    familyEmail: b.familyEmail.trim().toLowerCase(),
    apartmentCount: b.apartmentCount,
    eligibilityChecked: false, // set by Housing Ministry staff only
    socialApproval: false, // set by Housing Ministry staff only
    status: 'NEW',
    createdAt: new Date().toISOString(),
  };
  store.set(building.id, building);
  return { building };
}

module.exports = { DAMAGE_TYPES, RULES, create };
