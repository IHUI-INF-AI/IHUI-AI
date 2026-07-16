-- 0082: learn_topic.slug 唯一约束(partial unique index,仅对非 NULL 值生效)
-- 对应 schema: packages/database/src/schema/learn-extra-extended.ts learnTopic.slugUnique
-- 幂等可重复执行(IF NOT EXISTS)
-- 设计:partial unique index(WHERE slug IS NOT NULL)允许未设置 slug 的记录共存,
-- 仅当 slug 非 NULL 时校验唯一性(参照 RuoYi/WordPress slug 风格)
CREATE UNIQUE INDEX IF NOT EXISTS "learn_topic_slug_uniq"
  ON "learn_topic" USING btree ("slug")
  WHERE "slug" IS NOT NULL;
