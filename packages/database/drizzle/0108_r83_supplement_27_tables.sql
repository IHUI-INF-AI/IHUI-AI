CREATE TYPE "public"."search_content_topic_type" AS ENUM('article', 'news', 'question', 'resource', 'lesson');--> statement-breakpoint
CREATE TABLE "edu_classes_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" varchar(64) NOT NULL,
	"user_id" uuid,
	"role" varchar(20) DEFAULT 'student' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_classes_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" varchar(64) NOT NULL,
	"lesson_id" varchar(64),
	"lesson_name" varchar(200),
	"teacher_name" varchar(100),
	"scheduled_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"location" varchar(200),
	"status" varchar(20) DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_agent_examine" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar(64),
	"agent_name" varchar(128),
	"agent_avatar" varchar(500),
	"prologue" text,
	"category_id" uuid,
	"status" smallint,
	"start_time" timestamp with time zone,
	"start_user" uuid,
	"start_phone" varchar(15),
	"start_name" varchar(128),
	"examine_user" varchar(128),
	"examine_user_id" uuid,
	"examine_time" timestamp with time zone,
	"desc" text,
	"follow" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_agent_settlement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uuid" uuid,
	"order_no" varchar(36),
	"create_time" timestamp with time zone DEFAULT now(),
	"buy_uuid" uuid,
	"agent_id" varchar(64),
	"agent_name" varchar(128),
	"prologue" text,
	"agent_avatar" varchar(500),
	"expiration_date" timestamp with time zone,
	"settlement" varchar(2),
	"withdrawal" varchar(2),
	"issue_no" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_contents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" uuid NOT NULL,
	"topic_type" "search_content_topic_type" NOT NULL,
	"topic_title" varchar(300) NOT NULL,
	"topic_summary" text,
	"search_text" text NOT NULL,
	"author_id" uuid,
	"view_count" integer DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_billings" (
	"billing_id" varchar(64) PRIMARY KEY NOT NULL,
	"event_id" varchar(128) NOT NULL,
	"record_id" varchar(64) NOT NULL,
	"consume_time" bigint NOT NULL,
	"consume_datetime" timestamp with time zone,
	"created_at_coze" varchar(20),
	"record_root_id" varchar(64),
	"connector_id" varchar(64),
	"connector_uid" varchar(64),
	"device_id" varchar(64),
	"custom_consumer" varchar(255),
	"space_id" varchar(64),
	"root_entity_id" varchar(64),
	"root_entity_type" integer,
	"change_balance" numeric(10, 6) NOT NULL,
	"balance_type" integer,
	"cost_account_id" varchar(64),
	"resource_type" integer,
	"resource_id" varchar(64),
	"model_id" varchar(64),
	"model_input_token" integer DEFAULT 0 NOT NULL,
	"model_output_token" integer DEFAULT 0 NOT NULL,
	"rtc_begin_time" integer DEFAULT 0 NOT NULL,
	"rtc_end_time" integer DEFAULT 0 NOT NULL,
	"rtc_duration" integer DEFAULT 0 NOT NULL,
	"tts_char_num" integer DEFAULT 0 NOT NULL,
	"tts_count" integer DEFAULT 0 NOT NULL,
	"asr_audio_length" integer DEFAULT 0 NOT NULL,
	"billing_status" varchar(20) DEFAULT 'recorded' NOT NULL,
	"raw_callback_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_billings_event_uniq" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "t_content" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"topic_id" bigint NOT NULL,
	"topic_title" varchar(2000) NOT NULL,
	"topic_type" varchar(50) NOT NULL,
	"create_time" timestamp with time zone DEFAULT now(),
	"update_time" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "t_dynamic" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"member_id" bigint NOT NULL,
	"image" varchar(3000) DEFAULT '',
	"status" varchar(100) NOT NULL,
	"circle_id" bigint NOT NULL,
	"create_time" timestamp with time zone DEFAULT now(),
	"update_time" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "t_favorite" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"topic_id" bigint NOT NULL,
	"topic_type" varchar(50) NOT NULL,
	"member_id" bigint NOT NULL,
	"create_time" timestamp with time zone DEFAULT now(),
	"update_time" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "t_follow" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"member_id" bigint NOT NULL,
	"follow_member_id" bigint NOT NULL,
	"status" varchar(100) DEFAULT 'follow' NOT NULL,
	"create_time" timestamp with time zone DEFAULT now(),
	"update_time" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "t_like" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"topic_id" bigint NOT NULL,
	"topic_type" varchar(50) NOT NULL,
	"member_id" bigint NOT NULL,
	"status" boolean DEFAULT true NOT NULL,
	"create_time" timestamp with time zone DEFAULT now(),
	"update_time" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "t_private_letter" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"sender_id" varchar(100) NOT NULL,
	"receiver_id" varchar(100) NOT NULL,
	"content" text NOT NULL,
	"read_time" timestamp with time zone,
	"is_read" boolean DEFAULT false NOT NULL,
	"status" varchar(30) NOT NULL,
	"create_time" timestamp with time zone DEFAULT now(),
	"update_time" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "t_tencent_cloud_live_stream" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"channel_id" bigint NOT NULL,
	"stream_name" varchar(200) NOT NULL,
	"app_name" varchar(200) DEFAULT 'live' NOT NULL,
	"create_time" timestamp with time zone DEFAULT now() NOT NULL,
	"update_time" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "t_check_in_record" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"member_id" bigint NOT NULL,
	"type" varchar(20) NOT NULL,
	"create_time" timestamp with time zone DEFAULT now(),
	"update_time" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "t_homework" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"lesson_id" bigint NOT NULL,
	"url" varchar(3000) DEFAULT '' NOT NULL,
	"content" text NOT NULL,
	"create_time" timestamp with time zone DEFAULT now(),
	"update_time" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "search_content" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"topic_id" bigint NOT NULL,
	"topic_title" varchar(2000) NOT NULL,
	"topic_type" varchar(50) NOT NULL,
	"create_time" timestamp with time zone DEFAULT now(),
	"update_time" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "t_resource_download" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"member_id" bigint NOT NULL,
	"resource_id" bigint NOT NULL,
	"create_time" timestamp with time zone DEFAULT now(),
	"update_time" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "t_certificate" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"create_time" timestamp with time zone DEFAULT now() NOT NULL,
	"update_time" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"certificate_id" bigint,
	"code" varchar(64),
	"name" varchar(128),
	"description" varchar(2000),
	"awarding_organization" varchar(128),
	"awarder_name" varchar(64),
	"awarder_position" varchar(64),
	"design" varchar(512),
	"award_conditions" varchar(2000),
	"validity_policy" varchar(1024),
	"award_date" timestamp with time zone,
	"validity" timestamp with time zone,
	"status" varchar(32),
	"member_id" bigint,
	"lesson_id" bigint,
	"lesson_sign_id" bigint,
	"lesson_sign_time" timestamp with time zone,
	"lesson_complete_time" timestamp with time zone,
	"score" varchar(32),
	"company_id" bigint,
	"create_user_id" bigint,
	"create_user_name" varchar(64),
	"update_user_id" bigint,
	"update_user_name" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "t_certificate_template" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(200) DEFAULT '' NOT NULL,
	"description" varchar(1000) DEFAULT '',
	"awarding_organization" varchar(200) DEFAULT '',
	"awarder_name" varchar(100) DEFAULT '',
	"awarder_position" varchar(100) DEFAULT '',
	"design" varchar(1000) DEFAULT '',
	"award_conditions" varchar(500) DEFAULT '',
	"validity_policy" varchar(500) DEFAULT '',
	"status" varchar(30) DEFAULT 'inactive' NOT NULL,
	"company_id" bigint,
	"create_user_id" bigint,
	"create_user_name" varchar(100) DEFAULT '',
	"update_user_id" bigint,
	"update_user_name" varchar(100) DEFAULT '',
	"create_time" timestamp with time zone DEFAULT now(),
	"update_time" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "t_department" (
	"id" bigint PRIMARY KEY DEFAULT 0 NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(50) NOT NULL,
	"short_name" varchar(50) DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"create_time" timestamp with time zone DEFAULT now(),
	"update_time" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "t_lecturer" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"title" varchar(100) DEFAULT '' NOT NULL,
	"introduction" varchar(2000) DEFAULT '' NOT NULL,
	"create_time" timestamp with time zone DEFAULT now(),
	"update_time" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "t_manager" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"manager_id" bigint NOT NULL,
	"create_time" timestamp with time zone DEFAULT now(),
	"update_time" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "t_sensitive_word" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"create_time" timestamp with time zone DEFAULT now(),
	"update_time" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
DROP INDEX "ix_oauth_private_keys_status";--> statement-breakpoint
ALTER TABLE "oauth_private_keys" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "oauth_private_keys" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "oauth_private_keys" ALTER COLUMN "key_type" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "oauth_private_keys" ALTER COLUMN "key_type" SET DEFAULT 'RSA';--> statement-breakpoint
ALTER TABLE "oauth_private_keys" ADD COLUMN "client_id" varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_private_keys" ADD COLUMN "private_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_private_keys" ADD COLUMN "public_key" text;--> statement-breakpoint
ALTER TABLE "oauth_private_keys" ADD COLUMN "is_active" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_model_config" ADD COLUMN "icon_svg" text;--> statement-breakpoint
ALTER TABLE "zhs_agent_buy" ADD COLUMN "agent_name" varchar(128);--> statement-breakpoint
ALTER TABLE "zhs_agent_buy" ADD COLUMN "bug_name" varchar(128);--> statement-breakpoint
ALTER TABLE "zhs_agent_buy" ADD COLUMN "category_id" integer;--> statement-breakpoint
ALTER TABLE "zhs_agent_buy" ADD COLUMN "discount" numeric(5, 2) DEFAULT '1.00';--> statement-breakpoint
ALTER TABLE "zhs_agent_buy" ADD COLUMN "prologue" text;--> statement-breakpoint
ALTER TABLE "zhs_agent_category" ADD COLUMN "agent_name" varchar(128);--> statement-breakpoint
ALTER TABLE "zhs_agent_category" ADD COLUMN "create_uuid" varchar(36);--> statement-breakpoint
ALTER TABLE "zhs_agent_category" ADD COLUMN "create_name" varchar(128);--> statement-breakpoint
ALTER TABLE "zhs_agent_category" ADD COLUMN "agent_main_category" varchar(2);--> statement-breakpoint
ALTER TABLE "zhs_agent_category" ADD COLUMN "agent_category" varchar(2);--> statement-breakpoint
ALTER TABLE "zhs_agent_category" ADD COLUMN "discount_month" varchar(5);--> statement-breakpoint
ALTER TABLE "zhs_agent_category" ADD COLUMN "prologue" text;--> statement-breakpoint
ALTER TABLE "zhs_agent_developer" ADD COLUMN "uuid" varchar(36);--> statement-breakpoint
ALTER TABLE "zhs_agent_developer" ADD COLUMN "user_name" varchar(128);--> statement-breakpoint
ALTER TABLE "zhs_agent_developer" ADD COLUMN "creator_id" varchar(128);--> statement-breakpoint
ALTER TABLE "zhs_agent_developer" ADD COLUMN "creator_name" varchar(128);--> statement-breakpoint
ALTER TABLE "zhs_agent_developer" ADD COLUMN "bug_time" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "zhs_developer_link" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "zhs_developer_link" ADD COLUMN "field1" varchar(500);--> statement-breakpoint
ALTER TABLE "zhs_developer_link" ADD COLUMN "field2" varchar(500);--> statement-breakpoint
ALTER TABLE "zhs_developer_link" ADD COLUMN "assigner" varchar(64);--> statement-breakpoint
ALTER TABLE "zhs_developer_link" ADD COLUMN "allocate_time" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "zhs_developer_link" ADD COLUMN "is_del" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "zhs_developer_link" ADD COLUMN "type" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "slug" varchar(100);--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "content_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "last_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "sync_source" varchar(20) DEFAULT 'web';--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "edu_classes_members" ADD CONSTRAINT "edu_classes_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "edu_classes_members_class_idx" ON "edu_classes_members" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "edu_classes_members_user_idx" ON "edu_classes_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "edu_classes_members_status_idx" ON "edu_classes_members" USING btree ("status");--> statement-breakpoint
CREATE INDEX "edu_classes_schedules_class_idx" ON "edu_classes_schedules" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "edu_classes_schedules_scheduled_idx" ON "edu_classes_schedules" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "edu_classes_schedules_status_idx" ON "edu_classes_schedules" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_zhs_agent_examine_agent_id" ON "zhs_agent_examine" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_zhs_agent_examine_status" ON "zhs_agent_examine" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_zhs_agent_examine_examine_user_id" ON "zhs_agent_examine" USING btree ("examine_user_id");--> statement-breakpoint
CREATE INDEX "idx_settlement_order_no" ON "zhs_agent_settlement" USING btree ("order_no");--> statement-breakpoint
CREATE INDEX "idx_settlement_status" ON "zhs_agent_settlement" USING btree ("settlement");--> statement-breakpoint
CREATE INDEX "idx_settlement_withdrawal" ON "zhs_agent_settlement" USING btree ("withdrawal");--> statement-breakpoint
CREATE INDEX "zhs_agent_settlement_agent_id_idx" ON "zhs_agent_settlement" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "search_contents_topic_idx" ON "search_contents" USING btree ("topic_type","topic_id");--> statement-breakpoint
CREATE INDEX "search_contents_type_idx" ON "search_contents" USING btree ("topic_type");--> statement-breakpoint
CREATE INDEX "search_contents_author_idx" ON "search_contents" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "search_contents_created_idx" ON "search_contents" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "agent_billings_record_idx" ON "agent_billings" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "agent_billings_consume_time_idx" ON "agent_billings" USING btree ("consume_time");--> statement-breakpoint
CREATE INDEX "agent_billings_model_idx" ON "agent_billings" USING btree ("model_id");--> statement-breakpoint
CREATE INDEX "agent_billings_status_idx" ON "agent_billings" USING btree ("billing_status");--> statement-breakpoint
CREATE INDEX "t_content_topic_idx" ON "t_content" USING btree ("topic_id","topic_type");--> statement-breakpoint
CREATE INDEX "t_content_type_idx" ON "t_content" USING btree ("topic_type");--> statement-breakpoint
CREATE INDEX "t_dynamic_circle_idx" ON "t_dynamic" USING btree ("circle_id");--> statement-breakpoint
CREATE INDEX "t_dynamic_member_idx" ON "t_dynamic" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "t_favorite_topic_idx" ON "t_favorite" USING btree ("topic_id","topic_type");--> statement-breakpoint
CREATE INDEX "t_favorite_member_idx" ON "t_favorite" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "t_follow_member_idx" ON "t_follow" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "t_follow_follow_member_idx" ON "t_follow" USING btree ("follow_member_id");--> statement-breakpoint
CREATE INDEX "t_like_topic_idx" ON "t_like" USING btree ("topic_id","topic_type");--> statement-breakpoint
CREATE INDEX "t_like_member_idx" ON "t_like" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "t_private_letter_sender_idx" ON "t_private_letter" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "t_private_letter_receiver_idx" ON "t_private_letter" USING btree ("receiver_id");--> statement-breakpoint
CREATE INDEX "t_tencent_cloud_live_stream_chan_idx" ON "t_tencent_cloud_live_stream" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "t_check_in_record_member_idx" ON "t_check_in_record" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "t_homework_lesson_idx" ON "t_homework" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "search_content_topic_idx" ON "search_content" USING btree ("topic_id","topic_type");--> statement-breakpoint
CREATE INDEX "search_content_type_idx" ON "search_content" USING btree ("topic_type");--> statement-breakpoint
CREATE INDEX "t_resource_download_member_idx" ON "t_resource_download" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "t_resource_download_resource_idx" ON "t_resource_download" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "t_certificate_certificate_id_idx" ON "t_certificate" USING btree ("certificate_id");--> statement-breakpoint
CREATE INDEX "t_certificate_member_idx" ON "t_certificate" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "t_certificate_lesson_idx" ON "t_certificate" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "t_certificate_status_idx" ON "t_certificate" USING btree ("status");--> statement-breakpoint
CREATE INDEX "t_certificate_company_idx" ON "t_certificate" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "t_certificate_template_status_idx" ON "t_certificate_template" USING btree ("status");--> statement-breakpoint
CREATE INDEX "t_certificate_template_company_idx" ON "t_certificate_template" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "t_certificate_template_create_time_idx" ON "t_certificate_template" USING btree ("create_time");--> statement-breakpoint
CREATE INDEX "t_lecturer_user_idx" ON "t_lecturer" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "t_manager_user_idx" ON "t_manager" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "t_manager_manager_idx" ON "t_manager" USING btree ("manager_id");--> statement-breakpoint
CREATE INDEX "t_sensitive_word_name_idx" ON "t_sensitive_word" USING btree ("name");--> statement-breakpoint
CREATE INDEX "oauth_private_keys_client_idx" ON "oauth_private_keys" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "oauth_private_keys_active_idx" ON "oauth_private_keys" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "zhs_agent_buy_category_idx" ON "zhs_agent_buy" USING btree ("category_id");--> statement-breakpoint
ALTER TABLE "oauth_private_keys" DROP COLUMN "app_id";--> statement-breakpoint
ALTER TABLE "oauth_private_keys" DROP COLUMN "key_data";--> statement-breakpoint
ALTER TABLE "oauth_private_keys" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "oauth_private_keys" DROP COLUMN "create_time";