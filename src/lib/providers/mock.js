'use strict';
const fs = require('fs');
const path = require('path');
const { GEN_DIR } = require('../../config');
const { STYLE_PREVIEWS } = require('../wizardSteps');
const { sceneQualityScore } = require('../continuity');

const MOOD_BG = {
  happy: ['#ffd166', '#ef476f'], premium: ['#1d3557', '#c9a24b'],
  emotional: ['#6a4c93', '#b56576'], energetic: ['#f4801f', '#ffd166'],
  calm: ['#2a9d8f', '#8ecae6'], festive: ['#d7263d', '#ffba08'],
};
const SETTING_LABEL = {
  home: 'Home', road: 'Road', car_exit: 'Car exit', car_inside: 'Car interior',
  showroom: 'Showroom', office: 'Office', plot: 'Plot/Site', temple: 'Temple/Festival',
  ai_decide: 'AI choice',
};
const BEATS = ['hook', 'intro', 'benefit', 'offer', 'cta'];

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function posterSvg({ idx, beat, answers, label }) {
  const W = 1080, H = 1920;
  const mood = answers.mood || 'premium';
  const [c1, c2] = MOOD_BG[mood] || MOOD_BG.premium;
  const styles = Array.isArray(answers.styles) ? answers.styles.map((s) => (STYLE_PREVIEWS[s] ? STYLE_PREVIEWS[s].en : s)) : ['Cinematic'];
  const setting = SETTING_LABEL[answers.setting] || 'AI choice';
  const brand = esc(answers.business_name || 'Brand');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><linearGradient id="g${idx}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#g${idx})"/>
<circle cx="540" cy="620" r="220" fill="#ffffff" opacity="0.12"/>
<text x="540" y="560" font-size="120" text-anchor="middle" opacity="0.85">${(STYLE_PREVIEWS[styles[0]] ? STYLE_PREVIEWS[styles[0]].emoji : '🎬')}</text>
<text x="540" y="900" font-size="64" font-weight="700" fill="#fff" text-anchor="middle">Scene ${idx + 1}</text>
<text x="540" y="1000" font-size="44" fill="#fff" text-anchor="middle" opacity="0.9">beat: ${beat}</text>
<text x="540" y="1120" font-size="36" fill="#fff" text-anchor="middle" opacity="0.8">${esc(styles.join(' / '))}</text>
<text x="540" y="1200" font-size="32" fill="#fff" text-anchor="middle" opacity="0.7">${esc(setting)}</text>
<text x="540" y="1700" font-size="48" font-weight="700" fill="#fff" text-anchor="middle">${brand}</text>
<text x="540" y="1780" font-size="28" fill="#fff" text-anchor="middle" opacity="0.7">MOCK RENDER · ${esc(label || 'no real AI')}</text>
</svg>`;
}

function MockRenderProvider() {
  return {
    name: 'mock-render',
    async renderScenes({ orderId, answers, sceneCount }) {
      const dir = path.join(GEN_DIR, String(orderId));
      fs.mkdirSync(dir, { recursive: true });
      const n = sceneCount || BEATS.length;
      const scenes = [];
      for (let i = 0; i < n; i++) {
        const beat = BEATS[i % BEATS.length];
        const svg = posterSvg({ idx: i, beat, answers });
        const fp = path.join(dir, `scene_${i}.svg`);
        fs.writeFileSync(fp, svg);
        // last-frame chaining: same poster referenced (mock)
        scenes.push({
          idx: i, beat,
          poster_path: fp,
          last_frame_path: fp,
          continuity_score: sceneQualityScore(i, answers.strictness),
        });
      }
      return { scenes, provider: 'mock-render' };
    },
  };
}

function MockImageProvider() {
  return {
    name: 'mock-image',
    async generate({ prompt, style, count, aspect }) {
      const dir = path.join(GEN_DIR, 'generated_images');
      fs.mkdirSync(dir, { recursive: true });
      const n = count || 1;
      const images = [];
      for (let i = 0; i < n; i++) {
        const [w, h] = aspect === '1:1' ? [1024, 1024] : aspect === '16:9' ? [1280, 720] : aspect === '4:5' ? [1024, 1280] : [1080, 1920];
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#264653"/><text x="${w/2}" y="${h/2}" font-size="40" fill="#fff" text-anchor="middle">AI image (mock)</text><text x="${w/2}" y="${h/2+50}" font-size="28" fill="#fff" text-anchor="middle">${esc(style||'photoreal')}</text></svg>`;
        const fp = path.join(dir, `img_${Date.now()}_${i}.svg`);
        fs.writeFileSync(fp, svg);
        images.push({ path: fp, prompt });
      }
      return { images, provider: 'mock-image' };
    },
  };
}

function MockTTSProvider() {
  return {
    name: 'mock-tts',
    async synthesize({ text, lang, gender, dialect, speed }) {
      // Real impl would call the Tamil TTS API and return an audio file.
      // Mock returns transcript metadata and a null audioPath.
      return { audioPath: null, transcript: text, lang, gender, provider: 'mock-tts' };
    },
  };
}

function MockLipSyncProvider() {
  return {
    name: 'mock-lipsync',
    async sync({ videoPath, audioPath, characterRef }) {
      return { syncedPath: videoPath, provider: 'mock-lipsync' };
    },
  };
}

module.exports = { MockRenderProvider, MockImageProvider, MockTTSProvider, MockLipSyncProvider, posterSvg };
