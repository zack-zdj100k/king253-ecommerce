# Executive summary — KING 253 production-readiness audit (2026-11-10)

## Outcome

**Conditionally ready.** The software works: on the final deploy package, real guest orders succeed in Arabic, French and English, on phone and desktop, through both "Buy now" and the bag; orders, stock and money are correct in the database; the admin can confirm, deliver, return, exchange and cancel; no access-control or injection weakness was found.

It is **not yet ready for real customers** for four reasons that only the owner can resolve:
1. the new package (with a **critical framework security fix**) is not deployed yet;
2. the live shop has **0 products**;
3. the shops have **no notification email**, so a new order reaches nobody;
4. the **email account (SMTP)** is not connected.

## What was found and fixed (19 issues; 17 fixed, 2 informational left open)

| Severity | Most important |
|---|---|
| CRITICAL | Next.js 16.3.8 had known remote-code-execution / DoS advisories → upgraded to 16.4.6 |
| HIGH | "Buy now" sent visitors to sign-up instead of the order form · rate limit could lock out all customers behind the host · new orders notified nobody and left no trace · opening stock went into the wrong shop · switching a shop off deleted its stock |
| MEDIUM | fake Google/Apple login buttons · no HSTS on the live site · no picture when links are shared · new products hidden as drafts · admin order lines hard to read |
| LOW | labels under 10 px · 14–17 px tap targets on phones · mobile search focus · unnamed category tiles |
| INFORMATIONAL (open) | no Content-Security-Policy · dev-only tool advisories (not in the deploy bundle) |

## Evidence in numbers

* 128 / 128 automated database tests (incl. 25 buyers racing for 10 items → exactly 10 orders)
* 18 / 18 real browser orders verified in the database · 13 / 13 account tests · 8 / 8 admin lifecycle
* 28 / 28 database integrity checks · 46 / 47 security checks (1 informational) · 16 / 16 upload attacks
* 99 page × screen-size checks with 0 overflow and 0 broken images · keyboard focus visible everywhere
* 370 pages crawled, 38 routes click-probed (every visible button), 0 dead buttons left
* Live site: HTTPS + redirects + certificate OK, 70 / 70 Postman requests OK (avg 126 ms), 0 errors on 90 screen-size checks

## Remaining risks

| Risk | Level | Mitigation |
|---|---|---|
| Home page is slow on low-end phones (Lighthouse mobile 43–45; LCP ~7.5 s simulated) because of the animated intro | MEDIUM | show the hero text immediately (needs your OK — design change) |
| Backup restore never tested | MEDIUM | restore one dump to a spare database |
| Tested on Chromium, Firefox and WebKit/Safari (incl. iPhone 15 emulation): 6/6 with real orders; a real iPhone is still worth one look | LOW | quick check on your phone after deploy |
| No error monitoring | LOW | check `stderr.log` after deploys |
| Rate limiter in memory | LOW | fine at current traffic |

## Next steps, in order
1. Upload the new `dist/king253.zip` → I install it and check the 3 new migrations.
2. Add the real products (they appear in the shop as soon as they are saved as Published).
3. Set the two shop emails (Admin → Shops) and connect the email account.
4. One supervised test order on king253.com, then delete it.
5. Then: unconditional "production ready".

## Scorecard

| Area | Score | Basis |
|---|---|---|
| Frontend functionality | 94 | measured (probe, flows, orders) |
| Backend functionality | 95 | measured (128 tests, lifecycle) |
| API reliability | 95 | measured (2 routes + 52 actions, security, load test) |
| Database integrity | 96 | measured (28 checks, constraints, concurrency) |
| Authentication & authorization | 95 | measured (20 access tests, 13 account tests) |
| E-commerce workflow | 94 | measured locally; live order BLOCKED (no products) |
| Admin dashboard | 92 | measured (25 pages probed, lifecycle) |
| Security | 90 | measured; CSP absent |
| UI / UX | 88 | measured + judgement |
| Responsive design | 95 | measured (9 widths) |
| Accessibility | 90 | measured (Lighthouse 96, focus, tap/text size) |
| Performance | 60 | measured (Lighthouse mobile 45–71 on the package; server 0.2 s) |
| Automated test coverage | 80 | **estimated** (feature coverage; no code-coverage tool run) |
| Error handling | 88 | measured (invalid input, races, missing email, uploads) |
