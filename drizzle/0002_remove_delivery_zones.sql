DROP TABLE "cities" CASCADE;--> statement-breakpoint
DROP TABLE "delivery_points" CASCADE;--> statement-breakpoint
DROP TABLE "wilayas" CASCADE;--> statement-breakpoint
ALTER TABLE "cart_items" DROP CONSTRAINT IF EXISTS "cart_items_variant_id_product_variants_id_fk";
--> statement-breakpoint
ALTER TABLE "checkout_profiles" DROP CONSTRAINT IF EXISTS "checkout_profiles_wilaya_id_wilayas_id_fk";
--> statement-breakpoint
ALTER TABLE "checkout_profiles" DROP CONSTRAINT IF EXISTS "checkout_profiles_delivery_point_id_delivery_points_id_fk";
--> statement-breakpoint
ALTER TABLE "customers" DROP CONSTRAINT IF EXISTS "customers_wilaya_id_wilayas_id_fk";
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_order_id_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS "order_items_order_id_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS "order_items_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS "order_items_variant_id_product_variants_id_fk";
--> statement-breakpoint
ALTER TABLE "order_status_history" DROP CONSTRAINT IF EXISTS "order_status_history_order_id_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_wilaya_id_wilayas_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_delivery_point_id_delivery_points_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_customer_id_customers_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "product_variants" DROP CONSTRAINT IF EXISTS "product_variants_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "return_requests" DROP CONSTRAINT IF EXISTS "return_requests_order_id_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "return_requests" DROP CONSTRAINT IF EXISTS "return_requests_order_item_id_order_items_id_fk";
--> statement-breakpoint
ALTER TABLE "return_requests" DROP CONSTRAINT IF EXISTS "return_requests_replacement_variant_id_product_variants_id_fk";
--> statement-breakpoint
ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "reviews_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "reviews_order_id_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "reviews_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "stock_movements" DROP CONSTRAINT IF EXISTS "stock_movements_variant_id_product_variants_id_fk";
--> statement-breakpoint
ALTER TABLE "stock_reservations" DROP CONSTRAINT IF EXISTS "stock_reservations_variant_id_product_variants_id_fk";
--> statement-breakpoint
ALTER TABLE "stock_reservations" DROP CONSTRAINT IF EXISTS "stock_reservations_order_item_id_order_items_id_fk";
--> statement-breakpoint
ALTER TABLE "wishlist_items" DROP CONSTRAINT IF EXISTS "wishlist_items_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "product_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "variant_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "customer_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_replacement_variant_id_product_variants_id_fk" FOREIGN KEY ("replacement_variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_profiles" DROP COLUMN "wilaya_id";--> statement-breakpoint
ALTER TABLE "checkout_profiles" DROP COLUMN "delivery_type";--> statement-breakpoint
ALTER TABLE "checkout_profiles" DROP COLUMN "delivery_point_id";--> statement-breakpoint
ALTER TABLE "customers" DROP COLUMN "wilaya_id";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "wilaya_id";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "delivery_type";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "delivery_point_id";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "delivery_point_name";--> statement-breakpoint
DROP TYPE "public"."delivery_type";