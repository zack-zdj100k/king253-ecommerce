ALTER TABLE "stores" ADD COLUMN "courier_name" text;--> statement-breakpoint
-- Each shop's delivery company (from the price lists the owner gave): Annaba ships with ZR Express,
-- Constantine with On Time Express. Editable in Admin → Shops → "Delivery company".
UPDATE "stores" SET "courier_name" = 'ZR Express' WHERE "courier_name" IS NULL AND ("slug" = 'annaba' OR lower("wilaya") LIKE '%annaba%');--> statement-breakpoint
UPDATE "stores" SET "courier_name" = 'On Time Express' WHERE "courier_name" IS NULL AND ("slug" = 'constantine' OR lower("wilaya") LIKE '%constantine%');
