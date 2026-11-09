CREATE TYPE "public"."delivery_type" AS ENUM('home', 'desk');--> statement-breakpoint
CREATE TABLE "delivery_desks" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" integer NOT NULL,
	"wilaya_code" smallint NOT NULL,
	"commune" text NOT NULL,
	"name" text NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"desk_price" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_desks_price_non_negative" CHECK (coalesce("delivery_desks"."desk_price", 0) >= 0)
);
--> statement-breakpoint
CREATE TABLE "delivery_rates" (
	"store_id" integer NOT NULL,
	"wilaya_code" smallint NOT NULL,
	"home_price" integer,
	"desk_price" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_rates_store_id_wilaya_code_pk" PRIMARY KEY("store_id","wilaya_code"),
	CONSTRAINT "delivery_rates_prices_non_negative" CHECK (coalesce("delivery_rates"."home_price", 0) >= 0 and coalesce("delivery_rates"."desk_price", 0) >= 0)
);
--> statement-breakpoint
ALTER TABLE "delivery_desks" ADD CONSTRAINT "delivery_desks_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_desks" ADD CONSTRAINT "delivery_desks_wilaya_code_wilayas_code_fk" FOREIGN KEY ("wilaya_code") REFERENCES "public"."wilayas"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_rates" ADD CONSTRAINT "delivery_rates_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_rates" ADD CONSTRAINT "delivery_rates_wilaya_code_wilayas_code_fk" FOREIGN KEY ("wilaya_code") REFERENCES "public"."wilayas"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "delivery_desks_lookup_idx" ON "delivery_desks" USING btree ("store_id","wilaya_code");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_desks_unique" ON "delivery_desks" USING btree ("store_id","wilaya_code","name");--> statement-breakpoint
-- Until the owner imports the couriers' price lists, every shop keeps the old single
-- home-delivery fee (Settings → deliveryFee) for every wilaya, if one was set.
INSERT INTO "delivery_rates" ("store_id","wilaya_code","home_price")
SELECT s."id", w."code", (st."value" #>> '{}')::int
FROM "stores" s CROSS JOIN "wilayas" w
JOIN "settings" st ON st."key" = 'deliveryFee'
WHERE s."active" AND (st."value" #>> '{}') ~ '^[0-9]+$' AND (st."value" #>> '{}')::int > 0
ON CONFLICT DO NOTHING;
