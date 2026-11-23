ALTER TABLE "categories" ADD COLUMN "translations" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "testimonials" ADD COLUMN "translations" jsonb DEFAULT '{}'::jsonb NOT NULL;