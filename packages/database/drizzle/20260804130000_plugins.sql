-- Migration 20260804130000: plugins 插件元数据表
-- 创建时间: 2026-08-04
-- 描述: §24 用户已确认 DB 化,原 plugins-data.ts 代码常量迁移到 DB,支持后台 CRUD(上架/下架/编辑)。
--       agent-creation.ts type='plugin' 分支查询此表。
--       plugin_events.pluginId 软引用此表 name(非外键,兼容历史数据)。
--       插件是平台级的(无 user_id 字段),全局共享;通过 is_active 控制上下架。
--
-- 幂等安全:使用 IF NOT EXISTS,表/索引已存在则为 no-op。

CREATE TABLE IF NOT EXISTS "plugins" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(128) NOT NULL UNIQUE,
    "display_name" VARCHAR(256) NOT NULL,
    "description" TEXT,
    "version" VARCHAR(32) NOT NULL DEFAULT '1.0.0',
    "author" VARCHAR(128),
    "category" VARCHAR(64),
    "icon" VARCHAR(512),
    "readme" TEXT,
    "is_official" BOOLEAN NOT NULL DEFAULT FALSE,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "download_url" VARCHAR(512),
    "config" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_plugins_category" ON "plugins"("category");
CREATE INDEX IF NOT EXISTS "idx_plugins_active" ON "plugins"("is_active");
