# KING 253 — Deployment Audit (Stage 1)

Target: DZSecurity shared hosting (cPanel + Phusion Passenger, Node.js 22, MySQL), domain `253king.com`.
Audit date: 2026-11-08. Based on the repository at commit `4cb2da2` and the local development database.
**No code, database or hosting changes were made during this audit.**

---

## 0. Hosting facts verified in the owner's account (2026-11-08)

Read-only inspection of the client area and cPanel, nothing created or changed.

| Item | Verified value |
|---|---|
| Plan | **Starter-20** shared hosting (4 500 DA / year), active, renews 07/11/2027 |
| Server | `oort-shared.dzsecurity.net`, Linux x86_64 (EL9 kernel, CloudLinux LVE), cPanel 138, Apache 2.4.69, shared IP 157.90.66.113 |
| Limits | **1 GB physical memory**, 1 CPU (100%), **20 entry processes**, 250 processes, 1 024 IOPS, 97.66 GB disk, 488 GB bandwidth, 10 MySQL + **10 PostgreSQL databases**, 10 subdomains |
| Node.js | "Setup Node.js App" (Passenger), **Node 22.23.4** available |
| MySQL side | **MariaDB 10.11.19** (not MySQL 8) |
| PostgreSQL | **Available**: "PostgreSQL Databases", "PostgreSQL Database Wizard" and phpPgAdmin 7.14 are in cPanel; local socket `/var/run/postgresql:5432`; account prefix `kingco32_`. Exact server version visible once a first database exists (the app needs ≥ 13 for `gen_random_uuid`). |
| Terminal | Disabled by default; can be enabled from the client area ("تفعيل الوصول إلى Terminal") |
| Domain | `king253.com` — **registered 2026-11-08 22:19 UTC** (Realtime Register), name servers `oort-shared.dzsecurity.net` / `dns2-r.dzsecurity.net`; DNS propagating |
| Billing | Hosting and domain invoice paid; two open invoices are only "add credit" requests (not services) |

**Consequence:** PostgreSQL is offered on this account, so the MySQL/MariaDB port (sections 2 and 9) is **not required**. Keeping PostgreSQL removes the riskiest part of the work. Note also the domain is **king253.com** (not 253king.com).

---

## 1. Current architecture

| Layer | What exists today |
|---|---|
| Framework | **Next.js 16.3.8 (App Router)**, React 19.2, TypeScript, Turbopack |
| Frontend | 33 pages (storefront + admin), server-rendered React components, Tailwind CSS 4, Radix UI, Framer Motion, GSAP, Lenis, Recharts |
| Backend | **Inside Next.js**: 71 Server Actions in 11 files + 2 route handlers (`/api/admin/uploads`, `/media/[...path]`) |
| Database | **PostgreSQL 17** via **Drizzle ORM 0.45** + `postgres` (postgres-js) driver |
| Schema | 26 tables, 14 Postgres enums, 12 SQL migrations in `drizzle/` |
| Auth | Own implementation: scrypt password hashes, server-side sessions in DB, HTTP-only cookie, admin role checks on every admin action |
| Uploads | Admin image upload → validated by file signature (JPEG/PNG/WebP/AVIF), re-encoded/renamed to `<uuid>.webp`, max 10 MB / 12 files, stored on disk in `UPLOAD_DIR` (default `./storage/uploads`), served by `/media/...` |
| Email | Nodemailer over SMTP (Gmail app password today) |
| Payment | None online — cash on delivery only |
| Tests | Vitest, 105 integration tests against a real PostgreSQL test database |

There is **no separate frontend/backend split and no Express server today**. The frontend and the backend are one Next.js application: pages are rendered on the server and talk to the database directly in server code; the browser never touches the database.

## 2. Current database technology and PostgreSQL coupling

Measured in `src/`, `scripts/` and `tests/`:

