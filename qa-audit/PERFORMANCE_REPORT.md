# Performance report

All numbers are **measured**, not estimated. Conditions are stated for each table.

## 1. Server response time — live site (https://king253.com, DZSecurity, 1 CPU)

Measured from the test machine, 5 requests per page (time to first byte):

| Page | Min | Median | Max |
|---|---|---|---|
| `/fr` | 0.21 s | 0.22 s | 0.63 s |
| `/fr/clothes` | 0.21 s | 0.23 s | 0.28 s |
| `/ar` | 0.21 s | 0.25 s | 0.27 s |
| `/language` | 0.20 s | 0.21 s | 0.30 s |
| `/sitemap.xml` | 0.19 s | 0.22 s | 0.28 s |

Postman / newman collection (`tests/postman/king253-speed.postman_collection.json`), 5 iterations on the live site: **70 requests, 140 assertions, 0 failed, average 126 ms** (min 62, max 960 ms).

## 2. Lighthouse 12 — mobile (simulated slow 4G + 4× slower CPU)

| Page | Where | Performance | Accessibility | Best practices | SEO | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|---|---|
| Home `/fr` | live (old version) | 43 | 96 | 100 | 100 | 1.4 s | 7.6 s | 2.81 s | 0 |
| Collection `/fr/clothes` | live | 67 | 96 | 100 | 100 | 1.3 s | 2.8 s | 1.76 s | 0 |
| Who is King | live | 57 | 96 | 100 | 100 | 1.4 s | 4.8 s | 1.16 s | 0 |
| Home `/ar` | live | 52 | 96 | 100 | 100 | 1.4 s | 7.3 s | 1.02 s | 0 |
| Home `/fr` | final package (local) | 45 | 96 | 100 | 100 | 1.4 s | 7.9 s | 2.15 s | 0 |
| Collection | final package | 64 | 96 | 96 | 100 | 1.4 s | 6.2 s | 0.53 s | 0 |
| Product page | final package | 71 | 96 | 100 | 100 | 1.4 s | 5.1 s | 0.38 s | 0 |
| Who is King | final package | 67 | 96 | 100 | 100 | 1.4 s | 5.5 s | 0.47 s | 0 |

Earlier in this audit, the phone images were reduced from 3840 px to ~1920 px and a blur filter removed on large backgrounds: the home page's blocking time went from **10.5 s to ~1–2 s** (same conditions).

### What limits the score (measured, from the Lighthouse traces)
1. **Home page Largest Contentful Paint (7–8 s on the simulated slow phone):** the LCP element is the hero text, which is hidden until the intro animation runs (render delay ≈ 94 % of LCP). This is the brand's animated intro, kept on purpose.
2. **JavaScript work on the home page** (GSAP + scroll effects + the pinned hero) gives ~1–2 s of blocking time on a slow phone.
3. Layout stability is perfect (CLS 0 everywhere); first paint is fast (1.3–1.4 s); images are WebP, resized and cached 30 days.

### Recommendations (not done — they change the design and need your OK)
* Show the hero text immediately and animate only movement (not visibility) → expected large LCP gain on the home page.
* Load the scroll-animation code after the first paint on phones.

## 3. Controlled load test — final package, local machine (single process)

| Page | Requests | At once | Throughput | p50 | p95 | p99 | Errors |
|---|---|---|---|---|---|---|---|
| `/fr` | 300 | 25 | 40 / s | 598 ms | 733 ms | 840 ms | **0** |
| `/fr/clothes` | 300 | 25 | 33 / s | 751 ms | 946 ms | 1046 ms | **0** |
| product page | 300 | 25 | 41 / s | 601 ms | 762 ms | 837 ms | **0** |
| `/sitemap.xml` | 200 | 25 | 356 / s | 69 ms | 103 ms | 121 ms | **0** |
| `/ar/clothes` | 200 | 50 | 21 / s | 2286 ms | 2638 ms | 2798 ms | **0** |

No errors under 50 simultaneous visitors. The host has 1 CPU, so absolute numbers there will be lower; a small shop's traffic (a few visitors at once) is far below these levels. No load test was run against production (forbidden by the audit rules).

## 4. Database query efficiency

12 indexes added on foreign-key columns (migration 0019) so order lists per shop, a customer's orders, the journal per shop and stock ledgers stay fast as data grows. All tables are small today (largest: communes 1,541 rows).

## 5. Limitations

Lighthouse simulates a slow phone; real devices on 4G in Algeria will usually be faster than the "LCP" shown but slower than desktop. Measurements were taken from one location. No Interaction-to-Next-Paint field data (needs real users / Search Console).
