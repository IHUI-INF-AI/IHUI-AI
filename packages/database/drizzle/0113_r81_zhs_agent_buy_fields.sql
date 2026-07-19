-- 0113_r81_zhs_agent_buy_fields.sql
-- R81 补齐: D 盘 coze_zhs_py/models/agent_models.py:227-275 ZhsAgentBuy 5 字段
--   agent_name / bug_name / category_id / discount / prologue
--   (用于 D 盘 AgentBuy 业务信息冗余, 列表展示/审计/统计无需 JOIN agents/users 表)

ALTER TABLE "zhs_agent_buy"
  ADD COLUMN IF NOT EXISTS "agent_name" varchar(128),
  ADD COLUMN IF NOT EXISTS "bug_name" varchar(128),
  ADD COLUMN IF NOT EXISTS "category_id" integer,
  ADD COLUMN IF NOT EXISTS "discount" numeric(5, 2) NOT NULL DEFAULT 1.00,
  ADD COLUMN IF NOT EXISTS "prologue" text;

-- category_id 索引(按分类统计购买量)
CREATE INDEX IF NOT EXISTS "zhs_agent_buy_category_idx" ON "zhs_agent_buy" ("category_id");
