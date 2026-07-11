CREATE TABLE "ai_education_policy" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_name" varchar(300) NOT NULL,
	"issuing_authority" varchar(200) NOT NULL,
	"issue_date" date,
	"effective_date" date,
	"policy_level" varchar(50),
	"target_group" varchar(200),
	"summary" text,
	"key_points" text,
	"implementation" text,
	"goals" text,
	"supporting_measures" text,
	"related_policies" text,
	"source_url" varchar(500),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_teacher_certification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cert_name" varchar(200) NOT NULL,
	"issuing_authority" varchar(200) NOT NULL,
	"target_teachers" varchar(200),
	"level" varchar(50),
	"training_hours" integer,
	"training_content" text,
	"assessment_method" text,
	"certification_requirements" text,
	"validity" varchar(100),
	"benefits" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aigc_tool_detail" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"name_cn" varchar(100),
	"category" varchar(50) NOT NULL,
	"subcategory" varchar(50),
	"provider" varchar(200),
	"url" varchar(500),
	"description" text,
	"core_features" text,
	"use_cases" text,
	"pricing_model" varchar(50),
	"pricing_detail" text,
	"free_tier" varchar(100),
	"generation_speed" varchar(100),
	"output_quality" varchar(100),
	"chinese_support" varchar(50),
	"learning_curve" varchar(50),
	"api_available" boolean DEFAULT false NOT NULL,
	"mobile_app" boolean DEFAULT false NOT NULL,
	"pros" text,
	"cons" text,
	"tips" text,
	"alternatives" text,
	"rating" real,
	"user_count" varchar(100),
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "k12_ai_curriculum" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage" varchar(50) NOT NULL,
	"grade_range" varchar(100),
	"course_name" varchar(200),
	"hours_per_year" integer,
	"course_type" varchar(50),
	"learning_objectives" text,
	"content_modules" text,
	"key_concepts" text,
	"skill_requirements" text,
	"teaching_methods" text,
	"assessment_methods" text,
	"tools_resources" text,
	"integration_subjects" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "university_ai_course" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_name" varchar(200) NOT NULL,
	"course_type" varchar(50),
	"target_major" varchar(200),
	"credits" real,
	"hours" integer,
	"university" varchar(200),
	"description" text,
	"modules" text,
	"prerequisites" text,
	"textbooks" text,
	"teaching_team" text,
	"assessment" text,
	"is_required" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_agreement" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text,
	"type" varchar(50) DEFAULT 'user' NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_answer" (
	"id" serial PRIMARY KEY NOT NULL,
	"question_id" integer NOT NULL,
	"member_id" integer NOT NULL,
	"member_name" varchar(100),
	"content" text NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"is_adopted" boolean DEFAULT false NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_article" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text,
	"summary" varchar(500),
	"cover_image" varchar(500),
	"author_id" integer,
	"author_name" varchar(100),
	"category_id" integer,
	"view_count" integer DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"is_top" boolean DEFAULT false NOT NULL,
	"is_recommend" boolean DEFAULT false NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_ask_category" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"pid" integer DEFAULT 0 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_authority" (
	"id" serial PRIMARY KEY NOT NULL,
	"pid" integer DEFAULT 0 NOT NULL,
	"name" varchar(100) NOT NULL,
	"alias" varchar(100) NOT NULL,
	"type" integer DEFAULT 1 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_carousel" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(200),
	"image" varchar(500) NOT NULL,
	"link" varchar(500),
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_category" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"pid" integer DEFAULT 0 NOT NULL,
	"type" varchar(50) DEFAULT 'article' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_circle" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"cover_image" varchar(500),
	"description" text,
	"category_id" integer,
	"member_count" integer DEFAULT 0 NOT NULL,
	"post_count" integer DEFAULT 0 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_circle_category" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"pid" integer DEFAULT 0 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_circle_dynamic" (
	"id" serial PRIMARY KEY NOT NULL,
	"circle_id" integer,
	"category_id" integer,
	"member_id" integer NOT NULL,
	"member_name" varchar(100),
	"content" text NOT NULL,
	"images" text,
	"like_count" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"is_top" boolean DEFAULT false NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_comment" (
	"id" serial PRIMARY KEY NOT NULL,
	"topic_id" integer NOT NULL,
	"topic_type" varchar(50) NOT NULL,
	"member_id" integer NOT NULL,
	"member_name" varchar(100),
	"content" text NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"reply_count" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_exam" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"category_id" integer,
	"description" text,
	"total_score" real DEFAULT 100 NOT NULL,
	"pass_score" real DEFAULT 60 NOT NULL,
	"duration" integer DEFAULT 60 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"start_time" timestamp with time zone,
	"end_time" timestamp with time zone,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_exam_category" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"pid" integer DEFAULT 0 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_exam_chapter" (
	"id" serial PRIMARY KEY NOT NULL,
	"exam_id" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_exam_chapter_section" (
	"id" serial PRIMARY KEY NOT NULL,
	"chapter_id" integer NOT NULL,
	"exam_id" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_exam_paper" (
	"id" serial PRIMARY KEY NOT NULL,
	"exam_id" integer,
	"title" varchar(200) NOT NULL,
	"paper_type" varchar(50) DEFAULT 'normal' NOT NULL,
	"total_score" real DEFAULT 100 NOT NULL,
	"pass_score" real DEFAULT 60 NOT NULL,
	"duration" integer DEFAULT 60 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"category_id" integer,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_exam_paper_question" (
	"id" serial PRIMARY KEY NOT NULL,
	"paper_id" integer NOT NULL,
	"question_id" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"score" real DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_exam_paper_rule" (
	"id" serial PRIMARY KEY NOT NULL,
	"paper_id" integer NOT NULL,
	"question_type" varchar(50) NOT NULL,
	"category_id" integer,
	"difficulty" integer DEFAULT 1 NOT NULL,
	"question_count" integer DEFAULT 0 NOT NULL,
	"score_per_question" real DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_exam_question" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer,
	"type" varchar(50) DEFAULT 'single_choice' NOT NULL,
	"difficulty" integer DEFAULT 1 NOT NULL,
	"title" text NOT NULL,
	"options" text,
	"answer" text,
	"analysis" text,
	"score" real DEFAULT 1 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_exam_record" (
	"id" serial PRIMARY KEY NOT NULL,
	"exam_id" integer,
	"paper_id" integer NOT NULL,
	"member_id" integer NOT NULL,
	"score" real DEFAULT 0 NOT NULL,
	"total_score" real DEFAULT 100 NOT NULL,
	"is_pass" boolean DEFAULT false NOT NULL,
	"is_marked" boolean DEFAULT false NOT NULL,
	"start_time" timestamp with time zone,
	"submit_time" timestamp with time zone,
	"duration" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_favorite" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"topic_id" integer NOT NULL,
	"topic_type" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_index_category" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"icon" varchar(500),
	"link_url" varchar(500),
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_index_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"config_key" varchar(100) NOT NULL,
	"config_value" text,
	"description" varchar(500),
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_learn_category" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"pid" integer DEFAULT 0 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_learn_map" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_lesson_homework" (
	"id" serial PRIMARY KEY NOT NULL,
	"lesson_id" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text,
	"deadline" timestamp with time zone,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_lesson_study_record" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"lesson_id" integer NOT NULL,
	"section_id" integer,
	"study_duration" integer DEFAULT 0 NOT NULL,
	"progress" real DEFAULT 0 NOT NULL,
	"last_position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_lesson_topic" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"cover_image" varchar(500),
	"description" text,
	"lesson_ids" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_like" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"topic_id" integer NOT NULL,
	"topic_type" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_live_category" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"pid" integer DEFAULT 0 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_live_channel" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"cover_image" varchar(500),
	"intro" text,
	"category_id" integer,
	"lecturer_id" integer,
	"lecturer_name" varchar(100),
	"push_url" varchar(500),
	"play_url" varchar(500),
	"start_time" timestamp with time zone,
	"end_time" timestamp with time zone,
	"is_live" boolean DEFAULT false NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_news" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text,
	"summary" varchar(500),
	"cover_image" varchar(500),
	"author_id" integer,
	"category_id" integer,
	"view_count" integer DEFAULT 0 NOT NULL,
	"is_top" boolean DEFAULT false NOT NULL,
	"is_recommend" boolean DEFAULT false NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_notification" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"sender_id" integer,
	"title" varchar(200),
	"content" text,
	"notif_type" varchar(50) DEFAULT 'system' NOT NULL,
	"channel" varchar(50) DEFAULT 'letter' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"ref_id" integer,
	"ref_type" varchar(50),
	"read_time" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_notification_device" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"device_type" varchar(50),
	"device_token" varchar(500),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_question" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(500) NOT NULL,
	"content" text,
	"category_id" integer,
	"member_id" integer NOT NULL,
	"member_name" varchar(100),
	"answer_count" integer DEFAULT 0 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"is_solved" boolean DEFAULT false NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_resource" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"cover_image" varchar(500),
	"intro" text,
	"category_id" integer,
	"file_url" varchar(500),
	"file_type" varchar(50),
	"file_size" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"download_count" integer DEFAULT 0 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_resource_category" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"pid" integer DEFAULT 0 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_resource_product" (
	"id" serial PRIMARY KEY NOT NULL,
	"resource_id" integer NOT NULL,
	"name" varchar(200) NOT NULL,
	"price" real DEFAULT 0 NOT NULL,
	"original_price" real DEFAULT 0 NOT NULL,
	"description" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_role" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(100) NOT NULL,
	"description" text,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_role_authority" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_id" integer NOT NULL,
	"authority_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_sign_up" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"target_id" integer NOT NULL,
	"target_type" varchar(50) DEFAULT 'lesson' NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_trade" (
	"id" serial PRIMARY KEY NOT NULL,
	"trade_no" varchar(64) NOT NULL,
	"order_no" varchar(64),
	"user_id" integer NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"pay_type" varchar(20) DEFAULT 'alipay' NOT NULL,
	"status" integer DEFAULT 0 NOT NULL,
	"pay_time" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_user" (
	"id" serial PRIMARY KEY NOT NULL,
	"mobile" varchar(20),
	"name" varchar(100),
	"password" varchar(200),
	"company_id" integer,
	"department_id" integer,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_visit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer,
	"ip" varchar(50),
	"city" varchar(100),
	"url" varchar(500),
	"referer" varchar(500),
	"user_agent" varchar(500),
	"session_id" varchar(100),
	"visit_date" varchar(10),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_watch_record" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"topic_id" integer NOT NULL,
	"topic_type" varchar(50) NOT NULL,
	"topic_title" varchar(200),
	"watch_duration" integer DEFAULT 0 NOT NULL,
	"last_position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"activity_name" varchar(255),
	"activity_rule" text,
	"activity_recharge" text,
	"multiple" integer,
	"computing" bigint,
	"begin_time" timestamp with time zone,
	"end_time" timestamp with time zone,
	"status" integer,
	"begin_amount" integer,
	"creator" varchar(255),
	"updator" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_agent_category" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" varchar(64),
	"group" integer DEFAULT 2 NOT NULL,
	"type" varchar(10) DEFAULT '1' NOT NULL,
	"type_child" varchar(10) DEFAULT '1' NOT NULL,
	"limit_free" varchar(10),
	"account" integer DEFAULT 0 NOT NULL,
	"create_time" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_agent_developer" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" varchar(64) NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"order_no" varchar(64),
	"status" integer DEFAULT 1 NOT NULL,
	"price" real,
	"type" varchar(20),
	"count" integer,
	"expiration_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_agent_need_task" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"agent_id" varchar(64) DEFAULT '' NOT NULL,
	"task_name" varchar(128) NOT NULL,
	"task_desc" text,
	"reward_tokens" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 0 NOT NULL,
	"accept_user_id" varchar(64) DEFAULT '' NOT NULL,
	"deadline" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_ai_model_info" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"source" varchar(100),
	"icon" varchar(500),
	"description" text,
	"status" integer DEFAULT 1 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_banner_carousel" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(200),
	"image_url" varchar(500),
	"link_url" varchar(500),
	"position" varchar(50),
	"status" integer DEFAULT 1 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_category_dictionary" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100),
	"code" varchar(50),
	"parent_id" integer DEFAULT 0 NOT NULL,
	"type" varchar(50),
	"status" integer DEFAULT 1 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_course" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"subtitle" text,
	"content" text,
	"remark" text,
	"remark_file" varchar(500),
	"binding" varchar(500),
	"stage" varchar(50),
	"is_hidden" integer DEFAULT 0 NOT NULL,
	"is_del" integer DEFAULT 0 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"creator" varchar(100),
	"label" varchar(100),
	"audit_status" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_course_audit" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"audit_status" integer DEFAULT 0 NOT NULL,
	"auditor" varchar(64),
	"audit_time" timestamp with time zone,
	"remark" text,
	"create_time" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_course_new" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_uuid" varchar(64),
	"title" varchar(200),
	"subtitle" text,
	"content" text,
	"remark_file" varchar(500),
	"binding" varchar(500),
	"stage" integer,
	"is_hidden" integer DEFAULT 0 NOT NULL,
	"is_del" integer DEFAULT 0 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"creator" varchar(64),
	"updator" varchar(64),
	"remark" text,
	"label" varchar(100),
	"types" varchar(500),
	"categorys" varchar(500),
	"platform" varchar(64),
	"audit_status" integer DEFAULT 0 NOT NULL,
	"nickname" varchar(100),
	"avatar" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_course_pay" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"user_uuid" varchar(64) NOT NULL,
	"order_no" varchar(64),
	"amount" bigint DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 0 NOT NULL,
	"create_time" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_course_pay_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"pay_id" integer NOT NULL,
	"action" varchar(32) NOT NULL,
	"detail" text,
	"create_time" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_course_platform_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"platform_id" integer NOT NULL,
	"action" varchar(32) NOT NULL,
	"create_time" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_course_temp" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_name" varchar(200),
	"status" integer DEFAULT 0 NOT NULL,
	"create_time" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_course_video" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"binding" varchar(500),
	"video_path" varchar(500) NOT NULL,
	"title" varchar(200),
	"subtitle" text,
	"content" text,
	"remark" text,
	"duration" integer,
	"adjunct_url" varchar(500),
	"is_pay" integer DEFAULT 0 NOT NULL,
	"amount" real,
	"status" integer DEFAULT 1 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"creator" varchar(100),
	"lecturer" varchar(100),
	"label" varchar(100),
	"audit_status" integer DEFAULT 0 NOT NULL,
	"stage" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_course_video_temp" (
	"id" serial PRIMARY KEY NOT NULL,
	"video_name" varchar(200),
	"status" integer DEFAULT 0 NOT NULL,
	"create_time" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_developer_link" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"coze_account_id" varchar(64),
	"coze_account_name" varchar(200),
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_education_platform" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"domain" varchar(200),
	"remark" text,
	"binding" varchar(500),
	"file_path" varchar(500),
	"type" integer,
	"status" integer DEFAULT 1 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"is_hidden" integer DEFAULT 0 NOT NULL,
	"is_del" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_educational_course" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"subtitle" text,
	"cover" varchar(500),
	"content" text,
	"price" real,
	"category" varchar(100),
	"stage" varchar(50),
	"status" integer DEFAULT 1 NOT NULL,
	"is_hidden" integer DEFAULT 0 NOT NULL,
	"is_del" integer DEFAULT 0 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"creator" varchar(64),
	"label" varchar(100),
	"audit_status" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_exchange_rate" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_currency" varchar(20) NOT NULL,
	"to_currency" varchar(20) NOT NULL,
	"rate" real NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"create_time" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_identity_ext" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" varchar(64),
	"name" varchar(100),
	"platform_id" varchar(64),
	"organization_id" varchar(64),
	"parent_id" varchar(64),
	"binding" varchar(500),
	"is_hidden" integer DEFAULT 0 NOT NULL,
	"is_del" integer DEFAULT 0 NOT NULL,
	"is_cross" integer DEFAULT 0 NOT NULL,
	"creator" varchar(64),
	"updator" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_information" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(300),
	"content" text,
	"type" integer,
	"status" integer DEFAULT 1 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_knowledge_planet" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200),
	"description" text,
	"cover" varchar(500),
	"price" bigint,
	"type" varchar(50),
	"status" integer DEFAULT 1 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"creator" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_official_information" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(300),
	"content" text,
	"type" varchar(50),
	"status" integer DEFAULT 1 NOT NULL,
	"create_time" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_operate_token_flow" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"token_quantity" bigint DEFAULT 0 NOT NULL,
	"type" integer,
	"operate_desc" varchar(255),
	"token_free" bigint DEFAULT 0 NOT NULL,
	"user_uuid" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_order" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64),
	"out_trade_no" varchar(64),
	"open_id" varchar(100),
	"amount" bigint,
	"status" integer DEFAULT 0 NOT NULL,
	"payment_status" integer DEFAULT 0 NOT NULL,
	"paid_at" timestamp with time zone,
	"product_id" varchar(64),
	"order_type" integer DEFAULT 0 NOT NULL,
	"activity_id" varchar(64),
	"product_identity_id" varchar(64),
	"pay_type" varchar(20),
	"refund_time" timestamp with time zone,
	"refund_reason" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_organization_ext" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" varchar(64),
	"platform_id" varchar(64),
	"name" varchar(200),
	"file_path" text,
	"binding" varchar(500),
	"is_hidden" integer DEFAULT 0 NOT NULL,
	"is_del" integer DEFAULT 0 NOT NULL,
	"creator" varchar(64),
	"updator" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_popular_courses" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"create_time" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_product" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_uuid" varchar(64),
	"name" varchar(200),
	"price" bigint,
	"token_amount" bigint,
	"type" varchar(50),
	"status" integer DEFAULT 1 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_resources" (
	"id" serial PRIMARY KEY NOT NULL,
	"resource_name" varchar(200),
	"resource_type" varchar(50),
	"resource_url" varchar(500),
	"status" integer DEFAULT 1 NOT NULL,
	"create_time" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_user_agent_free_time" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_uuid" varchar(64) NOT NULL,
	"agent_id" varchar(64),
	"free_count" integer DEFAULT 0 NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"expire_time" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_user_comment_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_uuid" varchar(64) NOT NULL,
	"comment_id" integer NOT NULL,
	"action" varchar(32) NOT NULL,
	"create_time" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_user_model_chat" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_uuid" varchar(64) NOT NULL,
	"model_name" varchar(100) NOT NULL,
	"mark" varchar(500),
	"create_time" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_user_platform" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_uuid" varchar(64) NOT NULL,
	"platform_id" integer NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"create_time" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_user_video_comment" (
	"id" serial PRIMARY KEY NOT NULL,
	"video_id" integer NOT NULL,
	"user_uuid" varchar(64) NOT NULL,
	"content" text,
	"parent_id" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"create_time" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_user_video_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"video_id" integer NOT NULL,
	"user_uuid" varchar(64) NOT NULL,
	"action" varchar(32) NOT NULL,
	"create_time" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_category_relation" (
	"id" serial PRIMARY KEY NOT NULL,
	"child_category_id" integer NOT NULL,
	"father_category_id" integer NOT NULL,
	"direct_father_category_id" integer NOT NULL,
	"is_sub" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_channel_category" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_show" boolean DEFAULT true NOT NULL,
	"icon" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_channel_category_relation" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"channel_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_channel_lecturer" (
	"id" serial PRIMARY KEY NOT NULL,
	"lecturer_id" integer NOT NULL,
	"channel_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_comment" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel_id" integer NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"user_name" varchar(100),
	"user_avatar" varchar(500),
	"content" text NOT NULL,
	"type" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_gift" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel_id" integer NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"user_name" varchar(100),
	"gift_id" integer,
	"gift_name" varchar(100),
	"gift_count" integer DEFAULT 1 NOT NULL,
	"total_price" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_subscribe" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"channel_id" integer NOT NULL,
	"is_notify" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_tencent_cloud_live_stream" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel_id" integer NOT NULL,
	"stream_name" varchar(200) NOT NULL,
	"app_name" varchar(200) DEFAULT 'live' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ix_ai_edu_policy_level" ON "ai_education_policy" USING btree ("policy_level");--> statement-breakpoint
CREATE INDEX "ix_ai_edu_policy_status" ON "ai_education_policy" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ix_ai_teacher_cert_level" ON "ai_teacher_certification" USING btree ("level");--> statement-breakpoint
CREATE INDEX "ix_aigc_tool_category" ON "aigc_tool_detail" USING btree ("category");--> statement-breakpoint
CREATE INDEX "ix_aigc_tool_rating" ON "aigc_tool_detail" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "ix_k12_ai_curr_stage" ON "k12_ai_curriculum" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "ix_uni_ai_course_university" ON "university_ai_course" USING btree ("university");--> statement-breakpoint
CREATE INDEX "ix_uni_ai_course_type" ON "university_ai_course" USING btree ("course_type");--> statement-breakpoint
CREATE INDEX "edu_answer_question_idx" ON "edu_answer" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "edu_article_category_idx" ON "edu_article" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "edu_circle_category_idx" ON "edu_circle" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "edu_circle_dynamic_circle_idx" ON "edu_circle_dynamic" USING btree ("circle_id");--> statement-breakpoint
CREATE INDEX "edu_comment_topic_idx" ON "edu_comment" USING btree ("topic_id","topic_type");--> statement-breakpoint
CREATE INDEX "edu_comment_member_idx" ON "edu_comment" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "edu_exam_category_idx" ON "edu_exam" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "edu_exam_paper_exam_idx" ON "edu_exam_paper" USING btree ("exam_id");--> statement-breakpoint
CREATE INDEX "edu_exam_paper_question_paper_idx" ON "edu_exam_paper_question" USING btree ("paper_id");--> statement-breakpoint
CREATE INDEX "edu_exam_paper_question_question_idx" ON "edu_exam_paper_question" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "edu_exam_question_category_idx" ON "edu_exam_question" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "edu_exam_record_member_idx" ON "edu_exam_record" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "edu_exam_record_exam_idx" ON "edu_exam_record" USING btree ("exam_id");--> statement-breakpoint
CREATE INDEX "edu_favorite_member_idx" ON "edu_favorite" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "edu_lesson_study_record_member_idx" ON "edu_lesson_study_record" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "edu_lesson_study_record_lesson_idx" ON "edu_lesson_study_record" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "edu_like_member_idx" ON "edu_like" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "edu_live_channel_category_idx" ON "edu_live_channel" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "edu_live_channel_live_idx" ON "edu_live_channel" USING btree ("is_live");--> statement-breakpoint
CREATE INDEX "edu_notification_member_idx" ON "edu_notification" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "edu_question_category_idx" ON "edu_question" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "edu_question_member_idx" ON "edu_question" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "edu_resource_category_idx" ON "edu_resource" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "edu_sign_up_member_idx" ON "edu_sign_up" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "edu_visit_log_member_idx" ON "edu_visit_log" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "edu_visit_log_date_idx" ON "edu_visit_log" USING btree ("visit_date");--> statement-breakpoint
CREATE INDEX "edu_watch_record_member_idx" ON "edu_watch_record" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "edu_watch_record_topic_idx" ON "edu_watch_record" USING btree ("topic_id","topic_type");--> statement-breakpoint
CREATE INDEX "zhs_activity_status_idx" ON "zhs_activity" USING btree ("status");--> statement-breakpoint
CREATE INDEX "zhs_agent_developer_user_idx" ON "zhs_agent_developer" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "zhs_agent_developer_status_idx" ON "zhs_agent_developer" USING btree ("status");--> statement-breakpoint
CREATE INDEX "zhs_agent_need_task_user_idx" ON "zhs_agent_need_task" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "zhs_agent_need_task_agent_idx" ON "zhs_agent_need_task" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "zhs_agent_need_task_status_idx" ON "zhs_agent_need_task" USING btree ("status");--> statement-breakpoint
CREATE INDEX "zhs_ai_model_info_status_idx" ON "zhs_ai_model_info" USING btree ("status");--> statement-breakpoint
CREATE INDEX "zhs_banner_carousel_status_idx" ON "zhs_banner_carousel" USING btree ("status");--> statement-breakpoint
CREATE INDEX "zhs_category_dictionary_parent_idx" ON "zhs_category_dictionary" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "zhs_category_dictionary_status_idx" ON "zhs_category_dictionary" USING btree ("status");--> statement-breakpoint
CREATE INDEX "zhs_course_pay_status_idx" ON "zhs_course_pay" USING btree ("status");--> statement-breakpoint
CREATE INDEX "zhs_course_temp_status_idx" ON "zhs_course_temp" USING btree ("status");--> statement-breakpoint
CREATE INDEX "zhs_course_video_status_idx" ON "zhs_course_video" USING btree ("status");--> statement-breakpoint
CREATE INDEX "zhs_course_video_temp_status_idx" ON "zhs_course_video_temp" USING btree ("status");--> statement-breakpoint
CREATE INDEX "zhs_developer_link_user_idx" ON "zhs_developer_link" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "zhs_developer_link_status_idx" ON "zhs_developer_link" USING btree ("status");--> statement-breakpoint
CREATE INDEX "zhs_education_platform_status_idx" ON "zhs_education_platform" USING btree ("status");--> statement-breakpoint
CREATE INDEX "zhs_educational_course_status_idx" ON "zhs_educational_course" USING btree ("status");--> statement-breakpoint
CREATE INDEX "zhs_exchange_rate_status_idx" ON "zhs_exchange_rate" USING btree ("status");--> statement-breakpoint
CREATE INDEX "zhs_information_status_idx" ON "zhs_information" USING btree ("status");--> statement-breakpoint
CREATE INDEX "zhs_knowledge_planet_status_idx" ON "zhs_knowledge_planet" USING btree ("status");--> statement-breakpoint
CREATE INDEX "zhs_official_information_status_idx" ON "zhs_official_information" USING btree ("status");--> statement-breakpoint
CREATE INDEX "zhs_operate_token_flow_user_idx" ON "zhs_operate_token_flow" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "zhs_order_user_idx" ON "zhs_order" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "zhs_order_status_idx" ON "zhs_order" USING btree ("status");--> statement-breakpoint
CREATE INDEX "zhs_popular_courses_status_idx" ON "zhs_popular_courses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "zhs_product_status_idx" ON "zhs_product" USING btree ("status");--> statement-breakpoint
CREATE INDEX "zhs_resources_status_idx" ON "zhs_resources" USING btree ("status");--> statement-breakpoint
CREATE INDEX "zhs_user_platform_status_idx" ON "zhs_user_platform" USING btree ("status");--> statement-breakpoint
CREATE INDEX "zhs_user_video_comment_parent_idx" ON "zhs_user_video_comment" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "zhs_user_video_comment_status_idx" ON "zhs_user_video_comment" USING btree ("status");--> statement-breakpoint
CREATE INDEX "live_channel_category_relation_cat_idx" ON "live_channel_category_relation" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "live_channel_category_relation_chan_idx" ON "live_channel_category_relation" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "live_channel_lecturer_lecturer_idx" ON "live_channel_lecturer" USING btree ("lecturer_id");--> statement-breakpoint
CREATE INDEX "live_channel_lecturer_channel_idx" ON "live_channel_lecturer" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "live_comment_channel_idx" ON "live_comment" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "live_comment_user_idx" ON "live_comment" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "live_gift_channel_idx" ON "live_gift" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "live_gift_user_idx" ON "live_gift" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "live_subscribe_user_idx" ON "live_subscribe" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "live_subscribe_channel_idx" ON "live_subscribe" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "live_tencent_cloud_live_stream_chan_idx" ON "live_tencent_cloud_live_stream" USING btree ("channel_id");