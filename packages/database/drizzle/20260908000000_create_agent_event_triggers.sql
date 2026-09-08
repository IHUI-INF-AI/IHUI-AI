-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

-- 20260908000000_create_agent_event_triggers.sql
-- 新增事件唤醒触发规则表 agent_event_triggers(2026-09-08 立)。
--
-- 背景:复检报告缺口 #5 —— cloud_runs / automations 仅支持手动与定时触发,缺事件
-- 订阅自动开工。对账 Cursor Cloud Agents 事件唤醒 / GitHub HydraFusion+Agent Merge:
-- GitHub webhook(POST /api/webhooks/github)收到 pull_request/opened、issues/opened、
-- push 事件后,按 (repo_full_name, event) 匹配本表规则,命中则复用 agent-runtime
-- 执行器自动创建一次 agent 运行(prompt 来自 action jsonb)。
--
-- 设计要点:
-- 1. event 仅允许 pull_request | issues | push(GitHub 事件名)。
-- 2. action jsonb 存放创建 agent 运行参数(prompt 必填,可选 mode / agentId),
--    与 user_automations.prompt 同源,复用 automations 调度器已验证的执行路径。
-- 3. enabled 'true'|'false',禁用时 webhook 收到事件直接跳过(幂等防重由 X-GitHub-Delivery 头内存去重)。
-- 4. last_fired_at / last_result 记录最近一次命中执行结果(执行失败不重试)。
-- 5. 全程幂等(CREATE TABLE IF NOT EXISTS + IF NOT EXISTS 索引),重复执行安全;无数据迁移。

CREATE TABLE IF NOT EXISTS "agent_event_triggers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"repo_full_name" varchar(255) NOT NULL,
	"event" varchar(40) NOT NULL,
	"action" jsonb NOT NULL,
	"enabled" varchar(8) DEFAULT 'true' NOT NULL,
	"last_fired_at" timestamp with time zone,
	"last_result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "agent_event_triggers_user_idx" ON "agent_event_triggers" ("user_id");

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "agent_event_triggers_repo_event_idx" ON "agent_event_triggers" ("repo_full_name", "event");
