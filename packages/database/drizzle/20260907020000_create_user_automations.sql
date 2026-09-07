-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

-- 20260907020000_create_user_automations.sql
-- 新增用户侧 Agent 定时自动化表 user_automations(2026-09-07 立)。
--
-- 背景:对标 WorkBuddy automations——用户创建"定时任务"(名称 + prompt + 一次性/重复
-- 计划),服务端调度器(apps/api/src/services/agent-automation-scheduler.ts,60s tick)
-- 到点调用 ai-service agent-runtime 自动执行,结果摘要写回 last_result,前端
-- /automations 页面查看/暂停/恢复/立即运行/删除。
--
-- 设计要点:
-- 1. schedule_type 'once'(scheduled_at 定时,执行一次后靠 last_run_at IS NULL 防重跑)
--    | 'recurring'(rrule RFC 5545 子集,next_run_at 由调度器每次执行后重算)。
-- 2. rrule 解析失败时调度器将 status 置 'paused',防止死循环空转。
-- 3. 全程幂等(CREATE TABLE IF NOT EXISTS),重复执行安全;无数据迁移(新表从零积累)。

CREATE TABLE IF NOT EXISTS "user_automations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"prompt" text NOT NULL,
	"schedule_type" varchar(20) DEFAULT 'once' NOT NULL,
	"rrule" varchar(500),
	"scheduled_at" timestamp with time zone,
	"timezone" varchar(64) DEFAULT 'Asia/Shanghai' NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"last_run_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	"last_result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "user_automations_user_idx" ON "user_automations" ("user_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "user_automations_status_idx" ON "user_automations" ("status");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "user_automations_next_run_idx" ON "user_automations" ("next_run_at");
