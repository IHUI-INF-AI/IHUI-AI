-- 0115_r82_seed_unique_indexes.sql
-- R82: 为 ai-fresh-2026.ts seed 6 处 `if (ex) continue` 升级为 `onConflictDoNothing` 所需 unique 索引
-- circles.slug 已有 unique 约束(原 schema),此迁移仅补 4 张表:
--   live_channels.title, news_articles.title, asks.title, resources.title

CREATE UNIQUE INDEX IF NOT EXISTS "live_channels_title_uniq" ON "live_channels" ("title");
CREATE UNIQUE INDEX IF NOT EXISTS "news_articles_title_uniq" ON "news_articles" ("title");
CREATE UNIQUE INDEX IF NOT EXISTS "asks_title_uniq" ON "asks" ("title");
CREATE UNIQUE INDEX IF NOT EXISTS "resources_title_uniq" ON "resources" ("title");
