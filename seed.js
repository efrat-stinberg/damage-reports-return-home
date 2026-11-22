// Demo data through the real API (so every business rule is exercised). Usage: node seed.js [baseUrl]
// Also run automatically by `npm run demo` (SEED_DEMO=1 node server.js).
const STREETS = ['יפו', 'המלך ג\'ורג\'', 'עזה', 'בן יהודה', 'הנביאים', 'אגריפס', 'קינג דיוויד', 'שמאי', 'הלל', 'דוד ילין', 'האר"י', 'הפלמ"ח', 'בצלאל', 'חברון', 'קרן היסוד', 'עמק רפאים', 'אבן גבירול', 'תרע"ט', 'שטראוס', 'הרצל'];
const DAMAGE = ['נזקי מים / הצפה', 'שריפה', 'נזק מבני', 'חשמל', 'סערה'];

// 10 reasons why a building is NOT eligible (one each), plus an "eligible" profile.
const NOT_ELIGIBLE = [
  { engineer: false, eligibility: true, budget: false, status: 'REHAB_COMPLETED' },  // no engineer report (so no budget request either)
  { engineer: true, eligibility: false, budget: false, status: 'REHAB_COMPLETED' },  // no eligibility check (so no budget either)
  { engineer: true, eligibility: true, budget: false, status: 'REHAB_COMPLETED' },   // no budget request
  { engineer: true, eligibility: true, budget: true, status: 'REHAB_IN_PROGRESS' },   // rehab still in progress
  { engineer: true, eligibility: true, budget: true, status: 'IN_REVIEW' },
  { engineer: true, eligibility: true, budget: true, status: 'NEW' },
  { engineer: false, eligibility: false, budget: false, status: 'NEW' },
  { engineer: false, eligibility: true, budget: false, status: 'REHAB_IN_PROGRESS' },
  { engineer: true, eligibility: false, budget: false, status: 'IN_REVIEW' },
  { engineer: true, eligibility: true, budget: false, status: 'REHAB_IN_PROGRESS' },
];
const ELIGIBLE = { engineer: true, eligibility: true, budget: true, status: 'REHAB_COMPLETED' };

async function seed(base = 'http://localhost:3000', { password = process.env.STAFF_PASSWORD || 'housing123' } = {}) {
  const call = async (method, url, body, token) => {
    const res = await fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${data.error || ''}`);
    return data;
  };
  // Each portal's data is entered by its own user, so the action history shows realistic users.
  const login = async (username, pw) => (await call('POST', '/auth/login', { username, password: pw })).token;
  const token = await login('staff', password);
  const assessorToken = await login('assessor', 'assessor123');
  const municipalToken = await login('municipal', 'municipal123');

  let n = 0;
  async function building(city, profile, i, portals = {}) {
    const aptCount = 4 + ((i * 7) % 20); // 4..23: never needs a social approval
    const { id } = await call('POST', '/reports', {
      reporterName: ['דנה כהן', 'יוסי לוי', 'מיכל אברהם', 'רונית מזרחי', 'אבי ביטון'][i % 5],
      familyEmail: `family${i + 1}@example.com`,
      address: `רחוב ${STREETS[i % STREETS.length]} ${1 + ((i * 3) % 40)}, ${city}`,
      damageType: DAMAGE[i % DAMAGE.length],
      description: `נזק לבניין מספר ${i + 1} בישוב ${city}, נדרש טיפול.`,
      hasDamagePhotos: true,
      hasEngineerReport: profile.engineer,
      apartmentCount: aptCount,
    });
    const P = (m, u, b) => call(m, `/reports/${id}${u}`, b, token);
    if (profile.eligibility) await P('PATCH', '/eligibility', { eligibilityChecked: true });
    if (profile.budget) await P('POST', '/budget-request');
    if (profile.status !== 'NEW') await P('PATCH', '/status', { status: profile.status });
    // appraiser + local authority portals (public APIs)
    if (portals.assess) await call('PUT', `/assessor/buildings/${id}/assessment`, { damageLevel: portals.assess, notes: 'הערכה לדוגמה', inspectionDate: new Date().toISOString().slice(0, 10), requiresReinspection: false }, assessorToken);
    if (portals.muni !== undefined) await call('PUT', `/municipal/buildings/${id}/approval`, { waterOk: true, electricityOk: true, accessRoadsOpen: portals.muni, hazardsCleared: true, notes: '', approved: portals.muni }, municipalToken);
    n++;
  }
  // Settlement-opening demo: after "generate all packages", only the first 6 Jerusalem buildings are ready to open.
  const JERUSALEM_PORTALS = [
    { assess: 'LIGHT', muni: true }, { assess: 'MEDIUM', muni: true }, { assess: 'LIGHT', muni: true },
    { assess: 'MEDIUM', muni: true }, { assess: 'LIGHT', muni: true }, { assess: 'MEDIUM', muni: true },
    { assess: 'SEVERE', muni: true },   // severe damage
    { muni: true },                     // no assessment yet
    { assess: 'LIGHT' },                // no local authority answer yet
    { assess: 'MEDIUM', muni: false },  // authority answered "no"
  ];

  // Jerusalem: 20 buildings = 10 eligible + 10 not eligible
  for (let i = 0; i < 10; i++) await building('ירושלים', ELIGIBLE, i, JERUSALEM_PORTALS[i]);
  for (let i = 0; i < 10; i++) await building('ירושלים', NOT_ELIGIBLE[i], 10 + i, i % 2 === 0 ? { assess: 'LIGHT', muni: true } : {});
  // Tel Aviv: 4 buildings (2 eligible) - to try the settlement filter
  for (let i = 0; i < 2; i++) await building('תל אביב', ELIGIBLE, 20 + i, { assess: 'LIGHT', muni: true });
  for (let i = 0; i < 2; i++) await building('תל אביב', NOT_ELIGIBLE[i], 22 + i);
  return n;
}

module.exports = { seed };

if (require.main === module) {
  seed(process.argv[2]).then((n) => console.log(`Seeded ${n} buildings`)).catch((e) => { console.error(e.message); process.exit(1); });
}
