-- 大模型排行榜 (model_leaderboard) — 参考 arena.ai/leaderboard
-- 2026-07-22 新增:6 类模型(llm/image/video/multimodal/audio/embedding) + agent 智能体榜 + 总榜
CREATE TABLE IF NOT EXISTS "model_leaderboard" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "model_id" varchar(128) NOT NULL,
  "model_name" varchar(128) NOT NULL,
  "vendor" varchar(64) NOT NULL,
  "category" varchar(32) NOT NULL,
  "subcategory" varchar(32),
  "arena_score" integer,
  "arena_rank" integer,
  "rank_delta" integer,
  "rank_spread_low" integer,
  "rank_spread_high" integer,
  "score_ci" integer,
  "win_rate" real,
  "vote_count" integer,
  "context_window" varchar(32),
  "max_output" varchar(32),
  "input_price" varchar(64),
  "output_price" varchar(64),
  "release_date" date,
  "highlight" varchar(500),
  "capabilities" text,
  "license" varchar(32) DEFAULT 'Proprietary' NOT NULL,
  "is_overall" boolean DEFAULT false NOT NULL,
  "sort_order" integer DEFAULT 100 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_model_leaderboard_model" ON "model_leaderboard" ("model_id","category");
CREATE INDEX IF NOT EXISTS "ix_model_leaderboard_category" ON "model_leaderboard" ("category","subcategory");
CREATE INDEX IF NOT EXISTS "ix_model_leaderboard_rank" ON "model_leaderboard" ("category","arena_rank");
CREATE INDEX IF NOT EXISTS "ix_model_leaderboard_overall" ON "model_leaderboard" ("is_overall","arena_rank");
