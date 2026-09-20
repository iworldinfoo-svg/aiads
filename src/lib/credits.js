'use strict';
// Credit estimation + ledger. Credits are an internal cost unit; the cost
// multiplier from strictness maps to real spend in the admin dashboard.

const COST_MULTIPLIER = { standard: 1.0, high: 1.4, maximum: 1.8 };

// Base credits per second of generated video (mock economy).
const CREDITS_PER_SECOND = 2.0;
const STYLE_CREDIT = 4;        // per selected style
const GENERATED_IMAGE_CREDIT = 1.5; // per generated image
const ENDCARD_CREDIT = 3;
const TEXTFX_CREDIT = 2;
const FREE_RETRY_PER_ORDER = 1;

function durationSeconds(answers) {
  return parseInt(answers.duration || '30', 10);
}

function estimate(answers) {
  const a = answers || {};
  const seconds = durationSeconds(a);
  const mult = COST_MULTIPLIER[a.strictness] || 1.0;

  const base = seconds * CREDITS_PER_SECOND;
  const styles = Array.isArray(a.styles) ? a.styles.length : 0;
  const styleCost = styles * STYLE_CREDIT;
  const genImages = a.gen_count ? parseInt(a.gen_count, 10) : 0;
  const imageCost = (a.image_source === 'generate' || a.image_source === 'both') ? genImages * GENERATED_IMAGE_CREDIT : 0;
  const endcardCost = a.endcard_on ? ENDCARD_CREDIT : 0;
  const textfxCost = a.text_on ? TEXTFX_CREDIT : 0;

  const raw = base + styleCost + imageCost + endcardCost + textfxCost;
  const total = Math.round((raw * mult) * 10) / 10;

  return {
    seconds,
    multiplier: mult,
    breakdown: {
      base: Math.round(base * 10) / 10,
      styles: styleCost,
      images: Math.round(imageCost * 10) / 10,
      endcard: endcardCost,
      textfx: textfxCost,
    },
    total,
    freeRetries: FREE_RETRY_PER_ORDER,
  };
}

// Ledger operations
const db = require('../db');
function balanceFor(userId) {
  const row = db.get('SELECT COALESCE(SUM(delta),0) AS bal FROM credits_ledger WHERE user_id = ?', [userId]);
  return row ? row.bal : 0;
}
function addEntry({ userId, orderId, delta, reason }) {
  const balance = balanceFor(userId) + delta;
  db.run(
    'INSERT INTO credits_ledger (user_id, order_id, delta, balance, reason) VALUES (?,?,?,?,?)',
    [userId || null, orderId || null, delta, balance, reason]
  );
  return balance;
}

module.exports = { estimate, COST_MULTIPLIER, FREE_RETRY_PER_ORDER, balanceFor, addEntry };
