# Test execution report

Final runs on **2026-11-10**, on the **final deploy package** (`dist/king253.zip`, Next.js 16.4.6, migrations 0000–0019) served locally with host-like headers, plus read-only runs on **https://king253.com** (still the previous version). Every line below was executed; nothing is counted as passed without a checked result.

## 1. Summary by suite

| # | Suite | Environment | Executed | Passed | Failed | Blocked / skipped | Evidence |
|---|---|---|---|---|---|---|---|
| 1 | Vitest database integration (orders, stock per shop, returns, exchanges, accounts, delivery, emails, status by hand, **concurrency**, overview, …) | test DB | 128 | **128** | 0 | 0 | `npx vitest run` |
| 2 | Real guest orders + abuse cases (`orders-e2e.cjs`) | package | 18 | **18** | 0 | 0 | screenshots + DB rows |
| 3 | Accounts / sign-in / cancel own order (`auth-account-e2e.cjs`) | package | 13 | **13** | 0 | 0 | screenshots |
| 4 | Admin lifecycle: confirm → deliver → return → exchange → cancel (`returns-e2e.cjs`) | package | 8 | **8** | 0 | 0 | screenshots |
| 5 | Security (`sec.cjs`) | package | 47 | **46** | 1 (informational: no CSP) | 0 | security.json |
| 6 | Security, read-only (`sec.cjs LIVE=1`) | live | 44 | 41 | 3 (HSTS + X-Powered-By, **fixed in the package**; CSP informational) | 0 | — |
| 7 | Image upload attacks (`media.cjs`) | package | 16 | **16** | 0 | 0 | — |
| 8 | Database integrity on real data (`dbaudit.cjs`) | local DB | 28 | **28** | 0 | 0 | db-audit.json |
| 9 | SEO (`seo.cjs`) | package | 20 | 19 | 1 (test product with a 15-character description — data) | 0 | seo.json |
| 10 | SEO, read-only | live | 20 | 15 | 0 | 5 BLOCKED: product pages (live shop has 0 products) | — |
| 11 | Screen sizes 320–1920 px × public pages (`viewports.cjs`) | package | 99 | 90 | 0 | 9 informational (Google map frame console messages on /location) | viewports.json |
| 12 | Screen sizes, read-only | live | 90 | 81 | 0 | 9 BLOCKED: product page 404 (no products on live) | — |
| 13 | Keyboard focus (40 Tab presses × 3 pages) | package + live | 6 | **6** | 0 | 0 | — |
| 14 | Click-through probe: every page, every visible button clicked (`probe.cjs`) | storefront 13 pages + admin 25 pages | 38 pages | 38 | 0 dead buttons left | destructive admin buttons skipped by design | probe-*.json |
| 15 | Storefront click flows (`flows.cjs`, earlier today) | production build | 23 | **23** | 0 | 0 | — |
| 16 | Crawl of every internal link (`crawl.cjs`, earlier today) | production build | 370 pages | 370 | 0 errors | 0 | problems.json |
| 17 | Postman / newman speed + status collection | live | 70 requests / 140 assertions | **140** | 0 | 0 | newman output |
| 18 | Load test (1,300 requests, up to 50 at once) | package | 5 runs | **5** (0 errors) | 0 | 0 | PERFORMANCE_REPORT |
| 19 | Lighthouse mobile | package + live | 8 pages | measured (see PERFORMANCE_REPORT) | – | – | lh/*.json |
| 20 | Dependency audit (`npm audit --omit=dev`) | – | 1 | **1** after upgrade (0 critical, 0 vulnerable packages in the bundle) | – | – | — |
| 21 | Cross-browser (Firefox, Safari/WebKit, Edge) | – | 0 | – | – | **BLOCKED** (only Chromium installed) | — |
| 22 | Real email delivery | – | 0 | – | – | **BLOCKED** (no SMTP yet; mock transport tested in Vitest) | — |
| 23 | Order on king253.com | – | 0 | – | – | **BLOCKED** (would write real data; 0 products live) | — |
| 24 | DB connection failure / backup restore | – | 0 | – | – | **BLOCKED** (destructive) | — |

## 2. Totals

| Measure | Count |
|---|---|
| Individual checks executed (rows 1–13 + 15 + 17 assertions + 20) | **701** |
| Passed | **673** |
| Failed (all informational or fixed-in-package, no open functional failure) | 5 |
| Blocked / informational | 23 checks + 4 whole areas (rows 21–24) |
| Pages opened by automation | 370 crawled + 38 click-probed + 99/90 per-size checks |
| Bugs found | 19 (1 critical, 5 high, 5 medium, 4 low, 4 informational) — see BUG_REPORT.md |
| Bugs fixed | 17 (2 informational left open by choice) |
| Share of discovered pages actually tested | 38 / 38 routes (100 %) — feature coverage, **not** code coverage |

## 3. Notable test-run events (honest log)

* Two order-test failures on the final package were caused by **my own earlier test orders using up the local stock** ("no size button enabled" = sold out, correctly refused). Restocked the local test data; 18 / 18 passed.
* Two failures earlier were caused by **repeated test names** across runs; the script now uses unique names.
* My first "subtotal mismatch" check flagged two orders wrongly (exchange lines are outside the original subtotal by design); the query was corrected; the data was correct.
* An admin probe run was interrupted when the dev server restarted after a config change; it was re-run fully on the final package.
* The earlier statement "confirm → deliver tested" in a previous session was not true (the script only selected the option); this audit re-tested it for real (row 4).

## 4. Customer journeys executed end-to-end

| Journey | Result |
|---|---|
| New visitor, phone, French: product → size → Buy now → form → order confirmed | PASS (ORD-01) |
| New visitor, desktop, Arabic (RTL, Arabic name and address) | PASS (ORD-02) |
| New visitor, phone, English | PASS (ORD-03) |
| Add to bag → bag → checkout → order | PASS (ORD-04) |
| Invalid information (empty, bad phone, no address, 5,000-character fields) | refused, nothing saved (ORD-05…08) |
| Hostile text (XSS / SQL) in name and address | saved as plain text, no script ran (ORD-09, SEC-D2) |
| Double / triple click on Confirm | one order (ORD-10) |
| Back button after ordering | no duplicate (ORD-11) |
| Returning customer, wrong then right password | refused then accepted on the same account (ORD-13/14) |
| Signed-in customer orders again | same account (ORD-18) |
| Customer cancels own order from the secret link | cancelled, stock released (AUTH-11) |
| 25 buyers at once for 10 items | exactly 10 orders (Vitest concurrency) |
