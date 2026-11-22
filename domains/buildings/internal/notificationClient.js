// HTTP client of the (external) notification server. All family messages go through POST /notifications/send.
const baseUrl = () => process.env.NOTIFICATIONS_URL;
const TIMEOUT_MS = 3000;

async function call(method, url, body) {
  const res = await fetch(baseUrl() + url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Notification server answered ${res.status}`);
  return res.json();
}

// -> { status, messageId }
const send = ({ buildingId, email, subject, body, idempotencyKey }) => call('POST', '/notifications/send', { buildingId, email, subject, body, idempotencyKey });
const list = () => call('GET', '/notifications');
const getMode = () => call('GET', '/notifications/mode');
const setMode = (mode) => call('PUT', '/notifications/mode', { mode });

module.exports = { send, list, getMode, setMode };
