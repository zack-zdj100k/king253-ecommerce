ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "wilaya_code" smallint;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_type" "delivery_type" DEFAULT 'home' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_desk_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "desk_name" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "desk_address" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "referral_source" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "locale" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "login_phone" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "locale" text;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_desk_id_delivery_desks_id_fk" FOREIGN KEY ("delivery_desk_id") REFERENCES "public"."delivery_desks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_login_phone_unique" ON "users" USING btree ("login_phone");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_or_phone" CHECK ("users"."email" is not null or "users"."login_phone" is not null);--> statement-breakpoint
UPDATE "orders" o SET "wilaya_code" = w."code" FROM "wilayas" w WHERE lower(o."wilaya_name") = lower(w."name_fr");--> statement-breakpoint
UPDATE "orders" o SET "referral_source" = u."referral_source" FROM "users" u WHERE o."user_id" = u."id" AND o."referral_source" IS NULL;--> statement-breakpoint
-- Customers who saved a valid mobile number on their account can also sign in with it
-- (only when no other account saved the same number).
WITH n AS (
  SELECT "id", '+213' || substring(regexp_replace(coalesce("phone", ''), '[\s.()-]', '', 'g') FROM '^(?:\+213|00213|213|0)([5-7][0-9]{8})$') AS p
  FROM "users" WHERE "role" = 'customer'
), u AS (
  SELECT p FROM n WHERE p IS NOT NULL GROUP BY p HAVING count(*) = 1
)
UPDATE "users" SET "login_phone" = n.p FROM n JOIN u ON u.p = n.p WHERE "users"."id" = n."id";
