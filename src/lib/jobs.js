'use strict';
const fs = require('fs');
const path = require('path');
const db = require('../db');
const config = require('../config');
const { registry } = require('./providers/registry');
const { buildPrompt, buildDialogue } = require('./promptBuilder');
const { buildCharacterSheet, computeMeter } = require('./continuity');
const { saveEndCard } = require('./endcard');
const ffmpeg = require('./ffmpeg');
const credits = require('./credits');

const SCENE_PLAN = { 10: 3, 30: 5, 60: 8 };

function log(level, message, context) {
  db.run('INSERT INTO logs (level, message, context) VALUES (?,?,?)',
    [level, message, context ? JSON.stringify(context) : null]);
}

function upsertJob(orderId, step) {
  const existing = db.get('SELECT id FROM jobs WHERE order_id=? AND step=?', [orderId, step]);
  if (existing) {
    db.run("UPDATE jobs SET status='running', attempts=attempts+1, updated_at=datetime('now') WHERE id=?", [existing.id]);
    return existing.id;
  }
  return db.insert("INSERT INTO jobs (order_id, step, status, attempts) VALUES (?,?,'running',1)", [orderId, step]);
}
function finishJob(id, ok, error) {
  db.run("UPDATE jobs SET status=?, error=?, updated_at=datetime('now') WHERE id=?",
    [ok ? 'done' : 'failed', error || null, id]);
}

function loadOrder(orderId) {
  const order = db.get('SELECT * FROM orders WHERE id=?', [orderId]);
  if (!order) return null;
  const ans = db.get('SELECT payload FROM answers WHERE order_id=?', [orderId]);
  const answers = ans ? JSON.parse(ans.payload) : {};
  return { order, answers };
}

function validate(answers) {
  const errs = [];
  if (!answers.business_name) errs.push('business_name required');
  if (!answers.category) errs.push('category required');
  if (!answers.ad_concept) errs.push('ad_concept required');
  if (!answers.contact_number) errs.push('contact_number required');
  return errs;
}

// Resume point after character-sheet approval.
async function resumeAfterApproval(orderId) {
  const data = loadOrder(orderId);
  if (!data) throw new Error('order not found');
  return runRenderAndDeliver(data, { approved: true });
}

async function runPipeline(orderId, { mode = 'full', mobile } = {}) {
  const data = loadOrder(orderId);
  if (!data) throw new Error('order not found');
  const { order, answers } = data;

  // 1. Validate
  const errs = validate(answers);
  if (errs.length) { db.run("UPDATE orders SET status='failed' WHERE id=?", [orderId]); throw new Error(errs.join('; ')); }

  // 2. Build master prompt
  let j = upsertJob(orderId, 'build_prompt');
  const masterPrompt = buildPrompt(answers);
  db.run('UPDATE orders SET master_prompt=?, duration=?, strictness=? WHERE id=?',
    [masterPrompt, parseInt(answers.duration || '30', 10), answers.strictness || 'standard', orderId]);
  finishJob(j, true);

  // 3. Character sheet
  j = upsertJob(orderId, 'character_sheet');
  const sheets = buildCharacterSheet(orderId, answers);
  sheets.forEach((s) => db.insert(
    'INSERT INTO characters (order_id, role, source, attrs, approved) VALUES (?,?,?,?,?)',
    [s.order_id, s.role, s.source, JSON.stringify(s.attrs), s.approved]));
  finishJob(j, true);

  // 4. Approval gate
  if (answers.require_approval) {
    db.run("UPDATE orders SET status='pending_approval' WHERE id=?", [orderId]);
    log('info', 'Order awaiting character-sheet approval', { orderId });
    return { status: 'pending_approval' };
  }
  return runRenderAndDeliver(data, { mode, mobile });
}

