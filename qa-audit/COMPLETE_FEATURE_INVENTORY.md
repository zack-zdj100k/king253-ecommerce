# KING 253 — Complete feature inventory

Built from the real route tree (`src/app`) and from an automated click-through (`qa-audit/automation/probe.cjs`) that opened every page below in a real browser, listed every visible interactive element and **clicked every button** (except delete / save / send style buttons on the admin).

Legend — *Elements* = visible links + buttons + fields · *Clicked* = buttons clicked · *No effect* = buttons that changed nothing on screen (each one is explained).

## 1. Public storefront (French, desktop; the same pages were also probed in Arabic/phone and English)

| Page | Route | What it contains | Backend dependency | Database | Elements | Links | Buttons | Fields | Clicked | No effect | Auth |
|---|---|---|---|---|---|---|---|---|---|---|---|
| fr | `/fr` | home: hero slideshow, featured products, categories, location teaser | getFeaturedProducts, content (CMS), stores | products, product_variants, store_stock, settings | 31 | 24 | 7 | 0 | 7 | 0 | public |
| clothes | `/fr/clothes` | catalogue: category tabs, filters sheet, sort, product cards (heart, +, link) | listProducts, productShopStock, addToCart/getQuickView actions | products, categories, store_stock, carts, wishlist | 53 | 29 | 23 | 1 | 22 | 0 | public |
| clothes | `/fr/clothes?category=jackets` | catalogue: category tabs, filters sheet, sort, product cards (heart, +, link) | listProducts, productShopStock, addToCart/getQuickView actions | products, categories, store_stock, carts, wishlist | 49 | 27 | 21 | 1 | 13 | 0 | public |
| china-jacket | `/fr/product/china-jacket` | product page: gallery, colour & size pickers, quantity, Buy now, Add to bag, heart, reviews, related, recently viewed | getProductPage, addToCartAction, trackViewAction | products, product_variants, store_stock, carts, reviews, analytics_events | 53 | 28 | 25 | 0 | 22 | 3 | public |
| jacket-china | `/fr/product/jacket-china` |  |  |  | 47 | 29 | 18 | 0 | 17 | 1 | public |
| who-is-king | `/fr/who-is-king` | brand story page | content (CMS) | settings/content | 25 | 23 | 2 | 0 | 2 | 0 | public |
| location | `/fr/location` | shops list, "find nearest" (browser geolocation), map links | stores | stores | 29 | 26 | 3 | 0 | 3 | 0 | public |
| track | `/fr/track` | track an order by number + phone | trackOrderAction (rate limited) | orders | 29 | 23 | 4 | 2 | 4 | 1 | public |
| sign-in | `/fr/sign-in` | sign in with email or phone | signInAction (rate limited) | users, sessions | 36 | 23 | 11 | 2 | 11 | 3 | public |
| sign-up | `/fr/sign-up` | create account | signUpAction | users, customers, sessions | 42 | 23 | 16 | 3 | 16 | 1 | public |
| wishlist | `/fr/wishlist` | saved products | getCardsByIds, syncWishlist | wishlist_items, products | 41 | 28 | 13 | 0 | 9 | 0 | public |
| checkout | `/fr/checkout` | checkout: customer form, wilaya/commune, home vs Stop desk, shop choice, referral, password, confirm | quoteCheckoutAction, placeOrderAction | orders, order_items, stock_reservations, users, customers, delivery_rates, notifications | 38 | 23 | 6 | 9 | 5 | 0 | public |
| language | `/language` | language chooser (AR/FR/EN) | proxy.ts cookie | – | 3 | 3 | 0 | 0 | 0 | 0 | public |

### Buttons that showed no visible change (all explained)

| Page | Button | Explanation |
|---|---|---|
| Product page | "White", "Taille S", "Taille M", "Black" | Re-selecting the option that is already selected changes nothing — correct. |
| Track order | "Suivre" | Submitting with an empty field is stopped by the browser's required-field check — correct. |
| Sign-in / Sign-up | "Connexion", "Se connecter", "Inscription" | Empty submit stopped by the browser's required-field check — correct. |
| Sign-in | "Continuer avec Apple" (and Google) | **Placeholder: only said "coming soon". Removed (BUG-07).** |

## 2. Customer area

| Route | Contains | Auth | Tested |
|---|---|---|---|
| `/account` | tabs *My orders / My information / Security*, "Add my email" banner, favourites, sign out | signed-in customer (else redirect to sign-in) | AUTH-01…13 |
| `/order/[number]?t=token` | order confirmation, 3-step timeline, delivery details, **cancel order**, return info, "track" | secret token in the link (else 404) | ORD-01…04, AUTH-11…13 |

