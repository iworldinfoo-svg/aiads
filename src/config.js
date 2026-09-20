'use strict';
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const GEN_DIR = path.join(ROOT, 'generated');
const DB_PATH = path.join(DATA_DIR, 'app.db');

// Server secret used for password hashing salts, API-key encryption and cookie signing.
// Persisted to disk so restarts keep the same secret.
function loadSecret() {
  if (process.env.APP_SECRET) return process.env.APP_SECRET;
  const kp = path.join(DATA_DIR, '.secret');
  if (fs.existsSync(kp)) return fs.readFileSync(kp, 'utf8').trim();
  const s = crypto.randomBytes(32).toString('hex');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(kp, s, { mode: 0o600 });
  return s;
}

const SECRET = loadSecret();
const PORT = parseInt(process.env.PORT || '3000', 10);
const DEV = process.env.NODE_ENV !== 'production';

[DATA_DIR, UPLOAD_DIR, GEN_DIR].forEach((d) => fs.mkdirSync(d, { recursive: true }));

module.exports = {
  ROOT, SRC, PUBLIC_DIR, DATA_DIR, UPLOAD_DIR, GEN_DIR, DB_PATH, SECRET, PORT, DEV,
};
