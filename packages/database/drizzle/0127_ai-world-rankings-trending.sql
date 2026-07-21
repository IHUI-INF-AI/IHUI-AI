-- 2026-07-22 AI World 升级:模型排行榜表(ai_world_rankings)+ aiWorldItems 热度字段
-- 5 大权威榜单:LMSYS / OpenCompass / HF Open LLM / SuperCLUE / Artificial Analysis
-- 热度数据:GitHub stars / forks + LLM 综合热度分 0-100

CREATE TABLE IF NOT EXISTS "ai_world_rankings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"leaderboard" varchar(50) NOT NULL,
	"category" varchar(50) NOT NULL,
	"rank" integer NOT NULL,
	"model_name" varchar(200) NOT NULL,
	"provider" varchar(100),
	"score" varchar(100),
	"scores" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_ai_world_rankings_leaderboard" ON "ai_world_rankings" USING btree ("leaderboard");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_ai_world_rankings_category" ON "ai_world_rankings" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_ai_world_rankings_rank" ON "ai_world_rankings" USING btree ("rank");--> statement-breakpoint
ALTER TABLE "ai_world_rankings" ADD CONSTRAINT "uq_ai_world_rankings_lb_cat_model" UNIQUE("leaderboard","category","model_name");--> statement-breakpoint
ALTER TABLE "ai_world_items" ADD COLUMN IF NOT EXISTS "trending_score" integer;--> statement-breakpoint
ALTER TABLE "ai_world_items" ADD COLUMN IF NOT EXISTS "trending_metrics" jsonb;--> statement-breakpoint
ALTER TABLE "ai_world_items" ADD COLUMN IF NOT EXISTS "trending_updated_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_ai_world_items_trending_score" ON "ai_world_items" USING btree ("trending_score");
