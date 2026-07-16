-- 0081: learn_topic 表新增 slug 与 sort 字段
-- slug: URL 友好标识(可空),sort: 排序权重(默认 0)
-- 对应 schema: packages/database/src/schema/learn-extra-extended.ts learnTopic.slug/sort
-- 幂等可重复执行(IF NOT EXISTS)
ALTER TABLE "learn_topic"
  ADD COLUMN IF NOT EXISTS "slug" varchar(200),
  ADD COLUMN IF NOT EXISTS "sort" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "learn_topic_sort_idx" ON "learn_topic" USING btree ("sort");
