-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
-- BUG-85: 存量表新增 NOT NULL 列必须带 DEFAULT，否则非空表在 ADD COLUMN 处当场中断。
ALTER TABLE "ai_world_categories" ADD COLUMN "slug" varchar(100) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "ai_world_categories" ADD COLUMN "description" varchar(500);--> statement-breakpoint
ALTER TABLE "ai_world_categories" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_world_categories" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_world_items" ADD COLUMN "kind" varchar(32) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "ai_world_items" ADD COLUMN "slug" varchar(200);--> statement-breakpoint
ALTER TABLE "ai_world_items" ADD COLUMN "summary" varchar(1000);--> statement-breakpoint
ALTER TABLE "ai_world_items" ADD COLUMN "url" varchar(1000);--> statement-breakpoint
ALTER TABLE "ai_world_items" ADD COLUMN "source" varchar(200) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "ai_world_items" ADD COLUMN "source_url" varchar(1000);--> statement-breakpoint
ALTER TABLE "ai_world_items" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ai_world_items" ADD COLUMN "fetched_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_world_items" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_world_items" ADD COLUMN "like_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_ai_world_sync_log_source" ON "ai_world_sync_log" USING btree ("source");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_ai_world_sync_log_started_at" ON "ai_world_sync_log" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_ai_world_items_kind" ON "ai_world_items" USING btree ("kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_ai_world_items_source" ON "ai_world_items" USING btree ("source");--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_world_categories_slug_unique') THEN
    BEGIN
      ALTER TABLE "ai_world_categories" ADD CONSTRAINT "ai_world_categories_slug_unique" UNIQUE("slug");
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE 'BUG-85: ai_world_categories 存量 slug 重复，跳过唯一约束(待清理后补建)';
    END;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_ai_world_items_kind_source_url') THEN
    BEGIN
      ALTER TABLE "ai_world_items" ADD CONSTRAINT "uq_ai_world_items_kind_source_url" UNIQUE("kind","source_url");
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE 'BUG-85: ai_world_items 存量 (kind,source_url) 重复，跳过唯一约束(待清理后补建)';
    END;
  END IF;
END $$;
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
