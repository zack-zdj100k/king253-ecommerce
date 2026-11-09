# KING 253 — Multi-shop update: stack report and implementation plan

Status: **done on branch `feature/multi-shop` (2026-11-09), not deployed yet.** Owner approved all recommendations (69 wilayas, Cancel kept, Annaba gets existing stock, /ar /fr /en URLs with French as x-default, hang-tag card as preview variant 3, Bento delta fix).
Source spec: owner's "KING 253 — Update Specification for Claude Code" + `analytics-bento.tsx` + card reference.

---

## 0. Stack report (what exists today)

| Area | Today |
|---|---|
| Framework | Next.js **16.3.8**, React 19.2, **App Router** (`src/app`), Server Actions in `src/app/actions` |
| Language / styling | TypeScript (strict, `tsc` = 0 errors), Tailwind CSS **v4** (`@theme` in `src/app/globals.css`) |
| shadcn | Already set up: `components.json` (style radix-nova, aliases `@/components/ui`), `src/components/ui/` exists, shadcn CSS variables exist (`--background #050505`, `--card`, `--foreground`, `--border`, `--muted`, `--popover`, `--ring` red). Nothing to install. |
| Database / ORM | PostgreSQL (13.23 in production) + **Drizzle ORM** 0.45; SQL migrations in `drizzle/0000…0011`, applied by `scripts/migrate.mjs` (also on every server start via `app.js`) |
| Auth | Own session auth (`src/server/auth`): `users` (email **required**, unique lower(email)), `sessions` (hashed token cookie), roles admin/customer. Login = email + password only |
| Email | nodemailer over SMTP (`SMTP_*` env, still empty in production). Sends: admin "new order" + customer received/confirmed/preparing/ready/delivered |
| i18n | **None.** All storefront text is English, `<html lang="en">` |
| Shops | `stores` table (name, wilaya, city, address, phone, hours, map, lat/lng, active) — used only by the Location page |
| Products / stock | `products` → `product_variants` (size + colour, `physical`, `reserved`, never negative, checked by the DB) + `stock_reservations` + `stock_movements` ledger. **Stock is global, not per shop** |
| Orders | `orders` + `order_items` (price snapshots) + `order_status_history`. Statuses: pending, contacting, confirmed, preparing, ready_for_delivery, delivered, cancelled. One global delivery fee (`settings.deliveryFee`), "ships with" merging of open orders to the same address |
| Customers | `customers` keyed by unique normalised phone (+213…), linked from `users.customer_id` and `orders.customer_id` |
| Returns | `return_requests` with a 5-step workflow (requested → approved → received → completed), `refund_amount` subtracted from revenue |
| Referral | `users.referral_source` (sign-up only), sources in `src/lib/referral.ts` |
| Wilayas | `src/lib/algeria-data.json`: **69 wilayas, 1,541 communes, FR + AR** (official since Law 26-06, April 2026) |
| Admin overview | `src/server/analytics.ts` + `revenue-chart.tsx` (recharts) |
| Checks | `tsc` 0 errors · 105 vitest tests pass · ESLint errors only in `dist/` and `app.js` (build output, to be ignored) |

---

## 1. Design decisions (my recommendations)

