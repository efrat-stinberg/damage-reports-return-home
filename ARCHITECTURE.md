# Architecture – ownership by domain

```
server.js                      composition root: wires the domains, routes HTTP, serves index.html
platform/                      shared kernel: HTTP helpers, route guard, errors (owns no business data)
domains/
  users/                       users + login sessions                       (Users team)
  audit/                       action log: who did what, on which entity    (Audit)
  buildings/                   buildings, rehabilitation, budget, return-home package,
                               family notifications, "ready to open a settlement" (Housing Ministry)
  assessments/                 appraisers' assessments                       (Appraisers' portal team)
  municipal-approvals/         local authorities' approvals                  (Local authorities' portal team)
  settlement-processes/        one record per "generate packages for a settlement" activation
  system-health/               health metrics calculated from processes + the technical log (owns no data)
mock-notification-server.js    external system (simulated e-mail sender)
```

## Rules
1. **Ownership** – a domain stores and changes only its own data. Data lives in `internal/` (private).
2. **APIs only** – a domain's `index.js` exposes its public API; other domains may use nothing else.
   Dependencies are injected in `server.js` (`create({ ... })`), never `require`d across domains.
3. **Copies** – public APIs return copies, so a caller can never modify another domain's data.
4. `npm run check:boundaries` fails when a domain `require`s another domain's code.

## Who calls whom
| Caller | Uses | For |
|---|---|---|
| buildings | assessments API `getAssessment` | detail view, settlement-opening rule |
| buildings | municipal API `getApproval` | detail view, settlement-opening rule |
| assessments / municipal | buildings API `exists`, `getSummary`, `listSummaries` | portal lists, validating the building |
| buildings, assessments, municipal | audit API `record` | writing the action log |
| settlement-processes | buildings API `canGenerateReturnHomePackage`, `generateReturnHomePackage` | running one activation |
| system-health | settlement-processes API `getStats` + `platform/logger` | metrics |
| all | users API `authenticate` | knowing who is logged in |

## HTTP (unchanged by the refactor)
`/reports…`, `/buildings/:id/return-home-package`, `/notification-center…`, `/meta` → buildings ·
`/assessor/…` → assessments · `/municipal/…` → municipal-approvals · `/audit` → audit · `/auth/…` → users · `/settlement-processes` → settlement-processes · `/system-health` → system-health
