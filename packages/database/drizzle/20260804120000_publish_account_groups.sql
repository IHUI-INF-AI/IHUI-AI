-- 2026-08-04 补建 publish_account_groups + publish_account_group_members 表
-- 来源:ai-service app/services/publish/account_groups.py 运行时自建,TS schema 未管理
-- 本 migration 将建表逻辑统一到 Drizzle migration,消除 schema_check WARNING
-- 幂等:使用 IF NOT EXISTS,与 ai-service _ensure_tables 共存不冲突

-- 1. 账号分组表(group_id 为 VARCHAR(40) 字符串主键,非 UUID/bigserial)
CREATE TABLE IF NOT EXISTS "publish_account_groups" (
    "group_id" VARCHAR(40) PRIMARY KEY,
    "user_id" VARCHAR(64) NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "description" TEXT DEFAULT '',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_publish_account_groups_user" ON "publish_account_groups"("user_id");

-- 2. 分组成员关联表(复合主键 group_id + account_id,外键 ON DELETE CASCADE)
CREATE TABLE IF NOT EXISTS "publish_account_group_members" (
    "group_id" VARCHAR(40) NOT NULL REFERENCES "publish_account_groups"("group_id") ON DELETE CASCADE,
    "account_id" BIGINT NOT NULL,
    "user_id" VARCHAR(64) NOT NULL,
    "added_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("group_id", "account_id")
);

CREATE INDEX IF NOT EXISTS "idx_publish_group_members_user" ON "publish_account_group_members"("user_id");
