'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Router, escapeHtml: esc } = require('./lib/router');
const { PORT, UPLOAD_DIR } = require('./config');
const session = require('./lib/session');
const { verifyPassword, encryptSecret, decryptSecret, sign } = require('./lib/crypto');
const db = require('./db');
const { seed } = require('./lib/seed');
const pages = require('./views/pages');
const { buildPrompt, buildDialogue, recommendVoice } = require('./lib/promptBuilder');
const { computeMeter } = require('./lib/continuity');
const credits = require('./lib/credits');
const trial = require('./lib/trial');
const jobs = require('./lib/jobs');
const { registry } = require('./lib/providers/registry');

seed();

const router = new Router();

function langOf(req) {
  return req.cookies.lang === 'en' ? 'en' : 'ta';
}

// ---- Helpers ----
function getDraftId(req, res) {
  const raw = req.cookies.draft;
  if (raw) {
    const id = parseInt(session.unsign ? session.unsign(raw) : raw, 10);
    if (!isNaN(id)) {
      const o = db.get("SELECT id FROM orders WHERE id=? AND status='draft'", [id]);
      if (o) return o.id;
    }
  }
  const oid = db.insert("INSERT INTO orders (status) VALUES ('draft')");
  db.run('INSERT INTO answers (order_id, payload) VALUES (?,?)', [oid, '{}']);
  res.setCookie('draft', sign(String(oid)), { httpOnly: true, maxAge: 60 * 60 * 24 });
  return oid;
}

function loadAnswers(orderId) {
  const r = db.get('SELECT payload FROM answers WHERE order_id=?', [orderId]);
  return r ? JSON.parse(r.payload) : {};
}
function saveAnswers(orderId, answers) {
  const existing = db.get('SELECT id FROM answers WHERE order_id=?', [orderId]);
  const payload = JSON.stringify(answers);
  if (existing) db.run('UPDATE answers SET payload=? WHERE order_id=?', [payload, orderId]);
  else db.insert('INSERT INTO answers (order_id, payload) VALUES (?,?)', [orderId, payload]);
  db.run("UPDATE orders SET updated_at=datetime('now') WHERE id=?", [orderId]);
}

