-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌

-- 风控规则命中持久化表 (P0 资金安全修复 2026-09-06)
-- risk_hits: 每次 evaluateRisk 命中规则后落库(替代原内存 Map),供规则评判/人工复核/审计。
CREATE TABLE IF NOT EXISTS "risk_hits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
  "ip" text,
  "rule_code" text NOT NULL,
  "rule_name" text NOT NULL,
  "action" text NOT NULL,
  "score" text NOT NULL,
  "reason" text NOT NULL,
  "hit_at" timestamptz NOT NULL DEFAULT now(),
  "context" jsonb DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS "risk_hits_user_idx" ON "risk_hits"("user_id");
CREATE INDEX IF NOT EXISTS "risk_hits_ip_idx" ON "risk_hits"("ip");
CREATE INDEX IF NOT EXISTS "risk_hits_rule_code_idx" ON "risk_hits"("rule_code");
CREATE INDEX IF NOT EXISTS "risk_hits_hit_at_idx" ON "risk_hits"("hit_at");