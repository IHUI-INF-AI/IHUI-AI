-- 0042: 补齐 H-2 缺失的 14 张表 (learn_record/learn_topic/exam_wrong_question/agent_heat_stats/user_auth_info 等)

-- ========== 学习记录相关 ==========

-- 学习记录表 (历史 learn_record)
CREATE TABLE IF NOT EXISTS "learn_record" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "member_id" uuid NOT NULL,
  "lesson_id" uuid NOT NULL,
  "lesson_chapter_section_id" uuid NOT NULL,
  "sign_up_id" uuid NOT NULL,
  "learn_time" bigint DEFAULT 0 NOT NULL,
  "max_progress_time" bigint DEFAULT 0 NOT NULL,
  "status" varchar(200) DEFAULT 'progressing' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "learn_record_member_idx" ON "learn_record" ("member_id");
CREATE INDEX IF NOT EXISTS "learn_record_lesson_idx" ON "learn_record" ("lesson_id");
CREATE INDEX IF NOT EXISTS "learn_record_signup_idx" ON "learn_record" ("sign_up_id");

-- 学习记录日志表 (历史 learn_record_log)
CREATE TABLE IF NOT EXISTS "learn_record_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "member_id" uuid NOT NULL,
  "lesson_id" uuid NOT NULL,
  "lesson_chapter_section_id" uuid NOT NULL,
  "sign_up_id" uuid NOT NULL,
  "learn_time" bigint DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "learn_record_log_member_idx" ON "learn_record_log" ("member_id");
CREATE INDEX IF NOT EXISTS "learn_record_log_lesson_idx" ON "learn_record_log" ("lesson_id");

-- ========== 专题相关 ==========

-- 专题表 (历史 learn_topic)
CREATE TABLE IF NOT EXISTS "learn_topic" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" varchar(100) NOT NULL,
  "image" varchar(1000) NOT NULL,
  "status" varchar(50) DEFAULT 'draft' NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "company_id" bigint,
  "department_id" bigint,
  "create_user_id" bigint,
  "price" numeric(14, 2) DEFAULT '0',
  "original_price" numeric(14, 2) DEFAULT '0',
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "learn_topic_status_idx" ON "learn_topic" ("status");

-- 专题分类表 (历史 learn_topic_category)
CREATE TABLE IF NOT EXISTS "learn_topic_category" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(50) NOT NULL,
  "sort_order" integer DEFAULT 1 NOT NULL,
  "is_show" boolean DEFAULT true NOT NULL,
  "is_show_index" boolean DEFAULT true NOT NULL,
  "level" integer NOT NULL,
  "image" varchar(500) NOT NULL,
  "company_id" bigint DEFAULT 0 NOT NULL,
  "department_id" bigint DEFAULT 0 NOT NULL,
  "create_user_id" bigint DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

-- 专题分类关系表 (历史 learn_topic_category_relation)
CREATE TABLE IF NOT EXISTS "learn_topic_category_relation" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "child_category_id" uuid NOT NULL,
  "father_category_id" uuid NOT NULL,
  "direct_father_category_id" uuid NOT NULL,
  "is_sub" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

-- 专题与课程关系表 (历史 learn_topic_lesson)
CREATE TABLE IF NOT EXISTS "learn_topic_lesson" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lesson_id" uuid NOT NULL,
  "topic_id" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "learn_topic_lesson_topic_idx" ON "learn_topic_lesson" ("topic_id");
CREATE INDEX IF NOT EXISTS "learn_topic_lesson_lesson_idx" ON "learn_topic_lesson" ("lesson_id");

-- 专题与分类关系表 (历史 learn_topic_topic_category_relation)
CREATE TABLE IF NOT EXISTS "learn_topic_topic_category_relation" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "category_id" uuid NOT NULL,
  "topic_id" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "learn_topic_topic_category_relation_category_idx" ON "learn_topic_topic_category_relation" ("category_id");
CREATE INDEX IF NOT EXISTS "learn_topic_topic_category_relation_topic_idx" ON "learn_topic_topic_category_relation" ("topic_id");

-- 学习地图与专题关系表 (历史 learn_learn_map_topic)
CREATE TABLE IF NOT EXISTS "learn_learn_map_topic" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "learn_map_id" uuid NOT NULL,
  "topic_id" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "learn_learn_map_topic_map_idx" ON "learn_learn_map_topic" ("learn_map_id");
CREATE INDEX IF NOT EXISTS "learn_learn_map_topic_topic_idx" ON "learn_learn_map_topic" ("topic_id");

-- 作业提交记录表 (历史 learn_homework_record)
CREATE TABLE IF NOT EXISTS "learn_homework_record" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "member_id" uuid NOT NULL,
  "lesson_id" uuid NOT NULL,
  "url" varchar(3000) NOT NULL,
  "status" varchar(200) DEFAULT 'pending' NOT NULL,
  "sign_up_id" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "learn_homework_record_member_idx" ON "learn_homework_record" ("member_id");
CREATE INDEX IF NOT EXISTS "learn_homework_record_lesson_idx" ON "learn_homework_record" ("lesson_id");
CREATE INDEX IF NOT EXISTS "learn_homework_record_signup_idx" ON "learn_homework_record" ("sign_up_id");

-- ========== 考试错题相关 ==========

-- 错题本表 (历史 exam_wrong_question)
CREATE TABLE IF NOT EXISTS "exam_wrong_question" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "question_id" uuid NOT NULL,
  "paper_id" uuid NOT NULL,
  "paper_title" varchar(200),
  "user_answer" text,
  "right_answer" text,
  "wrong_count" integer DEFAULT 1 NOT NULL,
  "last_wrong_time" timestamptz,
  "is_mastered" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "exam_wrong_question_user_idx" ON "exam_wrong_question" ("user_id");
CREATE INDEX IF NOT EXISTS "exam_wrong_question_question_idx" ON "exam_wrong_question" ("question_id");

-- ========== Agent 相关 ==========

-- 智能体热度统计表 (历史 agent_heat_stats)
CREATE TABLE IF NOT EXISTS "agent_heat_stats" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "agent_id" uuid NOT NULL,
  "hit_count" bigint DEFAULT 0 NOT NULL,
  "date_str" varchar(10),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "agent_heat_stats_agent_idx" ON "agent_heat_stats" ("agent_id");

-- 智能体回调配置表 (历史 agent_callbacks)
CREATE TABLE IF NOT EXISTS "agent_callbacks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "agent_id" uuid NOT NULL,
  "callback_url" text,
  "callback_data_1" varchar(500),
  "callback_data_2" varchar(500),
  "callback_data_3" varchar(500),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "agent_callbacks_agent_idx" ON "agent_callbacks" ("agent_id");

-- 智能体配置表 (历史 agent_configs)
CREATE TABLE IF NOT EXISTS "agent_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "agent_id" uuid NOT NULL,
  "config_key" varchar(100) NOT NULL,
  "config_value" text,
  "is_deleted" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "agent_configs_agent_idx" ON "agent_configs" ("agent_id");

-- ========== 用户认证信息相关 ==========

-- 用户认证信息表 (历史 user_auth_info)
-- user_uuid 既是主键也对应 users.id (外部约定,不在此加 FK 约束)
CREATE TABLE IF NOT EXISTS "user_auth_info" (
  "user_uuid" uuid PRIMARY KEY NOT NULL,
  "phone" varchar(20),
  "cancel_phone" varchar(20),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
