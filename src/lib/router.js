'use strict';
const fs = require('fs');
const path = require('path');
const { PUBLIC_DIR } = require('../config');
const session = require('./session');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function parsePattern(pattern) {
  // /admin/api-slots/:id -> regex + param names
  const names = [];
  const rx = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, (m) => (m === ':' ? ':' : '\\' + m))
    .replace(/:([A-Za-z0-9_]+)/g, (_, n) => {
      names.push(n);
      return '([^/]+)';
    });
  return { regex: new RegExp('^' + rx + '$'), names };
}

class Router {
  constructor() {
    this.routes = [];
    this.notFound = null;
  }
  add(method, pattern, handler, opts = {}) {
    const { regex, names } = parsePattern(pattern);
    this.routes.push({ method, regex, names, handler, auth: opts.auth || null });
    return this;
  }
  get(p, h, o) { return this.add('GET', p, h, o); }
  post(p, h, o) { return this.add('POST', p, h, o); }

  async handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    const method = req.method;

    // Attach helpers
    await this._decorate(req, res, url);

    // Static files
    if (method === 'GET' && pathname.startsWith('/public/')) {
      return this._serveStatic(res, pathname.slice('/public'.length));
    }
    if (method === 'GET' && pathname.startsWith('/generated/')) {
      return this._serveGenerated(res, pathname.slice('/generated'.length));
    }

    for (const r of this.routes) {
      if (r.method !== method) continue;
      const m = pathname.match(r.regex);
      if (!m) continue;
      req.params = {};
      r.names.forEach((n, i) => (req.params[n] = decodeURIComponent(m[i + 1])));
      req.query = Object.fromEntries(url.searchParams);
      // Auth gate
      if (r.auth === 'admin' && (!req.session || req.session.role !== 'admin')) {
        if (req.acceptsJson) return res.json({ error: 'unauthorized' }, 401);
        return res.redirect('/login');
      }
      try {
        await r.handler(req, res);
      } catch (e) {
        console.error('Route error', pathname, e);
        if (req.acceptsJson) return res.json({ error: 'server_error', message: String(e.message) }, 500);
        res.html('<h1>Server error</h1><pre>' + escapeHtml(String(e.stack || e.message)) + '</pre>', 500);
      }
      return;
    }
    if (this.notFound) return this.notFound(req, res);
    res.html('<h1>404 Not Found</h1>', 404);
  }

  async _decorate(req, res, url) {
    // Cookies
    const cookies = {};
    const ch = req.headers.cookie || '';
    ch.split(';').forEach((c) => {
      const idx = c.indexOf('=');
      if (idx > 0) cookies[c.slice(0, idx).trim()] = decodeURIComponent(c.slice(idx + 1).trim());
    });
    req.cookies = cookies;
    req.session = session.get(session.readSessionId(cookies));
    req.userId = req.session ? req.session.userId : null;
    req.role = req.session ? req.session.role : null;

    const ct = (req.headers['content-type'] || '').toLowerCase();
    req.acceptsJson = ct.includes('application/json') || (req.headers.accept || '').includes('application/json');

    // Body parsing (JSON; uploads are sent base64-in-JSON in this foundation)
    req.body = {};
    if (req.method === 'POST' || req.method === 'PUT') {
      req.body = await readJsonBody(req, ct);
    }

    // Response helpers
    res.json = (obj, code = 200) => {
      res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(obj));
    };
    res.html = (str, code = 200) => {
      res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(str);
    };
    res.redirect = (loc) => {
      res.writeHead(302, { Location: loc, 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Redirect to ' + loc);
    };
    res.setCookie = (name, value, opts = {}) => {
      let v = name + '=' + encodeURIComponent(value) + '; Path=/; SameSite=Lax';
      if (opts.httpOnly) v += '; HttpOnly';
      if (opts.maxAge != null) v += '; Max-Age=' + opts.maxAge;
      const prev = res.getHeader('Set-Cookie');
      res.setHeader('Set-Cookie', prev ? prev + ', ' + v : v);
    };
    res.sendFile = (filePath, opts = {}) => {
      fs.stat(filePath, (err, st) => {
        if (err) { res.writeHead(404); res.end('Not found'); return; }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
          'Content-Type': opts.contentType || MIME[ext] || 'application/octet-stream',
          'Content-Length': st.size,
          ...(opts.headers || {}),
        });
        fs.createReadStream(filePath).pipe(res);
      });
    };
  }

  _serveStatic(res, rel) {
    const fp = path.normalize(path.join(PUBLIC_DIR, rel));
    if (!fp.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end('Forbidden'); return; }
    fs.stat(fp, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404); res.end('Not found'); return; }
      const ext = path.extname(fp).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      fs.createReadStream(fp).pipe(res);
    });
  }

  _serveGenerated(res, rel) {
    const { GEN_DIR } = require('../config');
    const fp = path.normalize(path.join(GEN_DIR, rel));
    if (!fp.startsWith(GEN_DIR)) { res.writeHead(403); res.end('Forbidden'); return; }
    fs.stat(fp, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404); res.end('Not found'); return; }
      const ext = path.extname(fp).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      fs.createReadStream(fp).pipe(res);
    });
  }
}

function readJsonBody(req, ct) {
  return new Promise((resolve) => {
    let data = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 25 * 1024 * 1024) { req.destroy(); resolve({}); return; } // 25MB cap
      data += chunk;
    });
    req.on('end', () => {
      if (!data) return resolve({});
      if (ct.includes('application/json')) {
        try { return resolve(JSON.parse(data)); } catch { return resolve({}); }
      }
      if (ct.includes('application/x-www-form-urlencoded')) {
        const o = {};
        new URLSearchParams(data).forEach((v, k) => (o[k] = v));
        return resolve(o);
      }
      // Try JSON anyway
      try { return resolve(JSON.parse(data)); } catch { return resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

module.exports = { Router, escapeHtml, MIME };
