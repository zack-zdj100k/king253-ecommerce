# Responsive, UX and accessibility report

Real browser (Chromium) at 9 widths × the public pages (+ the checkout page opened with a real "buy now" link), on the **final deploy package** and, read-only, on **https://king253.com**. Script: `qa-audit/automation/viewports.cjs`. Each check = one page at one width (scrolled top to bottom so lazy images and animations run).

## 1. Results by width — final package

| Width | Checks | Horizontal overflow | JS / console errors* | Broken images | Images without alt | Text < 10 px | Tap targets < 24 px | Bad HTTP status |
|---|---|---|---|---|---|---|---|---|
| 320px | 11 | 0 | 4 | 0 | 0 | 12 | 4 | 0 |
| 375px | 11 | 0 | 4 | 0 | 0 | 12 | 5 | 0 |
| 390px | 11 | 0 | 2 | 0 | 0 | 12 | 5 | 0 |
| 430px | 11 | 0 | 4 | 0 | 0 | 12 | 5 | 0 |
| 768px | 11 | 0 | 2 | 0 | 0 | 0 | 0 | 0 |
| 1024px | 11 | 0 | 4 | 0 | 0 | 0 | 0 | 0 |
| 1280px | 11 | 0 | 11 | 0 | 0 | 0 | 0 | 0 |
| 1440px | 11 | 0 | 11 | 0 | 0 | 0 | 0 | 0 |
| 1920px | 11 | 0 | 11 | 0 | 0 | 0 | 0 | 0 |

**99 page × width checks.** \* All console errors come from one page, `/fr/location`: they are produced inside Google's own embedded map frame (a CORS test ping blocked in Google's iframe), not by KING 253 code.

## 2. Before / after the fixes of this audit (public pages, same checks)

| Width | Text < 10 px before → after | Tap targets < 24 px before → after |
|---|---|---|
| 320px | 81 → 12 | 102 → 4 |
| 375px | 77 → 12 | 121 → 5 |
| 390px | 78 → 12 | 121 → 5 |
| 430px | 78 → 12 | 121 → 5 |

The one remaining sub-10 px text is the decorative "KING 253" stamp on the paper price tag of product cards (a brand mark, 6.4 px).

## 3. Live site (read-only) — https://king253.com, previous version

| Width | Checks | Overflow | Errors | Broken images | Bad status |
|---|---|---|---|---|---|
| 320px | 10 | 0 | 0 | 0 | 1 |
| 375px | 10 | 0 | 0 | 0 | 1 |
| 390px | 10 | 0 | 0 | 0 | 1 |
| 430px | 10 | 0 | 0 | 0 | 1 |
| 768px | 10 | 0 | 0 | 0 | 1 |
| 1024px | 10 | 0 | 0 | 0 | 1 |
| 1280px | 10 | 0 | 0 | 0 | 1 |
| 1440px | 10 | 0 | 0 | 0 | 1 |
| 1920px | 10 | 0 | 0 | 0 | 1 |

The one "bad status" per width on the live site is the product page: the live shop has no products yet, so it correctly answers 404. The live site still has the old text sizes and tap targets until the new package is deployed.

## 4. Keyboard and focus

| Page | Tab stops visited | Without a visible focus ring |
|---|---|---|
| `/fr` | 39 | 0 |
| `/fr/clothes` | 40 | 0 |
| `/fr/sign-in` | 39 | 0 |

Result: every focusable element on the home page, the catalogue and the sign-in page shows a visible focus indicator; no keyboard trap was found in 40 consecutive Tab presses per page.

## 5. Accessibility (Lighthouse, mobile, live site)

Accessibility score **96 / 100** on every tested page (home, collection, who-is-king, Arabic home). Best-practices 100, SEO 100. The remaining Lighthouse items are contrast on the very dark grey tertiary text (`text-king-gray` on near-black) — a design-system choice, listed as a recommendation.

## 6. Findings

| ID | Finding | Severity | Status |
|---|---|---|---|
| UX-01 | ~100 storefront labels smaller than 10 px | LOW | **Fixed** (min 10 px) |
| UX-02 | ~130 text links 14–17 px tall on phones (footer, breadcrumb, location, sign-in) | LOW | **Fixed** (≥ 24 px touch area) |
| UX-03 | Placeholder "Continue with Google/Apple" buttons | MEDIUM | **Removed** |
| UX-04 | Floating bottom icon bar could cover the last footer links | LOW | **Fixed** (bottom padding on phones) |
| UX-05 | Console errors on Location page | INFORMATIONAL | Google map frame, not our code |
| UX-06 | Tertiary grey text contrast (design choice) | INFORMATIONAL | Open — recommendation: lighten `king-gray` slightly |
| UX-07 | Firefox / Safari / Edge not tested | – | BLOCKED (not installed) |

## 7. Arabic and right-to-left

Verified in the real-order test (ORD-02, desktop): the whole checkout is right-to-left, labels are Arabic, the Arabic name and address are saved exactly in the database, prices and phone numbers keep their digits in the correct order (bidi isolation), and the language page + `/ar` URLs work. Mixed Arabic/Latin text (brand names, DA amounts) rendered correctly in the screenshots.
