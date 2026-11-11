ALTER TABLE "delivery_rates" ADD COLUMN "return_price" integer;--> statement-breakpoint
ALTER TABLE "return_journal" ADD COLUMN "return_cost" integer;--> statement-breakpoint
-- ZR Express return fee from Annaba (PDF "Tarif 1, départ Annaba", column Retour), given by the owner:
-- 250 DA for Tamanrasset (11), In Salah (53), In Guezzam (54); 200 DA for every other wilaya in the list.
-- Only Annaba's rows: Constantine's return fee is not known yet (stays NULL = "not set").
UPDATE "delivery_rates" r
SET "return_price" = CASE WHEN r."wilaya_code" IN (11, 53, 54) THEN 250 ELSE 200 END, "updated_at" = now()
FROM (
  SELECT "id" FROM "stores" WHERE "slug" = 'annaba' OR lower("wilaya") LIKE '%annaba%'
  ORDER BY ("slug" = 'annaba') DESC, "id" LIMIT 1
) s
WHERE r."store_id" = s."id" AND r."home_price" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_rates" DROP CONSTRAINT IF EXISTS "delivery_rates_prices_non_negative";--> statement-breakpoint
ALTER TABLE "delivery_rates" ADD CONSTRAINT "delivery_rates_prices_non_negative" CHECK (coalesce("home_price", 0) >= 0 and coalesce("desk_price", 0) >= 0 and coalesce("return_price", 0) >= 0);
