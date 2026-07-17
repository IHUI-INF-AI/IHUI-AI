ALTER TABLE "resources" ADD COLUMN "type" varchar(50);--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "product_id" uuid;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "tag_id_list" jsonb;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "image" varchar(500);--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "introduction" text;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "cid_list" jsonb;--> statement-breakpoint
CREATE INDEX "resources_product_idx" ON "resources" USING btree ("product_id");