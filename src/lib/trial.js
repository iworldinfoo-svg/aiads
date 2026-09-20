'use strict';
// Trial system: OTP (mock SMS), 5s 720p watermarked, 1 per mobile number.
const db = require('../db');
const crypto = require('./crypto');
const config = require('../config');

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

function sanitizeMobile(m) {
  if (!m) return null;
  const digits = String(m).replace(/[^\d]/g, '');
  // Accept 10-digit Indian or 12-digit with 91
  if (digits.length === 10) return '+91' + digits;
  if (digits.length === 12 && digits.startsWith('91')) return '+' + digits;
  if (digits.length === 11 && digits.startsWith('0')) return '+91' + digits.slice(1);
  return null;
}

function trialUsed(mobile) {
  // A mobile has "used" its trial once a verified OTP has been consumed by a
  // generated trial order (order_id set). OTP verification alone does not count.
  const row = db.get('SELECT COUNT(*) AS c FROM trials WHERE mobile = ? AND verified = 1 AND order_id IS NOT NULL', [mobile]);
  return row.c > 0;
}

function sendOtp(mobile) {
  const m = sanitizeMobile(mobile);
  if (!m) return { ok: false, error: 'invalid_mobile' };
  if (trialUsed(m)) return { ok: false, error: 'trial_used' };
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const hash = crypto.hashOtp(otp);
  db.run(
    'INSERT INTO trials (mobile, otp_hash, otp_sent_at, verified) VALUES (?,?,?,0)',
    [m, hash, new Date().toISOString()]
  );
  // In a real deployment this would call an SMS gateway. For the foundation we
  // surface the OTP in the dev response so the flow is testable.
  return { ok: true, mobile: m, otp: config.DEV ? otp : undefined };
}

function verifyOtp(mobile, otp) {
  const m = sanitizeMobile(mobile);
  if (!m) return { ok: false, error: 'invalid_mobile' };
  const row = db.get(
    'SELECT * FROM trials WHERE mobile = ? ORDER BY id DESC LIMIT 1',
    [m]
  );
  if (!row) return { ok: false, error: 'no_otp' };
  const age = Date.now() - new Date(row.otp_sent_at).getTime();
  if (age > OTP_TTL_MS) return { ok: false, error: 'otp_expired' };
  if (crypto.hashOtp(otp) !== row.otp_hash) return { ok: false, error: 'otp_wrong' };
  db.run('UPDATE trials SET verified = 1 WHERE id = ?', [row.id]);
  return { ok: true, mobile: m };
}

module.exports = { sendOtp, verifyOtp, trialUsed, sanitizeMobile, OTP_TTL_MS };
