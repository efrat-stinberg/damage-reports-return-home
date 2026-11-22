// "שרות תיק אכלוס" - eligibility to issue a "return home" package and generation of its PDF.
// Business rules are NOT duplicated here: they are composed from the rehabilitation and budget services.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ServiceError } = require('../../../platform/errors');
const rehabilitation = require('./rehabilitationService');
const budget = require('./budgetService');
const pdf = require('./returnHomePackagePdf');
const familyNotification = require('./familyNotificationService');
const logger = require('../../../platform/logger');

const OUTPUT_DIR = path.join(__dirname, '..', '..', '..', 'generated', 'return-home-packages');
const URL_PREFIX = '/files/return-home-packages/';
const FILE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/;
const SIMULATED_PROCESSING_MS = 1000; // simulates producing a complex document

// What still prevents issuing the package (empty array = allowed).
function getBlockers(report) {
  const blockers = [];
  const missing = rehabilitation.getMissingForWorkQueue(report); // engineer report + eligibility check
  if (missing.length) blockers.push(...missing);
  if (!budget.hasRequest(report)) blockers.push('בקשת תקציב');
  if (!rehabilitation.isRehabilitationCompleted(report)) {
    blockers.push(`סטטוס "${rehabilitation.statusLabel(rehabilitation.REHAB_COMPLETED)}"`);
  }
  return blockers;
}

// Was a package already issued for this building?
const isIssued = (report) => !!report.returnHomePackageFile;

const canGenerate = (report) => getBlockers(report).length === 0;

function describe(report) {
  const blockers = getBlockers(report);
  return { canGenerate: blockers.length === 0, blockers, file: report.returnHomePackageFile || null };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Handling of one building, logged: started / completed / failed.
// A building that is already being processed (double click, two overlapping settlement activations) is not
// processed twice: the second caller simply waits for and shares the result of the running one.
const inFlight = new Map(); // buildingId -> Promise

function generate(report) {
  if (inFlight.has(report.id)) return inFlight.get(report.id);
  const job = logger.withContext({ buildingId: report.id }, async () => {
    logger.info('building_processing_started');
    try {
      const result = await issue(report);
      logger.info('building_processing_completed');
      return result;
    } catch (e) {
      logger.error('building_processing_failed', { errorMessage: e.message });
      throw e;
    }
  }).finally(() => inFlight.delete(report.id));
  inFlight.set(report.id, job);
  return job;
}

async function issue(report) {
  const blockers = getBlockers(report);
  if (blockers.length) throw new ServiceError('לא ניתן להפיק תיק אכלוס מחדש – חסר: ' + blockers.join(', '), 409);

  await sleep(SIMULATED_PROCESSING_MS);

  const generatedAt = new Date();
  const fileName = crypto.randomUUID() + '.pdf';
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  logger.info('pdf_generation_started');
  await pdf.build({
    buildingId: report.id,
    address: report.address,
    apartmentCount: report.apartmentCount,
    eligibilityStatus: rehabilitation.eligibilityLabel(report),
    budgetStatus: budget.requestStatusLabel(report),
    rehabilitationStatus: rehabilitation.statusLabel(report.status),
    generatedAt,
  }, path.join(OUTPUT_DIR, fileName));
  logger.info('pdf_generation_completed');

  // Remember the issued document on the building so the UI can open it later.
  const result = { url: URL_PREFIX + fileName, fileName, generatedAt: generatedAt.toISOString() };
  const previous = report.returnHomePackageFile;
  report.returnHomePackageFile = result;
  if (previous) fs.rm(path.join(OUTPUT_DIR, previous.fileName), { force: true }, () => {}); // a re-issue replaces the old file

  // After the PDF exists: tell the family.
  result.notification = await familyNotification.notifyFamily(report);
  return result;
}

// Absolute path of a generated file, or null (name is validated so no path traversal is possible).
function resolveFile(fileName) {
  if (!FILE_NAME.test(fileName)) return null;
  const p = path.join(OUTPUT_DIR, fileName);
  return fs.existsSync(p) ? p : null;
}

module.exports = { URL_PREFIX, canGenerate, isIssued, describe, generate, resolveFile };
