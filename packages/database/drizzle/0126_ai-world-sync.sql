CREATE TABLE "ai_world_sync_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(200) NOT NULL,
	"kind" varchar(32) NOT NULL,
	"status" varchar(32) NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"item_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_world_categories" ALTER COLUMN "icon" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "ai_world_items" ALTER COLUMN "title" SET DATA TYPE varchar(500);--> statement-breakpoint
ALTER TABLE "ai_world_items" ALTER COLUMN "cover_image" SET DATA TYPE varchar(1000);--> statement-breakpoint
ALTER TABLE "ai_world_categories" ADD COLUMN "slug" varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_world_categories" ADD COLUMN "description" varchar(500);--> statement-breakpoint
ALTER TABLE "ai_world_categories" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_world_categories" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_world_items" ADD COLUMN "kind" varchar(32) NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_world_items" ADD COLUMN "slug" varchar(200);--> statement-breakpoint
ALTER TABLE "ai_world_items" ADD COLUMN "summary" varchar(1000);--> statement-breakpoint
ALTER TABLE "ai_world_items" ADD COLUMN "url" varchar(1000);--> statement-breakpoint
ALTER TABLE "ai_world_items" ADD COLUMN "source" varchar(200) NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_world_items" ADD COLUMN "source_url" varchar(1000);--> statement-breakpoint
ALTER TABLE "ai_world_items" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ai_world_items" ADD COLUMN "fetched_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_world_items" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_world_items" ADD COLUMN "like_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "ix_ai_world_sync_log_source" ON "ai_world_sync_log" USING btree ("source");--> statement-breakpoint
CREATE INDEX "ix_ai_world_sync_log_started_at" ON "ai_world_sync_log" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "ix_ai_world_items_kind" ON "ai_world_items" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "ix_ai_world_items_source" ON "ai_world_items" USING btree ("source");--> statement-breakpoint
ALTER TABLE "ai_world_categories" ADD CONSTRAINT "ai_world_categories_slug_unique" UNIQUE("slug");--> statement-breakpoint
ALTER TABLE "ai_world_items" ADD CONSTRAINT "uq_ai_world_items_kind_source_url" UNIQUE("kind","source_url");