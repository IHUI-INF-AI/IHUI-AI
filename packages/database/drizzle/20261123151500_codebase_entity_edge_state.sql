-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- P0-8 第二批(2026-11-23):代码实体表 / 关系边表 / 索引状态幂等标记。
--
-- 背景:codebase_chunks 存的是**检索单位**(可重叠、可固定行数切),无法回答
-- "这个函数是谁、被谁调用";也没有任何一行记录"上次用什么配置建的索引"。
-- 本迁移新增三张表:
--   codebase_entities     符号级实体(一个函数一条身份,不因跨切片出现两次而重复)
--   codebase_edges        有向关系边(引用/调用/导入/继承/实现),from_entity_id 可空
--   codebase_index_states 配置指纹 + 幂等标记(唯一键 owner_uuid + repo_id)
--
-- 纪律沿用 codebase_chunks:
--   * owner_uuid 在实体/边表可空(存量/未归属),新写入由服务层强制要求主体;
--   * 状态表 owner_uuid NOT NULL —— 归属就是幂等键的一半,不允许无主;
--   * 一律 IF NOT EXISTS:本迁移可重放,不依赖表此前是否存在。

CREATE TABLE IF NOT EXISTS "codebase_entities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_uuid" uuid,
  "repo_id" text NOT NULL,
  "file_path" text NOT NULL,
  "line_start" integer NOT NULL,
  "line_end" integer NOT NULL,
  "kind" text NOT NULL,
  "name" text NOT NULL,
  "signature" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ix_codebase_entities_owner_repo" ON "codebase_entities" ("owner_uuid","repo_id");
CREATE INDEX IF NOT EXISTS "ix_codebase_entities_repo_name" ON "codebase_entities" ("repo_id","name");
CREATE INDEX IF NOT EXISTS "ix_codebase_entities_repo_file" ON "codebase_entities" ("repo_id","file_path");

CREATE TABLE IF NOT EXISTS "codebase_edges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_uuid" uuid,
  "repo_id" text NOT NULL,
  "from_entity_id" uuid,
  "from_name" text NOT NULL,
  "to_name" text NOT NULL,
  "kind" text NOT NULL,
  "file_path" text NOT NULL,
  "line" integer NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ix_codebase_edges_owner_repo" ON "codebase_edges" ("owner_uuid","repo_id");
CREATE INDEX IF NOT EXISTS "ix_codebase_edges_repo_to" ON "codebase_edges" ("repo_id","to_name");
CREATE INDEX IF NOT EXISTS "ix_codebase_edges_repo_from" ON "codebase_edges" ("repo_id","from_name");

CREATE TABLE IF NOT EXISTS "codebase_index_states" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_uuid" uuid NOT NULL,
  "repo_id" text NOT NULL,
  "config_fingerprint" text NOT NULL,
  "last_run_id" text,
  "chunk_count" integer DEFAULT 0 NOT NULL,
  "last_indexed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ux_codebase_index_states_owner_repo" ON "codebase_index_states" ("owner_uuid","repo_id");
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
