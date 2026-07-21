-- G5 数据库 FK 与审计字段补齐:agent_tasks 加 FK + 4 表 CASCADE→SET NULL
-- P0-10: agent_tasks.agentId/ruleId 缺 FK
-- P0: audit_logs/orders/commission_flows/withdrawal_flows 的 userId CASCADE 导致用户删除时丢审计/财务凭证
-- 安全策略:全部使用 IF NOT EXISTS / DO $$ EXCEPTION 守门,可安全重复执行

-- =============================================================================
-- 1. agent_tasks: 补 FK (agent_id -> agents.agent_id, rule_id -> agent_rule.id)
-- =============================================================================
DO $$ BEGIN
  ALTER TABLE "agent_tasks"
    ADD CONSTRAINT "agent_tasks_agent_id_agents_agent_id_fk"
    FOREIGN KEY ("agent_id") REFERENCES "agents"("agent_id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "agent_tasks"
    ADD CONSTRAINT "agent_tasks_rule_id_agent_rule_id_fk"
    FOREIGN KEY ("rule_id") REFERENCES "agent_rule"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 2. audit_logs: CASCADE -> SET NULL (R70 分区表, FK 在父表)
-- =============================================================================
ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_user_id_users_id_fk";
DO $$ BEGIN
  ALTER TABLE "audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 3. orders: CASCADE -> SET NULL (订单财务凭证保留)
-- =============================================================================
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_user_id_users_id_fk";
DO $$ BEGIN
  ALTER TABLE "orders"
    ADD CONSTRAINT "orders_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 4. commission_flows.beneficiaryId: CASCADE -> SET NULL
-- =============================================================================
ALTER TABLE "commission_flows" DROP CONSTRAINT IF EXISTS "commission_flows_beneficiary_id_users_id_fk";
DO $$ BEGIN
  ALTER TABLE "commission_flows"
    ADD CONSTRAINT "commission_flows_beneficiary_id_users_id_fk"
    FOREIGN KEY ("beneficiary_id") REFERENCES "users"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 5. withdrawal_flows.userId: CASCADE -> SET NULL
-- =============================================================================
ALTER TABLE "withdrawal_flows" DROP CONSTRAINT IF EXISTS "withdrawal_flows_user_id_users_id_fk";
DO $$ BEGIN
  ALTER TABLE "withdrawal_flows"
    ADD CONSTRAINT "withdrawal_flows_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 6. DROP NOT NULL: SET NULL 语义要求字段可空(3 表原为 NOT NULL)
-- PostgreSQL ALTER COLUMN DROP NOT NULL 原生幂等,重复执行无副作用
-- =============================================================================
ALTER TABLE "orders" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "commission_flows" ALTER COLUMN "beneficiary_id" DROP NOT NULL;
ALTER TABLE "withdrawal_flows" ALTER COLUMN "user_id" DROP NOT NULL;
