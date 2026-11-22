// Route guard (platform kernel). Users are owned by the Users domain; this only asks its public API.
const { send } = require('./http');

// Returns the logged-in user, or answers 401 and returns null.
function requireUser(users, req, res) {
  const user = users.authenticate(req);
  if (!user) send(res, 401, { error: 'נדרשת התחברות למערכת' });
  return user;
}

module.exports = { requireUser };
