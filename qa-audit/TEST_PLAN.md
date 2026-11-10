# Test plan — KING 253 production-readiness audit

## Goal
Prove with real evidence whether KING 253 is ready for real customers, find everything that is broken, fix verified defects, and report honestly what could not be tested.

## Rules followed
No invented results · a test is PASS only if it ran and the result was checked · isolated test data on a local copy of the database · **production data never modified, no real customer email, no real order placed on king253.com** · no deployment without the owner uploading the package · no secrets in reports.

## Environments
| Environment | Used for |
|---|---|
| **Local database + deploy package** (`dist/king253`, the exact files that are uploaded, run like the host with Passenger-style headers) | all functional, order, database, security, upload, concurrency and responsive tests |
| **Vitest test database** (separate from the working database) | 128 database integration tests, concurrency tests |
| **https://king253.com (read-only)** | pages, redirects, certificate, security headers, access control, SEO, speed, screen sizes, accessibility — no writes |

## Phases and how each was executed
| Phase | Method | Tool | Evidence |
|---|---|---|---|
| 1 Discovery | read code, schema, config, docs | shell, `git`, `psql` | PROJECT_ARCHITECTURE_AUDIT.md |
| 2 Feature inventory | route tree + automatic click-through of every page (lists every visible link, button, field and **clicks every button**) | `probe.cjs` (Playwright) | COMPLETE_FEATURE_INVENTORY.md |
| 3 Storefront | click tests in 3 languages, phone + desktop: language page, hero, menus, search, filters, cards, bag, wishlist, product page, checkout, tracking, footer | `flows.cjs`, `probe.cjs`, `crawl.cjs` | TEST_EXECUTION_REPORT.md |
| 4 Order lifecycle | real guest orders through the real buttons, then verification of the database rows; edge cases (empty form, bad phone, giant input, XSS/SQL text, double click, Back button, wrong password, returning customer) | `orders-e2e.cjs` | 18 tests |
| 5 Admin | confirm → deliver → return → exchange → cancel on a real order; every admin page opened; read-only probe | `returns-e2e.cjs`, `probe.cjs`, `crawl.cjs` | — |
| 6 API / actions | the 2 HTTP routes + 52 admin server actions (static guard check) + hostile requests | `sec.cjs`, `media.cjs` | SECURITY_AUDIT.md |
| 7 Database | 28 integrity queries on real data + schema review | `dbaudit.cjs` | DATABASE_INTEGRITY_REPORT.md |
| 8 Security | access control, headers, injection, sessions, uploads, dependency audit | `sec.cjs`, `media.cjs`, `npm audit` | SECURITY_AUDIT.md |
| 9 UI / responsive / accessibility | 9 viewports × 18 pages, keyboard focus, console errors, alt text, tap size, text size | `viewports.cjs` | RESPONSIVE_AND_UX_REPORT.md |
| 10 Performance | Lighthouse (mobile), response-time sampling, Postman/newman collection | Lighthouse, newman | PERFORMANCE_REPORT.md |
| 11 Failure & recovery | wrong password, double submit, Back button, out-of-stock race, email with no recipient, upload failures | `orders-e2e.cjs`, Vitest | see report |
| 12 Automation | everything above is repeatable (see AUTOMATION_SUMMARY.md) | — | — |
| 13 Fixes | each bug fixed, then the related test re-run | — | BUG_REPORT.md |
| 14 Final verification | full suite on the final upgraded package | all | PRODUCTION_READINESS_CHECKLIST.md |

## Test perspectives
* **Black-box:** a visitor using a real browser (orders, accounts, hostile input, live site).
* **White-box:** source scan of all 52 admin actions, SQL integrity queries, schema review.
* **Gray-box:** architecture knowledge + real browser/API (e.g. verifying the order row after the click).

## Out of scope / BLOCKED
Firefox, Safari/WebKit, Edge (not installed; downloading browsers was not approved) · real email delivery (SMTP not configured yet) · database connection failure and restore (destructive) · placing real orders on production (writes real data) · Google Search Console (not set up yet).
