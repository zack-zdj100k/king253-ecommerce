# Automation summary

## What exists now

| Suite | Location | Count | Command |
|---|---|---|---|
| Database integration tests (orders, stock, returns, exchanges, accounts, delivery, emails, status by hand, **concurrency**, overview, …) | `tests/*.test.ts` | **24 files, 128 tests** | `npx vitest run` |
| Speed / health collection (Postman) | `tests/postman/king253-speed.postman_collection.json` | 14 requests × 2 checks | `npx newman run tests/postman/king253-speed.postman_collection.json --env-var base=https://king253.com -n 5` |
| Real guest orders + abuse cases (browser) | `qa-audit/automation/orders-e2e.cjs` | 18 | see below |
| Accounts / sign-in / cancel with secret link | `qa-audit/automation/auth-account-e2e.cjs` | 13 | see below |
| Admin lifecycle (confirm → deliver → return → exchange → cancel) | `qa-audit/automation/returns-e2e.cjs` | 8 | see below |
| Click-through of every page and button | `qa-audit/automation/probe.cjs` | all pages | see below |
| Security (access control, headers, injection, secrets) | `qa-audit/automation/sec.cjs` | 47 (local) / 44 (live) | see below |
| Image upload attacks | `qa-audit/automation/media.cjs` + `make-media-fixtures.py` | 16 | see below |
| Database integrity on the real data | `qa-audit/automation/dbaudit.cjs` | 28 | see below |
| SEO | `qa-audit/automation/seo.cjs` | 20 | see below |
| 9 screen sizes + keyboard focus | `qa-audit/automation/viewports.cjs` | 162 page×size checks | see below |
| Crawl of every internal page (errors, broken images, overflow, unnamed buttons) | `qa-audit/automation/crawl.cjs` | ~370 pages | see below |

## How to run the browser suites
Playwright is installed globally on this Mac (Chromium only).
```bash
cd qa-audit/automation
export PW="$(npm root -g)/@playwright/cli/node_modules/playwright"
export DATABASE_URL="…local database…"            # never the production one
export BASE=http://localhost:3010                  # the deploy package: node dist/king253/server.js
PGMOD=$(cd ../.. && node -e 'console.log(require.resolve("postgres"))' | sed 's|/cjs/src/index.js||;s|/src/index.js||') OUT=/tmp/qa node orders-e2e.cjs
OUT=/tmp/qa node dbaudit.cjs
TOKENFILE=admin-token.txt OUT=/tmp/qa node sec.cjs          # admin-token.txt = a local admin session token
LIVE=1 BASE=https://king253.com OUT=/tmp/qa node sec.cjs    # read-only, safe on production
LIVE=1 BASE=https://king253.com OUT=/tmp/qa node viewports.cjs
BASE=https://king253.com OUT=/tmp/qa node seo.cjs
```
**Never run `orders-e2e.cjs`, `auth-account-e2e.cjs` or `returns-e2e.cjs` against king253.com**: they create real orders and accounts.

## Coverage and limits
* **Feature coverage:** every discovered page was opened; every visible button on the storefront and on 14 admin pages was clicked (destructive admin buttons skipped on purpose and covered by tests instead). See COMPLETE_FEATURE_INVENTORY.md for the numbers.
* **This is not code coverage.** No coverage percentage is claimed.
* **Limits:** Chromium only; Firefox / WebKit / Edge not run (not installed). Email delivery is verified with a mock transport (real SMTP not configured). Load tests were small and local.
* **Not yet in CI:** the scripts run by hand; a GitHub Actions workflow running `vitest` + `tsc` + `eslint` on every push is a recommended next step.
