# Bug report — KING 253 (audit of 2026-11-10)

Every item below was **reproduced or measured**, fixed in the code, and re-tested. Severity follows the audit scale (CRITICAL / HIGH / MEDIUM / LOW / INFORMATIONAL). IDs are stable; the regression test or script that guards each fix is listed.

## Summary

| Severity | Found | Fixed | Open |
|---|---|---|---|
| CRITICAL | 1 | 1 | 0 |
| HIGH | 5 | 5 | 0 |
| MEDIUM | 5 | 5 | 0 |
| LOW | 4 | 4 | 0 |
| INFORMATIONAL | 4 | 2 | 2 |

## CRITICAL

### BUG-01 — Next.js (production framework) had critical known vulnerabilities
* **Where:** `next@16.3.8`, in the deployed bundle (`npm audit`: GHSA-2464-fhr4-w9xw critical — remote code execution in the image optimizer when SVG is used; GHSA-673q-mjm6-r5xr critical — RCE in `use cache` functions; GHSA-p3m5-59mp-jv5r high — DoS through Server Actions).
* **Reproduction:** `npm audit --omit=dev`.
* **Actual / expected:** vulnerable range `16.0.0–16.4.0`; the site is not known to use the two RCE paths (no SVG through the optimizer, no `use cache`), but the Server Actions DoS applies to every page.
* **Root cause:** framework version not updated since the project start.
* **Fix:** upgraded to **Next.js 16.4.6** (minor update, non-breaking), plus `zod 4.6.7` (memory-exhaustion DoS) and `nodemailer 10.5.0` (address-parser flaws). `npm audit --omit=dev` critical count went 1 → 0. All 128 tests pass on the new versions; build and the full audit were re-run on the upgraded package.
* **Regression guard:** run `npm audit --omit=dev` before each deploy (added to the production checklist).

## HIGH

### BUG-02 — "Buy now" sent a visitor to the sign-up page instead of the order form
* **Where:** product page `Buy now` button, quick-view `Buy now`.
* **Steps:** open a product as a signed-out visitor → choose a size → Buy now.
* **Expected:** order form opens (guests can order; account is created from phone + password).
* **Actual:** redirected to `/sign-up?next=…` — a visitor could not buy.
* **Root cause:** old code from before guest checkout remained in `buy-box.tsx` and `quick-view-dialog.tsx`; the checkout page and server already accepted guests, and the earlier tests only covered the "Add to bag" route.
* **Fix:** both buttons go straight to `/checkout?buy=…`.
* **Regression test:** `orders-e2e.cjs` ORD-01…03 (guest Buy now in 3 languages) and ORD-04 (bag route).

### BUG-03 — Order rate limit could lock out every customer behind the host
* **Where:** `clientIp()` used by all rate limits (orders 8 / 10 min, sign-ups, login, tracking…).
* **Cause:** when the host passes no visitor address (possible behind cPanel/Passenger), every visitor shared one `"local"` bucket → after 8 orders in 10 minutes nobody could order.
* **Fix:** the key is now the visitor address, else a fingerprint of browser + language; plus a per-phone limit (5 orders / 10 min) on orders.
* **Guard:** ORD-01…14 run with separate addresses; the per-phone limit is exercised by ORD-13/14.

### BUG-04 — A new order notified nobody and left no trace when no shop email was set
* **Where:** `sendNewOrderEmails` (`if (!to) return`).
* **Actual:** order accepted, no email, nothing recorded — the owner would not know an order arrived.
* **Fix:** a visible "nobody was notified" record on the order (shown in its Emails panel), a **warning banner on the admin Overview** until each shop has an email and SMTP is connected, and one automatic retry for failed sends.
* **Regression test:** `tests/emails.test.ts` ("a shop with no notification email leaves a visible record").

### BUG-05 — Opening stock went to a different shop than the one shown
* **Steps:** product sold in two shops → add a colour/size, leave "Stock goes to" on its default → stock was saved in the other shop.
* **Cause:** the picker displayed the first shop but sent no value; the server used a different default.
* **Fix:** what the picker shows is what is sent.

### BUG-06 — Switching a shop off for a product required zeroing its stock (and deleted it)
* **Fix:** migration `0017` adds `product_stores.active`; off = stops selling, stock is kept; storefront, checkout, cards and exchanges respect it. Test: `tests/shops-stock.test.ts`.

## MEDIUM

### BUG-07 — "Continue with Google / Apple" buttons did nothing
Placeholders that only printed "coming soon". **Removed** (customers buy with a phone number). Found by the click probe (`probe.cjs`).

### BUG-08 — No HSTS header on king253.com
`strict-transport-security` was missing on the live HTTPS site. **Added** (`max-age=31536000`, no subdomains). Found by `sec.cjs` against the live site; verify after the next deploy.

### BUG-09 — Links shared on WhatsApp / Instagram / Facebook had no picture
No `og:image` on any page (the site layout's `openGraph` replaced the root one). **Fixed**: brand image on every page, product photo on product pages (brand image if the product has none). Found by `seo.cjs`.

### BUG-10 — Products added in the admin were hidden by default
New products defaulted to **Draft** and the Products list opens on "Published", so a new product silently did not appear on the Clothes page. **Fixed**: new products default to Published; the save message says where the product is ("in the shop" / "saved as DRAFT — hidden"); the list shows "N draft products are NOT in the shop".

### BUG-11 — Admin: product lines on order / return pages were hard to read
No photo, abbreviated names. **Fixed** (photo, category › subcategory, full name, colour, size, quantity, in orders, returns and the journal).

## LOW

### BUG-12 — About 100 labels were smaller than 10 px on the storefront
Raised to 10 px minimum (`text-[0.45–0.6rem]` → `0.625rem`). Found by `viewports.cjs` (tiny-text counter).

### BUG-13 — Footer, breadcrumb, Location and sign-in links were only 14–17 px tall on phones
Touch areas enlarged to ≥ 24 px (WCAG 2.2 target-size minimum) without changing the look. Found by `viewports.cjs` (small-tap counter: 130 → see PERFORMANCE/RESPONSIVE report for the re-measurement).

### BUG-14 — Opening search from the mobile menu did not focus the search box
Fixed earlier in this audit cycle (delay until the menu closes).

### BUG-15 — Category tiles had no accessible name
Added `aria-label` ("Category — tagline").

## INFORMATIONAL

| ID | Finding | Status |
|---|---|---|
| INF-01 | `X-Powered-By: Next.js` header was sent | **Fixed** (`poweredByHeader: false`) |
| INF-02 | No Content-Security-Policy header | Open — needs a nonce setup; risk of breaking inline scripts; not required for launch |
| INF-03 | Console errors on `/fr/location` | Not a bug: they come from Google's own embedded map frame (CORS ping blocked inside Google's iframe) |
| INF-04 | Remaining `npm audit` items (13: dev tools `shadcn`, `@shadcn/registry`, `ts-morph`, `body-parser` … ) | Open — none of them is inside the deploy bundle (checked); update the dev tools at leisure |

## Not bugs (investigated and explained)

* "Orders whose subtotal ≠ sum of lines" — exchange lines are intentionally outside the original subtotal (my first check was wrong, the data is correct).
* Test failures caused by repeated test data (same customer name twice) — fixed in the test, not in the site.
* Rate-limit message ("Too many attempts") during fast tests — the protection working.
