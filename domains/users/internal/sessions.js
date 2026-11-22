// Login sessions: a user stays logged in until logout (no expiry in this MVP).
const crypto = require('crypto');

const sessions = new Map(); // token -> user dto

const start = (user) => { const token = crypto.randomBytes(32).toString('hex'); sessions.set(token, user); return token; };
const end = (token) => sessions.delete(token);
const find = (token) => sessions.get(token) || null;

module.exports = { start, end, find };
