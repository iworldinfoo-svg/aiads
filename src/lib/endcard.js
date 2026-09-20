'use strict';
const fs = require('fs');
const path = require('path');
const { GEN_DIR } = require('../config');

// Generates a vector SVG end card. Vector output guarantees zero distortion
// regardless of resolution (spec: "Image is never passed through the AI model").
// The user building/shop image is composited as an <image> reference, not re-encoded.

const W = 1080, H = 1920;

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function paletteColors(palette) {
  if (!palette) return ['#0b1f3a', '#c9a24b'];
  const parts = String(palette).split(/[+,/]/).map((s) => s.trim().toLowerCase());
  const map = {
    red: '#d7263d', gold: '#c9a24b', blue: '#1d3557', green: '#2a9d8f',
    pink: '#e75480', black: '#111111', white: '#f5f5f5', orange: '#f4801f',
    purple: '#6a4c93', yellow: '#ffd166',
  };
  const cols = parts.map((p) => map[p]).filter(Boolean);
  return cols.length ? cols : ['#0b1f3a', '#c9a24b'];
}

function qrPlaceholder(seed, x, y, size) {
  // Deterministic pseudo-QR grid (placeholder only; real QR needs a generator).
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const n = 21, cell = size / n;
  let rects = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      h = (h * 1103515245 + 12345) >>> 0;
      if ((h >> 16) & 1) {
        rects += `<rect x="${(x + c * cell).toFixed(1)}" y="${(y + r * cell).toFixed(1)}" width="${cell.toFixed(1)}" height="${cell.toFixed(1)}" fill="#111"/>`;
      }
    }
  }
  return `<g>${rects}<text x="${x + size / 2}" y="${y + size + 28}" font-size="26" fill="#444" text-anchor="middle">QR (placeholder)</text></g>`;
}

function generateEndCard({ layout = 'logo_phone', logoPath, brand, phone, whatsapp, address, website, palette, bgImagePath }) {
  const [c1, c2] = paletteColors(palette);
  const defs = `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>`;
  const bg = bgImagePath
    ? `<image href="${esc(bgImagePath)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`
    : `<rect width="${W}" height="${H}" fill="url(#bg)"/>`;

  const logo = logoPath
    ? `<image href="${esc(logoPath)}" x="${W / 2 - 200}" y="180" width="400" height="200" preserveAspectRatio="xMidYMid meet"/>`
    : `<text x="${W / 2}" y="320" font-size="76" font-weight="700" fill="#fff" text-anchor="middle" font-family="Arial, sans-serif">${esc(brand || 'Your Brand')}</text>`;

  let body = '';
  if (layout === 'logo_phone') {
    body = `<text x="${W / 2}" y="900" font-size="64" fill="#fff" text-anchor="middle">📞 ${esc(phone || '')}</text>
            <text x="${W / 2}" y="1000" font-size="40" fill="#fff" text-anchor="middle" opacity="0.9">Call now</text>`;
  } else if (layout === 'logo_address_map') {
    body = `<text x="${W / 2}" y="860" font-size="40" fill="#fff" text-anchor="middle">${esc(address || '')}</text>
            <rect x="340" y="920" width="400" height="300" rx="16" fill="#000" opacity="0.25"/>
            <text x="${W / 2}" y="1080" font-size="34" fill="#fff" text-anchor="middle" opacity="0.85">📍 Map</text>`;
  } else if (layout === 'whatsapp_qr_phone') {
    body = qrPlaceholder(whatsapp || phone || 'wa', 390, 760, 300) +
      `<text x="${W / 2}" y="1180" font-size="64" fill="#fff" text-anchor="middle">💬 ${esc(whatsapp || phone || '')}</text>`;
  } else if (layout === 'offer_phone') {
    body = `<text x="${W / 2}" y="880" font-size="58" fill="#ffd166" text-anchor="middle" font-weight="700">Special Offer</text>
            <text x="${W / 2}" y="1000" font-size="64" fill="#fff" text-anchor="middle">📞 ${esc(phone || '')}</text>`;
  }
  const web = website ? `<text x="${W / 2}" y="1700" font-size="32" fill="#fff" text-anchor="middle" opacity="0.85">${esc(website)}</text>` : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${defs}${bg}${logo}${body}${web}</svg>`;
  return svg;
}

// Save end card to generated/<order>/endcard.svg and return the path.
function saveEndCard(orderId, opts) {
  const dir = path.join(GEN_DIR, String(orderId));
  fs.mkdirSync(dir, { recursive: true });
  const fp = path.join(dir, 'endcard.svg');
  fs.writeFileSync(fp, generateEndCard(opts));
  return fp;
}

module.exports = { generateEndCard, saveEndCard, W, H };
