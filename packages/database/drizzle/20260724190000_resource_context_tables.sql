-- Migration 20260724190000: 资源上下文管理表(resource_contexts + resource_context_bindings)
-- 创建时间: 2026-07-24
-- 描述: 用户上传文件/知识库/URL/text 资源,绑定到会话/agent 供 AI 引用。
--       resource_contexts 存储资源主体,resource_context_bindings 存储资源与会话/agent 的绑定关系。
--
-- 幂等安全:使用 IF NOT EXISTS,表/索引已存在则为 no-op。

-- 1. 资源上下文表
CREATE TABLE IF NOT EXISTS "resource_contexts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar(64) NOT NULL,
  "name" varchar(200) NOT NULL,
  "type" varchar(20) DEFAULT 'file' NOT NULL,
  "url" varchar(2000),
  "content" text,
  "file_id" uuid,
  "metadata" jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "resource_contexts_user_id_idx" ON "resource_contexts" ("user_id");
CREATE INDEX IF NOT EXISTS "resource_contexts_type_idx" ON "resource_contexts" ("type");

-- 2. 资源上下文绑定表
CREATE TABLE IF NOT EXISTS "resource_context_bindings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "resource_context_id" uuid NOT NULL,
  "session_id" varchar(128),
  "agent_id" varchar(128),
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "resource_context_bindings_ctx_idx" ON "resource_context_bindings" ("resource_context_id");
CREATE INDEX IF NOT EXISTS "resource_context_bindings_session_idx" ON "resource_context_bindings" ("session_id");
CREATE INDEX IF NOT EXISTS "resource_context_bindings_agent_idx" ON "resource_context_bindings" ("agent_id");
