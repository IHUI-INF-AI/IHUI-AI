-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 0123_pgvector_embedding.sql
-- 启用 pgvector 扩展,将 zhs_knowledge_chunk.embedding 从 text 升级为 vector(1536),
-- 并加 HNSW 索引(vector_cosine_ops)以支撑近邻语义检索。
--
-- 2026-09-06 drift 审计改造:原实现硬编码 vector,无 pgvector 的部署(如本机
-- Windows PostgreSQL 17)整链必断。改为随环境自适应(与 20260829000000 同一模式):
-- 有 pgvector → 按原设计升级 vector(1536) + HNSW;无 → 保持 embedding text
-- (JSON 数组字符串)原状,检索走应用层降级,零破坏。
DO $outer$
DECLARE
  rec RECORD;
  raw_text TEXT;
  cleaned TEXT;
  parsed_array TEXT[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
    RAISE NOTICE 'pgvector not available: zhs_knowledge_chunk.embedding stays text (app-level fallback)';
    RETURN;
  END IF;
  CREATE EXTENSION IF NOT EXISTS vector;
  ALTER TABLE "zhs_knowledge_chunk" ADD COLUMN "embedding_new" vector(1536);
  FOR rec IN SELECT "id", "embedding" FROM "zhs_knowledge_chunk" LOOP
    raw_text := rec.embedding;
    IF raw_text IS NULL OR length(trim(raw_text)) = 0 THEN
      CONTINUE;
    END IF;
    BEGIN
      cleaned := regexp_replace(trim(both ' ' FROM raw_text), '^\[|\]$', '', 'g');
      cleaned := regexp_replace(cleaned, '\s+', '', 'g');
      IF cleaned !~ '^-?[0-9]+(\.[0-9]+)?(,-?[0-9]+(\.[0-9]+)?)*$' THEN
        CONTINUE;
      END IF;
      parsed_array := string_to_array(cleaned, ',');
      IF array_length(parsed_array, 1) = 1536 THEN
        EXECUTE format(
          'UPDATE "zhs_knowledge_chunk" SET "embedding_new" = $1::vector WHERE "id" = $2',
          array_to_string(parsed_array, ','),
          rec.id
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;
  END LOOP;
  ALTER TABLE "zhs_knowledge_chunk" DROP COLUMN "embedding";
  ALTER TABLE "zhs_knowledge_chunk" RENAME COLUMN "embedding_new" TO "embedding";
  CREATE INDEX "ix_knowledge_chunk_embedding_hnsw"
    ON "zhs_knowledge_chunk"
    USING hnsw ("embedding" vector_cosine_ops);
  COMMENT ON COLUMN "zhs_knowledge_chunk"."embedding" IS
    'pgvector 1536 维向量,HNSW 索引 cosine 距离;NULL 时走关键词 fallback';
END
$outer$;

-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