| PostgreSQL-specific feature | Occurrences | MySQL equivalent |
|---|---|---|
| `drizzle-orm/pg-core` schema (26 tables) | 1 file | `drizzle-orm/mysql-core` — rewrite of `schema.ts` (643 lines) |
| `postgres` driver | 7 files | `mysql2` driver + `drizzle-orm/mysql2` |
| `pgEnum` | 14 enums | inline `mysqlEnum` per column |
| `uuid` columns / `defaultRandom()` | 81 | `char(36)` + `$defaultFn(() => crypto.randomUUID())` |
| `jsonb` | 6 | `json` |
| `timestamp … withTimezone` | 29 | `datetime`/`timestamp` stored in UTC (MySQL has no time-zone-aware type) |
| `.returning()` | **54 in 21 files** | **not supported by MySQL** — re-select after insert/update (or `$returningId()`) |
| `onConflictDo…` (upsert) | 8 in 6 files | `onDuplicateKeyUpdate` |
| Raw `sql` fragments | 116 in 22 files | review one by one |
| `::int`, `::numeric`, `::uuid`… casts | 96 in 18 files | `CAST(… AS SIGNED/DECIMAL)` or remove |
| `FILTER (WHERE …)` aggregates | 26 in 5 files | `SUM(CASE WHEN … THEN … END)` |
| `ILIKE` | 24 in 4 files | `LIKE` (case-insensitive with the default collation) |
| `json_agg` / `jsonb_build_object` / `json_build_object` | 12 in 3 files | `JSON_ARRAYAGG` / `JSON_OBJECT` |
| `array_agg`, `text[]` arrays | 3 in 2 files | `JSON` column / `GROUP_CONCAT` |
| `LATERAL` joins | 4 in 1 file (catalog query) | MySQL ≥ 8.0.14 supports LATERAL — **MariaDB does not** |
| `to_char`, `AT TIME ZONE` | 6 in 2 files | `DATE_FORMAT`, `CONVERT_TZ` (needs time-zone tables) or a fixed `+01:00` offset |
| `SELECT … FOR UPDATE` (stock locking) | 9 in 5 files | supported (InnoDB) |
| Transactions | 29 in 9 files | supported (InnoDB) |
| Window functions `count(*) over()` | 6 in 3 files | MySQL ≥ 8.0 / MariaDB ≥ 10.2 |
| `check()` constraints | 13 | enforced from MySQL 8.0.16 / MariaDB 10.2 |
| Unique / functional indexes (e.g. `lower(email)`) | 10 | functional indexes need MySQL ≥ 8.0.13; MariaDB needs a generated column |

**Conclusion:** the migration is a real port, not a connection-string change: new schema, new migrations, and a review of roughly **400 database touch points**, with stock reservations, money calculations and order numbering being the most sensitive.

**Unknown that blocks the plan:** the exact server on DZSecurity — *MySQL 8.x* or *MariaDB 10.x/11.x* (most cPanel hosts ship MariaDB). Several features above (LATERAL, functional indexes, JSON functions) differ between the two. **Check in cPanel → phpMyAdmin → "Server version".**

## 3. Data to migrate

Current local database (development/test data): 14 products, 25 product images, 14 variants, 7 categories, 6 orders, 3 users, 26 settings, 1 shop, content blocks. Uploaded images: 10 files, 1.2 MB.
Production does not exist yet, so there is **no live data at risk**. Options: start production from a clean migrated schema + seed (recommended), then the owner enters real products; or transfer the current data with a one-off script, with record counts verified.

## 4. DZSecurity compatibility

