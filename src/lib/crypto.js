'use strict';
const crypto = require('crypto');
const { SECRET } = require('../config');

// --- Password hashing (scrypt) ---
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, 64);
  return salt.toString('hex') + ':' + h.toString('hex');
}
function verifyPassword(pw, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, h] = stored.split(':');
  const hh = crypto.scryptSync(pw, Buffer.from(salt, 'hex'), 64);
  const expected = Buffer.from(h, 'hex');
  if (hh.length !== expected.length) return false;
  return crypto.timingSafeEqual(hh, expected);
}

// --- API-key encryption (AES-256-CBC) ---
function _key() {
  return crypto.createHash('sha256').update(SECRET).digest();
}
function encryptSecret(plain) {
  if (plain === null || plain === undefined || plain === '') return '';
  const iv = crypto.randomBytes(16);
  const c = crypto.createCipheriv('aes-256-cbc', _key(), iv);
  const e = Buffer.concat([c.update(String(plain)), c.final()]);
  return iv.toString('hex') + ':' + e.toString('hex');
}
function decryptSecret(enc) {
  if (!enc) return '';
  const [iv, e] = enc.split(':');
  if (!iv || !e) return '';
  const d = crypto.createDecipheriv('aes-256-cbc', _key(), Buffer.from(iv, 'hex'));
  const p = Buffer.concat([d.update(Buffer.from(e, 'hex')), d.final()]);
  return p.toString('utf8');
}

// --- Signed cookies / tokens ---
function sign(val) {
  const sig = crypto.createHmac('sha256', SECRET).update(val).digest('hex');
  return val + '.' + sig;
}
function unsign(signed) {
  if (!signed || signed.indexOf('.') < 0) return null;
  const i = signed.lastIndexOf('.');
  const val = signed.slice(0, i);
  const sig = signed.slice(i + 1);
  const good = crypto.createHmac('sha256', SECRET).update(val).digest('hex');
  const a = Buffer.from(good);
  const b = Buffer.from(sig);
  if (a.length !== b.length) return null;
  return crypto.timingSafeEqual(a, b) ? val : null;
}

// OTP hash (short-lived; we store a hash + timestamp in DB).
function hashOtp(otp) {
  return crypto.createHash('sha256').update('otp:' + otp).digest('hex');
}

module.exports = {
  hashPassword,
  verifyPassword,
  encryptSecret,
  decryptSecret,
  sign,
  unsign,
  hashOtp,
  randomToken: () => crypto.randomBytes(24).toString('hex'),
};
