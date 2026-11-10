-- ZR Express price list (PDF "Tarif de livraison e-commerce", departure Annaba, tariff 1, DA, HT),
-- given by the owner on 2026-11-10. Also in data/delivery/zr-express-annaba-rates.csv.
-- 54 wilayas; "—" in the PDF (no Stop desk) = NULL desk price. Wilayas absent from the PDF keep
-- no price (home delivery "confirmed by phone"). Re-running is safe: it updates the same rows.
INSERT INTO "delivery_rates" ("store_id","wilaya_code","home_price","desk_price","updated_at")
SELECT s."id", v."code", v."home", v."desk", now()
FROM (VALUES
(1,1400,980),
(2,800,530),
(3,950,680),
(4,750,530),
(5,750,530),
(6,750,530),
(7,950,630),
(8,1100,730),
(9,750,530),
(10,750,530),
(11,1600,1130),
(12,800,530),
(13,900,580),
(14,800,530),
(15,750,530),
(16,650,480),
(17,950,580),
(18,750,530),
(19,750,530),
(20,800,580),
(21,700,530),
(22,800,530),
(23,500,380),
(24,700,530),
(25,700,530),
(26,800,530),
(27,800,530),
(28,850,580),
(29,800,530),
(30,1000,680),
(31,800,530),
(32,1050,680),
(34,750,530),
(35,750,530),
(36,650,530),
(38,800,530),
(39,1000,680),
(40,750,530),
(41,750,530),
(42,800,530),
(43,750,530),
(44,800,530),
(45,1100,680),
(46,800,530),
(47,1000,680),
(48,800,530),
(49,1400,980),
(51,950,630),
(52,1200,980),
(53,1600,1130),
(54,1600,NULL),
(55,1000,680),
(57,950,NULL),
(58,1000,680)
) AS v("code","home","desk")
JOIN "wilayas" w ON w."code" = v."code"
CROSS JOIN LATERAL (
  SELECT "id" FROM "stores" WHERE "slug" = 'annaba' OR lower("wilaya") LIKE '%annaba%'
  ORDER BY ("slug" = 'annaba') DESC, "id" LIMIT 1
) s
ON CONFLICT ("store_id","wilaya_code") DO UPDATE
SET "home_price" = EXCLUDED."home_price", "desk_price" = EXCLUDED."desk_price", "updated_at" = now();
