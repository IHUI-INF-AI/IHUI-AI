-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- Migration 20261030160000: G4 计费弹性(pricing_rules 组合定价表 + ai_cost_records 结算明细/用量维度列)
-- 创建时间: 2026-10-30
-- 描述: 《差距修复方案-第二轮》G4 后端落库。
--       1. pricing_rules        组合定价规则表:基础价 × 会员档位系数(tier_multipliers jsonb,
--                               档位键对齐 users.is_vip 与 user_billing_groups 的 default/vip/svip 词表)
--                               × 错峰时段系数(time_of_day_factor jsonb,跨日窗口 [start,end) 左闭右开)。
--                               rule_key = 模型标识,'*' 全局兜底(同 tiered_pricing_rules.model_id 约定);
--                               version 编辑递增,结算明细落 ruleVersion 供审计回溯。
--       2. ai_cost_records 加 4 个可空列(不 DROP 不改存量语义,存量行零迁移):
--                               pricing_rule_id / pricing_rule_version / pricing_detail(jsonb 系数链明细)
--                               —— 仅 PRICING_RULES_ENABLED 开启且命中规则时写入;
--                               tier —— 用量计量补会员档位维度(model 维度既有列已覆盖)。
--
-- 幂等安全:全部使用 IF NOT EXISTS / DO $$ 守门,可安全重复执行。
--
-- 执行方式(与项目 202610* 系列手写 migration 一致):
--   pnpm tsx packages/database/scripts/apply-migration.mjs drizzle/20261030160000_g4_pricing_rules.sql
-- 或直接 psql:
--   psql "$DATABASE_URL" -f packages/database/drizzle/20261030160000_g4_pricing_rules.sql

CREATE TABLE IF NOT EXISTS "pricing_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "rule_key" varchar(128) NOT NULL,
  "display_name" varchar(255) NOT NULL,
  "currency" varchar(16) DEFAULT 'CNY' NOT NULL,
  "mode" varchar(16) DEFAULT 'token' NOT NULL,
  "base_price" numeric(18, 6) NOT NULL,
  "tier_multipliers" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "time_of_day_factor" jsonb,
  "enabled" boolean DEFAULT true NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "effective_from" timestamptz DEFAULT now() NOT NULL,
  "effective_to" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pricing_rules_rule_key_unique') THEN
    ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_rule_key_unique" UNIQUE ("rule_key");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "pricing_rules_mode_enabled_idx"
  ON "pricing_rules" ("mode", "enabled");
CREATE INDEX IF NOT EXISTS "pricing_rules_effective_idx"
  ON "pricing_rules" ("effective_from", "effective_to");

-- ai_cost_records 结算明细 + 用量维度列(全部可空,存量行为 NULL,读取端零适配)
ALTER TABLE "ai_cost_records"
  ADD COLUMN IF NOT EXISTS "pricing_rule_id" uuid,
  ADD COLUMN IF NOT EXISTS "pricing_rule_version" integer,
  ADD COLUMN IF NOT EXISTS "pricing_detail" jsonb,
  ADD COLUMN IF NOT EXISTS "tier" varchar(32);

CREATE INDEX IF NOT EXISTS "ai_cost_pricing_rule_idx"
  ON "ai_cost_records" ("pricing_rule_id");
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
