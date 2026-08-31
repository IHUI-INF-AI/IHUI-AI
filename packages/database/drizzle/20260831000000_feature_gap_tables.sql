-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 2026-08-31 功能补齐批次:8 张恢复功能表 + live_gift_catalog 建表 migration
--
-- 背景:
--   1. 表治理批次删除了 131 张确认零引用的死表(DB 层已执行 DROP,见记忆 2026-08-31)。
--      其中 8 张表因"未落地功能开发"被重新启用(ai_generated_question / ai_grading_record /
--      ab_test_variants / ab_test_results / live_gift / gen_table / gen_table_column / tbox_bean),
--      DB 表已从全库备份 pg_restore 恢复;此处补 CREATE migration,消除 schema drift 守门
--      "TS schema 定义了表但 migration 未生成"告警。
--   2. live_gift_catalog 由 live-gifts.ts 内联定义,已纳入共享 schema(live-extended.ts),
--      此处补正式 migration(原内联 CREATE TABLE IF NOT EXISTS 幂等兜底保留)。
--
-- 处置:全部 CREATE TABLE IF NOT EXISTS 幂等,重复执行安全;未做数据迁移(8 张表由
--   pg_restore 恢复时已含原数据,数据一致性已校验)。

CREATE TABLE IF NOT EXISTS "ai_generated_question" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject" varchar(50) NOT NULL,
	"chapter" varchar(200),
	"question_type" varchar(20) NOT NULL,
	"difficulty" varchar(10) DEFAULT 'medium' NOT NULL,
	"stem" text NOT NULL,
	"options" jsonb,
	"correct_answer" text NOT NULL,
	"analysis" text,
	"created_by" uuid,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ai_grading_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"exam_id" uuid,
	"student_answer" text NOT NULL,
	"ai_score" real NOT NULL,
	"ai_feedback" text NOT NULL,
	"rubric" jsonb,
	"model" varchar(100),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"teacher_review" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ab_test_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experiment_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"weight" integer DEFAULT 50 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ab_test_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experiment_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"user_id" varchar(64),
	"session_id" varchar(64),
	"event_type" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "live_gift" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid,
	"user_id" uuid NOT NULL,
	"receiver_id" uuid,
	"gift_name" varchar(100) NOT NULL,
	"gift_count" integer DEFAULT 1 NOT NULL,
	"total_price" numeric(20, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "live_gift_catalog" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"icon" varchar(500),
	"price" numeric(20, 4) DEFAULT '0' NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "gen_table" (
	"id" serial PRIMARY KEY NOT NULL,
	"table_name" varchar(200) NOT NULL,
	"table_comment" varchar(500),
	"class_name" varchar(200),
	"module_name" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "gen_table_column" (
	"id" serial PRIMARY KEY NOT NULL,
	"table_id" integer NOT NULL,
	"column_name" varchar(200) NOT NULL,
	"column_comment" varchar(500),
	"data_type" varchar(100) NOT NULL,
	"is_pk" boolean DEFAULT false NOT NULL,
	"is_nullable" boolean DEFAULT true NOT NULL,
	"column_default" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "tbox_bean" (
	"id" serial PRIMARY KEY NOT NULL,
	"bean_type" varchar(50),
	"bean_data" jsonb,
	"status" integer DEFAULT 0,
	"create_time" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 索引(幂等)
CREATE INDEX IF NOT EXISTS "ai_grading_record_student_idx" ON "ai_grading_record" ("student_id");
CREATE INDEX IF NOT EXISTS "ai_grading_record_question_idx" ON "ai_grading_record" ("question_id");
CREATE INDEX IF NOT EXISTS "ab_test_variants_experiment_idx" ON "ab_test_variants" ("experiment_id");
CREATE INDEX IF NOT EXISTS "ab_test_results_experiment_idx" ON "ab_test_results" ("experiment_id");
CREATE INDEX IF NOT EXISTS "gen_table_column_table_idx" ON "gen_table_column" ("table_id");
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
