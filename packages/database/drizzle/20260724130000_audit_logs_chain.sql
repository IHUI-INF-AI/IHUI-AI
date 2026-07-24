-- 国安级审计日志链 (audit_logs_chain) — 2026-07-24 新增
-- 独立于现有 audit_logs 表,采用 prev_hash/current_hash 链式结构保证日志不可篡改
-- 字段对齐 apps/api/src/db/audit-queries.ts 的 AuditLogChainRow 接口

CREATE TABLE IF NOT EXISTS "audit_logs_chain" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "timestamp" timestamp with time zone NOT NULL,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "action" varchar(64) NOT NULL,
  "resource_type" varchar(64),
  "resource_id" varchar(64),
  "ip" varchar(64),
  "user_agent" varchar(512),
  "result" varchar(32),
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "prev_hash" char(64) NOT NULL,
  "current_hash" char(64) NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_audit_chain_ts" ON "audit_logs_chain" ("timestamp" DESC);
CREATE INDEX IF NOT EXISTS "idx_audit_chain_user" ON "audit_logs_chain" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_audit_chain_act" ON "audit_logs_chain" ("action");
