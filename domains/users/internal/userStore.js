// Users (seed data - there is no registration screen). Passwords are stored as salted scrypt hashes.
const crypto = require('crypto');

const hash = (password, salt) => crypto.scryptSync(password, salt, 32);

function makeUser(id, fullName, username, password) {
  const salt = crypto.randomBytes(16);
  return { id, fullName, username, salt, passwordHash: hash(password, salt) };
}

const users = [
  makeUser('user-1', 'נועה כהן (משרד השיכון)', 'staff', process.env.STAFF_PASSWORD || 'housing123'),
  makeUser('user-2', 'יוסי לוי (שמאי)', 'assessor', 'assessor123'),
  makeUser('user-3', 'רונית מזרחי (רשות מקומית)', 'municipal', 'municipal123'),
];

// A password check against a dummy user keeps the timing the same when the username does not exist.
const DUMMY = makeUser('none', '', '', 'not-a-real-password');

function verify(username, password) {
  const user = users.find((u) => u.username === username) || DUMMY;
  const ok = crypto.timingSafeEqual(hash(String(password), user.salt), user.passwordHash);
  return ok && user !== DUMMY ? user : null;
}

// Public shape of a user (never includes the password).
const toDto = (u) => ({ id: u.id, fullName: u.fullName, username: u.username });

module.exports = { verify, toDto };
