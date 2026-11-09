CREATE TABLE "product_stores" (
	"product_id" uuid NOT NULL,
	"store_id" integer NOT NULL,
	CONSTRAINT "product_stores_product_id_store_id_pk" PRIMARY KEY("product_id","store_id")
);
--> statement-breakpoint
CREATE TABLE "store_stock" (
	"variant_id" uuid NOT NULL,
	"store_id" integer NOT NULL,
	"physical" integer DEFAULT 0 NOT NULL,
	"reserved" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_stock_variant_id_store_id_pk" PRIMARY KEY("variant_id","store_id"),
	CONSTRAINT "store_stock_physical_non_negative" CHECK ("store_stock"."physical" >= 0),
	CONSTRAINT "store_stock_reserved_non_negative" CHECK ("store_stock"."reserved" >= 0),
	CONSTRAINT "store_stock_reserved_within_physical" CHECK ("store_stock"."reserved" <= "store_stock"."physical")
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "store_id" integer;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "store_id" integer;--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD COLUMN "store_id" integer;--> statement-breakpoint
ALTER TABLE "product_stores" ADD CONSTRAINT "product_stores_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_stores" ADD CONSTRAINT "product_stores_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_stock" ADD CONSTRAINT "store_stock_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_stock" ADD CONSTRAINT "store_stock_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "store_stock_store_idx" ON "store_stock" USING btree ("store_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Existing stock, reservations, movements and orders belong to the Annaba shop (owner's choice, 2026-11-09).
CREATE TEMP TABLE "_default_store" AS
SELECT "id" FROM "stores"
ORDER BY ("slug" = 'annaba') DESC, (lower("wilaya") LIKE '%annaba%') DESC, "id"
LIMIT 1;--> statement-breakpoint
INSERT INTO "product_stores" ("product_id","store_id")
SELECT p."id", d."id" FROM "products" p, "_default_store" d;--> statement-breakpoint
INSERT INTO "store_stock" ("variant_id","store_id","physical","reserved")
SELECT v."id", d."id", v."physical", v."reserved" FROM "product_variants" v, "_default_store" d;--> statement-breakpoint
UPDATE "stock_reservations" SET "store_id" = (SELECT "id" FROM "_default_store");--> statement-breakpoint
UPDATE "stock_movements" SET "store_id" = (SELECT "id" FROM "_default_store");--> statement-breakpoint
UPDATE "orders" SET "store_id" = (SELECT "id" FROM "_default_store");--> statement-breakpoint
DROP TABLE "_default_store";