async function runRenderAndDeliver(data, { mode = 'full', mobile, approved } = {}) {
  const { order, answers } = data;
  const orderId = order.id;
  let duration = parseInt(answers.duration || '30', 10);
  let watermark = false;
  if (mode === 'trial') {
    duration = config.DEV ? Math.min(duration, 5) : 5;
    watermark = true;
    db.run('UPDATE orders SET is_trial=1 WHERE id=?', [orderId]);
  }
  db.run("UPDATE orders SET status='generating' WHERE id=?", [orderId]);

  // 5. Image generation (if requested)
  if (answers.image_source === 'generate' || answers.image_source === 'both') {
    const j = upsertJob(orderId, 'image_gen');
    try {
      const img = await registry.image().generate({ prompt: answers.gen_prompt || answers.ad_concept, style: answers.gen_style, count: parseInt(answers.gen_count || '2', 10), aspect: answers.aspect_ratio });
      img.images.forEach((im) => db.insert("INSERT INTO assets (order_id, kind, path) VALUES (?, 'generated_image', ?)", [orderId, im.path]));
      finishJob(j, true);
    } catch (e) { finishJob(j, false, e.message); log('error', 'image_gen failed', { e: e.message }); }
  }

  // 6. Render scenes
  let j = upsertJob(orderId, 'render_scenes');
  const sceneCount = SCENE_PLAN[duration] || 5;
  const render = await registry.render().renderScenes({ orderId, answers, sceneCount });
  let minScore = 100;
  render.scenes.forEach((sc, i) => {
    db.insert(
      'INSERT INTO scenes (order_id, idx, beat, prompt, poster_path, last_frame_path, continuity_score, status) VALUES (?,?,?,?,?,?,?,?)',
      [orderId, sc.idx, sc.beat, buildPrompt(answers), sc.poster_path, sc.last_frame_path, sc.continuity_score, 'done']);
    minScore = Math.min(minScore, sc.continuity_score);
  });
  finishJob(j, true);

  // 7. TTS + lip-sync
  j = upsertJob(orderId, 'tts_lipsync');
  const dialogue = answers.dialogue || buildDialogue(answers);
  const tts = await registry.tts().synthesize({ text: dialogue, lang: answers.language, gender: answers.voice_gender, dialect: answers.dialect, speed: answers.speed });
  // mock audio is null; real impl would mux. Lip-sync only for character_speaking.
  if (Array.isArray(answers.styles) && answers.styles.includes('character_speaking')) {
    await registry.lipsync().sync({ videoPath: render.scenes[0].poster_path, audioPath: tts.audioPath });
  }
  finishJob(j, true);
  const audioPath = tts.audioPath;

  // 8. End card (FFmpeg overlay / vector)
  j = upsertJob(orderId, 'endcard');
  let endcardPath = null;
  if (answers.endcard_on) {
    const logoAsset = db.get("SELECT path FROM assets WHERE order_id=? AND kind='logo' ORDER BY id DESC LIMIT 1", [orderId]);
    endcardPath = saveEndCard(orderId, {
      layout: answers.endcard_layout, logoPath: logoAsset ? logoAsset.path : null, brand: answers.business_name,
      phone: answers.contact_number, whatsapp: answers.whatsapp_number, address: answers.address_text,
      website: answers.website, palette: answers.colour_palette, bgImagePath: answers.endcard_image || null,
    });
  }
  finishJob(j, true);

  // 9. Assemble (FFmpeg if present, else HTML preview)
  j = upsertJob(orderId, 'assemble');
  const scenes = db.all('SELECT * FROM scenes WHERE order_id=? ORDER BY idx', [orderId]);
  const ffmpegOk = await ffmpeg.detect();
  let outPath = null, previewPath = null;
  if (ffmpegOk) {
    outPath = path.join(config.GEN_DIR, String(orderId), 'final.mp4');
    const r = await ffmpeg.run(orderId, { scenes, endcardPath, audioPath, duration, outPath, watermark });
    if (!r.ok) { finishJob(j, false, r.error); log('error', 'ffmpeg failed', { e: r.error }); }
    else finishJob(j, true);
  } else {
    previewPath = buildHtmlPreview(orderId, { scenes, endcardPath, dialogue, answers, watermark, trial: mode === 'trial' });
    finishJob(j, true);
    log('info', 'FFmpeg not available — produced HTML preview instead of MP4', { orderId });
  }

  // 10. QC + deliver
  j = upsertJob(orderId, 'qc_deliver');
  const meter = computeMeter(answers);
  const continuityScore = Math.min(minScore, meter.score);
  db.run('UPDATE orders SET continuity_score=?, status=?, output_path=?, preview_path=? WHERE id=?',
    [continuityScore, 'ready', outPath, previewPath, orderId]);
  finishJob(j, true);

  // 11. Credits ledger
  const est = credits.estimate(answers);
  const cost = mode === 'trial' ? 0 : est.total;
  credits.addEntry({ userId: order.user_id, orderId, delta: -cost, reason: mode === 'trial' ? 'trial render' : 'full render' });

  log('info', 'Order ready', { orderId, continuityScore, cost });
  return { status: 'ready', outputPath: outPath, previewPath, continuityScore };
}

