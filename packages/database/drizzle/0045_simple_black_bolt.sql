CREATE TABLE "admin_oper_log" (
	"oper_id" serial PRIMARY KEY NOT NULL,
	"title" varchar(50) DEFAULT '',
	"business_type" integer DEFAULT 0,
	"method" varchar(200) DEFAULT '',
	"request_method" integer DEFAULT 0,
	"operator_type" integer DEFAULT 0,
	"oper_name" varchar(50) DEFAULT '',
	"dept_name" varchar(50) DEFAULT '',
	"oper_url" varchar(255) DEFAULT '',
	"oper_ip" varchar(128) DEFAULT '',
	"oper_param" varchar(2000) DEFAULT '',
	"json_result" varchar(2000) DEFAULT '',
	"status" integer DEFAULT 0,
	"error_msg" varchar(2000) DEFAULT '',
	"oper_time" timestamp with time zone DEFAULT now(),
	"cost_time" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "admin_role" (
	"role_id" serial PRIMARY KEY NOT NULL,
	"role_name" varchar(30) NOT NULL,
	"role_key" varchar(100) NOT NULL,
	"role_sort" integer NOT NULL,
	"data_scope" varchar(1) DEFAULT '1',
	"menu_check_strictly" integer DEFAULT 1,
	"dept_check_strictly" integer DEFAULT 1,
	"status" varchar(1) DEFAULT '0',
	"del_flag" varchar(1) DEFAULT '0',
	"create_by" varchar(64),
	"create_time" timestamp with time zone DEFAULT now(),
	"update_by" varchar(64),
	"update_time" timestamp with time zone DEFAULT now(),
	"remark" varchar(500)
);
--> statement-breakpoint
CREATE TABLE "admin_role_dept" (
	"role_id" integer NOT NULL,
	"dept_id" integer NOT NULL,
	CONSTRAINT "admin_role_dept_pk" UNIQUE("role_id","dept_id")
);
--> statement-breakpoint
CREATE TABLE "admin_role_menu" (
	"role_id" integer NOT NULL,
	"menu_id" integer NOT NULL,
	CONSTRAINT "admin_role_menu_pk" UNIQUE("role_id","menu_id")
);
--> statement-breakpoint
CREATE TABLE "admin_user" (
	"user_id" serial PRIMARY KEY NOT NULL,
	"user_uuid" varchar(36),
	"dept_id" integer,
	"user_name" varchar(30) NOT NULL,
	"nick_name" varchar(30) NOT NULL,
	"email" varchar(50),
	"phone" varchar(11),
	"sex" varchar(1) DEFAULT '0',
	"avatar" varchar(100),
	"password" varchar(100),
	"status" varchar(1) DEFAULT '0',
	"del_flag" varchar(1) DEFAULT '0',
	"login_ip" varchar(128),
	"login_date" timestamp with time zone,
	"create_by" varchar(64),
	"create_time" timestamp with time zone DEFAULT now(),
	"update_by" varchar(64),
	"update_time" timestamp with time zone DEFAULT now(),
	"remark" varchar(500),
	CONSTRAINT "admin_user_user_uuid_unique" UNIQUE("user_uuid")
);
--> statement-breakpoint
CREATE TABLE "admin_user_role" (
	"user_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	CONSTRAINT "admin_user_role_pk" UNIQUE("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "app_content" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(200),
	"image_url" varchar(500),
	"link_url" varchar(500),
	"type" varchar(50),
	"status" integer DEFAULT 1,
	"sort" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "behavior_comment" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"user_name" varchar(100),
	"user_avatar" varchar(500),
	"target_type" varchar(50) NOT NULL,
	"target_id" integer NOT NULL,
	"content" text NOT NULL,
	"pid" integer DEFAULT 0,
	"reply_user_id" varchar(64),
	"reply_user_name" varchar(100),
	"like_num" integer DEFAULT 0,
	"status" integer DEFAULT 1,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "behavior_favorite" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"user_name" varchar(100),
	"target_type" varchar(50) NOT NULL,
	"target_id" integer NOT NULL,
	"folder" varchar(50) DEFAULT 'default',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "behavior_follow" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"target_user_id" varchar(64) NOT NULL,
	"is_mutual" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "behavior_like" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"user_name" varchar(100),
	"target_type" varchar(50) NOT NULL,
	"target_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "behavior_report" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"target_type" varchar(50) NOT NULL,
	"target_id" integer NOT NULL,
	"reason" varchar(500),
	"category" varchar(50),
	"status" integer DEFAULT 0,
	"handle_user" varchar(64),
	"handle_remark" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "behavior_sensitive" (
	"id" serial PRIMARY KEY NOT NULL,
	"word" varchar(100) NOT NULL,
	"category" varchar(50),
	"level" integer DEFAULT 1,
	"action" varchar(20) DEFAULT 'replace',
	"replacement" varchar(50),
	"status" integer DEFAULT 1,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "behavior_sensitive_word_unique" UNIQUE("word")
);
--> statement-breakpoint
CREATE TABLE "behavior_share" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"target_type" varchar(50) NOT NULL,
	"target_id" integer NOT NULL,
	"platform" varchar(50),
	"ip" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "circle_category_relation" (
	"id" serial PRIMARY KEY NOT NULL,
	"child_category_id" integer NOT NULL,
	"father_category_id" integer NOT NULL,
	"direct_father_category_id" integer NOT NULL,
	"is_sub" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "circle_circle" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"member_id" integer NOT NULL,
	"image" varchar(3000),
	"status" varchar(100) NOT NULL,
	"introduction" varchar(200) DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "circle_circle_category_relation" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"circle_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "circle_circle_member" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"circle_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "circle_dynamic" (
	"id" serial PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"member_id" integer NOT NULL,
	"image" varchar(3000) DEFAULT '',
	"status" varchar(100) NOT NULL,
	"circle_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_category_relation" (
	"id" serial PRIMARY KEY NOT NULL,
	"child_category_id" integer NOT NULL,
	"father_category_id" integer NOT NULL,
	"direct_father_category_id" integer NOT NULL,
	"is_sub" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_exam" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(100) NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"image" varchar(1000) NOT NULL,
	"status" varchar(50) NOT NULL,
	"phrase" varchar(255) DEFAULT '' NOT NULL,
	"introduction" varchar(3000) DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_exam_category_relation" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"exam_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_exam_chapter" (
	"id" serial PRIMARY KEY NOT NULL,
	"exam_id" integer,
	"title" varchar(100) NOT NULL,
	"phrase" varchar(255) DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_exam_chapter_section" (
	"id" serial PRIMARY KEY NOT NULL,
	"exam_chapter_id" integer,
	"title" varchar(100) NOT NULL,
	"paper_id" integer NOT NULL,
	"phrase" varchar(255) DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_paper_category" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"sort_order" integer DEFAULT 1 NOT NULL,
	"is_show" boolean DEFAULT true NOT NULL,
	"is_show_index" boolean DEFAULT true NOT NULL,
	"level" integer NOT NULL,
	"image" varchar(500) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_paper_category_relation" (
	"id" serial PRIMARY KEY NOT NULL,
	"child_category_id" integer NOT NULL,
	"father_category_id" integer NOT NULL,
	"direct_father_category_id" integer NOT NULL,
	"is_sub" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_paper_paper_category_relation" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"paper_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_paper_question" (
	"id" serial PRIMARY KEY NOT NULL,
	"question_id" integer NOT NULL,
	"paper_id" integer NOT NULL,
	"sort_order" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_paper_question_rule" (
	"id" serial PRIMARY KEY NOT NULL,
	"paper_id" integer NOT NULL,
	"rule_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_question_and_category_relation" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"question_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_question_category" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"sort_order" integer DEFAULT 1 NOT NULL,
	"is_show" boolean DEFAULT true NOT NULL,
	"is_show_index" boolean DEFAULT true NOT NULL,
	"level" integer NOT NULL,
	"image" varchar(500) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_question_category_relation" (
	"id" serial PRIMARY KEY NOT NULL,
	"child_category_id" integer NOT NULL,
	"father_category_id" integer NOT NULL,
	"direct_father_category_id" integer NOT NULL,
	"is_sub" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exchange_rate" (
	"id" serial PRIMARY KEY NOT NULL,
	"currency_code" varchar(20),
	"currency_name" varchar(50),
	"rate" real,
	"status" integer DEFAULT 1,
	"sort" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learn_category_relation" (
	"id" serial PRIMARY KEY NOT NULL,
	"child_category_id" integer NOT NULL,
	"father_category_id" integer NOT NULL,
	"direct_father_category_id" integer NOT NULL,
	"is_sub" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learn_lesson_category_relation" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"lesson_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learn_order" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_no" varchar(64) NOT NULL,
	"member_id" varchar(64) NOT NULL,
	"lesson_id" integer,
	"amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"pay_type" varchar(20),
	"invoice_title" varchar(255),
	"invoice_status" varchar(20) DEFAULT 'none' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learn_order_order_no_unique" UNIQUE("order_no")
);
--> statement-breakpoint
CREATE TABLE "learn_sign_up" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"lesson_id" integer NOT NULL,
	"status" varchar(50) DEFAULT 'enrolled' NOT NULL,
	"completed_time" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_announcement" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text NOT NULL,
	"cover" varchar(500),
	"type" integer DEFAULT 1,
	"priority" integer DEFAULT 1,
	"status" integer DEFAULT 1,
	"target_user" varchar(20) DEFAULT 'all',
	"target_url" varchar(500),
	"publish_time" timestamp with time zone,
	"expire_time" timestamp with time zone,
	"view_num" integer DEFAULT 0,
	"is_top" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_announcement_read_record" (
	"id" serial PRIMARY KEY NOT NULL,
	"announcement_id" integer NOT NULL,
	"member_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_notice" (
	"id" serial PRIMARY KEY NOT NULL,
	"topic_id" integer NOT NULL,
	"topic_type" varchar(100) NOT NULL,
	"to_member_id" integer NOT NULL,
	"status" varchar(100),
	"type" varchar(100) NOT NULL,
	"browsed" boolean DEFAULT false NOT NULL,
	"member_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_read_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"message_id" integer NOT NULL,
	"message_type" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_system_notice" (
	"id" serial PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_channel" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"type" varchar(20) NOT NULL,
	"config" text,
	"is_default" boolean DEFAULT false,
	"status" integer DEFAULT 1,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"notification_id" integer NOT NULL,
	"user_id" varchar(64),
	"channel" varchar(50),
	"type" varchar(20),
	"success" boolean DEFAULT false,
	"response" text,
	"error" varchar(500),
	"send_time" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_subscription" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"type" varchar(20) NOT NULL,
	"category" varchar(50) NOT NULL,
	"enabled" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "point_exchange" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"user_name" varchar(100),
	"goods_id" integer NOT NULL,
	"goods_name" varchar(200),
	"point_cost" integer DEFAULT 0,
	"quantity" integer DEFAULT 1,
	"total_point" integer DEFAULT 0,
	"status" integer DEFAULT 0,
	"address" varchar(500),
	"contact" varchar(100),
	"express_no" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "point_goods" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"image" varchar(500),
	"point_cost" integer DEFAULT 0,
	"stock" integer DEFAULT 0,
	"sold_num" integer DEFAULT 0,
	"limit_per_user" integer DEFAULT 1,
	"type" varchar(20) DEFAULT 'virtual',
	"status" integer DEFAULT 1,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "point_rule" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(20) DEFAULT 'add',
	"action" varchar(50) NOT NULL,
	"point" integer DEFAULT 0,
	"max_per_day" integer DEFAULT 0,
	"description" varchar(500),
	"status" integer DEFAULT 1,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "point_rule_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "resource_category_relation" (
	"id" serial PRIMARY KEY NOT NULL,
	"child_category_id" integer NOT NULL,
	"father_category_id" integer NOT NULL,
	"direct_father_category_id" integer NOT NULL,
	"is_sub" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_github_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"url" varchar(500) NOT NULL,
	"stars" integer,
	"category" varchar(100),
	"description" text,
	"language" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_resource" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(100) NOT NULL,
	"member_id" integer NOT NULL,
	"introduction" text NOT NULL,
	"image" varchar(3000),
	"url" varchar(3000),
	"status" varchar(100) NOT NULL,
	"type" varchar(200) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_resource_category_relation" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"resource_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_resource_download" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"resource_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_resource_search_record" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"search_condition" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64),
	"keyword" varchar(200) NOT NULL,
	"target_type" varchar(50),
	"result_count" integer DEFAULT 0,
	"ip" varchar(50),
	"user_agent" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "t_article" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(100) NOT NULL,
	"member_id" integer NOT NULL,
	"content" text NOT NULL,
	"image" varchar(3000),
	"tags" varchar(3000),
	"keywords" varchar(3000),
	"status" varchar(100) NOT NULL,
	"introduction" varchar(200) DEFAULT '' NOT NULL,
	"recommend" boolean DEFAULT false NOT NULL,
	"top" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "t_member_company" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) DEFAULT '' NOT NULL,
	"image" varchar(1000) DEFAULT '',
	"mobile" varchar(20) DEFAULT '' NOT NULL,
	"email" varchar(100) DEFAULT '' NOT NULL,
	"status" varchar(30) DEFAULT 'normal' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"company_type_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "t_order_item" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"item_id" varchar(100) NOT NULL,
	"title" varchar(500) NOT NULL,
	"image" varchar(2000) NOT NULL,
	"original_price" numeric(14, 2) NOT NULL,
	"price" numeric(14, 2) NOT NULL,
	"quantity" integer NOT NULL,
	"payment_amount" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "t_order_payment" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"status" varchar(100) NOT NULL,
	"channel" varchar(100) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visit_page" (
	"id" serial PRIMARY KEY NOT NULL,
	"stat_date" varchar(20) NOT NULL,
	"path" varchar(500) NOT NULL,
	"visit_count" integer DEFAULT 0,
	"uv" integer DEFAULT 0,
	"avg_duration" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visit_source" (
	"id" serial PRIMARY KEY NOT NULL,
	"stat_date" varchar(20) NOT NULL,
	"source" varchar(50) NOT NULL,
	"visit_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visit_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"stat_date" varchar(20) NOT NULL,
	"stat_type" varchar(20) NOT NULL,
	"target_type" varchar(50),
	"target_id" varchar(64),
	"pv" integer DEFAULT 0,
	"uv" integer DEFAULT 0,
	"ip_count" integer DEFAULT 0,
	"new_user" integer DEFAULT 0,
	"avg_duration" integer DEFAULT 0,
	"bounce_rate" real DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ix_admin_oper_log_status" ON "admin_oper_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ix_admin_user_create_by" ON "admin_user" USING btree ("create_by");--> statement-breakpoint
CREATE INDEX "ix_admin_user_update_by" ON "admin_user" USING btree ("update_by");--> statement-breakpoint
CREATE INDEX "ix_app_content_status" ON "app_content" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bc_target" ON "behavior_comment" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "ix_behavior_comment_user_id" ON "behavior_comment" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_behavior_comment_status" ON "behavior_comment" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bf_user" ON "behavior_favorite" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_bf_target" ON "behavior_favorite" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "idx_bf2_user" ON "behavior_follow" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_bf2_target" ON "behavior_follow" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "idx_bl_user" ON "behavior_like" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_bl_target" ON "behavior_like" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "idx_br_target" ON "behavior_report" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "ix_behavior_report_user_id" ON "behavior_report" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_behavior_report_status" ON "behavior_report" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ix_behavior_sensitive_status" ON "behavior_sensitive" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bs_user" ON "behavior_share" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_bs_target" ON "behavior_share" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "idx_ccr_father" ON "circle_category_relation" USING btree ("father_category_id");--> statement-breakpoint
CREATE INDEX "idx_ccr_child" ON "circle_category_relation" USING btree ("child_category_id");--> statement-breakpoint
CREATE INDEX "idx_cc_member" ON "circle_circle" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_cccr_category" ON "circle_circle_category_relation" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_cccr_circle" ON "circle_circle_category_relation" USING btree ("circle_id");--> statement-breakpoint
CREATE INDEX "idx_ccm_member" ON "circle_circle_member" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_ccm_circle" ON "circle_circle_member" USING btree ("circle_id");--> statement-breakpoint
CREATE INDEX "idx_cd_circle" ON "circle_dynamic" USING btree ("circle_id");--> statement-breakpoint
CREATE INDEX "idx_cd_member" ON "circle_dynamic" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_exam_exam_status" ON "exam_exam" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_eecr_category" ON "exam_exam_category_relation" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_eecr_exam" ON "exam_exam_category_relation" USING btree ("exam_id");--> statement-breakpoint
CREATE INDEX "idx_eec_exam" ON "exam_exam_chapter" USING btree ("exam_id");--> statement-breakpoint
CREATE INDEX "idx_eecs_chapter" ON "exam_exam_chapter_section" USING btree ("exam_chapter_id");--> statement-breakpoint
CREATE INDEX "idx_eecs_paper" ON "exam_exam_chapter_section" USING btree ("paper_id");--> statement-breakpoint
CREATE INDEX "idx_eppcr_category" ON "exam_paper_paper_category_relation" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_eppcr_paper" ON "exam_paper_paper_category_relation" USING btree ("paper_id");--> statement-breakpoint
CREATE INDEX "idx_epq_paper" ON "exam_paper_question" USING btree ("paper_id");--> statement-breakpoint
CREATE INDEX "idx_epq_question" ON "exam_paper_question" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "idx_epqr_paper" ON "exam_paper_question_rule" USING btree ("paper_id");--> statement-breakpoint
CREATE INDEX "idx_eqacr_category" ON "exam_question_and_category_relation" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_eqacr_question" ON "exam_question_and_category_relation" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "ix_exchange_rate_status" ON "exchange_rate" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_llcr_category" ON "learn_lesson_category_relation" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_llcr_lesson" ON "learn_lesson_category_relation" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "idx_learn_order_member" ON "learn_order" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_learn_order_status" ON "learn_order" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_learn_su_member" ON "learn_sign_up" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_learn_su_lesson" ON "learn_sign_up" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "idx_learn_su_status" ON "learn_sign_up" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ann_status" ON "message_announcement" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_marr_announcement" ON "message_announcement_read_record" USING btree ("announcement_id");--> statement-breakpoint
CREATE INDEX "idx_marr_member" ON "message_announcement_read_record" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_mn_member" ON "message_notice" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_mn_to_member" ON "message_notice" USING btree ("to_member_id");--> statement-breakpoint
CREATE INDEX "idx_mrl_user" ON "message_read_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_notification_channel_status" ON "notification_channel" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_nl_notif" ON "notification_log" USING btree ("notification_id");--> statement-breakpoint
CREATE INDEX "idx_nl_time" ON "notification_log" USING btree ("send_time");--> statement-breakpoint
CREATE INDEX "ix_notification_log_user_id" ON "notification_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ns_user" ON "notification_subscription" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pe_user" ON "point_exchange" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pe_status" ON "point_exchange" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_pg_status" ON "point_goods" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ix_point_rule_status" ON "point_rule" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_rescr_father" ON "resource_category_relation" USING btree ("father_category_id");--> statement-breakpoint
CREATE INDEX "idx_rescr_child" ON "resource_category_relation" USING btree ("child_category_id");--> statement-breakpoint
CREATE INDEX "idx_rgp_category" ON "resource_github_projects" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_rgp_language" ON "resource_github_projects" USING btree ("language");--> statement-breakpoint
CREATE INDEX "idx_rr_member" ON "resource_resource" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_rr_status" ON "resource_resource" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_rrcr_category" ON "resource_resource_category_relation" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_rrcr_resource" ON "resource_resource_category_relation" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "idx_rrd_member" ON "resource_resource_download" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_rrd_resource" ON "resource_resource_download" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "idx_rrsr_member" ON "resource_resource_search_record" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_sl_user" ON "search_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sl_keyword" ON "search_log" USING btree ("keyword");--> statement-breakpoint
CREATE INDEX "idx_article_status" ON "t_article" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_article_member_id" ON "t_article" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_member_company_type_id" ON "t_member_company" USING btree ("company_type_id");--> statement-breakpoint
CREATE INDEX "idx_member_company_status" ON "t_member_company" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_member_company_sort_order" ON "t_member_company" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "idx_member_company_create_time" ON "t_member_company" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_order_item_order" ON "t_order_item" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_order_payment_order" ON "t_order_payment" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_vp_date" ON "visit_page" USING btree ("stat_date");--> statement-breakpoint
CREATE INDEX "idx_vs2_date" ON "visit_source" USING btree ("stat_date");--> statement-breakpoint
CREATE INDEX "idx_vs_date" ON "visit_stats" USING btree ("stat_date");--> statement-breakpoint
CREATE INDEX "idx_vs_target" ON "visit_stats" USING btree ("target_type","target_id");