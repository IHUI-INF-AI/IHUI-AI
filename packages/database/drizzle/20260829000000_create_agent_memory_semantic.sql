-- 20260829000000_create_agent_memory_semantic.sql
-- 补建 agent_memory_semantic 表(2026-08-29)。
-- 现象:api 启动日志报 "relation agent_memory_semantic does not exist" —— ai-service 的
-- memory_service.py / active_forgetter.py / metacognition.py 读写该表,但该部署的数据库
-- 从未建表,导致语义记忆读写持续报错。本 migration 按
-- packages/database/src/schema/memory.ts 的 agentMemorySemantic 定义补建。
--
-- 设计要点:
-- 1. 列类型随环境自适应:有 pgvector 扩展 → embedding vector(1536) + HNSW cosine 索引;
--    无 pgvector(如本机 Windows PostgreSQL 17 未装扩展)→ embedding text(存 '[0.1,0.2,...]'
--    JSON 数组字符串,与 drizzle memoryVector1536 的 driverData 序列化格式一致),
--    检索走 memory_service._recall_fallback 内存 cosine 降级,写入走 add_semantic 的
--    无 cast 降级,功能完整可用。
-- 2. importance_score 默认 0.5,影响检索 top_k 加权(active_forgetter 遗忘曲线依赖 last_accessed_at)。
-- 3. 全程幂等(IF NOT EXISTS / 条件建索引),表已存在时不破坏既有数据。

BEGIN;

--> statement-breakpoint
-- 1. 表结构(列类型按 pgvector 可用性自适应)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
    CREATE EXTENSION IF NOT EXISTS vector;
    EXECUTE 'CREATE TABLE IF NOT EXISTS "agent_memory_semantic" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "content" text NOT NULL,
      "embedding" vector(1536),
      "importance_score" numeric DEFAULT ''0.5'' NOT NULL,
      "metadata" jsonb DEFAULT ''{}''::jsonb NOT NULL,
      "created_at" timestamptz DEFAULT now() NOT NULL,
      "last_accessed_at" timestamptz
    )';
  ELSE
    RAISE NOTICE 'pgvector not available, embedding column falls back to text (in-memory cosine via _recall_fallback)';
    EXECUTE 'CREATE TABLE IF NOT EXISTS "agent_memory_semantic" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "content" text NOT NULL,
      "embedding" text,
      "importance_score" numeric DEFAULT ''0.5'' NOT NULL,
      "metadata" jsonb DEFAULT ''{}''::jsonb NOT NULL,
      "created_at" timestamptz DEFAULT now() NOT NULL,
      "last_accessed_at" timestamptz
    )';
  END IF;
END $$;

--> statement-breakpoint
-- 2. 常规索引(幂等):user 检索 + importance 排序
CREATE INDEX IF NOT EXISTS "ix_agent_memory_semantic_user" ON "agent_memory_semantic" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_agent_memory_semantic_importance" ON "agent_memory_semantic" ("importance_score");

--> statement-breakpoint
-- 3. HNSW 向量索引:仅 embedding 列为 vector 类型时创建(text 降级列不适用)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_memory_semantic'
      AND column_name = 'embedding'
      AND udt_name = 'vector'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "ix_agent_memory_semantic_embedding_hnsw"
      ON "agent_memory_semantic" USING hnsw ("embedding" vector_cosine_ops)';
  END IF;
END $$;

--> statement-breakpoint
-- 4. 说明注释
COMMENT ON COLUMN "agent_memory_semantic"."embedding" IS
  'pgvector 1536 维向量(HNSW cosine);无 pgvector 扩展的环境降级为 text(JSON 数组字符串),检索走内存 cosine';
