-- 0129_codebase_embedding.sql
-- 代码库语义索引:codebase_chunks 表 + HNSW 向量索引。
--
-- 设计要点:
-- 1. 复用 0123_pgvector_embedding.sql 的 pgvector 扩展(vector 已在 0123 启用,此处 IF NOT EXISTS 兜底)。
-- 2. 维度 1536:对齐 embedding-provider.ts 统一约定(OpenAI/DashScope/MiniMax 均 1536 维)。
-- 3. HNSW 索引:m=16(每节点最多 16 条边) + ef_construction=64(构建时搜索深度),
--    对 10w 条以下数据集 recall@10 > 0.95,与 knowledge_chunk 索引参数一致。
-- 4. 语义检索 score = 1 - (embedding <=> query::vector),cosine 距离越小越相似。
-- 5. repoId + filePath 联合索引:增量更新时按文件快速定位旧切片并删除。
--
-- 注:原任务计划用 0124 编号,因 0124_acoustic_iron_man.sql 已存在,改用 0129 避免冲突。

BEGIN;

--> statement-breakpoint
-- 1. 确保 pgvector 扩展已启用(0123 已创建,此处幂等兜底)
CREATE EXTENSION IF NOT EXISTS vector;

--> statement-breakpoint
-- 2. 建表
CREATE TABLE IF NOT EXISTS "codebase_chunks" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "repo_id" TEXT NOT NULL,
  "file_path" TEXT NOT NULL,
  "line_start" INTEGER NOT NULL,
  "line_end" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "embedding" vector(1536),
  "language" TEXT,
  "symbol_name" TEXT,
  "symbol_type" TEXT,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

--> statement-breakpoint
-- 3. 普通索引:按 repo + file 快速定位(增量更新用)
CREATE INDEX IF NOT EXISTS "ix_codebase_chunks_repo_file"
  ON "codebase_chunks" ("repo_id", "file_path");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_codebase_chunks_repo"
  ON "codebase_chunks" ("repo_id");

--> statement-breakpoint
-- 4. HNSW 向量索引(cosine 距离,语义检索用 1 - (embedding <=> query) 作为 score)
CREATE INDEX IF NOT EXISTS "ix_codebase_chunks_embedding_hnsw"
  ON "codebase_chunks"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

--> statement-breakpoint
COMMENT ON TABLE "codebase_chunks" IS
  '代码库语义索引:tree-sitter AST 切片 + pgvector 1536 维向量,HNSW cosine 距离检索';
COMMENT ON COLUMN "codebase_chunks"."embedding" IS
  'pgvector 1536 维向量,HNSW 索引 cosine 距离;NULL 时走关键词 fallback';

COMMIT;
