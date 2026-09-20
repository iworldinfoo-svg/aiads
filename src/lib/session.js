'use strict';
const crypto = require('crypto');
const { sign, unsign } = require('./crypto');

// In-memory session store. Sessions are signed and stored in a cookie.
// For production scale this would move to Redis/DB, but the interface is stable.
const store = new Map();

function create(data) {
  const sid = crypto.randomBytes(24).toString('hex');
  store.set(sid, { ...data, _created: Date.now() });
  return sid;
}
function get(sid) {
  if (!sid) return null;
  const s = store.get(sid);
  if (!s) return null;
  // 7-day expiry
  if (Date.now() - (s._created || 0) > 7 * 24 * 3600 * 1000) {
    store.delete(sid);
    return null;
  }
  return s;
}
function set(sid, data) {
  const existing = store.get(sid) || {};
  store.set(sid, { ...existing, ...data, _created: existing._created || Date.now() });
}
function destroy(sid) {
  if (sid) store.delete(sid);
}

// Cookie helpers (signed session id).
function sessionCookie(sid) {
  return 'sid=' + sign(sid) + '; HttpOnly; Path=/; SameSite=Lax; Max-Age=' + 7 * 24 * 3600;
}
function readSessionId(cookies) {
  const raw = cookies.sid;
  if (!raw) return null;
  return unsign(raw);
}

module.exports = { create, get, set, destroy, sessionCookie, readSessionId, store };
