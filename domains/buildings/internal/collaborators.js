// Public APIs of the OTHER domains, injected once by the composition root (server.js).
// Buildings reads assessments / municipal approvals only through these APIs, never through their data.
let apis = {};

module.exports = {
  set: (injected) => { apis = injected; },
  assessments: () => apis.assessments(),
  municipal: () => apis.municipal(),
};
