-- On Time Express price list (PDF "Tarifs Standard On Time Express — Station Constantine", DA), given by the owner
-- on 2026-11-15 (photos). Also in data/delivery/on-time-express-constantine-rates.csv.
-- 55 wilayas. A desk price of "0" in the PDF (Beni Abbes, El M'Ghair) = no Stop desk = NULL.
-- Wilayas that are not in the PDF (50, 54, 56, 59 and up) stay "confirmed by phone": no price.
-- Return fees are not in this PDF: they are left untouched (not set yet for Constantine).
-- Re-running is safe: it updates the same rows.
INSERT INTO "delivery_rates" ("store_id","wilaya_code","home_price","desk_price","updated_at")
SELECT s."id", v."code", v."home", v."desk", now()
FROM (VALUES
(1,1200,700),
(2,750,450),
(3,900,600),
(4,750,450),
(5,750,450),
(6,750,450),
(7,850,550),
(8,1100,800),
(9,650,400),
(10,750,550),
(11,1350,800),
(12,800,450),
(13,850,500),
(14,850,550),
(15,750,500),
(16,550,350),
(17,900,600),
(18,750,450),
(19,600,400),
(20,850,550),
(21,750,450),
(22,800,550),
(23,750,450),
(24,800,450),
(25,600,400),
(26,750,550),
(27,800,500),
(28,800,500),
(29,800,500),
(30,900,650),
(31,750,500),
(32,1000,700),
(33,1500,800),
(34,600,400),
(35,700,500),
(36,800,450),
(37,1450,850),
(38,800,500),
(39,900,600),
(40,800,550),
(41,800,500),
(42,750,450),
(43,650,450),
(44,750,550),
(45,950,550),
(46,750,450),
(47,1000,650),
(48,800,500),
(49,1350,700),
(51,900,650),
(52,1200,NULL),
(53,1300,800),
(55,1100,700),
(57,1150,NULL),
(58,1000,750)
) AS v("code","home","desk")
JOIN "wilayas" w ON w."code" = v."code"
CROSS JOIN LATERAL (
  SELECT "id" FROM "stores" WHERE "slug" = 'constantine' OR lower("wilaya") LIKE '%constantine%'
  ORDER BY ("slug" = 'constantine') DESC, "id" LIMIT 1
) s
ON CONFLICT ("store_id","wilaya_code") DO UPDATE
SET "home_price" = EXCLUDED."home_price", "desk_price" = EXCLUDED."desk_price", "updated_at" = now();--> statement-breakpoint
UPDATE "delivery_rates" r
SET "home_price" = NULL, "desk_price" = NULL, "updated_at" = now()
FROM (
  SELECT "id" FROM "stores" WHERE "slug" = 'constantine' OR lower("wilaya") LIKE '%constantine%'
  ORDER BY ("slug" = 'constantine') DESC, "id" LIMIT 1
) s
WHERE r."store_id" = s."id" AND r."wilaya_code" NOT IN (1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,51,52,53,55,57,58);
