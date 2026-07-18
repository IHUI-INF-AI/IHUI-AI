-- skills 表同步字段:支持 CLI ↔ Web 双向同步
-- 新增字段:
--   slug           — skill 的 URL 友好标识(小写+短横线),用于 (authorId, slug) 唯一定位
--   content_hash   — content 的 SHA-256 hex,用于快速跳过未变更 skill
--   last_synced_at — 最近一次同步时间,用于增量同步
--   sync_source    — 同步来源:'web' | 'cli' | 'api'
-- 同步语义:
--   - CLI push 时计算 content SHA-256 → upsert by (authorId, slug)
--   - content_hash 相同则跳过(无变化),不同则更新
--   - Web 端编辑 → sync_source='web';CLI push → sync_source='cli'

ALTER TABLE "skills" ADD COLUMN IF NOT EXISTS "slug" varchar(100);
ALTER TABLE "skills" ADD COLUMN IF NOT EXISTS "content_hash" varchar(64);
ALTER TABLE "skills" ADD COLUMN IF NOT EXISTS "last_synced_at" timestamp with time zone;
ALTER TABLE "skills" ADD COLUMN IF NOT EXISTS "sync_source" varchar(20) DEFAULT 'web';

-- (author_id, slug) 唯一索引:同一用户下 slug 唯一,用于 upsert 定位
-- 部分索引:仅对 slug 非空的行生效(历史数据可能没有 slug)
CREATE UNIQUE INDEX IF NOT EXISTS "skills_author_slug_unique_idx"
  ON "skills" ("author_id", "slug")
  WHERE "slug" IS NOT NULL;

-- content_hash 索引:快速判断是否有相同内容的 skill(去重场景)
CREATE INDEX IF NOT EXISTS "skills_content_hash_idx"
  ON "skills" ("content_hash")
  WHERE "content_hash" IS NOT NULL;
