-- 自媒体已发布内容记忆表(2026-07-20 新增)
-- 迁移自源项目 `F:\BaiduSyncdisk\自媒体\公众号\wechat-article-system\已发布内容记忆.json`
-- 与 `口播稿\koubo\materials\已发布内容记忆.json`,统一存数据库供 ai-service 查询。
--
-- 用途:替代原 JSON 文件,跨进程共享、支持事务、可索引查询。
-- 写入方:apps/api/src/routes/self-media-routes.ts(推送成功后 upsert)
-- 读取方:apps/ai-service/app/routers/self_media.py(_fetch_history 函数)

CREATE TABLE IF NOT EXISTS "self_media_published" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "category" VARCHAR(16) NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'generated',
  "draft_id" VARCHAR(128),
  "topic_keyword" VARCHAR(200),
  "payload" JSONB,
  "author_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ix_self_media_published_category"
  ON "self_media_published"("category");
CREATE INDEX IF NOT EXISTS "ix_self_media_published_created_at"
  ON "self_media_published"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "ix_self_media_published_author"
  ON "self_media_published"("author_id");

COMMENT ON TABLE "self_media_published" IS '自媒体已发布内容记忆(公众号文章 + 口播稿,迁移自 JSON)';
COMMENT ON COLUMN "self_media_published"."category" IS 'wechat=公众号文章 / koubo=抖音口播稿';
COMMENT ON COLUMN "self_media_published"."status" IS 'generated=已生成草稿 / published=已正式发布 / failed=流水线失败';
COMMENT ON COLUMN "self_media_published"."payload" IS '扩展字段(image_registry / topic_keyword / draft_id 等,来自原 JSON)';