function saveImage(orderId, kind, obj) {
  if (!obj || !obj.data) return obj;
  const ext = (obj.mime || '').includes('png') ? 'png' : (obj.mime || '').includes('svg') ? 'svg' : 'jpg';
  const fname = `${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const fp = path.join(UPLOAD_DIR, fname);
  fs.writeFileSync(fp, Buffer.from(obj.data, 'base64'));
  db.run("INSERT INTO assets (order_id, kind, path) VALUES (?,?,?)", [orderId, kind, fp]);
  return fp;
}

// Persist any base64 image fields embedded in answers.
function persistImages(orderId, answers) {
  const single = ['logo', 'char_photo', 'endcard_image'];
  single.forEach((k) => { if (answers[k] && answers[k].data) answers[k] = saveImage(orderId, k.replace('_image', '').replace('char_photo', 'character_photo'), answers[k]); });
  if (Array.isArray(answers.base_images)) {
    answers.base_images = answers.base_images.map((o) => saveImage(orderId, 'base_image', o));
  }
}

// ---- Public routes ----
router.get('/', (req, res) => res.html(pages.home(langOf(req))));
router.get('/login', (req, res) => res.html(pages.login(langOf(req))));
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const u = db.get('SELECT * FROM users WHERE name=? OR mobile=?', [username, username]);
  if (!u || u.role !== 'admin' || !verifyPassword(password || '', u.password_hash)) {
    return res.html(pages.login(langOf(req), 'Invalid credentials'), 401);
  }
  const sid = session.create({ userId: u.id, role: 'admin' });
  res.setCookie('sid', sign(sid), { httpOnly: true, maxAge: 7 * 24 * 3600 });
  res.redirect('/admin');
});
router.get('/logout', (req, res) => {
  if (req.cookies.sid) session.destroy(session.unsign ? session.unsign(req.cookies.sid) : req.cookies.sid);
  res.redirect('/');
});

router.get('/wizard', (req, res) => {
  const orderId = getDraftId(req, res);
  const answers = loadAnswers(orderId);
  res.html(pages.wizard(langOf(req), { orderId, answers }));
});
router.get('/api/state', (req, res) => {
  const orderId = getDraftId(req, res);
  res.json({ orderId, answers: loadAnswers(orderId), lang: langOf(req) });
});
router.post('/api/answers', (req, res) => {
  const orderId = parseInt(req.body.orderId, 10) || getDraftId(req, res);
  const prev = loadAnswers(orderId);
  const merged = Object.assign({}, prev, req.body.answers || {});
  persistImages(orderId, merged);
  saveAnswers(orderId, merged);
  res.json({ ok: true, orderId });
});
router.post('/api/preview', (req, res) => {
  const a = req.body.answers || {};
  const prompt = buildPrompt(a);
  const meter = computeMeter(a);
  const est = credits.estimate(a);
  res.json({ prompt, continuity: meter, credits: est, dialogue: buildDialogue(a), recommend: recommendVoice(a) });
});

// ---- Trial / OTP ----
router.post('/api/trial/send-otp', (req, res) => {
  const r = trial.sendOtp(req.body.mobile);
  if (!r.ok) return res.json({ ok: false, error: r.error }, 400);
  res.json({ ok: true, mobile: r.mobile, devOtp: r.otp });
});
router.post('/api/trial/verify', (req, res) => {
  const r = trial.verifyOtp(req.body.mobile, req.body.otp);
  if (!r.ok) return res.json({ ok: false, error: r.error }, 400);
  res.json({ ok: true, mobile: r.mobile });
});

// ---- Generate ----
router.post('/api/orders/:id/generate', async (req, res) => {
  const orderId = parseInt(req.params.id, 10);
  const { mode = 'full', mobile, otp } = req.body;
  const answers = loadAnswers(orderId);
  if (mode === 'trial') {
    if (!mobile) return res.json({ ok: false, error: 'mobile_required' }, 400);
    const m = trial.sanitizeMobile(mobile);
    if (trial.trialUsed(m)) return res.json({ ok: false, error: 'trial_used' }, 400);
    const v = trial.verifyOtp(mobile, otp);
    if (!v.ok) return res.json({ ok: false, error: v.error }, 400);
    // Consume the latest verified, unused trial for this mobile.
    const tr = db.get('SELECT id FROM trials WHERE mobile=? AND verified=1 AND order_id IS NULL ORDER BY id DESC LIMIT 1', [m]);
    if (tr) db.run('UPDATE trials SET order_id=? WHERE id=?', [orderId, tr.id]);
    db.run('UPDATE orders SET mobile=? WHERE id=?', [m, orderId]);
  }
  try {
    const result = await jobs.runPipeline(orderId, { mode, mobile });
    if (result.status === 'pending_approval') {
      return res.json({ ok: true, status: 'pending_approval', orderId, redirect: `/orders/${orderId}` });
    }
    res.json({ ok: true, status: 'ready', orderId, redirect: `/orders/${orderId}` });
  } catch (e) {
    res.json({ ok: false, error: String(e.message) }, 500);
  }
});
router.post('/orders/:id/approve', async (req, res) => {
  const orderId = parseInt(req.params.id, 10);
  db.run('UPDATE characters SET approved=1 WHERE order_id=?', [orderId]);
  try {
    const result = await jobs.resumeAfterApproval(orderId);
    res.json({ ok: true, status: result.status, orderId, redirect: `/orders/${orderId}` });
  } catch (e) {
    res.json({ ok: false, error: String(e.message) }, 500);
  }
});
router.get('/orders/:id', (req, res) => res.html(pages.orderResult(langOf(req), parseInt(req.params.id, 10))));

// ---- Admin ----
router.get('/admin', (req, res) => res.html(pages.adminDashboard(langOf(req))), { auth: 'admin' });
router.get('/admin/api-slots', (req, res) => res.html(pages.adminApiSlots(langOf(req))), { auth: 'admin' });
router.get('/admin/settings', (req, res) => res.html(pages.adminSettings(langOf(req))), { auth: 'admin' });
router.get('/admin/templates', (req, res) => res.html(pages.adminTemplates(langOf(req))), { auth: 'admin' });
router.get('/admin/users', (req, res) => res.html(pages.adminUsers(langOf(req))), { auth: 'admin' });
router.get('/admin/orders', (req, res) => res.html(pages.adminOrders(langOf(req))), { auth: 'admin' });
router.get('/admin/jobs', (req, res) => res.html(pages.adminJobs(langOf(req))), { auth: 'admin' });

router.post('/admin/settings', (req, res) => {
  Object.entries(req.body).forEach(([k, v]) => {
    const ex = db.get('SELECT id FROM settings WHERE key=?', [k]);
    if (ex) db.run('UPDATE settings SET value=? WHERE key=?', [v, k]);
    else db.run('INSERT INTO settings (key,value) VALUES (?,?)', [k, v]);
  });
  res.redirect('/admin/settings');
}, { auth: 'admin' });

router.post('/admin/api-slots', (req, res) => {
  const { id, display_name, endpoint_url, api_key, cost_per_unit, active } = req.body;
  const ex = db.get('SELECT api_key_enc FROM api_slots WHERE id=?', [id]);
  let keyEnc = ex ? ex.api_key_enc : '';
  if (api_key && String(api_key).trim().length) keyEnc = encryptSecret(api_key);
  db.run(
    'UPDATE api_slots SET display_name=?, endpoint_url=?, api_key_enc=?, cost_per_unit=?, active=?, updated_at=datetime(\'now\') WHERE id=?',
    [display_name, endpoint_url, keyEnc, parseFloat(cost_per_unit) || 0, active ? 1 : 0, id]
  );
  res.json({ ok: true });
}, { auth: 'admin' });

router.post('/admin/api-slots/:id/test', async (req, res) => {
  const r = await registryTest(req.params.id);
  res.json(r);
}, { auth: 'admin' });

async function registryTest(id) {
  const slot = db.get('SELECT slot_key FROM api_slots WHERE id=?', [id]);
  if (!slot) return { status: 'fail', note: 'not found' };
  const r = await registry.testSlot(slot.slot_key);
  db.run('UPDATE api_slots SET test_status=?, test_note=? WHERE id=?', [r.status, r.note, id]);
  return r;
}

router.post('/admin/jobs/:id/retry', async (req, res) => {
  const job = db.get('SELECT order_id FROM jobs WHERE id=?', [req.params.id]);
  if (!job) return res.json({ ok: false }, 404);
  try {
    const result = await jobs.runPipeline(job.order_id, { mode: 'full' });
    // mark the failed job done after successful re-run
    db.run("UPDATE jobs SET status='done', error=NULL WHERE id=?", [req.params.id]);
    res.json({ ok: true, status: result.status });
  } catch (e) {
    res.json({ ok: false, error: String(e.message) }, 500);
  }
}, { auth: 'admin' });

// ---- Server ----
const server = http.createServer((req, res) => router.handle(req, res));
server.listen(PORT, '0.0.0.0', () => {
  console.log(`AI Ad Video Studio running on http://0.0.0.0:${PORT} (lang=ta default, EN toggle)`);
});