## 3. Admin (English, left-to-right) — all require an admin session

| Route | Elements | Links | Buttons | Fields | Clicked | No effect | Main functions |
|---|---|---|---|---|---|---|---|
| `/admin` | 35 | 29 | 6 | 0 | 5 | 0 | Overview: KPI cards, shop filter, Analytics Bento, email-setup warning |
| `/admin/orders?status=pending` | 74 | 46 | 26 | 2 | 2 | 0 | Orders list: status tabs (Pending / Confirmed / Delivered / Cancelled / Returned), search, sort, pagination |
| `/admin/orders/[id]` | 49 | 22 | 16 | 11 | 7 | 1 | Order detail: status, items (photo/size/colour), add item, discount, delivery, returns & exchanges, manual status, audit log |
| `/admin/orders/[id]` | 33 | 23 | 9 | 1 | 2 | 0 | Order detail: status, items (photo/size/colour), add item, discount, delivery, returns & exchanges, manual status, audit log |
| `/admin/products` | 34 | 25 | 7 | 2 | 2 | 0 | Products list: status filter, search, New product, delete |
| `/admin/products/[id]` | 179 | 20 | 70 | 89 | 10 | 3 | Product editor: shops on/off, colours, photos, sizes, stock per shop |
| `/admin/products/new` | 45 | 18 | 3 | 24 | 1 | 0 | Create product |
| `/admin/products/categories` | 89 | 18 | 23 | 48 | 7 | 0 | Categories and subcategories |
| `/admin/returns` | 31 | 26 | 3 | 2 | 1 | 0 | Returns & exchanges journal (per shop) |
| `/admin/delivery` | 183 | 20 | 8 | 155 | 2 | 1 | Delivery prices per shop/wilaya, Stop desks, CSV import |
| `/admin/shops` | 67 | 18 | 7 | 42 | 2 | 0 | Shops: create/edit, notification email, on/off |
| `/admin/customers` | 69 | 42 | 26 | 1 | 1 | 0 | Customer list, search |
| `/admin/customers/[id]` | 30 | 27 | 3 | 0 | 1 | 0 | Customer detail and order history |
| `/admin/users` | 98 | 21 | 76 | 1 | 39 | 0 | Users and roles, add customer |

Admin buttons skipped on purpose (they change data): Save, Apply, Set to…, Delete, Remove, Add stock, Set count, Import, Cancel order, Sign out. Their behaviour is covered by the automated tests (`tests/*.test.ts`) and by `returns-e2e.cjs` (confirm → deliver → return → exchange → cancel on a real order).

Admin "no effect" items: "→ Confirmed" (selecting the option that is already selected), "Choose files" (opens the OS file picker, which a script cannot see), "Add desk" (needs the form fields filled first) — all correct.

Pages not probed by clicking in this run (admin probe stopped when the dev server restarted): inventory, reviews, testimonials, social, abandoned, settings, content. They were opened and crawled with 0 errors in the crawl (see TEST_EXECUTION_REPORT) and re-run on the final package.

## 4. Routes in the code (38)

| Route | Type | Auth |
|---|---|---|
| `/` | page | public |
| `/account` | page | signed-in customer |
| `/admin` | page | admin only |
| `/admin/abandoned` | page | admin only |
| `/admin/content` | page | admin only |
| `/admin/customers` | page | admin only |
| `/admin/customers/[id]` | page | admin only |
| `/admin/delivery` | page | admin only |
| `/admin/inventory` | page | admin only |
| `/admin/inventory/[variantId]` | page | admin only |
| `/admin/locations` | page | admin only |
| `/admin/login` | page | public |
| `/admin/orders` | page | admin only |
| `/admin/orders/[id]` | page | admin only |
| `/admin/products` | page | admin only |
| `/admin/products/[id]` | page | admin only |
| `/admin/products/categories` | page | admin only |
| `/admin/products/new` | page | admin only |
| `/admin/returns` | page | admin only |
| `/admin/reviews` | page | admin only |
| `/admin/settings` | page | admin only |
| `/admin/shops` | page | admin only |
| `/admin/social` | page | admin only |
| `/admin/testimonials` | page | admin only |
| `/admin/users` | page | admin only |
| `/api/admin/uploads` | API route | API: admin only |
| `/checkout` | page | public |
| `/clothes` | page | public |
| `/language` | page | public |
| `/location` | page | public |
| `/media/[...path]` | API route | public |
| `/order/[number]` | page | public |
| `/product/[slug]` | page | public |
| `/sign-in` | page | public |
| `/sign-up` | page | public |
| `/track` | page | public |
| `/who-is-king` | page | public |
| `/wishlist` | page | public |
