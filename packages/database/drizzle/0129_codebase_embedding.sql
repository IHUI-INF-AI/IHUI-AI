-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 0129_codebase_embedding.sql
-- 代码库语义索引:codebase_chunks 表 + HNSW 向量索引。
--
-- 2026-09-06 drift 审计改造:原实现硬编码 vector,无 pgvector 部署整链必断。
-- 改为随环境自适应:有 pgvector → vector(1536) + HNSW;无 → embedding text
-- (JSON 数组字符串)降级,HNSW 跳过,普通索引照建。
DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
    CREATE EXTENSION IF NOT EXISTS vector;
    EXECUTE 'CREATE TABLE IF NOT EXISTS "codebase_chunks" (
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
    )';
    EXECUTE 'CREATE INDEX IF NOT EXISTS "ix_codebase_chunks_embedding_hnsw"
      ON "codebase_chunks"
      USING hnsw ("embedding" vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)';
    EXECUTE 'COMMENT ON COLUMN "codebase_chunks"."embedding" IS ''pgvector 1536 维向量,HNSW 索引 cosine 距离;NULL 时走关键词 fallback''';
  ELSE
    RAISE NOTICE 'pgvector not available: codebase_chunks.embedding falls back to text, HNSW index skipped';
    EXECUTE 'CREATE TABLE IF NOT EXISTS "codebase_chunks" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "repo_id" TEXT NOT NULL,
      "file_path" TEXT NOT NULL,
      "line_start" INTEGER NOT NULL,
      "line_end" INTEGER NOT NULL,
      "content" TEXT NOT NULL,
      "embedding" text,
      "language" TEXT,
      "symbol_name" TEXT,
      "symbol_type" TEXT,
      "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    )';
  END IF;
END
$outer$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_codebase_chunks_repo_file"
  ON "codebase_chunks" ("repo_id", "file_path");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_codebase_chunks_repo"
  ON "codebase_chunks" ("repo_id");
--> statement-breakpoint
COMMENT ON TABLE "codebase_chunks" IS
  '代码库语义索引:tree-sitter AST 切片 + 1536 维向量(有 pgvector 时 HNSW cosine;无则 text 降级)';

-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
