// "תקציב" - all business logic about opening and approving budget requests.
const { ServiceError } = require('../../../platform/errors');
const rehabilitation = require('./rehabilitationService');

// Buildings with MORE apartments than this need a social approval to open a budget request.
const SOCIAL_APPROVAL_THRESHOLD = 24;

function requiresSocialApproval(report) {
  return report.apartmentCount > SOCIAL_APPROVAL_THRESHOLD;
}

// A social approval is needed only for big buildings; when it is needed it must have been received.
const isSocialApprovalSatisfied = (report) => !requiresSocialApproval(report) || report.socialApproval === true;

function hasRequest(report) {
  return !!report.budgetRequest;
}

const REQUEST_STATUS_LABELS = { OPEN: 'בקשה נפתחה – ממתינה לאישור', APPROVED: 'בקשה אושרה' };
const requestStatusLabel = (report) => (report.budgetRequest ? REQUEST_STATUS_LABELS[report.budgetRequest.status] : 'לא נפתחה בקשה');

// "מוכן לשחרור תקציב": photos + engineer report + eligibility check.
function isReadyForBudget(report) {
  return rehabilitation.canStartRehabilitation(report);
}

// Reasons why a budget request cannot be opened (empty array = allowed).
function getBlockers(report) {
  const blockers = [];
  const missing = rehabilitation.getMissingForRehabilitation(report);
  if (missing.length) blockers.push(`חסר: ${missing.join(', ')}`);
  if (requiresSocialApproval(report) && report.socialApproval !== true) {
    blockers.push(`מבנה עם יותר מ-${SOCIAL_APPROVAL_THRESHOLD} דירות (${report.apartmentCount}) דורש אישור חברתי`);
  }
  if (report.budgetRequest) blockers.push('כבר נפתחה בקשת תקציב');
  return blockers;
}

function describe(report) {
  const blockers = getBlockers(report);
  return {
    readyForRelease: isReadyForBudget(report),
    requiresSocialApproval: requiresSocialApproval(report),
    canOpenRequest: blockers.length === 0,
    blockers,
    request: report.budgetRequest || null,
  };
}

// ---------- state changes ----------
function setSocialApproval(report, value) {
  if (typeof value !== 'boolean') throw new ServiceError('socialApproval must be boolean');
  report.socialApproval = value;
  return report;
}

function openRequest(report) {
  const blockers = getBlockers(report);
  if (blockers.length) throw new ServiceError('לא ניתן לפתוח בקשת תקציב – ' + blockers.join('; '), 409);
  report.budgetRequest = { status: 'OPEN', openedAt: new Date().toISOString() };
  return report;
}

function approveRequest(report) {
  const req = report.budgetRequest;
  if (!req) throw new ServiceError('לא נפתחה בקשת תקציב', 409);
  if (req.status === 'APPROVED') throw new ServiceError('בקשת התקציב כבר אושרה', 409);
  req.status = 'APPROVED';
  req.approvedAt = new Date().toISOString();
  return report;
}

module.exports = {
  hasRequest,
  isSocialApprovalSatisfied,
  requestStatusLabel,
  describe,
  setSocialApproval,
  openRequest,
  approveRequest,
};
