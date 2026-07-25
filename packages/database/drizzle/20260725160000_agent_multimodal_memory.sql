-- L6 多模态记忆系统 migration(2026-07-25 立)
-- 持久化多模态记忆(image / audio / video / document),对标 GPT-4o 多模态记忆。
-- 让 agent 能跨模态检索历史感知到的图像/音频/视频/文档,
-- 而不仅是文本向量记忆(vector_memory.py)。
--
-- 设计:
--   1 张主表 agent_multimodal_memory:
--     modality:         image / audio / video / document
--     source_uri:       文件 URI / base64 引用(可空,运行时按需读取)
--     content_hash:     sha256,用于去重(同 user_id + content_hash 视为同一条记忆)
--     caption:          LLM 生成的文本描述(可空,跨模态检索的语义锚)
--     embedding:        多模态 embedding(jsonb 数组,维度可变,不同 modality 可不同维度)
--     metadata:         width / height / duration_ms / format 等模态特有元信息
--     importance_score: 重要度(0-1,默认 0.5,可由 update_importance 调整)
--     access_count:     访问次数(每次命中检索 +1,反映记忆活跃度)
--
-- 内存模型(MultimodalMemory._cache: dict[user_id, list[记忆 dict]])为运行时检索主体,
-- 本表为持久化镜像:
--   - 启动时由 lifespan 调 load_all_for_user 全量 hydrate 到内存
--   - 每次 store / update_importance / delete 同步写穿到 DB
--   - search 在内存中做 cosine similarity(纯 Python,不引入 numpy)
--
-- 说明:db:generate 自 idx 128 起因 snapshot 缺失无法非交互运行(详见 _journal.json),
--       本 migration 沿用项目 20260722* 系列手写 SQL 约定(IF NOT EXISTS 幂等),
--       不修改 _journal.json。
--
-- 执行方式(与项目 20260722* 系列手写 migration 一致):
--   pnpm tsx packages/database/scripts/apply-migration.mjs drizzle/20260725160000_agent_multimodal_memory.sql
-- 或直接 psql:
--   psql "$DATABASE_URL" -f packages/database/drizzle/20260725160000_agent_multimodal_memory.sql

-- ============================================================================
-- 1. agent_multimodal_memory — 多模态记忆持久化表
-- ============================================================================
CREATE TABLE IF NOT EXISTS "agent_multimodal_memory" (
  -- 记忆 ID(UUID,主键)
  "id" uuid PRIMARY KEY NOT NULL,
  -- 用户 ID(按用户隔离检索)
  "user_id" text NOT NULL,
  -- 模态:image / audio / video / document
  "modality" text NOT NULL,
  -- 文件 URI / base64 引用(可空,运行时按需读取)
  "source_uri" text,
  -- 内容 sha256 hash,用于去重(同 user_id + content_hash 视为同一条记忆)
  "content_hash" text NOT NULL,
  -- LLM 生成的文本描述(可空,跨模态检索的语义锚)
  "caption" text,
  -- 多模态 embedding(jsonb 数组,维度可变)
  "embedding" jsonb NOT NULL,
  -- 模态特有元信息(width / height / duration_ms / format 等)
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  -- 重要度(0-1,默认 0.5,可由 update_importance 调整)
  "importance_score" real DEFAULT 0.5 NOT NULL,
  -- 访问次数(每次命中检索 +1,反映记忆活跃度)
  "access_count" integer DEFAULT 0 NOT NULL,
  -- 创建时间
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  -- 最近访问时间(每次命中检索刷新)
  "last_accessed_at" timestamp with time zone
);

-- 用户 + 模态索引:按用户检索指定模态的记忆
CREATE INDEX IF NOT EXISTS "agent_multimodal_memory_user_modality_idx"
  ON "agent_multimodal_memory" ("user_id", "modality");
-- 内容 hash 索引:去重查询(同 user_id + content_hash 已存在则返回已有记录)
CREATE INDEX IF NOT EXISTS "agent_multimodal_memory_content_hash_idx"
  ON "agent_multimodal_memory" ("content_hash");
-- 用户 + 创建时间索引:按时间倒序查询某用户的历史记忆
CREATE INDEX IF NOT EXISTS "agent_multimodal_memory_user_created_idx"
  ON "agent_multimodal_memory" ("user_id", "created_at" DESC);
