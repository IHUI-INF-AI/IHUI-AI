-- CLI 配置导入功能(2026-07-20)
-- 支持 cc-switch / codex++ / 各 CLI 工具(Claude Code / Codex / Gemini CLI / Hermes)配置文件导入
--
-- 1. ai_model_config 表追加 3 个可空字段(导入溯源)
-- 2. 新建 cli_provider_imports 表(导入历史)
-- 3. 创建 partial unique index(导入去重)

-- 1. ai_model_config 追加字段(可空,向后兼容)
ALTER TABLE ai_model_config
  ADD COLUMN IF NOT EXISTS import_source VARCHAR(32),
  ADD COLUMN IF NOT EXISTS import_source_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS import_source_app_type VARCHAR(32);

COMMENT ON COLUMN ai_model_config.import_source IS 'CLI 配置导入来源: cc-switch | codex++ | claude-cli | codex-cli | gemini-cli | hermes | NULL(手动创建)';
COMMENT ON COLUMN ai_model_config.import_source_id IS '源工具中的 provider id(cc-switch) / relayProfile id(codex++)';
COMMENT ON COLUMN ai_model_config.import_source_app_type IS '仅 cc-switch:claude | claude-desktop | codex | gemini | cli | opencode | openclaw | hermes';

-- 2. 新建 cli_provider_imports 表
CREATE TABLE IF NOT EXISTS "cli_provider_imports" (
  "id" VARCHAR(64) PRIMARY KEY,
  "owner_uuid" VARCHAR(64) NOT NULL,
  "source" VARCHAR(32) NOT NULL,
  "source_app_type" VARCHAR(32),
  "source_path" VARCHAR(500) NOT NULL,
  "source_version" VARCHAR(32),
  "imported_count" INTEGER NOT NULL DEFAULT 0,
  "skipped_count" INTEGER NOT NULL DEFAULT 0,
  "failed_count" INTEGER NOT NULL DEFAULT 0,
  "import_preview" JSONB,
  "status" VARCHAR(16) NOT NULL,
  "error_message" TEXT,
  "imported_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ix_cli_provider_imports_owner"
  ON "cli_provider_imports"("owner_uuid");
CREATE INDEX IF NOT EXISTS "ix_cli_provider_imports_imported_at"
  ON "cli_provider_imports"("imported_at");

COMMENT ON TABLE "cli_provider_imports" IS 'CLI 供应商导入历史记录';
COMMENT ON COLUMN "cli_provider_imports"."source" IS 'cc-switch | codex++ | claude-cli | codex-cli | gemini-cli | hermes';
COMMENT ON COLUMN "cli_provider_imports"."status" IS 'success | partial | failed';

-- 3. 导入去重 partial unique index
-- 同一用户、同一来源、同一 source_id 只能有一条记录
CREATE UNIQUE INDEX IF NOT EXISTS "ix_ai_model_config_import_unique"
  ON "ai_model_config" ("owner_uuid", "import_source", "import_source_id")
  WHERE "import_source" IS NOT NULL;
