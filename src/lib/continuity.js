'use strict';
// Continuity engine logic: live meter (0-100), lock model and character-sheet
// generation. The meter is derived from active locks + chaining method + strictness.

const LOCK_WEIGHT = {
  face: 14, outfit: 10, location: 10, palette: 8, lighting: 8,
  voice: 10, product: 12, logo_text: 8,
};
const METHOD_BONUS = { sheet_lastframe: 12, sheet_only: 6, none: 0 };
const STRICTNESS_FACTOR = { standard: 1.0, high: 1.15, maximum: 1.3 };

// Returns { score, activeLocks, method, strictness, factors }
function computeMeter(answers) {
  const a = answers || {};
  const locks = Array.isArray(a.locks) ? a.locks : [];
  const method = a.lock_method || 'sheet_lastframe';
  const strictness = a.strictness || 'standard';

  let base = 30; // baseline continuity without any locks
  locks.forEach((l) => { base += LOCK_WEIGHT[l] || 0; });
  base += METHOD_BONUS[method] || 0;

  // Diminishing returns if "none" method selected with locks
  if (method === 'none') base = Math.min(base, 60);

  const factor = STRICTNESS_FACTOR[strictness] || 1.0;
  let score = Math.round(Math.min(100, base * factor));
  // High/maximum strictness also penalizes if too few locks active
  if ((strictness === 'high' || strictness === 'maximum') && locks.length < 4) {
    score = Math.max(0, score - 8);
  }
  return {
    score,
    activeLocks: locks,
    method,
    strictness,
    factors: { base, factor },
  };
}

// Builds a character sheet descriptor (text + what the renderer should lock).
function buildCharacterSheet(orderId, answers) {
  const a = answers || {};
  const sheets = [];
  const speakers = a.speakers || 'voice_only';
  const roles = speakers === 'man_woman' || speakers === 'family'
    ? ['speaker1', 'speaker2']
    : ['speaker1'];
  roles.forEach((role, idx) => {
    const gender = speakers === 'woman' ? 'female'
      : speakers === 'man' ? 'male'
      : (idx === 0 ? 'male' : 'female');
    sheets.push({
      order_id: orderId,
      role,
      source: a.char_source || 'ai',
      attrs: {
        gender,
        age_look: a.age_look || '30s',
        outfit: a.outfit || 'brand-appropriate attire',
        expression: a.expression || 'confident, friendly',
        gestures: a.gestures || 'natural hand gestures',
      },
      approved: 0,
    });
  });
  return sheets;
}

// Mock per-scene continuity QC score (real impl would compare embeddings/frames).
function sceneQualityScore(sceneIdx, strictness) {
  const base = strictness === 'maximum' ? 92 : strictness === 'high' ? 88 : 82;
  const jitter = (sceneIdx * 7 + 13) % 9; // deterministic pseudo variation
  return Math.min(100, base + jitter);
}

module.exports = { computeMeter, buildCharacterSheet, sceneQualityScore, LOCK_WEIGHT };
