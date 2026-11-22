// System health metrics, calculated only from data the system already collects:
//   - settlement process statistics (from the Settlement Processes domain)
//   - the technical log (platform/logger): one record per event
const count = (records, event) => records.filter((r) => r.event === event).length;

function calculate({ processStats, logRecords }) {
  return {
    settlementProcesses: { completed: processStats.completed, processing: processStats.processing },
    notifications: {
      successful: count(logRecords, 'notification_sent'),   // family messages delivered
      failed: count(logRecords, 'notification_failed'),      // family messages that still failed after all attempts
      retryCount: count(logRecords, 'notification_retry_started'), // additional attempts after a failed one
    },
    performance: { averageSettlementDurationMs: processStats.averageDurationMs },
    calculatedAt: new Date().toISOString(),
  };
}

module.exports = { calculate };
