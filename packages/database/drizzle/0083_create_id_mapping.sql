-- 0083: id_mapping 表 — Java Long 自增 ID → TS uuid 随机 ID 映射
-- 用于历史数据迁移:legacy_table + legacy_id 唯一索引(防重复映射)
-- 幂等可重复执行(IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS "id_mapping" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_table" varchar(100) NOT NULL,
	"legacy_id" bigint NOT NULL,
	"new_id" uuid NOT NULL,
	"migration_batch" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "id_mapping_legacy_uniq" ON "id_mapping" USING btree ("legacy_table","legacy_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "id_mapping_new_idx" ON "id_mapping" USING btree ("new_id");
