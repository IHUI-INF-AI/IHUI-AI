-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 86「证据级可追溯执行流水」明细账表(2026-10-24)。票面 2026-09-27 拍板「做,落库并可导出」,
-- 前置「保留策略」按机主 2026-10-23 强制令由 agent 代裁,裁量见下。
--
-- 定位(复用 vs 新表):
--   链式可验证**不在本表重建** —— 每行 chain_entry_id 指向一条既有 audit_logs_chain 行
--   (recordAuditLog 唯一写入器,HMAC prev_hash/current_hash 链,迁移史已存在)。
--   本表把 86A2 压在该链行 metadata JSONB 里的四要素升级为**可查询、值域封闭的列**:
--   调用编号 / 输入输出摘要 / 权限决策 / 操作者身份。依据 = G-790 A5/A7 同型判据
--   ("判别事实住列不住 JSON 键,正确性不依赖写入者巧合")。
--
-- 词汇对齐(全部引既有单源,本迁移零新造):
--   permission_decision ∈ (flag, approved, denied) = TOOL_APPROVAL_ROUTES(86H)同集;
--   permission_cause    ∈ (no-prompt, prompt-declined, prompt-empty, prompt-error)
--                       = TOOL_APPROVAL_DENY_CAUSES 同集;
--   outcome             ∈ (success, failure, lost, unknown) = toolInvokeAuditResult 输出集;
--   exec_budget_*       为 apps/cli 既有 execBudget 声明({ms} 或 {notInterruptible, reason})
--                       的原样投影,预算判据唯一解析面仍是 scripts/lib/tool-exec-budget.mjs;
--   input_digest        存 86B digestToolArgsStructure 输出(args-sha256-v1-<64hex>,定长 79);
--   output_digest       存结果文本 SHA-256 hex(64),NULL = 未观测到产出。
--
-- 保留策略代裁(题面前置,照抄仓内 O5 先例不自造第二套):
--   raw_retention_days / raw_retained / raw_purged_at 三列形状与语义逐字沿用
--   llm_call_logs(迁移 20260921130000):NULL = 全局默认,0 = 不留存原文;
--   全局默认环境变量 TOOL_LEDGER_RAW_RETENTION_DAYS,默认 30 天 —— 与
--   DEFAULT_RAW_RETENTION_DAYS(audit-log-service 现值)同档,理由同那份头注:
--   0 天把失败复现能力一起清零,30 天与运维复盘窗口对齐且消除"无限期留存"。
--   与 O5 唯一的形状差:本表 raw_retained DEFAULT **false** —— 新表默认摄入就不带原文
--   (includeRaw 显式开才落),不存在"存量旧行默认在表内"的兼容包袱,默认值如实反映形态。
--
-- 清除器(到期把 raw_input/raw_output 洗成 NULL 并置位)与导出路由不在本票范围:
--   前者归 purge 同族批次,后者牵他席在飞的 apps/api/src/routes/index.ts(刻意留下一格)。
--
-- 幂等:IF NOT EXISTS,可重复执行。

CREATE TABLE IF NOT EXISTS "tool_invocation_ledger" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "invocation_id" varchar(160) NOT NULL,
  "user_id" uuid NOT NULL,
  "permission_decision" varchar(16) NOT NULL,
  "permission_cause" varchar(32),
  "input_digest" varchar(80) NOT NULL,
  "output_digest" varchar(64),
  "outcome" varchar(16) NOT NULL,
  "exec_budget_ms" integer,
  "exec_budget_not_interruptible_reason" text,
  "tool_name" varchar(80) NOT NULL,
  "session_id" varchar(128) NOT NULL,
  "trace_id" varchar(32),
  "turn" integer,
  "stream_id" varchar(128),
  "seq" integer,
  "started_at_ms" bigint,
  "settled_at_ms" bigint,
  "raw_input" text,
  "raw_output" text,
  "raw_retention_days" integer,
  "raw_retained" boolean DEFAULT false NOT NULL,
  "raw_purged_at" timestamp with time zone,
  "chain_entry_id" uuid NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "tool_invocation_ledger_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "tool_invocation_ledger_decision_check"
    CHECK ("permission_decision" in ('flag', 'approved', 'denied')),
  CONSTRAINT "tool_invocation_ledger_cause_check"
    CHECK ("permission_cause" in ('no-prompt', 'prompt-declined', 'prompt-empty', 'prompt-error')),
  CONSTRAINT "tool_invocation_ledger_outcome_check"
    CHECK ("outcome" in ('success', 'failure', 'lost', 'unknown')),
  CONSTRAINT "tool_invocation_ledger_retention_check"
    CHECK ("raw_retention_days" is null or ("raw_retention_days" >= 0 and "raw_retention_days" <= 3650))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tool_invocation_ledger_invocation_uniq" ON "tool_invocation_ledger" ("invocation_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tool_invocation_ledger_user_idx" ON "tool_invocation_ledger" ("user_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tool_invocation_ledger_tool_idx" ON "tool_invocation_ledger" ("tool_name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tool_invocation_ledger_session_idx" ON "tool_invocation_ledger" ("session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tool_invocation_ledger_chain_idx" ON "tool_invocation_ledger" ("chain_entry_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tool_invocation_ledger_trace_idx" ON "tool_invocation_ledger" ("trace_id") WHERE "trace_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tool_invocation_ledger_created_idx" ON "tool_invocation_ledger" ("created_at");
--> statement-breakpoint
COMMENT ON COLUMN "tool_invocation_ledger"."invocation_id" IS '调用编号(= CLI 账本 callId,fingerprint#occurrence);全表唯一,重复摄入幂等跳过';
COMMENT ON COLUMN "tool_invocation_ledger"."user_id" IS '操作者身份=令牌主体,由承载层显式入参写入;摄入 payload 结构上不得自带身份(AGENTS §5)';
COMMENT ON COLUMN "tool_invocation_ledger"."permission_decision" IS '权限决策(flag/approved/denied),值域与 TOOL_APPROVAL_ROUTES 同集';
COMMENT ON COLUMN "tool_invocation_ledger"."input_digest" IS '输入摘要,唯一出口 digestToolArgsStructure(args-sha256-v1-<64hex>),存摘要不存原文';
COMMENT ON COLUMN "tool_invocation_ledger"."output_digest" IS '结果文本 SHA-256 hex(64);NULL=本次调用未观测到产出';
COMMENT ON COLUMN "tool_invocation_ledger"."exec_budget_ms" IS '既有 execBudget {ms} 档原样投影;NULL=未声明该档(未判定,非"无预算")';
COMMENT ON COLUMN "tool_invocation_ledger"."raw_retention_days" IS '原文留存天数;NULL=全局默认(TOOL_LEDGER_RAW_RETENTION_DAYS,默认 30);0=不留存原文';
COMMENT ON COLUMN "tool_invocation_ledger"."raw_retained" IS '原文当前是否在表内;默认 false(默认摄入不带原文)';
COMMENT ON COLUMN "tool_invocation_ledger"."chain_entry_id" IS '指向 audit_logs_chain.id(可验证性引用既有 HMAC 链,不重建第二条链)';
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
