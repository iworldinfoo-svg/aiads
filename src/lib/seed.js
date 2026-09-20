'use strict';
const db = require('../db');
const { hashPassword } = require('./crypto');

function seed() {
  // Super admin
  const existingAdmin = db.get("SELECT id FROM users WHERE role='admin' LIMIT 1");
  if (!existingAdmin) {
    const pass = process.env.ADMIN_PASS || 'admin123';
    db.run(
      "INSERT INTO users (mobile, name, role, password_hash) VALUES (?,?, 'admin', ?)",
      ['-', 'admin', hashPassword(pass)]
    );
    console.log('[seed] Super admin created. username=admin password=' + (process.env.ADMIN_PASS ? '<env>' : pass) + '  (CHANGE THIS)');
  }

  // API slots
  const slots = [
    ['primary_video', 'Primary Video Model'],
    ['fallback_video', 'Fallback Video Model'],
    ['image_gen', 'Image Generation'],
    ['tamil_tts', 'Tamil TTS'],
    ['lip_sync', 'Lip-sync'],
  ];
  slots.forEach(([key, name]) => {
    const ex = db.get('SELECT id FROM api_slots WHERE slot_key=?', [key]);
    if (!ex) {
      db.run(
        'INSERT INTO api_slots (slot_key, display_name, cost_per_unit, active, test_status) VALUES (?,?,?,0,\'untested\')',
        [key, name, 0]
      );
    }
  });

  // Templates
  const templates = [
    ['dialogue', 'jewellery_generic', 'Jewellery generic dialogue (TA)', 'உங்கள் நகைக் கடை இப்போது புதிய கலெக்ஷனுடன்! தரமான தங்க நகைகள், சிறந்த விலை. இன்றே வாருங்கள்!', 'ta'],
    ['dialogue', 'realestate_plot', 'Real estate plot dialogue (TA)', 'உங்கள் கனவு வீடு இப்போது எளிதான தவணையில்! DTCP அனுமதியுடன் பாதுகாப்பான மனை. அழைக்கவும்!', 'ta'],
    ['category_config', 'real_estate', 'Real estate sub-types', JSON.stringify(['plot', 'apartment', 'villa', 'commercial', 'venture']), 'en'],
    ['style_preview', 'animation', 'Animation preview', 'Animated 2D/3D look', 'en'],
  ];
  templates.forEach(([type, key, title, body, lang]) => {
    const ex = db.get('SELECT id FROM templates WHERE type=? AND key=?', [type, key]);
    if (!ex) db.run('INSERT INTO templates (type,key,title,body,lang) VALUES (?,?,?,?,?)', [type, key, title, body, lang]);
  });

  // Settings
  const settings = [
    ['trial_length_seconds', '5'],
    ['trial_watermark', '1'],
    ['trial_limit_per_mobile', '1'],
    ['free_retry_per_order', '1'],
    ['budget_guard_max_credits_per_order', '500'],
    ['default_strictness', 'standard'],
  ];
  settings.forEach(([k, v]) => {
    const ex = db.get('SELECT id FROM settings WHERE key=?', [k]);
    if (!ex) db.run('INSERT INTO settings (key,value) VALUES (?,?)', [k, v]);
  });
}

module.exports = { seed };
