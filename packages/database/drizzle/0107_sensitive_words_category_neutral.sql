-- 敏感词分类 ID 中性化:历史数据 porn→explicit, abuse→harassment
-- 原因:避免敏感词进入 LLM 上下文触发安全过滤(2026-07-19 LLM 安全清洁)
-- 同步改动:packages/database/src/schema/sensitive-words.ts 注释
--          apps/api/src/routes/admin-sensitive-words.ts CATEGORIES enum
--          apps/web/app/(main)/admin/sensitive-words/helpers.ts CATEGORIES
-- category 为 varchar(32) 非 enum,DB 不强制值,本迁移仅更新历史数据
UPDATE "sensitive_words" SET "category" = 'explicit' WHERE "category" = 'porn';--> statement-breakpoint
UPDATE "sensitive_words" SET "category" = 'harassment' WHERE "category" = 'abuse';