| Requirement from the host | Project status | Action |
|---|---|---|
| Node.js 22 | Next 16 needs Node ≥ 20.9 | ✅ compatible |
| Apps run by Passenger, CommonJS startup file | Next's `output: "standalone"` produces a CommonJS `server.js` | add a small CommonJS `app.js` that loads it |
| No custom ports | Passenger hooks `listen()`; the app must use `process.env.PORT` | ✅ standalone server already does |
| No background processes | No cron/worker. Emails, analytics use `after()` (runs inside the request process) | ✅ no change; abandoned carts and vacation mode are computed on read |
| Several Passenger processes | In-memory rate limiter is per process; Server Actions need a stable key | set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`; limiter stays approximate (documented risk) |
| Remote MySQL forbidden | Tests and migrations need a database | run migrations from the cPanel Terminal on the server; local tests need a local MySQL/MariaDB of the same version |
| No external SSH, cPanel Terminal only | Build is heavy (Turbopack) | **build locally, upload the standalone bundle** (zip via File Manager) |
| Linux x86-64 server | `sharp` (image optimisation) installed for macOS only; wasm fallback present | install the Linux `sharp` build in the bundle, or disable Next image optimisation (images are already WebP) |
| Persistent disk | Uploads written to disk | ✅ set `UPLOAD_DIR` to a folder outside `public_html` (e.g. `~/king253-uploads`), included in cPanel backups |
| HTTPS | Not configured yet | cPanel AutoSSL (Let's Encrypt) |
| Domain | `253king.com` and `api.253king.com` **do not resolve yet** (no DNS records) | register / point the domain to DZSecurity |

## 5. Recommended deployment architecture

**Option A — Keep Next.js, run it as one Node.js app on Passenger (recommended)**

```
https://253king.com  →  Passenger (Node 22)  →  Next.js standalone server  →  local MySQL
                                                   └─ /media/* serves ~/king253-uploads
```

- Zero rewrite of pages, design, Server Actions or SEO (server rendering is kept).
- The browser still never talks to MySQL; all database access stays on the server.
- `api.253king.com` is not needed (it can be added later if a mobile app needs a REST API).
- Work: MySQL port + standalone build + Passenger startup file + docs.

**Option B — Rewrite as React SPA + Express REST API (the target described in the brief)**

- Rewrite 71 Server Actions as ~70 REST endpoints, move 33 server-rendered pages to a client-side SPA with a router, add API auth (CSRF/CORS/cookies across subdomains), redo SEO (an SPA loses server rendering).
- Several weeks of work, high risk of regressions, and the MySQL port is still required.

**Option C — Frontend on Vercel, Express API on DZSecurity**

- Same rewrite as B, plus cross-origin cookies/CORS between `vercel.app`/`253king.com` and `api.253king.com`, and two platforms to maintain. No benefit over A for this shop.

| Criterion | A — Next on Passenger | B — SPA + Express | C — Vercel + Express |
|---|---|---|---|
| Compatibility with host | ✅ Node app via Passenger | ✅ | ✅ (API part) |
| Rewrite needed | MySQL port only | Full backend + frontend rewrite | Same as B |
| SEO | ✅ kept | ⚠️ weaker | ⚠️ weaker |
| Cost | Hosting plan only | Hosting plan | Hosting + possible Vercel limits |
| Complexity / maintenance | Low (1 app) | High (2 apps) | Highest (2 apps, 2 platforms) |
| Security surface | Same as today | New public API to secure | New public API + cross-origin |

## 6. Required environment variables (production)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | `mysql://USER:PASSWORD@localhost:3306/DBNAME` (MySQL user created in cPanel) |
| `NEXT_PUBLIC_SITE_URL` | `https://253king.com` (canonical URLs, sitemap, emails — set **at build time**) |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | stable key for multiple Passenger processes (`openssl rand -base64 32`) |
| `UPLOAD_DIR` | absolute path outside `public_html`, e.g. `/home/<cpanel-user>/king253-uploads` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | order emails (Gmail app password, or the host's mailbox) |
| `NODE_ENV` | `production` (set by Passenger) |

`TEST_DATABASE_URL` is only for local tests and must not be set in production. Secrets are entered in cPanel → Setup Node.js App → Environment variables, never committed.

## 7. Required hosting configuration (summary — full guide comes at Stage 8)

1. Domain `253king.com` pointed to the DZSecurity name servers; AutoSSL issued.
2. cPanel → MySQL Databases: database + user with all privileges on that database only.
3. cPanel → Setup Node.js App: Node 22, application root `~/king253`, URL `253king.com`, startup file `app.js`, environment variables above.
4. Upload the standalone bundle (built locally) to `~/king253`; run migrations from the cPanel Terminal.
5. Create the uploads folder, create the first admin with the provided script, restart the app.

## 8. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| MariaDB instead of MySQL 8 | LATERAL / functional indexes / some JSON functions unavailable | confirm version first; write SQL that works on both where possible |
| Behaviour change during the SQL port (stock, totals, revenue) | wrong stock or money figures | keep all 105 tests, run them against a local MySQL/MariaDB of the same version before deploying |
| Plan memory / process limits | Next server needs ~250–400 MB per process | verify limits in cPanel → Resource Usage; keep Passenger to 1–2 processes |
| Native `sharp` mismatch | image optimisation errors | ship the Linux build or disable optimisation |
| Rate limiting per process | limits are approximate | acceptable for this traffic; document |
| Time zone (`AT TIME ZONE` / dates) | daily stats shifted by one hour | Algeria is UTC+1 without DST → fixed offset |
| Domain not yet configured | site unreachable | registrar / DNS step by the owner |
| Building on the host | Turbopack build may exceed shared-host limits | build locally, upload the bundle |

## 9. Files expected to change (Option A)

- `src/server/db/schema.ts`, `src/server/db/client.ts`, `drizzle.config.ts`, `drizzle/` (new MySQL migrations)
- 21 files using `.returning()`, 22 files with raw SQL (catalog, analytics, admin queries, pricing SQL, orders, inventory, returns, account, customers, social, settings, reviews…)
- `scripts/*.mjs` (migrate, seed, create-admin, demo, reset) and `tests/support` (test DB setup)
- `package.json` (`postgres` → `mysql2`), `next.config.ts` (`output: "standalone"`), new `app.js` (Passenger), `.env.example`
- New docs: `docs/DZSECURITY_DEPLOYMENT_GUIDE.md`

No change to pages, design, components or business rules is planned.
