-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

-- 20260907000000_create_agent_runtime_sessions.sql
-- 新增 agent 运行时会话持久化表 agent_runtime_sessions(2026-09-07 立,P0 缺口修复)。
--
-- 背景:apps/api 的 agent-runtime 路由此前只用内存 SessionManager(clawdbot/session-manager.ts
-- 的同步方法),进程重启即丢全部 agent 会话上下文。不能复用 clawdbot_sessions——其 bot_id 是
-- uuid 外键,而 agent-runtime 的 botId 是任意字符串(默认 'default'),插入必然失败。
--
-- 设计要点:
-- 1. id varchar(80) 存 'sess_<uuid>' 业务 id,不受 uuid 列约束。
-- 2. messages jsonb 整体存会话消息数组(与 SessionManager.SessionMessage 结构对齐),
--    沿用 clawdbot_sessions 的 metadata 内嵌消息模式,写入侧为 write-through。
-- 3. 全程幂等(CREATE TABLE IF NOT EXISTS),重复执行安全;无数据迁移(新表从零积累)。

CREATE TABLE IF NOT EXISTS "agent_runtime_sessions" (
	"id" varchar(80) PRIMARY KEY NOT NULL,
	"bot_id" varchar(128) NOT NULL,
	"user_id" varchar(128) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "agent_runtime_sessions_bot_idx" ON "agent_runtime_sessions" ("bot_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "agent_runtime_sessions_user_idx" ON "agent_runtime_sessions" ("user_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "agent_runtime_sessions_status_idx" ON "agent_runtime_sessions" ("status");
