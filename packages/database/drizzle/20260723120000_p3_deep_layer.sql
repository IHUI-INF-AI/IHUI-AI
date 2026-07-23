-- P3 深度层 schema migration(2026-07-23 立)
-- AI 教育引擎 + LangGraph 升级:
--   1. exam_wrong_question 表追加 SRS(SM-2 Spaced Repetition System)字段
--   2. 新表 ai_grading_record       — AI 批改记录(主观题 AI 评分 + 教师审核)
--   3. 新表 ai_generated_question    — AI 出题记录(生成 + 人工审核)
--   4. 新表 knowledge_points         — 知识点树形结构(随机抽题/SRS/AI 出题关联)
--   5. 新表 langgraph_checkpoints    — LangGraph 节点级 checkpoint(线程状态快照)
--   6. 新表 langgraph_writes         — LangGraph checkpoint 写入记录(channel 增量)
--
-- 说明:db:generate 自 idx 128 起因 snapshot 缺失无法非交互运行(详见 _journal.json),
--       本 migration 沿用项目 20260722* 系列手写 SQL 约定(IF NOT EXISTS 幂等)。
--
-- 执行方式(与项目 20260722* 系列手写 migration 一致):
--   pnpm tsx packages/database/scripts/apply-migration.mjs drizzle/20260723120000_p3_deep_layer.sql
-- 或直接 psql:
--   psql "$DATABASE_URL" -f packages/database/drizzle/20260723120000_p3_deep_layer.sql

-- ============================================================================
-- 1. exam_wrong_question 表追加 SRS(SM-2 间隔重复系统)字段
-- ============================================================================
-- ease_factor:  SM-2 难度因子(默认 2.5,范围 1.3~2.8)
-- interval:     间隔天数(下次复习距上次复习的天数)
-- repetition:   重复次数(答对累计次数,用于 SM-2 状态机)
-- due_date:     下次复习日期(SM-2 计算出的到期日)
-- last_review_at: 上次复习日期
ALTER TABLE "exam_wrong_question" ADD COLUMN IF NOT EXISTS "ease_factor" real DEFAULT 2.5 NOT NULL;
ALTER TABLE "exam_wrong_question" ADD COLUMN IF NOT EXISTS "interval" integer DEFAULT 0 NOT NULL;
ALTER TABLE "exam_wrong_question" ADD COLUMN IF NOT EXISTS "repetition" integer DEFAULT 0 NOT NULL;
ALTER TABLE "exam_wrong_question" ADD COLUMN IF NOT EXISTS "due_date" timestamp with time zone;
ALTER TABLE "exam_wrong_question" ADD COLUMN IF NOT EXISTS "last_review_at" timestamp with time zone;

-- SRS 到期日索引(供"今日待复习"查询)
CREATE INDEX IF NOT EXISTS "exam_wrong_question_due_date_idx" ON "exam_wrong_question" ("due_date");

-- ============================================================================
-- 2. ai_grading_record — AI 批改记录表
-- ============================================================================
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

-- 外键(ai_grading_record)
DO $$ BEGIN
  ALTER TABLE "ai_grading_record"
    ADD CONSTRAINT "ai_grading_record_student_id_users_id_fk"
    FOREIGN KEY ("student_id") REFERENCES "users"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ai_grading_record"
    ADD CONSTRAINT "ai_grading_record_question_id_exam_questions_id_fk"
    FOREIGN KEY ("question_id") REFERENCES "exam_questions"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ai_grading_record"
    ADD CONSTRAINT "ai_grading_record_exam_id_exam_papers_id_fk"
    FOREIGN KEY ("exam_id") REFERENCES "exam_papers"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "ai_grading_record_student_idx" ON "ai_grading_record" ("student_id");
CREATE INDEX IF NOT EXISTS "ai_grading_record_question_idx" ON "ai_grading_record" ("question_id");
CREATE INDEX IF NOT EXISTS "ai_grading_record_exam_idx" ON "ai_grading_record" ("exam_id");
CREATE INDEX IF NOT EXISTS "ai_grading_record_status_idx" ON "ai_grading_record" ("status");

