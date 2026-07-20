-- 搜索热词表 (2026-07-20 补建,迁移报告 P0 缺失项)
-- 用途:补建 MIGRATION_INTEGRITY_REPORT.md 标记的 search_hot_word P0 缺失表
-- 与 hot_words (misc-extended-2.ts) 并存:本表聚焦搜索统计场景(search_count + rank + status int),
-- hot_words 偏运营展示(sort + status varchar)。
-- 表名使用 search_hot_words(复数,符合 Drizzle 命名约定),与已 drop 的历史 search_hot_keywords 不同。

CREATE TABLE IF NOT EXISTS "search_hot_words" (
  "id" BIGSERIAL PRIMARY KEY,
  "keyword" VARCHAR(200) NOT NULL,
  "search_count" INTEGER NOT NULL DEFAULT 0,
  "rank" INTEGER NOT NULL DEFAULT 0,
  "status" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "search_hot_words_keyword_idx"
  ON "search_hot_words"("keyword");

CREATE INDEX IF NOT EXISTS "search_hot_words_status_idx"
  ON "search_hot_words"("status");

COMMENT ON TABLE "search_hot_words" IS '搜索热词表(2026-07-20 补建,P0 缺失项)';
COMMENT ON COLUMN "search_hot_words"."keyword" IS '热搜关键词(唯一)';
COMMENT ON COLUMN "search_hot_words"."search_count" IS '搜索次数,默认 0';
COMMENT ON COLUMN "search_hot_words"."rank" IS '排名,默认 0(数值越小越靠前)';
COMMENT ON COLUMN "search_hot_words"."status" IS '状态:1-启用 0-禁用';