1. **Extend `stores`, don't add a second "Shop" table.** The spec's `Shop` = the existing `stores` row + `slug` + `notification_email`. One source of truth for Location page, stock, checkout, delivery, emails and statistics. Nothing hard-codes Annaba/Constantine; they are seed rows.
2. **Per-shop stock becomes the source of truth**: new `store_stock (variant_id, store_id, physical, reserved)`, unique on (variant, store). Variants are already "product + size (+ colour)", so this is "per product, per size, per shop". `product_variants.physical/reserved` stay as **cached totals** updated in the same transaction (so the catalog, search and existing queries keep working). Reservations and movements get a `store_id`.
3. **Wilayas: 69, not 58.** The data we already ship is the official 2026 list. The `wilayas` table is seeded from it with AR + FR, and EN = FR (Latin names are the same). The import script accepts old 58-codes and names.
4. **Delivery**: `delivery_rates (store_id, wilaya_code, home_price, desk_price)` + `delivery_desks (store_id, wilaya_code, commune, name, address, desk_price)`. Import from CSV/JSON (`npm run delivery:import`) + admin editor. Until the PDFs arrive, a placeholder seed file `data/delivery/*.example.csv`.
5. **Status flow** Pending → Confirmed → Delivered. Postgres cannot drop enum values safely, so the enum keeps them but a migration maps data: contacting → pending, preparing / ready_for_delivery → confirmed. The UI and server actions only allow the 3 statuses. **Open question: Cancelled** (see §4).
6. **Returns & exchanges** are instant admin actions on Delivered orders, recorded in a new `return_journal` (+ `return_journal_items`). Orders get `payment_status` (collected / refused) so a full return removes the order from revenue; partial returns and exchanges adjust revenue by the amount. Old `return_requests` rows are copied into the journal (kept, not deleted).
7. **Accounts**: `users.email` becomes nullable, `users.phone` unique (normalised). Checkout with a password creates/links the account by phone; an existing phone asks for that account's password (no duplicates). Login field accepts email or phone. `referral_source` is also saved on orders.
8. **Emails**: new-order email goes only to the chosen departure shop's `notification_email` (fallback: `settings.adminNotifyEmail`). Customer gets only "Delivered", in the order's language. Shop emails live in the database (editable in admin), not in env vars, because shops are dynamic.
9. **i18n**: `next-intl` with URL prefixes `/ar`, `/fr`, `/en` (best for SEO: real hreflang + sitemap per language). `src/proxy.ts` (Next 16's middleware) shows the language page on the first visit and returns to the exact URL + query. Bots (user-agent check) are never redirected. Arabic = RTL with an Arabic font via `next/font`. Admin stays French.
10. **Analytics Bento**: copied as given to `src/components/ui/analytics-bento.tsx`, Geist via `next/font`, `credit={false}`, `currency="DA "`, red/white palette passed via `colors`. Data computed server-side and cached (revalidated when orders change).

---

## 2. Database migrations (one file each, all additive, no data deleted)

| # | Migration | What it does |
|---|---|---|
| 0012 | `shops` | `stores`: add `slug` (unique), `notification_email`; seed Annaba + Constantine if missing |
| 0013 | `wilayas` | `wilayas (code, name_ar, name_fr, name_en)` + `communes`; seeded from algeria-data.json |
| 0014 | `store_stock` | create `store_stock`; copy every variant's physical/reserved to **Annaba** (needs your OK); add `store_id` to `stock_reservations`, `stock_movements` |
| 0015 | `delivery` | `delivery_rates`, `delivery_desks` |
| 0016 | `orders_shop` | orders: `store_id`, `delivery_type` (home/desk), `delivery_desk_id`, `wilaya_code`, `referral_source`, `locale`, `payment_status`; existing orders → Annaba, home |
| 0017 | `phone_accounts` | users: email nullable, `phone` unique, `locale`; backfill phone from customers |
| 0018 | `status_flow` | map old statuses to the 3-step flow (history rows kept) |
| 0019 | `return_journal` | journal + items; copy existing return_requests |

Every migration is tested on a copy of the production dump (`~/backups/*.dump`) before deploy.

## 3. Phases (each ends with build + tsc + lint + tests, one commit per phase, on branch `feature/multi-shop`)

| Phase | Spec § | Main files |
|---|---|---|
| 1. Foundation: lint ignores `dist/`, migrations 0012–0015, wilayas, shops admin (create / edit / deactivate) | 1.1, 1.3 | `schema.ts`, `server/stores.ts`, `admin/(panel)/shops` |
| 2. Stock per shop + size in product editor, totals, low stock per shop, inventory page | 1.2 | `server/inventory.ts`, `products-admin.ts`, product editor |
| 3. Delivery rates + desks: import script, admin editor | 1.3 | `scripts/import-delivery.mjs`, `admin/(panel)/delivery` |
| 4. Checkout: wilaya/commune, home/desk + closest desk, eligible shops with cost, cheapest preselected, "no shop" message, transactional reservation | 2 | `checkout-form.tsx`, `orders/create.ts` |
| 5. Accounts: phone account at checkout, phone/email login, "add your email" banner, admin creates customer by phone, referral on both | 3 | `auth/*`, `account/*`, `admin/users` |
| 6. Emails: shop-only new-order email, customer "Delivered" only, AR/FR/EN templates | 4 | `email/*` |
| 7. Orders: 3 statuses, Return + Exchange with live stock per shop, journal page, no "All" filters (orders default Pending) | 5, 6 | `orders/manage.ts`, `returns.ts`, admin pages |
| 8. Overview: KPI row + Analytics Bento with real data + shop filter, mobile | 7 | `admin/(panel)/page.tsx`, `server/analytics.ts` |
| 9. Product card: `/dev/card-preview` with the variants, screenshots desktop + mobile → **stop for your choice** | 8 | `components/shop/*` |
| 10. i18n AR/FR/EN, language page, switcher, hreflang, RTL | 9 | `[locale]` route group, `proxy.ts`, `messages/*.json` |
| 11. Acceptance checklist in the browser (Playwright, 375 / 768 / 1440), report | 10 | — |

Estimated size: large (several sessions). Deploy to king253.com only when you say so.

## 4. Questions before starting

1. **Existing stock → Annaba?** (spec 1.2 says "ask me before running")
2. **Cancelled orders**: the spec keeps only Pending → Confirmed → Delivered. With cash on delivery, some customers refuse or never answer. Keep a "Cancel" action (releases stock, not counted in revenue)?
3. **69 wilayas** (official 2026) instead of 58?
4. **Product card**: the attached "05 · Hang tag + shops" image — make it one of the preview variants (replacing one of the 3), or a 4th?
5. **Language URLs**: `/ar/...`, `/fr/...`, `/en/...` (recommended for Google), and which language for search engines by default (x-default)?
6. The Bento's `Delta` always draws a green up arrow, even for a drop. Copy it unchanged as asked, or allow a 3-line fix (red down arrow for negative)?

## 5. Waiting for owner input

- Delivery desk PDFs (Annaba, Constantine) with prices → CSV for the import script.
- The two shop notification emails.
- SMTP provider credentials (production `.env`: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`). Without them every email is logged as "skipped".

## 6. Result (2026-11-09)

| Check | Result |
|---|---|
| New shop appears in products, checkout, delivery prices, emails, overview | Yes — shops are rows; new products get every active shop |
| Stock per shop and per size | Yes (`store_stock`), tests |
| Checkout: only shops with the whole cart, price per wilaya/type, cheapest first, home vs desk, 69 wilayas | Yes, tests + browser |
| Guest checkout → account by phone, no duplicates, phone login, "add your email" banner | Yes, tests + browser |
| "Where did you hear about us" saved for both account types, shown in admin | Yes |
| New-order email only to the departure shop | Yes, test |
| Customer gets only "Delivered" (in their language) | Yes, test |
| Statuses Pending → Confirmed → Delivered (+ Cancel) | Yes, test |
| Return: stock back in the right shop, refused when all is back, out of revenue, journal | Yes, tests |
| Exchange: any in-stock item, ± difference, stock both ways, journal | Yes, tests + browser |
| No "All" option in admin lists | Orders, products, reviews, users, inventory, journal |
| Overview with real data, returns, shop filter, mobile | Yes |
| Language page on first visit from any URL, back to that URL; Arabic RTL; bots not redirected; hreflang | Yes, browser + curl |
| build, tsc, lint (0 errors), 120 tests | Pass |

Migrations: 0012 shops_and_wilayas · 0013 stock_per_shop · 0014 delivery_rates_desks ·
0015 checkout_accounts · 0016 status_flow_return_journal (all applied automatically at start).

Env: nothing new is required. Emails need `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`,
`SMTP_FROM` in `~/king253/.env`. Shop notification emails are set in Admin → Shops (not env).

Waiting for the owner: card choice (01 / 02 / 03 on /dev/card-preview), delivery desk PDFs
(→ `data/delivery/*.csv`, Admin → Delivery → Import), the two shop emails, SMTP account, go-ahead to deploy.
Not translated by design: product texts and admin-written content (each language can be written in Admin → Content).
