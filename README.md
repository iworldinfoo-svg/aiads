# AI Ad Video Studio (Foundational Build)

Continuity-locked AI video-ad generator for small businesses in Tamil Nadu.
Guided 11-step wizard → English master prompt (from Tamil answers) →
continuity-locked render → FFmpeg post-processing + vector end card → deliver.

> **Stack note:** The original spec called for **PHP + MySQL**. This sandbox has
> no PHP/MySQL (and no network to install them), so per the agreed plan this
> foundation is built in **Node.js + SQLite (zero dependencies, `node:sqlite`)**.
> The architecture maps 1:1 to the PHP/MySQL target — see *MySQL port* below.

## Run it

```bash
node src/server.js          # or: npm start
# open http://localhost:3000  (binds 0.0.0.0:3000)
```

No `npm install` needed — everything uses Node built-ins (`http`, `node:sqlite`,
`crypto`, `fs`). Works on Node ≥ 22.5 (for `node:sqlite`).

**Super Admin:** username `admin` / password `admin123` — **change this** via
`ADMIN_PASS` env var or by editing the seeded user.

## What works today (end-to-end, runnable)

| Area | Status |
|------|--------|
| 11-step wizard (Tamil UI + EN toggle) | ✅ server-driven config, client-rendered |
| Live prompt builder + continuity meter + credit estimate (sidebar, updates on every answer) | ✅ |
| Conditional questions (real-estate extras, character step, generate-only image fields) | ✅ |
| Dialogue step (system-written Tamil dialogue, editable, confirm) | ✅ |
| Master prompt builder (all 14 sections + hard negative rules) | ✅ |
| Continuity engine (lock model, character sheet, score meter, last-frame chaining model) | ✅ logic; real frame-embedding is a mock |
| Credits & cost control (estimate, strictness multiplier, ledger) | ✅ |
| Trial system (OTP mock, 5s/720p/watermark, 1 per mobile) | ✅ |
| Super Admin (API slots w/ AES-encrypted keys, test button, settings, templates, dashboard, users/orders/jobs, failed-job retry) | ✅ |
| Provider adapter layer (mock render / image / TTS / lip-sync; admin-swappable) | ✅ mock; real adapters are stubs to implement |
| End card (vector SVG — zero distortion, never through AI) | ✅ |
| Job pipeline (validate → prompt → character sheet → approval gate → render → TTS/lip-sync → end card → assemble → QC → deliver) | ✅ |
| FFmpeg post-processing | ⚠️ command builder is real; MP4 assemble needs FFmpeg installed. Without it the app produces an **HTML preview** of the scenes + end card. |

## Architecture

```
src/
  config.js            paths, secret, port
  server.js            http server + all routes
  db/schema.sql        canonical SQLite schema (MySQL-portable)
  db/index.js          node:sqlite wrapper + auto-migrate
  lib/
    crypto.js          scrypt passwords, AES-256-CBC key encryption, signed cookies, OTP hash
    i18n.js            Tamil/English chrome strings
    session.js         in-memory signed sessions
    router.js          tiny router: path params, JSON/urlencoded bodies, static, /generated
    view.js            HTML helpers
    wizardSteps.js     ★ single source of truth for all 11 steps (bilingual)
    promptBuilder.js   answers → English master prompt + Tamil dialogue
    continuity.js      continuity meter, character sheet, per-scene QC score
    credits.js         credit estimate + ledger
    trial.js           OTP (mock) + 1-per-mobile limit
    endcard.js         vector SVG end card (zero distortion)
    ffmpeg.js          FFmpeg detection + command builder
    seed.js            admin, API slots, templates, settings
    jobs.js            full generation pipeline orchestration
    providers/
      interface.js     adapter contract (implement these for real APIs)
      mock.js          mock render/image/TTS/lip-sync
      registry.js      slot → provider resolution (admin-swappable)
  views/pages.js       server-rendered pages (home, login, wizard shell, admin, result)
public/
  css/styles.css       mobile-first UI
  js/wizard.js         wizard client (steps, live preview, trial flow)
  js/admin.js          admin client (slot test/save, job retry)
data/  uploads/  generated/   runtime artifacts (gitignored)
```

## Key design decisions (spec → implementation)

- **Users never see model names.** Only style presets change prompts. The
  primary/fallback model is configured in Super Admin → API slots.
- **Hard rule enforced in the prompt builder:** AI must never generate text,
  logos, numbers or signboard lettering. Logo/text/address/price/approval/date
  are overlaid in post. The end card is vector SVG (FFmpeg composites the user's
  building/shop image without re-encoding it → zero distortion).
- **Continuity meter (0–100)** is derived from active locks + chaining method +
  strictness; shown live in the wizard sidebar and stored per order.
- **Trial:** 5s, 720p, watermarked, OTP-gated, 1 per mobile number.

## REST / JSON endpoints

Public wizard: `/wizard`, `/api/state`, `/api/answers`, `/api/preview`,
`/api/trial/send-otp`, `/api/trial/verify`, `/api/orders/:id/generate`,
`/orders/:id/approve`, `/orders/:id`.

Admin (auth): `/admin`, `/admin/api-slots` (+ `POST /admin/api-slots`,
`POST /admin/api-slots/:id/test`), `/admin/settings`, `/admin/templates`,
`/admin/users`, `/admin/orders`, `/admin/jobs` (+ `POST /admin/jobs/:id/retry`).

## MySQL port (for the production PHP/MySQL target)

`src/db/schema.sql` is SQLite-flavoured. To port:
- `INTEGER PRIMARY KEY AUTOINCREMENT` → `INT AUTO_INCREMENT PRIMARY KEY`
- `REAL` → `DECIMAL(10,4)`; `INTEGER` booleans → `TINYINT(1)`
- `TEXT` → `VARCHAR`/`TEXT`; add FK constraints + indexes.
- `node:sqlite` calls in `db/index.js` → PDO / mysqli. The rest of `lib/` is
  DB-agnostic (plain SQL strings).

## Not yet implemented (clearly scoped next steps)

1. **Real provider adapters** for primary/fallback video, image gen, Tamil TTS,
   lip-sync — implement the contract in `providers/interface.js` and register in
   `registry.js`. Super Admin already stores endpoints + encrypted keys.
2. **FFmpeg MP4 assembly** on a host that has `ffmpeg` installed (the command
   builder is ready).
3. **Real OTP SMS gateway** + **real QR generation** for the WhatsApp end card.
4. **GST invoices / UPI payments** and **commercial-use terms** for customer images.
5. File upload via multipart (currently images are sent base64-in-JSON for the
   foundation; switch to streaming multipart on a real deployment).
6. **Lip-sync** is currently a pass-through; wire a real model for the
   `character_speaking` style.
