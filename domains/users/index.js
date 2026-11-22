// USERS domain. Owns: users and login sessions.
// Public API (used by other domains): authenticate(req) -> { id, fullName, username } | null.
// No roles and no permissions: every logged-in user may perform every action.
const { send, readJson } = require('../../platform/http');
const userStore = require('./internal/userStore');
const sessions = require('./internal/sessions');

const tokenOf = (req) => (/^Bearer (.+)$/.exec(req.headers.authorization || '') || [])[1];

function create() {
  const api = {
    // The user behind the request's login token, or null.
    authenticate: (req) => sessions.find(tokenOf(req)),
  };

  const attempts = new Map(); // ip -> { n, until }  (brute-force protection)

  async function handle(req, res, url) {
    if (!url.pathname.startsWith('/auth/')) return false;

    if (url.pathname === '/auth/login' && req.method === 'POST') {
      const ip = req.socket.remoteAddress;
      const a = attempts.get(ip);
      if (a && a.until > Date.now()) return send(res, 429, { error: 'יותר מדי ניסיונות. נסו שוב בעוד דקה.' });
      const b = await readJson(req);
      const user = typeof b.username === 'string' && typeof b.password === 'string' ? userStore.verify(b.username, b.password) : null;
      if (!user) {
        const n = (a ? a.n : 0) + 1;
        attempts.set(ip, n >= 5 ? { n: 0, until: Date.now() + 60000 } : { n, until: 0 });
        return send(res, 401, { error: 'שם משתמש או סיסמה שגויים' });
      }
      attempts.delete(ip);
      const dto = userStore.toDto(user);
      return send(res, 200, { token: sessions.start(dto), user: dto });
    }

    if (url.pathname === '/auth/logout' && req.method === 'POST') {
      const token = tokenOf(req);
      if (token) sessions.end(token);
      return send(res, 200, { ok: true });
    }

    if (url.pathname === '/auth/me' && req.method === 'GET') {
      const user = api.authenticate(req);
      return user ? send(res, 200, user) : send(res, 401, { error: 'נדרשת התחברות למערכת' });
    }

    send(res, 404, { error: 'Not found' });
  }

  const startupHint = () => 'Users (username / password): staff / ' + (process.env.STAFF_PASSWORD ? '(STAFF_PASSWORD)' : 'housing123') + ', assessor / assessor123, municipal / municipal123';

  return { api, handle, startupHint };
}

module.exports = { create };
