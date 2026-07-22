-- G13 审计追溯字段补齐:4 表加 createdBy
-- G12 遗留 P1:created_by 字段补齐(orders/commission_flows/withdrawal_flows/agent_tasks)
-- 与 updatedBy 区分:createdBy 记录"创建者",updatedBy 记录"最近修改者"
-- 系统自动创建(如 commission-service 的自动分佣)传 null,管理员/用户主动创建传 request.userId
-- 安全策略:全部使用 IF NOT EXISTS / DO $$ EXCEPTION 守门,可安全重复执行

-- =============================================================================
-- 1. orders: 加 created_by 字段 + FK
-- =============================================================================
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "created_by" uuid;
DO $$ BEGIN
  ALTER TABLE "orders"
    ADD CONSTRAINT "orders_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 2. commission_flows: 加 created_by 字段 + FK
-- 系统自动分佣(commission-service.ts)创建时 created_by = null
-- =============================================================================
ALTER TABLE "commission_flows" ADD COLUMN IF NOT EXISTS "created_by" uuid;
DO $$ BEGIN
  ALTER TABLE "commission_flows"
    ADD CONSTRAINT "commission_flows_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 3. withdrawal_flows: 加 created_by 字段 + FK
-- 用户申请提现时 created_by = request.userId
-- =============================================================================
ALTER TABLE "withdrawal_flows" ADD COLUMN IF NOT EXISTS "created_by" uuid;
DO $$ BEGIN
  ALTER TABLE "withdrawal_flows"
    ADD CONSTRAINT "withdrawal_flows_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 4. agent_tasks: 加 created_by 字段 + FK
-- 管理员创建 agent task 时 created_by = admin userId
-- =============================================================================
ALTER TABLE "agent_tasks" ADD COLUMN IF NOT EXISTS "created_by" uuid;
DO $$ BEGIN
  ALTER TABLE "agent_tasks"
    ADD CONSTRAINT "agent_tasks_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
