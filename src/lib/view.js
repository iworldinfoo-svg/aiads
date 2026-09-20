'use strict';
const { escapeHtml } = require('./router');
const { t } = require('./i18n');

const esc = escapeHtml;

// Reusable HTML primitives (server-rendered chrome). The wizard form itself is
// built client-side from wizardSteps.js, but these helpers keep page chrome DRY.
function layout({ title, lang = 'ta', body, user, activeNav }) {
  const isAdmin = user && user.role === 'admin';
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<link rel="stylesheet" href="/public/css/styles.css">
</head>
<body data-lang="${lang}">
<header class="topbar">
  <div class="brand">${esc(t('app_name', lang))}</div>
  <nav class="nav">
    ${activeNav === 'wizard' ? '' : `<a href="/wizard">${esc(t('start', lang))}</a>`}
    ${isAdmin
      ? `<a href="/admin" class="${activeNav === 'admin' ? 'active' : ''}">${esc(t('admin', lang))}</a>
         <a href="/admin/api-slots" class="${activeNav === 'api' ? 'active' : ''}">${esc(t('api_slots', lang))}</a>
         <a href="/logout">${esc(t('logout', lang))}</a>`
      : `<a href="/login">${esc(t('login', lang))}</a>`}
    <button class="lang-toggle" onclick="toggleLang()">${esc(t('lang_toggle', lang))}</button>
  </nav>
</header>
<main class="container">
${body}
</main>
<footer class="footer">${esc(t('note_mock', lang))}</footer>
<script>window.__LANG__=${JSON.stringify(lang)};</script>
<script src="/public/js/admin.js" defer></script>
</body>
</html>`;
}

function card(title, inner) {
  return `<section class="card"><h2>${esc(title)}</h2>${inner}</section>`;
}

function table(headers, rows) {
  const h = headers.map((x) => `<th>${esc(x)}</th>`).join('');
  const r = rows.map((row) => `<tr>${row.map((c) => `<td>${c == null ? '' : esc(String(c))}</td>`).join('')}</tr>`).join('');
  return `<table class="tbl"><thead><tr>${h}</tr></thead><tbody>${r}</tbody></table>`;
}

function flash(msg, kind = 'info') {
  if (!msg) return '';
  return `<div class="flash ${kind}">${esc(msg)}</div>`;
}

module.exports = { esc, layout, card, table, flash };
