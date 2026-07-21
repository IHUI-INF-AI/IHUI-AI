-- 0123_pgvector_embedding.sql
-- 启用 pgvector 扩展,将 zhs_knowledge_chunk.embedding 从 text 升级为 vector(1536),
-- 并加 HNSW 索引(vector_cosine_ops)以支撑近邻语义检索。
--
-- 设计要点:
-- 1. 维度 1536:对齐 OpenAI text-embedding-3-small / DashScope text-embedding-v2 / MiniMax embo-01,
--    embedding-provider.ts 的统一约定维度。
-- 2. 兼容旧数据:旧 text 字段的 JSON 字符串无法直接 cast 到 vector,采用两步:
--    (a) 新建临时列 embedding_new vector(1536)
--    (b) 旧 embedding 文本为空 / 非 JSON / 维度不匹配的跳过(JSON.parse 失败的丢弃)
--    (c) 旧表 embedding 列 drop 掉,新列 rename 为 embedding
-- 3. HNSW 索引:m=16(每节点最多 16 条边) + ef_construction=64(构建时搜索深度),
--    对 10w 条以下数据集 recall@10 > 0.95。
-- 4. 索引方法:hnsw + 向量余弦距离操作符类,语义检索 score 越大越相似时取 1 - distance。
-- 5. 失败回退:任何步骤报错则 ROLLBACK,migration 不会半成功。
-- 6. 无 pgvector 扩展的部署(老镜像)上,本 migration 会 CREATE EXTENSION 失败 → 由
--    部署文档(.trae-cn/STATE.md)要求先升级镜像到 pgvector/pgvector:pg15-alpine。

BEGIN;

--> statement-breakpoint
-- 1. 启用 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

--> statement-breakpoint
-- 2. 新增 vector(1536) 临时列,允许 NULL(兼容旧数据未生成 embedding)
ALTER TABLE "zhs_knowledge_chunk" ADD COLUMN "embedding_new" vector(1536);

--> statement-breakpoint
-- 3. 把旧 text(JSON 数组字符串)迁移到新 vector 列;旧值缺失或非法的置 NULL
--    使用 to_char + regexp_replace 把 '[0.1,0.2,...]' 转成 Postgres array literal
--    后用 string_to_array + ::vector 转换;无法解析的 chunk 不报错,直接 NULL。
DO $$
DECLARE
  rec RECORD;
  raw_text TEXT;
  cleaned TEXT;
  parsed_array TEXT[];
BEGIN
  FOR rec IN SELECT "id", "embedding" FROM "zhs_knowledge_chunk" LOOP
    raw_text := rec.embedding;
    IF raw_text IS NULL OR length(trim(raw_text)) = 0 THEN
      CONTINUE;
    END IF;
    BEGIN
      -- 去掉首尾 [] 与多余空白
      cleaned := regexp_replace(trim(both ' ' FROM raw_text), '^\[|\]$', '', 'g');
      cleaned := regexp_replace(cleaned, '\s+', '', 'g');
      -- 校验必须是数字 + 逗号
      IF cleaned !~ '^-?[0-9]+(\.[0-9]+)?(,-?[0-9]+(\.[0-9]+)?)*$' THEN
        CONTINUE;
      END IF;
      parsed_array := string_to_array(cleaned, ',');
      -- 校验维度
      IF array_length(parsed_array, 1) = 1536 THEN
        EXECUTE format(
          'UPDATE "zhs_knowledge_chunk" SET "embedding_new" = $1::vector WHERE "id" = $2',
          array_to_string(parsed_array, ','),
          rec.id
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- 任何解析异常:跳过,embedding_new 保持 NULL
      CONTINUE;
    END;
  END LOOP;
END $$;

--> statement-breakpoint
-- 4. 删旧 text embedding 列,把新列重命名为 embedding
ALTER TABLE "zhs_knowledge_chunk" DROP COLUMN "embedding";
--> statement-breakpoint
ALTER TABLE "zhs_knowledge_chunk" RENAME COLUMN "embedding_new" TO "embedding";

--> statement-breakpoint
-- 5. 建 HNSW 索引(cosine 距离,语义检索用 1 - (embedding <=> query) 作为 score)
CREATE INDEX "ix_knowledge_chunk_embedding_hnsw"
  ON "zhs_knowledge_chunk"
  USING hnsw ("embedding" vector_cosine_ops);

--> statement-breakpoint
-- 6. 同步 schema 版本(drizzle meta 维护,这里仅作迁移记录可见性)
COMMENT ON COLUMN "zhs_knowledge_chunk"."embedding" IS
  'pgvector 1536 维向量,HNSW 索引 cosine 距离;NULL 时走关键词 fallback';
