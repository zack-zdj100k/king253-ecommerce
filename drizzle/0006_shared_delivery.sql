ALTER TABLE "orders" ADD COLUMN "free_delivery" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "ships_with_order_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_ships_with_order_id_orders_id_fk" FOREIGN KEY ("ships_with_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;