-- ============================================================================
-- 3. ai_generated_question — AI 出题记录表
-- ============================================================================
CREATE TABLE IF NOT EXISTS "ai_generated_question" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "subject" varchar(50) NOT NULL,
  "chapter" varchar(200),
  "question_type" varchar(20) NOT NULL,
  "difficulty" varchar(10) DEFAULT 'medium' NOT NULL,
  "question_text" text NOT NULL,
  "options" jsonb,
  "answer" text NOT NULL,
  "explanation" text,
  "knowledge_points" jsonb,
  "prompt" text,
  "model" varchar(100),
  "quality" varchar(20) DEFAULT 'pending' NOT NULL,
  "human_review" text,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "ai_generated_question"
    ADD CONSTRAINT "ai_generated_question_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "ai_generated_question_subject_idx" ON "ai_generated_question" ("subject");
CREATE INDEX IF NOT EXISTS "ai_generated_question_type_idx" ON "ai_generated_question" ("question_type");
CREATE INDEX IF NOT EXISTS "ai_generated_question_difficulty_idx" ON "ai_generated_question" ("difficulty");
CREATE INDEX IF NOT EXISTS "ai_generated_question_quality_idx" ON "ai_generated_question" ("quality");

-- ============================================================================
-- 4. knowledge_points — 知识点表(树形结构,自引用)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "knowledge_points" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "subject" varchar(50) NOT NULL,
  "chapter" varchar(200) NOT NULL,
  "name" varchar(200) NOT NULL,
  "description" text,
  "difficulty" varchar(10) DEFAULT 'medium' NOT NULL,
  "prerequisites" jsonb,
  "parent_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 自引用外键:knowledge_points.parent_id -> knowledge_points.id(ON DELETE set null)
DO $$ BEGIN
  ALTER TABLE "knowledge_points"
    ADD CONSTRAINT "knowledge_points_parent_id_knowledge_points_id_fk"
    FOREIGN KEY ("parent_id") REFERENCES "knowledge_points"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "knowledge_points_subject_idx" ON "knowledge_points" ("subject");
CREATE INDEX IF NOT EXISTS "knowledge_points_chapter_idx" ON "knowledge_points" ("chapter");
CREATE INDEX IF NOT EXISTS "knowledge_points_parent_idx" ON "knowledge_points" ("parent_id");

-- ============================================================================
-- 5. langgraph_checkpoints — LangGraph 节点级 checkpoint(复合主键)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "langgraph_checkpoints" (
  "thread_id" varchar(100) NOT NULL,
  "checkpoint_id" varchar(100) NOT NULL,
  "parent_id" varchar(100),
  "node_id" varchar(200) NOT NULL,
  "state" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("thread_id", "checkpoint_id")
);

CREATE INDEX IF NOT EXISTS "langgraph_checkpoints_thread_idx" ON "langgraph_checkpoints" ("thread_id");
CREATE INDEX IF NOT EXISTS "langgraph_checkpoints_parent_idx" ON "langgraph_checkpoints" ("parent_id");

-- ============================================================================
-- 6. langgraph_writes — LangGraph checkpoint 写入记录(复合主键 + 复合外键)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "langgraph_writes" (
  "thread_id" varchar(100) NOT NULL,
  "checkpoint_id" varchar(100) NOT NULL,
  "task_id" varchar(100) NOT NULL,
  "channel" varchar(200) NOT NULL,
  "value" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("thread_id", "checkpoint_id", "task_id", "channel")
);

-- 复合外键:(thread_id, checkpoint_id) -> langgraph_checkpoints(thread_id, checkpoint_id)
DO $$ BEGIN
  ALTER TABLE "langgraph_writes"
    ADD CONSTRAINT "langgraph_writes_checkpoint_fk"
    FOREIGN KEY ("thread_id", "checkpoint_id")
    REFERENCES "langgraph_checkpoints"("thread_id", "checkpoint_id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "langgraph_writes_thread_idx" ON "langgraph_writes" ("thread_id");
