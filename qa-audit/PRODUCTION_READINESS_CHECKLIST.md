# Production readiness checklist — KING 253

Verdict (2026-11-10): **CONDITIONALLY READY.**
The software passes every executed test on the final deploy package. It is **not yet ready to take real customers** because of items that only the owner can complete (products, shop emails, email account, Stop-desk list) and because the fixed package has **not been deployed yet** — the live site still runs the previous version.

Scale used: ✅ verified with evidence · ⚠️ done but needs the owner / a deploy · ⛔ blocking for real customers · ➖ not tested (blocked).

## A. Software quality (final package, local, same files as the host)

| Check | Result |
|---|---|
| Production build, TypeScript, lint | ✅ build OK, 0 type errors, 0 lint errors |
| Automated tests | ✅ 128 / 128 (database integration, concurrency, emails, orders, returns, status, shops, delivery…) |
| Real guest orders through the real buttons (3 languages, phone + desktop, bag route) | ✅ 18 / 18 — order rows verified in the database |
| Accounts: sign-in with phone, wrong password, sign-up validation, add email, cancel own order, sign-out | ✅ 13 / 13 |
| Admin lifecycle: confirm → deliver → return → exchange → cancel | ✅ 8 / 8 |
| Database integrity on real data | ✅ 28 / 28 |
| Security | ✅ 46 / 47 (the 1 is the informational CSP) — no open CRITICAL / HIGH |
| Image upload attacks | ✅ 16 / 16 |
| SEO (titles, descriptions, canonical, hreflang, sitemap, robots, JSON-LD, 404, share image) | ✅ 19 / 20 (the 1 = a test product with a 15-character description — data, not code) |
| 9 screen sizes × public pages, keyboard focus, overflow, console errors | ✅ see RESPONSIVE_AND_UX_REPORT.md |
| Click-through: every button on the storefront, 14+ admin pages | ✅ no dead buttons left (placeholder social-login buttons removed) |
| Known framework vulnerabilities | ✅ Next.js upgraded to 16.4.6; 0 critical; 0 vulnerable packages inside the deploy bundle |

## B. Blocking items for real customers (owner actions)

| # | Item | Status |
|---|---|---|
| B1 | **Deploy the new package** (framework security fix, HSTS, Buy now fix, admin updates, 3 database migrations) — upload `dist/king253.zip`, then I unzip/restart and check `migrate.log` | ⛔ not yet done |
| B2 | **Products:** the live shop has **0 products** (checked on /fr/clothes). Add real products with photos, price, sizes, stock per shop — they now appear in the shop as soon as they are saved as Published | ⛔ |
| B3 | **Shop notification emails** (Annaba, Constantine) in Admin → Shops. Until then a new order notifies nobody (the admin Overview shows a warning) | ⛔ |
| B4 | **Email account (SMTP)** in the server `.env` (`SMTP_HOST/PORT/USER/PASS/FROM`). Without it emails are only recorded | ⛔ |
| B5 | **Stop desk addresses** (the ZR Express PDF has prices but no desk list). Until imported, customers can only choose home delivery | ⚠️ (home delivery works) |
| B6 | **Real shop data:** Constantine's stock and delivery prices (only Annaba's ZR Express prices are loaded); wilayas without a price show "price by phone" | ⚠️ |

## C. Deployment configuration

| Check | Result |
|---|---|
| HTTPS, http → https, www → bare domain | ✅ live (301 redirects); certificate Let's Encrypt, valid until 2027-02-06 (AutoSSL renews) |
| HSTS header | ⚠️ added in this package; **missing on the live site until B1** |
| `.env` not in the zip, not in git | ✅ |
| Migrations apply automatically at start (`migrate.log`) | ✅ (0012–0016 applied earlier on the host; 0017–0019 are standard SQL) |
| Passenger-style request origin | ✅ tested with `Host` / `X-Forwarded-*` headers; earlier HTTP 500 fixed and documented |
| Rollback | ✅ the previous version stays on the server as `~/king253-prev-*`; swap folders and restart |
| Backups | ✅ daily `pg_dump` at 03:00, all dumps kept · ⚠️ **a restore has never been tested** — do it once on a spare database |
| Uploads folder `~/king253-uploads` | ⚠️ confirm it is included in the host's backups |
| Error monitoring | ⚠️ none; read `~/king253/stderr.log` after each deploy |
| Dependency audit before each deploy | ✅ `npm audit --omit=dev` (0 critical now) |

## D. Not tested (BLOCKED) — be aware

* Firefox, Safari/WebKit, Edge (only Chromium is installed here; downloading browsers was not approved).
* Real email delivery (no SMTP yet) — verified with a mock transport only.
* Placing an order on **king253.com** (it would write to the real database; there are no products there yet). After B1 + B2, run **one** supervised test order and delete it.
* Database connection failure and restore (destructive).
* Google Search Console (not set up yet — planned).

## E. Final acceptance rules

| Rule | Status |
|---|---|
| Unresolved critical/high security issue | none ✅ |
| Core ordering workflow broken | no ✅ (18/18) |
| Unauthorized admin access | none ✅ (20/20) |
| Serious database integrity failure | none ✅ (28/28) |
| Data-loss defect unresolved | none ✅ |
| Failed production build | no ✅ |
| Missing essential deployment configuration | **B1–B4** ⛔ → therefore **conditional**, not unconditional |

**Unconditional PRODUCTION READY is only claimed after B1–B4 are done and one supervised order succeeds on king253.com.**
