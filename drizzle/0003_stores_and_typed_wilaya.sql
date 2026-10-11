CREATE TABLE "stores" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"wilaya" text NOT NULL,
	"city" text NOT NULL,
	"address" text NOT NULL,
	"phone" text,
	"hours" text,
	"map_url" text,
	"latitude" real,
	"longitude" real,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checkout_profiles" ADD COLUMN "wilaya" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "wilaya" text;