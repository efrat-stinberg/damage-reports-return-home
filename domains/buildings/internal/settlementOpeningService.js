// "כשיר לפתיחת יישוב" - is a building ready for residents to return, as part of opening its settlement.
// The national dashboard rule lives here (Buildings domain). Every condition is answered by the service that
// owns that knowledge; assessments and municipal approvals are read ONLY through their domains' public APIs.
const rehabilitation = require('./rehabilitationService');
const budget = require('./budgetService');
const returnHomePackage = require('./returnHomePackageService');
const collaborators = require('./collaborators');

const RESETTLEABLE_DAMAGE_LEVELS = ['LIGHT', 'MEDIUM']; // light or medium damage; "SEVERE" blocks opening

// Why the building is not ready (empty array = ready), in the order of the national-dashboard rules.
function getBlockers(report) {
  const assessment = collaborators.assessments().getAssessment(report.id);
  const approval = collaborators.municipal().getApproval(report.id);
  const blockers = [];
  blockers.push(...rehabilitation.getMissingForRehabilitation(report)); // damage photos, engineer report, eligibility check
  if (!budget.isSocialApprovalSatisfied(report)) blockers.push('אישור חברתי');
  if (!budget.hasRequest(report)) blockers.push('בקשת תקציב');
  if (!returnHomePackage.isIssued(report)) blockers.push('תיק חזרה לבית');
  if (!assessment) blockers.push('הערכת שמאי');
  else if (!RESETTLEABLE_DAMAGE_LEVELS.includes(assessment.damageLevel)) blockers.push('דרגת נזק חמורה');
  if (approval?.approved !== true) blockers.push('אישור רשות מקומית');
  return blockers;
}

// Summary category of a building. Not-ready buildings are counted once, by the first reason in this order:
// waiting for an appraiser -> waiting for the local authority -> other reasons.
const CATEGORIES = { ELIGIBLE: 'ELIGIBLE', AWAITING_ASSESSMENT: 'AWAITING_ASSESSMENT', AWAITING_MUNICIPAL: 'AWAITING_MUNICIPAL', OTHER: 'OTHER' };

function categoryOf(report, blockers) {
  if (!blockers.length) return CATEGORIES.ELIGIBLE;
  if (!collaborators.assessments().getAssessment(report.id)) return CATEGORIES.AWAITING_ASSESSMENT;
  if (collaborators.municipal().getApproval(report.id)?.approved !== true) return CATEGORIES.AWAITING_MUNICIPAL;
  return CATEGORIES.OTHER;
}

function describe(report) {
  const blockers = getBlockers(report);
  return { eligible: blockers.length === 0, blockers, category: categoryOf(report, blockers) };
}

module.exports = { describe };
