CREATE TYPE "public"."payment_status" AS ENUM('due', 'paid', 'refused');--> statement-breakpoint
CREATE TABLE "return_journal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"store_id" integer,
	"type" "return_type" NOT NULL,
	"amount" integer NOT NULL,
	"reason" text,
	"note" text,
	"actor_user_id" uuid,
	"actor_label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "return_journal_items" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"journal_id" uuid NOT NULL,
	"direction" text NOT NULL,
	"order_item_id" uuid,
	"variant_id" uuid,
	"product_name" text NOT NULL,
	"size" text NOT NULL,
	"color" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_value" integer NOT NULL,
	CONSTRAINT "return_journal_items_direction" CHECK ("return_journal_items"."direction" in ('in', 'out')),
	CONSTRAINT "return_journal_items_quantity_positive" CHECK ("return_journal_items"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "returned_quantity" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "exchange_journal_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_status" "payment_status" DEFAULT 'due' NOT NULL;--> statement-breakpoint
ALTER TABLE "return_journal" ADD CONSTRAINT "return_journal_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_journal" ADD CONSTRAINT "return_journal_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_journal" ADD CONSTRAINT "return_journal_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_journal_items" ADD CONSTRAINT "return_journal_items_journal_id_return_journal_id_fk" FOREIGN KEY ("journal_id") REFERENCES "public"."return_journal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_journal_items" ADD CONSTRAINT "return_journal_items_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_journal_items" ADD CONSTRAINT "return_journal_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "return_journal_created_idx" ON "return_journal" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "return_journal_order_idx" ON "return_journal" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "return_journal_items_journal_idx" ON "return_journal_items" USING btree ("journal_id");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_returned_within_quantity" CHECK ("order_items"."returned_quantity" >= 0 and "order_items"."returned_quantity" <= "order_items"."quantity");--> statement-breakpoint
-- Three-step flow: Pending → Confirmed → Delivered (+ Cancelled). Old in-between
-- statuses are mapped; the status history keeps the original values.
UPDATE "orders" SET "status" = 'pending' WHERE "status" = 'contacting';--> statement-breakpoint
UPDATE "orders" SET "status" = 'confirmed' WHERE "status" IN ('preparing', 'ready_for_delivery');--> statement-breakpoint
UPDATE "orders" SET "payment_status" = 'paid' WHERE "status" = 'delivered';--> statement-breakpoint
UPDATE "orders" SET "payment_status" = 'refused' WHERE "status" = 'cancelled';--> statement-breakpoint
-- Completed returns / exchanges from the old workflow go into the journal (requests are kept).
INSERT INTO "return_journal" ("id","order_id","store_id","type","amount","reason","note","actor_label","created_at")
SELECT r."id", r."order_id", o."store_id", r."type",
  CASE WHEN r."type" = 'return' THEN -coalesce(r."refund_amount", round(oi."unit_price" * r."quantity" * (o."subtotal" - o."discount_amount")::numeric / nullif(o."subtotal", 0))::int, 0) ELSE 0 END,
  r."reason", r."admin_note", 'Before 2026-11 (old workflow)', r."updated_at"
FROM "return_requests" r JOIN "orders" o ON o."id" = r."order_id" JOIN "order_items" oi ON oi."id" = r."order_item_id"
WHERE r."status" = 'completed';--> statement-breakpoint
INSERT INTO "return_journal_items" ("journal_id","direction","order_item_id","variant_id","product_name","size","color","quantity","unit_value")
SELECT r."id", 'in', oi."id", oi."variant_id", oi."product_name", oi."size", oi."color", r."quantity", oi."unit_price"
FROM "return_requests" r JOIN "order_items" oi ON oi."id" = r."order_item_id"
WHERE r."status" = 'completed';--> statement-breakpoint
UPDATE "order_items" oi SET "returned_quantity" = least(oi."quantity", x.q)
FROM (SELECT "order_item_id", sum("quantity")::int AS q FROM "return_requests" WHERE "status" = 'completed' GROUP BY 1) x
WHERE x."order_item_id" = oi."id";
--> statement-breakpoint
-- Delivered orders whose every item came back count as refused (no revenue).
UPDATE "orders" o SET "payment_status" = 'refused'
WHERE o."status" = 'delivered' AND NOT EXISTS (
  SELECT 1 FROM "order_items" oi WHERE oi."order_id" = o."id" AND oi."removed_at" IS NULL AND oi."returned_quantity" < oi."quantity");
