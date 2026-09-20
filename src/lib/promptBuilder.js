'use strict';
// Builds the English master prompt from Tamil/English wizard answers.
// This is the single source of truth used both for the live preview and the
// stored order master_prompt. Sections follow the spec's prompt_builder.sections.

const { STYLE_PREVIEWS, recommendVoice } = require('./wizardSteps');

const DURATIONS = { 10: '10 seconds', 30: '30 seconds', 60: '60 seconds' };
const DIALECTS = {
  standard: 'standard Tamil', chennai: 'Chennai Tamil', kongu: 'Kongu Tamil',
  madurai: 'Madurai Tamil', tirunelveli: 'Tirunelveli Tamil',
};

function pick(answers, key, map, fallback) {
  const v = answers[key];
  if (v == null || v === '') return fallback || '';
  if (map && map[v]) return map[v];
  return v;
}

function listToEnglish(arr) {
  if (!Array.isArray(arr) || !arr.length) return 'none specified';
  return arr.join(', ');
}

function buildPrompt(answers) {
  const a = answers || {};
  const L = [];

  // 1. Format
  const dur = DURATIONS[a.duration] || '30 seconds';
  const ar = a.aspect_ratio || '9:16';
  L.push(`FORMAT: A ${dur} vertical-first advertisement in ${ar} aspect ratio, mobile-optimized, broadcast-quality.`);

  // 2. Message
  L.push(`MESSAGE: Business "${a.business_name || 'the business'}" (${a.category || 'unspecified category'}).`);
  if (a.ad_concept) L.push(`Ad concept: ${a.ad_concept}`);
  if (a.sub_type) L.push(`Sub-type: ${a.sub_type}.`);

  // 3. Offer
  if (a.offer) L.push(`OFFER / HIGHLIGHT: ${a.offer}`);

  // 4. Goal / audience
  L.push(`GOAL: ${pick(a, 'goal', { calls: 'drive phone calls', whatsapp: 'drive WhatsApp enquiries', store_visit: 'drive store visits', online_order: 'drive online orders', awareness: 'build brand awareness' })}.`);
  L.push(`TARGET AUDIENCE: ${listToEnglish(a.target_audience)}.`);
  if (a.contact_number) L.push(`Primary contact: ${a.contact_number}.`);

  // 5. Real-estate extras
  if (a.category === 'real_estate') {
    const ex = [];
    if (a.re_show_launch && a.re_launch_date) ex.push(`launch/release date ${a.re_launch_date}`);
    if (a.re_show_approval && a.re_approval_number) ex.push(`approval number ${a.re_approval_number} (DTCP/RERA)`);
    if (a.re_starting_price) ex.push(`starting price ${a.re_starting_price}`);
    if (ex.length) L.push(`REAL-ESTATE EXTRAS (overlay only, never rendered by AI): ${ex.join('; ')}.`);
  }

  // 6. Visual style
  const styles = Array.isArray(a.styles) && a.styles.length ? a.styles.map((s) => (STYLE_PREVIEWS[s] ? STYLE_PREVIEWS[s].en : s)) : ['cinematic'];
  L.push(`VISUAL STYLE: ${styles.join(', ')}. Mood: ${a.mood || 'premium'}. Pacing: ${a.pacing || 'medium'}.`);
  if (a.colour_palette) L.push(`Colour palette: ${a.colour_palette} (or derived from logo).`);

  // 7. Character
  if (Array.isArray(a.styles) && a.styles.includes('character_speaking')) {
    const sp = a.speakers || 'voice_only';
    L.push(`CHARACTER: Speakers = ${sp}.`);
    if (a.who_first) L.push(`First speaker: ${a.who_first}.`);
    if (a.char_source) L.push(`Source: ${a.char_source} (user/uploaded photo must be used as reference; do not alter face).`);
    if (a.age_look) L.push(`Age look: ${a.age_look}.`);
    if (a.outfit) L.push(`Outfit: ${a.outfit} (locked across all scenes).`);
    if (a.expression) L.push(`Expression: ${a.expression}.`);
    if (a.gestures) L.push(`Gestures: ${a.gestures}.`);
  }

  // 8. Voice
  const rec = recommendVoice(a);
  const voiceGender = a.voice_gender || rec.gender;
  const langName = { tamil: 'Tamil', english: 'English', mix: 'Tamil-English mix' }[a.language] || 'Tamil';
  L.push(`VOICE: ${voiceGender} voice in ${langName}${a.dialect ? ' (' + (DIALECTS[a.dialect] || a.dialect) + ')' : ''}. Tone: ${a.tone || 'friendly'}. Speed: ${a.speed || 'normal'}.`);
  if (a.music_style && a.music_style !== 'none') L.push(`BACKGROUND MUSIC: ${a.music_style} (auto-duck under voice).`);

  // 9. Setting / camera
  if (a.setting) L.push(`SETTING: ${a.setting}${a.setting === 'ai_decide' ? ' (choose the most fitting)' : ''}.`);
  if (a.time_of_day) L.push(`TIME OF DAY: ${a.time_of_day}.`);
  if (a.festival_season) L.push(`FESTIVAL/SEASON: ${a.festival_season}.`);
  if (Array.isArray(a.camera_shots) && a.camera_shots.length) L.push(`CAMERA: ${listToEnglish(a.camera_shots)}.`);
  if (a.phone_call_scene) L.push(`Include a phone-call scene.`);
  L.push(`Background: ${a.crowd === 'crowd' ? 'friendly crowd' : 'clean, uncluttered'}.`);

  // 10. Text FX
  if (a.text_on) {
    L.push(`ON-SCREEN TEXT: style=${a.text_style || 'bold'}, font mood=${a.font_mood || 'modern'}, position=${a.text_position || 'lower_third'}, animation=${a.text_animation || 'fade'}.`);
    if (a.offer_badge && a.offer_badge !== 'none') L.push(`Offer badge shape: ${a.offer_badge}.`);
    L.push(`Captions: ${a.captions ? 'yes' : 'no'}.`);
  }

  // 11. Address display
  if (a.address_display && a.address_display !== 'none') {
    L.push(`ADDRESS DISPLAY: ${a.address_display}.`);
    if (a.address_text) L.push(`Address text: ${a.address_text} (overlay only).`);
  }

  // 12. End card
  if (a.endcard_on) {
    L.push(`END CARD: layout=${a.endcard_layout || 'logo_phone'}${a.endcard_image ? ' (user building/shop image composited by FFmpeg, never through the AI model)' : ''}, animation=${a.endcard_animation || 'fade'}, length=${a.endcard_length || 4}s.`);
    if (a.whatsapp_number) L.push(`WhatsApp: ${a.whatsapp_number}.`);
    if (a.website) L.push(`Website: ${a.website}.`);
  }

  // 13. Continuity lock
  const locks = Array.isArray(a.locks) && a.locks.length ? a.locks.join(', ') : 'none';
  L.push(`CONTINUITY LOCK: locked attributes = [${locks}]. Method = ${a.lock_method || 'sheet_lastframe'}. Strictness = ${a.strictness || 'standard'}.`);
  L.push(`Each scene receives the same reference images plus locked-attribute text; start each scene from the previous scene's last frame; split by beats (hook, intro, benefit, offer, CTA).`);

  // 14. Negative rules (hard rules)
  L.push(`NEGATIVE RULES (mandatory): The AI must NEVER generate text, logos, numbers, or signboard lettering inside the footage. Logo, text, address, price, approval number and launch date are overlaid in post. Avoid: morphing faces, extra fingers, flicker, watermark, deformed hands, inconsistent lighting.`);

  return L.join('\n');
}

// System-written dialogue (editable in step 6), Tamil by default.
function buildDialogue(answers) {
  const a = answers || {};
  const name = a.business_name || 'எங்கள் நிறுவனம்';
  const offer = a.offer ? `இப்போது ${a.offer}!` : '';
  const lines = [];
  lines.push(`[Hook] ${name} இப்போது உங்கள் அருகில்!`);
  lines.push(`[Intro] நாங்கள் ${a.category || 'சிறந்த'} சேவையை தரமான விலையில் தருகிறோம்.`);
  lines.push(`[Benefit] நம்பகமான தரம், விரைவான சேவை — உங்கள் தேவை என்னவோ அது கிடைக்கும்.`);
  if (offer) lines.push(`[Offer] ${offer}`);
  const contact = a.contact_number || a.whatsapp_number || '';
  lines.push(`[CTA] இன்றே அழைக்கவும்: ${contact}. வாட்ஸ்அப்பிலும் எங்களை அணுகலாம்!`);
  return lines.join('\n');
}

module.exports = { buildPrompt, buildDialogue, recommendVoice };
