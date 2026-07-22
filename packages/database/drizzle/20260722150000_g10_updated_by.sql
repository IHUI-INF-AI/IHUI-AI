-- G10 审计追溯字段补齐:4 表加 updatedBy + commission_flows 额外补 updatedAt
-- G2 遗留 P1:updated_by 字段补齐(orders/commission_flows/withdrawal_flows/agent_tasks)
-- commission_flows 原表只有 createdAt,补齐 updatedBy 必须同时补 updatedAt(否则 updated_by 无语义)
-- agent_rule.agentId varchar->uuid 修复风险隔离(需数据审计,标 P2 遗留)
-- 安全策略:全部使用 IF NOT EXISTS / DO $$ EXCEPTION 守门,可安全重复执行

-- =============================================================================
-- 1. orders: 加 updated_by 字段 + FK
-- =============================================================================
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "updated_by" uuid;
DO $$ BEGIN
  ALTER TABLE "orders"
    ADD CONSTRAINT "orders_updated_by_users_id_fk"
    FOREIGN KEY ("updated_by") REFERENCES "users"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 2. commission_flows: 补 updated_at + updated_by 字段
-- 原表只有 created_at,补齐 updated_at + updated_by 支持审计追溯
-- =============================================================================
ALTER TABLE "commission_flows" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE "commission_flows" ADD COLUMN IF NOT EXISTS "updated_by" uuid;
DO $$ BEGIN
  ALTER TABLE "commission_flows"
    ADD CONSTRAINT "commission_flows_updated_by_users_id_fk"
    FOREIGN KEY ("updated_by") REFERENCES "users"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 3. withdrawal_flows: 加 updated_by 字段 + FK
-- =============================================================================
ALTER TABLE "withdrawal_flows" ADD COLUMN IF NOT EXISTS "updated_by" uuid;
DO $$ BEGIN
  ALTER TABLE "withdrawal_flows"
    ADD CONSTRAINT "withdrawal_flows_updated_by_users_id_fk"
    FOREIGN KEY ("updated_by") REFERENCES "users"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 4. agent_tasks: 加 updated_by 字段 + FK
-- =============================================================================
ALTER TABLE "agent_tasks" ADD COLUMN IF NOT EXISTS "updated_by" uuid;
DO $$ BEGIN
  ALTER TABLE "agent_tasks"
    ADD CONSTRAINT "agent_tasks_updated_by_users_id_fk"
    FOREIGN KEY ("updated_by") REFERENCES "users"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 5. updated_at 索引(为按更新时间查询优化)
-- =============================================================================
CREATE INDEX IF NOT EXISTS "commission_flows_updated_at_idx" ON "commission_flows" ("updated_at");
