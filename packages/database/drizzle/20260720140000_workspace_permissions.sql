-- Workspace Permissions (2026-07-20)
-- 工作区访问权限配置:用户首次打开本地项目文件夹时弹出权限选择弹窗
-- 三种模式: default (人工审计) / accept-edits (白名单) / bypass-permissions (完全访问)

CREATE TABLE IF NOT EXISTS "workspace_permissions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_path" TEXT NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "tech_stack" TEXT,
  "mode" VARCHAR(32) NOT NULL DEFAULT 'default',
  "last_accessed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ux_workspace_permissions_user_path"
  ON "workspace_permissions"("user_id", "workspace_path");
CREATE INDEX IF NOT EXISTS "ix_workspace_permissions_user"
  ON "workspace_permissions"("user_id");

CREATE TABLE IF NOT EXISTS "workspace_permission_rules" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_path" TEXT NOT NULL,
  "rule_type" VARCHAR(16) NOT NULL,
  "pattern" TEXT NOT NULL,
  "operation" VARCHAR(16),
  "decision" VARCHAR(8) NOT NULL,
  "builtin" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ix_workspace_permission_rules_user_path"
  ON "workspace_permission_rules"("user_id", "workspace_path");

CREATE TABLE IF NOT EXISTS "workspace_permission_audit_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_path" TEXT NOT NULL,
  "tool_name" VARCHAR(64),
  "args" TEXT,
  "decision" VARCHAR(16) NOT NULL,
  "reason" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ix_workspace_permission_audit_user_path"
  ON "workspace_permission_audit_logs"("user_id", "workspace_path");
CREATE INDEX IF NOT EXISTS "ix_workspace_permission_audit_created"
  ON "workspace_permission_audit_logs"("created_at");
