// Messages to the family after a "return home" package was issued. Sending goes only through the notification server.
const client = require('./notificationClient');
const logger = require('../../../platform/logger');

const subjectFor = (report) => `אישור חזרה לבית ${report.address}`;
const BODY = `שלום,
אנו שמחים לעדכן כי המבנה שלכם אושר לחזרה לבית.
תיק האכלוס הוכן בהצלחה.
בברכה,
משרד הבינוי והשיכון`;

const MAX_ATTEMPTS = 3; // first attempt + up to 2 retries, no delay between them
// ALREADY_SENT: an earlier attempt did reach the family (e.g. its answer was lost), so there is nothing left to send.
const isDelivered = (result) => result.status === 'SENT' || result.status === 'ALREADY_SENT';

// Sends the "approved to return home" message, retrying immediately on failure (at most MAX_ATTEMPTS requests).
// Every request is a new entry in the notification server log. Returns { status, messageId, attempts }.
async function notifyFamily(report) {
  // MVP: the building id is the idempotency key, so all attempts for one building are the same message.
  const message = { buildingId: report.id, email: report.familyEmail, subject: subjectFor(report), body: BODY, idempotencyKey: report.id };
  let result = { status: 'FAILED' };
  let attempts = 0;
  while (attempts < MAX_ATTEMPTS && !isDelivered(result)) {
    attempts++;
    if (attempts === 1) logger.info('notification_send_started', { notificationAttempt: attempts });
    else logger.info('notification_retry_started', { notificationAttempt: attempts });
    let errorMessage;
    try {
      result = await client.send(message);
      if (!isDelivered(result)) errorMessage = `Notification server answered ${result.status}`;
    } catch (e) {
      result = { status: 'FAILED' }; // no usable answer from the server counts as a failed attempt
      errorMessage = e.message;
    }
    if (isDelivered(result)) logger.info('notification_sent', { notificationAttempt: attempts });
    else logger.warn('notification_attempt_failed', { notificationAttempt: attempts, errorMessage });
  }
  if (!isDelivered(result)) logger.error('notification_failed', { notificationAttempt: attempts, errorMessage: `All ${attempts} attempts failed` });
  return { ...result, attempts };
}

// Message log for the notifications center (newest first), each row joined with the building address.
async function getLog(addressOf) {
  const rows = await client.list();
  return rows.reverse().map((r) => ({ ...r, address: addressOf(r.buildingId) }));
}

// Behaviour mode of the (mock) notification server.
const getMode = () => client.getMode();
const setMode = (mode) => client.setMode(mode);

module.exports = { notifyFamily, getLog, getMode, setMode };