function buildHtmlPreview(orderId, { scenes, endcardPath, dialogue, answers, watermark, trial }) {
  const dir = path.join(config.GEN_DIR, String(orderId));
  fs.mkdirSync(dir, { recursive: true });
  const fp = path.join(dir, 'preview.html');
  const sceneImgs = scenes.map((s) =>
    `<div class="slide"><img src="/generated/${orderId}/${path.basename(s.poster_path)}"><div class="cap">${path.basename(s.poster_path)} · score ${s.continuity_score}</div></div>`
  ).join('');
  const endcardImg = endcardPath ? `<div class="slide endcard"><img src="/generated/${orderId}/${path.basename(endcardPath)}"></div>` : '';
  const lines = String(dialogue || '').split('\n').map((l) => `<p>${l.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</p>`).join('');
  const html = `<!doctype html><html lang="ta"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Preview ${orderId}</title>
<style>body{margin:0;background:#0b0b0b;color:#fff;font-family:system-ui}A{color:#ffd166}.wrap{max-width:480px;margin:0 auto}.slide{position:relative}.slide img{width:100%;display:block}.cap{position:absolute;bottom:8px;left:8px;font-size:12px;background:rgba(0,0,0,.5);padding:2px 6px;border-radius:4px}.endcard img{width:100%}h1{font-size:18px;padding:12px}.dlg{background:#161616;padding:12px;font-size:14px;line-height:1.5}.badge{display:inline-block;background:#d7263d;color:#fff;padding:4px 8px;border-radius:4px;font-size:12px}</style>
</head><body><div class="wrap">
<h1>முன்னோட்டம் / Preview — Order #${orderId} ${trial ? '<span class="badge">TRIAL 5s</span>' : ''} ${watermark ? '<span class="badge">WATERMARK</span>' : ''}</h1>
<div class="scene-track">${sceneImgs}${endcardImg}</div>
<div class="dlg"><strong>Dialogue:</strong>${lines}</div>
<p style="padding:12px;font-size:12px;opacity:.7">Mock preview — no real AI video. With FFmpeg installed, this becomes an MP4. End card is vector (zero distortion).</p>
</div>
<script>// simple auto-advance slideshow
const slides=[...document.querySelectorAll('.slide')];let i=0;slides.forEach(s=>s.style.display='none');
if(slides.length){slides[0].style.display='block';setInterval(()=>{slides[i].style.display='none';i=(i+1)%slides.length;slides[i].style.display='block';},2500);}
</script>
</body></html>`;
  fs.writeFileSync(fp, html);
  return fp;
}

module.exports = { runPipeline, resumeAfterApproval, loadOrder, validate, buildHtmlPreview };
