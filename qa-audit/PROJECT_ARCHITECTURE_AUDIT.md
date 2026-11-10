# KING 253 — Project architecture audit

Audit date: 2026-11-10. Everything below was read from the real project (no assumptions); versions come from `package.json` and the running machine.

## 1. Stack (verified)

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router, Server Actions, `output: standalone`) | 16.3.8 |
| UI | React, Tailwind CSS v4, shadcn/ui primitives, GSAP (animations) | 19.2.8 / 4 / – / 3.15 |
| Language | TypeScript (strict) | 5 |
| Database | PostgreSQL — **production 13.23** (DZSecurity), local test machine runs 17.11 | – |
| ORM / migrations | Drizzle ORM + drizzle-kit, SQL migrations applied at every server start | 0.45 / 0.31 |
| i18n | next-intl (AR / FR / EN, RTL) with URL prefixes handled in `src/proxy.ts` + `next.config.ts` rewrites | 4.14 |
| Validation | Zod | 4.6 |
| Email | Nodemailer over SMTP (`SMTP_*` env) | 10 |
| Images | sharp (re-encode to WebP) | – |
| Tests | Vitest (database integration), Playwright scripts (this audit), Postman/newman collection | 4.1 |
| Runtime | Node.js | 22.x on the host, 24.x locally |
| Hosting | DZSecurity shared hosting (cPanel, CloudLinux, Passenger), 1 GB RAM, 1 CPU | – |

## 2. How the pieces talk

```
Visitor / admin browser
   │  HTTPS (AutoSSL) → Passenger → Node (app.js → Next standalone server)
   ▼
src/proxy.ts            language routing (/ar /fr /en), first-visit language page, bots never redirected
   ▼
React Server Components + Server Actions (src/app/**, src/app/actions, src/app/admin/actions)
   ▼   every admin action → adminAction() → requireAdmin()   (server-side, never trusts the UI)
Business logic          src/server/*  (orders/create, inventory, shipping, returns, pricing, email …)
   ▼   all stock/order changes run inside one DB transaction
PostgreSQL (34 tables, 52 FKs)        ◄─ migrations drizzle/0000…0019
   ▼
External: SMTP server (not yet configured) · local disk for uploads (UPLOAD_DIR, served by /media/…)
```

* Only **two HTTP API routes** exist: `POST /api/admin/uploads` (admin only) and `GET /media/[...path]` (public images). Everything else is Server Actions, which Next protects against CSRF with origin checks.
* Orders are **not** "made to order": the shop uses real stock **per shop and per size** (`store_stock`), reserves it when an order is placed, and removes it when the order is delivered.

## 3. Size of the project

| Item | Count |
|---|---|
| Pages | 36 (13 public, 1 customer, 23 admin) |
| API routes | 2 |
| React components | 92 |
| Server modules (`src/server`) | 27 files + sub-folders |
| Server Actions | customer 6 files · admin 52 functions in 7 files |
| Database tables | 34 · foreign keys 52 · unique indexes 48 · CHECK rules 23 |
| Migrations | 20 files (0000–0019) |
| Automated tests (Vitest) | 24 files, 128 tests |
| Source lines (src) | ≈ 26,700 |

## 4. Environment variables (names only)

`DATABASE_URL`, `TEST_DATABASE_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `UPLOAD_DIR`. Values live only in `.env` files, which are git-ignored and excluded from the deploy zip (verified: no `.env` in `dist/king253.zip`, none tracked by git).

## 5. Authentication and authorization (white-box)

* Passwords: **scrypt** salted hashes. Sessions: random 32-byte token in an HttpOnly cookie; only the **SHA-256 hash** is stored in `sessions`.
* Roles `admin` / `customer`. Every one of the **52 admin server actions** goes through `adminAction()`/`requireAdmin()` (checked by a script that parses the source). `/admin/*` pages redirect to the login page for visitors and for customer accounts. The upload API answers 403 to both.
* Guest checkout: an account is created from the phone number + a password chosen at checkout; an existing phone must give its password (or tick "I forgot", which links the order without signing in).
* Order pages for customers are protected by a secret per-order token (no guessing by order number).

## 6. Risks and gaps found by reading the architecture

| # | Finding | Severity | Status |
|---|---|---|---|
| A1 | Rate limits keyed on the visitor address fell back to one shared `"local"` bucket when the host passes no address → all customers could be blocked after 8 orders in 10 minutes | HIGH (conditional) | **Fixed** (fingerprint fallback + per-phone limit) |
| A2 | New-order email did nothing and recorded nothing when no shop email exists | HIGH for the business | **Fixed** (visible record + Overview warning + one retry) |
| A3 | Rate limiter lives in memory per process (resets on restart; per-process if Passenger runs several) | LOW | Documented, acceptable at this traffic |
| A4 | Uploaded images are on local disk (`~/king253-uploads`), covered by the daily home-directory backup only if JetBackup picks them up | MEDIUM | Document / watch |
| A5 | Production DB is PostgreSQL 13; the machine used for tests is 17. New migrations use only standard SQL (ALTER, INSERT…ON CONFLICT, CREATE INDEX) | LOW | Verified on host after each deploy (`migrate.log`) |
| A6 | No Content-Security-Policy header | INFORMATIONAL | Not added (needs nonce setup; risk of breaking inline scripts) |
| A7 | No error-monitoring service; errors go to `stderr.log` on the host | LOW | Recommendation: check `stderr.log` after deploys |
| A8 | Passenger shows the request origin as `https://localhost:3000`; an absolute rewrite in the proxy caused HTTP 500 on first deploy | – | Fixed and documented in the deploy guide |

## 7. Missing documentation

Present: `docs/DZSECURITY_DEPLOYMENT_GUIDE.md`, `docs/DEPLOYMENT_AUDIT.md`, `docs/UPDATE_PLAN.md`, `data/delivery/README.md`, `DESIGN-REFERENCES.md`. Added by this audit: everything under `qa-audit/`. Still missing: an operations runbook (restore a backup, rotate the SMTP password, add a shop) — recommended.
