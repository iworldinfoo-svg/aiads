'use strict';
const fs = require('fs');
const path = require('path');
const { layout, card, table, flash, esc } = require('../lib/view');
const { t, all } = require('../lib/i18n');
const { steps, SUBTYPES, STYLE_PREVIEWS } = require('../lib/wizardSteps');
const db = require('../db');
const { decryptSecret } = require('../lib/crypto');

function jsonScript(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

// ---------- Public ----------
function home(lang) {
  const L = all(lang);
  const body = `
  <section class="hero">
    <h1>${esc(L.app_name)}</h1>
    <p class="tag">${esc(L.tagline)}</p>
    <a class="btn primary" href="/wizard">${esc(L.start)} →</a>
    <a class="btn" href="/login">${esc(L.admin)}</a>
  </section>
  <section class="features">
    ${card(L.continuity, '<p>11-படி வழிகாட்டி → தொடர்ச்சி-லாக் செய்யப்பட்ட வீடியோ. / Continuity-locked video from an 11-step guide.</p>')}
    ${card(L.live_prompt, '<p>ஒவ்வொரு பதிலும் நேரடி ப்ராம்ப்டை புதுப்பிக்கும். / Every answer updates the live prompt.</p>')}
    ${card(L.api_slots, '<p>Super Admin மாதிரி உள்ளமைக்கப்பட்ட AI மாதிரிகள். / Admin-configured AI models, hidden from users.</p>')}
  </section>`;
  return layout({ title: L.app_name, lang, body, activeNav: 'home' });
}

function login(lang, error) {
  const L = all(lang);
  const body = `
  <section class="auth">
    <h1>${esc(L.login)}</h1>
    ${flash(error, 'error')}
    <form method="post" action="/login" class="form">
      <label>${esc(L.username)}<input name="username" required></label>
      <label>${esc(L.password)}<input name="password" type="password" required></label>
      <button class="btn primary" type="submit">${esc(L.login)}</button>
    </form>
  </section>`;
  return layout({ title: L.login, lang, body });
}

// ---------- Wizard ----------
function wizard(lang, { orderId, answers }) {
  const L = all(lang);
  const body = `
  <div id="wizard" class="wizard"></div>
  <script>window.APP=${jsonScript({
    lang, orderId, answers: answers || {},
    steps, subtypes: SUBTYPES, stylePreviews: STYLE_PREVIEWS,
    i18n: L,
  })};</script>
  <script src="/public/js/wizard.js" defer></script>`;
  return layout({ title: L.app_name + ' · Wizard', lang, body, activeNav: 'wizard' });
}

// ---------- Order result ----------
function orderResult(lang, orderId) {
  const L = all(lang);
  const order = db.get('SELECT * FROM orders WHERE id=?', [orderId]);
  if (!order) return layout({ title: 'Not found', lang, body: '<p>Order not found.</p>' });
  const ans = db.get('SELECT payload FROM answers WHERE order_id=?', [orderId]);
  const answers = ans ? JSON.parse(ans.payload) : {};
  const scenes = db.all('SELECT idx,beat,continuity_score,poster_path FROM scenes WHERE order_id=? ORDER BY idx', [orderId]);
  const story = scenes.map((s) => `<li>Scene ${s.idx + 1} · ${esc(s.beat)} · score ${s.continuity_score} <img class="thumb" src="/generated/${orderId}/${path.basename(s.poster_path)}"></li>`).join('');
  const dl = order.preview_path
    ? `<a class="btn primary" href="/generated/${orderId}/${path.basename(order.preview_path)}">${esc(L.preview)}</a>`
    : (order.output_path ? `<a class="btn primary" href="/generated/${orderId}/${path.basename(order.output_path)}">${esc(L.download)}</a>` : '');
  const body = `
  <section class="result">
    <h1>${esc(L.ready)} — #${orderId} ${order.is_trial ? '(TRIAL)' : ''}</h1>
    <p>Continuity score: <b>${order.continuity_score}</b> · Credits: <b>${order.credit_estimate}</b> · Status: ${esc(order.status)}</p>
    ${dl}
    <h3>Storyboard</h3><ul class="story">${story}</ul>
    <h3>${esc(L.live_prompt)}</h3><pre class="prompt">${esc(order.master_prompt || '')}</pre>
  </section>`;
  return layout({ title: 'Order #' + orderId, lang, body });
}

// ---------- Admin ----------
function adminShell(lang, title, inner, active) {
  return layout({ title: title + ' · Admin', lang, body: `<div class="admin"><h1>${esc(title)}</h1>${inner}</div>`, activeNav: active, user: { role: 'admin' } });
}

function adminDashboard(lang) {
  const L = all(lang);
  const orders = db.get('SELECT COUNT(*) c FROM orders');
  const users = db.get("SELECT COUNT(*) c FROM users WHERE role='user'");
  const trials = db.get('SELECT COUNT(*) c FROM trials WHERE verified=1');
  const failed = db.get("SELECT COUNT(*) c FROM jobs WHERE status='failed'");
  const recent = db.all('SELECT id,status,continuity_score,credit_estimate,is_trial,created_at FROM orders ORDER BY id DESC LIMIT 10');
  const rows = recent.map((r) => [r.id, r.status, r.continuity_score, r.credit_estimate, r.is_trial ? 'trial' : 'full', r.created_at]);
  const body = `
  <div class="stats">
    ${stat(L.orders, orders.c)}${stat(L.users, users.c)}${stat(L.trial_settings, trials.c)}${stat(L.jobs, failed.c + ' failed')}
  </div>
  <h3>${esc(L.orders)}</h3>
  ${table([L.orders, 'Status', 'Continuity', 'Credits', 'Type', 'Created'], rows)}
  ${failed.c > 0 ? `<p><a class="btn" href="/admin/jobs">Review failed jobs →</a></p>` : ''}`;
  return adminShell(lang, L.dashboard, body, 'admin');
}
function stat(label, val) {
  return `<div class="stat"><div class="v">${esc(String(val))}</div><div class="l">${esc(label)}</div></div>`;
}

function adminApiSlots(lang) {
  const L = all(lang);
  const slots = db.all('SELECT * FROM api_slots ORDER BY id');
  const rows = slots.map((s) => `
    <tr data-id="${s.id}">
      <td><b>${esc(s.display_name)}</b><br><small>${esc(s.slot_key)}</small></td>
      <td><input class="Slot" data-f="endpoint_url" value="${esc(s.endpoint_url || '')}" placeholder="https://..."></td>
      <td><input class="Slot" data-f="api_key" type="password" placeholder="${s.api_key_enc ? '••• leave blank to keep' : 'API key'}"></td>
      <td><input class="Slot num" data-f="cost_per_unit" value="${esc(s.cost_per_unit)}"></td>
      <td><input class="Slot act" data-f="active" type="checkbox" ${s.active ? 'checked' : ''}></td>
      <td class="testcell">${esc(s.test_status)}</td>
      <td>
        <button class="btn small test-btn" data-id="${s.id}">Test</button>
        <button class="btn small save-btn" data-id="${s.id}">Save</button>
      </td>
    </tr>`).join('');
  const body = `
  <p class="hint">API keys are encrypted at rest (AES-256-CBC) and never exposed to the client. Endpoints are admin-only. Users never see model names — only style presets change prompts.</p>
  <table class="tbl" id="slots-tbl">
    <thead><tr><th>Slot</th><th>Endpoint URL</th><th>API key</th><th>Cost/unit</th><th>Active</th><th>Test</th><th>Actions</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
  return adminShell(lang, L.api_slots, body, 'api');
}

function adminSettings(lang) {
  const L = all(lang);
  const get = (k) => (db.get('SELECT value FROM settings WHERE key=?', [k]) || {}).value;
  const fields = [
    ['trial_length_seconds', 'Trial length (s)'],
    ['trial_watermark', 'Trial watermark (1/0)'],
    ['trial_limit_per_mobile', 'Trial limit per mobile'],
    ['free_retry_per_order', 'Free retries per order'],
    ['budget_guard_max_credits_per_order', 'Budget guard max credits/order'],
    ['default_strictness', 'Default strictness'],
  ];
  const inputs = fields.map(([k, lbl]) => `<label>${esc(lbl)}<input name="${k}" value="${esc(get(k) || '')}"></label>`).join('');
  const body = `<form method="post" action="/admin/settings" class="form grid">${inputs}<button class="btn primary" type="submit">${esc(L.save)}</button></form>`;
  return adminShell(lang, L.settings, body, null);
}

function adminTemplates(lang) {
  const L = all(lang);
  const rows = db.all('SELECT * FROM templates ORDER BY type, key');
  const body = `<table class="tbl"><thead><tr><th>Type</th><th>Key</th><th>Title</th><th>Body</th><th>Active</th></tr></thead><tbody>
  ${rows.map((r) => `<tr><td>${esc(r.type)}</td><td>${esc(r.key)}</td><td>${esc(r.title)}</td><td><pre class="tiny">${esc(r.body)}</pre></td><td>${r.active ? '✅' : '⬜'}</td></tr>`).join('')}
  </tbody></table>`;
  return adminShell(lang, L.templates, body, null);
}

function adminUsers(lang) {
  const L = all(lang);
  const rows = db.all('SELECT id,mobile,name,role,created_at FROM users ORDER BY id DESC LIMIT 50');
  const body = table(['ID', 'Mobile', 'Name', 'Role', 'Created'], rows.map((r) => [r.id, r.mobile, r.name, r.role, r.created_at]));
  return adminShell(lang, L.users, body, null);
}

function adminOrders(lang) {
  const L = all(lang);
  const rows = db.all('SELECT id,status,continuity_score,credit_estimate,is_trial,created_at FROM orders ORDER BY id DESC LIMIT 50');
  const body = table(['ID', 'Status', 'Continuity', 'Credits', 'Type', 'Created'],
    rows.map((r) => [`<a href="/orders/${r.id}">${r.id}</a>`, r.status, r.continuity_score, r.credit_estimate, r.is_trial ? 'trial' : 'full', r.created_at]));
  return adminShell(lang, L.orders, body, null);
}

function adminJobs(lang) {
  const L = all(lang);
  const rows = db.all("SELECT * FROM jobs WHERE status='failed' ORDER BY id DESC LIMIT 50");
  const body = rows.length
    ? table(['ID', 'Order', 'Step', 'Error', 'Attempts', 'Retry'],
        rows.map((r) => [r.id, r.order_id, r.step, `<pre class="tiny">${esc(r.error || '')}</pre>`, r.attempts, `<button class="btn small retry-btn" data-id="${r.id}" data-order="${r.order_id}">Retry</button>`]))
    : '<p>No failed jobs. 🎉</p>';
  return adminShell(lang, L.jobs, body, null);
}

module.exports = {
  home, login, wizard, orderResult,
  adminDashboard, adminApiSlots, adminSettings, adminTemplates, adminUsers, adminOrders, adminJobs,
};
