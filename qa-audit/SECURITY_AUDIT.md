# Security audit — KING 253

Defensive, non-destructive tests only: no denial-of-service, no attacks on third parties, no real data changed. Run locally on the exact deploy package (`qa-audit/automation/sec.cjs`, `media.cjs`) and, read-only, on **https://king253.com** (`LIVE=1`).

## Result by area

| Area | Tests | Result |
|---|---|---|
| Access control (visitor, forged session, customer account → admin pages and upload API) | 20 | **20 / 20 PASS** |
| Authorization in code: every admin server action checks the admin session on the server | 52 actions | **52 / 52** guarded |
| Customer order pages need the secret per-order token (wrong/missing token → 404) | 3 | PASS |
| Security headers (X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy) | 4 | PASS |
| HSTS | live site | **was missing → fixed in this release** (re-check after deploy) |
| Content-Security-Policy | 1 | not present (INFORMATIONAL, see below) |
| File leak / path traversal (`/.env`, `/.git/config`, `/package.json`, `/media/../…`, encoded variants) | 9 | **9 / 9 PASS** |
| Injection: 36 hostile query strings (SQLi, XSS, template, null byte, emoji) on search, filters, tracking | 36 | no server error, nothing reflected, tables intact |
| Stored XSS: order saved with `<img onerror>` / `<script>` / `DROP TABLE` text | 2 | stored as plain text, HTML-escaped in the admin page, no script ran, table intact |
| Sessions: tokens stored only as SHA-256 hashes; HttpOnly + SameSite cookies | 2 | PASS |
| Password storage: scrypt (slow, salted) | 1 | PASS |
| Brute force: login limit 10 / 15 min per visitor; orders 8 / 10 min per visitor + 5 / 10 min per phone; sign-ups 5 / hour | code + browser | PASS (existing-phone + wrong password is refused, no account takeover: ORD-13) |
| Secrets: `.env` git-ignored, none committed, none in the deploy zip, none in page source | 3 | PASS |
| Image uploads (valid JPEG/PNG/WebP, GIF, SVG with script, PHP, polyglot JPEG+PHP, empty, corrupt, fake .jpg executable, 11 MB, 144-megapixel bomb, 13 files, no file) | 16 | **16 / 16 PASS** — only real JPEG/PNG/WebP/AVIF accepted by magic bytes, everything re-encoded to WebP, so no embedded payload survives |
| Dependencies (`npm audit --omit=dev`) | 1 | **critical Next.js flaws found and fixed** (BUG-01) |

Totals: local package **46 / 47** (the one non-pass is the informational CSP); live site read-only checks reported below.

## Findings by severity

| Severity | Finding | Status |
|---|---|---|
| CRITICAL | Next.js 16.3.8 known RCE / DoS advisories | **Fixed** → 16.4.6 |
| HIGH | Shared "local" rate-limit bucket could block all customers behind the host | **Fixed** |
| MEDIUM | No HSTS on the live site | **Fixed in code**, goes live with the next deploy |
| LOW | `X-Powered-By: Next.js` advertised | **Fixed** |
| LOW | zod / nodemailer DoS and address-parsing advisories | **Fixed** (4.6.7 / 10.5.0) |
| INFORMATIONAL | No Content-Security-Policy | Open. Adding one needs per-request nonces for Next's inline scripts; a wrong CSP breaks the site. Recommended later, with testing. |
| INFORMATIONAL | 13 advisories remain in development-only packages (`shadcn` CLI and its dependencies) | Not in the production bundle (verified); update when convenient |
| INFORMATIONAL | Rate limiter is in memory per process | Acceptable at this traffic |

## Not independently tested (stated honestly)

* **CSRF on Server Actions** — relies on Next.js's built-in origin check; not attacked directly (needs action IDs).
* **Denial-of-service / load beyond a few hundred requests** — excluded by the rules.
* **Penetration of the hosting platform / cPanel** — out of scope.
* **Email header injection** — covered by the nodemailer upgrade; not fuzzed against a real mail server.

## Conclusion

No open CRITICAL or HIGH security issue remains after the fixes. The two items that need action by the owner are operational: **deploy the new package** (framework fix, HSTS) and keep `npm audit` in the pre-deploy routine.
