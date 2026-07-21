-- 知识图谱(G5 2026-07-21)
-- 创建实体表 + 关系表,支持 LLM NER 抽取和图谱构建

CREATE TABLE "zhs_knowledge_entity" (
  "id" serial PRIMARY KEY,
  "owner_uuid" varchar(64) NOT NULL,
  "name" varchar(200) NOT NULL,
  "type" varchar(50) NOT NULL,
  "description" text,
  "frequency" integer DEFAULT 1 NOT NULL,
  "doc_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

-- 同一 owner 下 (name, type) 唯一,防重复入库
CREATE UNIQUE INDEX "ux_knowledge_entity_owner_name_type"
  ON "zhs_knowledge_entity" ("owner_uuid", "name", "type");
CREATE INDEX "ix_knowledge_entity_owner" ON "zhs_knowledge_entity" ("owner_uuid");
CREATE INDEX "ix_knowledge_entity_type" ON "zhs_knowledge_entity" ("type");

CREATE TABLE "zhs_knowledge_relation" (
  "id" serial PRIMARY KEY,
  "owner_uuid" varchar(64) NOT NULL,
  "source_entity_id" integer NOT NULL,
  "target_entity_id" integer NOT NULL,
  "relation_type" varchar(50) NOT NULL,
  "description" text,
  "weight" numeric DEFAULT '1' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

-- 同一 owner 下 (source, target, type) 唯一,防重复边
CREATE UNIQUE INDEX "ux_knowledge_relation_edge"
  ON "zhs_knowledge_relation" ("owner_uuid", "source_entity_id", "target_entity_id", "relation_type");
CREATE INDEX "ix_knowledge_relation_owner" ON "zhs_knowledge_relation" ("owner_uuid");
CREATE INDEX "ix_knowledge_relation_source" ON "zhs_knowledge_relation" ("source_entity_id");
CREATE INDEX "ix_knowledge_relation_target" ON "zhs_knowledge_relation" ("target_entity_id");
