CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"token" text,
	"family_id" uuid,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "refresh_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" varchar(20),
	"email" varchar(255),
	"username" varchar(64),
	"password_hash" text,
	"nickname" varchar(64),
	"avatar" text,
	"bio" text,
	"gender" integer DEFAULT 0 NOT NULL,
	"birthday" date,
	"family_id" uuid,
	"role_id" integer DEFAULT 0,
	"status" integer DEFAULT 1 NOT NULL,
	"is_vip" integer DEFAULT 0 NOT NULL,
	"invite_code" varchar(32),
	"parent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_phone_unique" UNIQUE("phone"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(32) DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"path" varchar(512) NOT NULL,
	"size" bigint DEFAULT 0 NOT NULL,
	"mime_type" varchar(128) NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "file_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"shared_by" uuid NOT NULL,
	"shared_with" uuid,
	"share_token" varchar(128) NOT NULL,
	"permissions" varchar(8) DEFAULT 'view' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "file_shares_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "file_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"size" integer NOT NULL,
	"path" varchar(512) NOT NULL,
	"uploaded_by" uuid,
	"change_log" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "file_versions_file_id_version_unique" UNIQUE("file_id","version")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" uuid NOT NULL,
	"receiver_id" uuid NOT NULL,
	"content" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(32) DEFAULT 'system' NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text,
	"data" jsonb,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_pricing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" varchar(128) NOT NULL,
	"input_token_price" integer NOT NULL,
	"output_token_price" integer NOT NULL,
	"region_pricing" jsonb DEFAULT '{"cn":1}'::jsonb NOT NULL,
	"discount" jsonb,
	"currency" varchar(8) DEFAULT 'CNY' NOT NULL,
	"effective_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_no" varchar(64) NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" uuid,
	"amount" integer NOT NULL,
	"currency" varchar(8) DEFAULT 'CNY' NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"payment_method" varchar(16),
	"order_type" integer DEFAULT 0 NOT NULL,
	"product_id" varchar(64),
	"paid_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_no_unique" UNIQUE("order_no")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" varchar(16) NOT NULL,
	"provider_order_id" varchar(128),
	"amount" integer NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"raw_response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(64) NOT NULL,
	"description" text,
	"price" integer NOT NULL,
	"interval" varchar(16) NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" varchar(32) NOT NULL,
	"resource_type" varchar(64),
	"resource_id" varchar(64),
	"details" jsonb,
	"ip" varchar(64),
	"user_agent" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"query" varchar(255) NOT NULL,
	"filters" jsonb,
	"results_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(255) DEFAULT '新对话' NOT NULL,
	"model" varchar(64) DEFAULT 'gpt-4o-mini' NOT NULL,
	"system_prompt" text,
	"metadata" jsonb,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_favorites_user_id_conversation_id_unique" UNIQUE("user_id","conversation_id")
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" varchar(16) DEFAULT 'user' NOT NULL,
	"content" text NOT NULL,
	"tokens" integer,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"inviter_id" uuid NOT NULL,
	"invitee_id" uuid,
	"email" varchar(255),
	"token" varchar(128) NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(32) DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_members_team_id_user_id_unique" UNIQUE("team_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"slug" varchar(128) NOT NULL,
	"description" text,
	"owner_id" uuid NOT NULL,
	"avatar" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"display_name" varchar(128) NOT NULL,
	"resource" varchar(64) NOT NULL,
	"action" varchar(32) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_unique" UNIQUE("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(64) NOT NULL,
	"display_name" varchar(128) NOT NULL,
	"description" text,
	"scope" varchar(16) DEFAULT 'self' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"scope_resource_id" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_unique" UNIQUE("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "workflow_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"project_id" uuid,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"context" jsonb,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instance_id" uuid NOT NULL,
	"task_id" uuid,
	"level" varchar(16) DEFAULT 'info' NOT NULL,
	"message" text NOT NULL,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instance_id" uuid NOT NULL,
	"step_index" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(32) DEFAULT 'action' NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"trigger_type" varchar(32) DEFAULT 'manual' NOT NULL,
	"trigger_config" jsonb,
	"steps" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comment_likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comment_likes_comment_id_user_id_unique" UNIQUE("comment_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"resource_type" varchar(32) NOT NULL,
	"resource_id" varchar(128) NOT NULL,
	"parent_id" uuid,
	"content" text NOT NULL,
	"mentions" jsonb,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedbacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(32) NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"contact" varchar(255),
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"priority" varchar(16) DEFAULT 'medium' NOT NULL,
	"admin_reply" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(128) NOT NULL,
	"slug" varchar(128) NOT NULL,
	"description" text,
	"banner" varchar(512),
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activities_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "activity_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_participants_activity_id_user_id_unique" UNIQUE("activity_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(128) NOT NULL,
	"type" varchar(16) NOT NULL,
	"value" integer NOT NULL,
	"min_amount" integer DEFAULT 0 NOT NULL,
	"max_uses" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "invitation_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(16) NOT NULL,
	"inviter_id" uuid NOT NULL,
	"invitee_id" uuid,
	"status" varchar(16) DEFAULT 'unused' NOT NULL,
	"reward_inviter" integer DEFAULT 0 NOT NULL,
	"reward_invitee" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitation_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"level" integer NOT NULL,
	"name" varchar(64) NOT NULL,
	"min_experience" integer NOT NULL,
	"max_experience" integer NOT NULL,
	"icon" varchar(512),
	"benefits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "levels_level_unique" UNIQUE("level")
);
--> statement-breakpoint
CREATE TABLE "point_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(16) NOT NULL,
	"source" varchar(32) NOT NULL,
	"amount" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"description" varchar(255),
	"reference_id" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sign_in_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"sign_in_date" date NOT NULL,
	"consecutive_days" integer DEFAULT 1 NOT NULL,
	"reward_points" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sign_in_records_user_id_sign_in_date_unique" UNIQUE("user_id","sign_in_date")
);
--> statement-breakpoint
CREATE TABLE "sign_in_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"consecutive_days" integer NOT NULL,
	"reward_points" integer NOT NULL,
	"extra_reward" jsonb DEFAULT '{}'::jsonb,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"total_earned" integer DEFAULT 0 NOT NULL,
	"total_spent" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"experience" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_points_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "announcement_reads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"announcement_id" uuid NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "announcement_reads_user_id_announcement_id_unique" UNIQUE("user_id","announcement_id")
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"type" varchar(32) DEFAULT 'info' NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "docs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" varchar(32) DEFAULT 'guide' NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(128) NOT NULL,
	"content" text NOT NULL,
	"author_id" uuid,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "docs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "help_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" varchar(32) DEFAULT 'other' NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(128) NOT NULL,
	"content" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "help_articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "help_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(64) NOT NULL,
	"slug" varchar(64) NOT NULL,
	"description" text,
	"icon" varchar(64),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "help_categories_name_unique" UNIQUE("name"),
	CONSTRAINT "help_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "api_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"method" varchar(16) NOT NULL,
	"path" varchar(512) NOT NULL,
	"status_code" integer NOT NULL,
	"duration" integer NOT NULL,
	"ip" varchar(64),
	"user_agent" varchar(512),
	"request_body" jsonb,
	"response_body" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"provider" varchar(32) NOT NULL,
	"credentials" jsonb,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integration_configs_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "payment_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(32) NOT NULL,
	"config_key" varchar(100) NOT NULL,
	"config_value" text,
	"is_enabled" boolean DEFAULT true,
	"environment" varchar(20) DEFAULT 'production',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(128) NOT NULL,
	"value" text NOT NULL,
	"type" varchar(16) DEFAULT 'string' NOT NULL,
	"category" varchar(32) DEFAULT 'general' NOT NULL,
	"description" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "system_configs_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "system_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(32) NOT NULL,
	"level" varchar(16) DEFAULT 'info' NOT NULL,
	"message" text NOT NULL,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"target_type" varchar(32) NOT NULL,
	"target_id" varchar(128) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_user_id_target_type_target_id_unique" UNIQUE("user_id","target_type","target_id")
);
--> statement-breakpoint
CREATE TABLE "tag_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tag_id" uuid NOT NULL,
	"resource_type" varchar(32) NOT NULL,
	"resource_id" varchar(128) NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tag_relations_tag_id_resource_type_resource_id_unique" UNIQUE("tag_id","resource_type","resource_id")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(64) NOT NULL,
	"slug" varchar(96) NOT NULL,
	"description" text,
	"color" varchar(16),
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name"),
	CONSTRAINT "tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user_favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"resource_type" varchar(32) NOT NULL,
	"resource_id" varchar(128) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_favorites_user_id_resource_type_resource_id_unique" UNIQUE("user_id","resource_type","resource_id")
);
--> statement-breakpoint
CREATE TABLE "user_follows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"follower_id" uuid NOT NULL,
	"following_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_follows_follower_id_following_id_unique" UNIQUE("follower_id","following_id")
);
--> statement-breakpoint
CREATE TABLE "ask_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ask_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"content" text NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"is_accepted" boolean DEFAULT false NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text NOT NULL,
	"tags" jsonb,
	"view_count" integer DEFAULT 0 NOT NULL,
	"answer_count" integer DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"is_resolved" boolean DEFAULT false NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "circle_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"circle_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text NOT NULL,
	"images" jsonb,
	"view_count" integer DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"reply_count" integer DEFAULT 0 NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "circles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"description" text,
	"cover_image" varchar(512),
	"category_id" uuid,
	"member_count" integer DEFAULT 0 NOT NULL,
	"post_count" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "circles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "learn_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"pid" uuid,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_chapter_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapter_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text,
	"video_url" varchar(512),
	"duration" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_free" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_sign_ups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_sign_ups_lesson_user_unique" UNIQUE("lesson_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"cover_image" varchar(512),
	"intro" text,
	"category_id" uuid,
	"lecturer_id" uuid,
	"lecturer_name" varchar(100),
	"price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"original_price" numeric(10, 2),
	"is_free" boolean DEFAULT false NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"signup_count" integer DEFAULT 0 NOT NULL,
	"lesson_count" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"pid" uuid,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_papers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"category_id" uuid,
	"paper_type" varchar(50) DEFAULT 'normal' NOT NULL,
	"total_score" numeric(6, 2) DEFAULT '100' NOT NULL,
	"pass_score" numeric(6, 2) DEFAULT '60' NOT NULL,
	"duration" integer DEFAULT 60 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"is_random" boolean DEFAULT false NOT NULL,
	"question_count" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paper_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"title" text NOT NULL,
	"options" jsonb,
	"answer" jsonb,
	"analysis" text,
	"score" numeric(6, 2) DEFAULT '5' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paper_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"answers" jsonb,
	"score" numeric(6, 2) DEFAULT '0' NOT NULL,
	"is_passed" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"duration" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_invoice_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid,
	"user_id" uuid NOT NULL,
	"invoice_type" varchar(16) DEFAULT 'normal' NOT NULL,
	"title_id" uuid,
	"amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"email" varchar(100),
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"remark" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "edu_invoice_applications_order_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "edu_invoice_titles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title_type" varchar(16) DEFAULT 'personal' NOT NULL,
	"title" varchar(200) NOT NULL,
	"tax_no" varchar(50),
	"bank" varchar(200),
	"bank_account" varchar(50),
	"address" varchar(500),
	"phone" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer,
	"product_name" varchar(255),
	"quantity" integer DEFAULT 1,
	"price" numeric(10, 2),
	"subtotal" numeric(10, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_no" varchar(64) NOT NULL,
	"user_id" uuid NOT NULL,
	"order_type" varchar(32) NOT NULL,
	"target_id" varchar(64),
	"target_title" varchar(200),
	"quantity" integer DEFAULT 1 NOT NULL,
	"original_price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"pay_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"pay_type" varchar(50),
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"pay_time" timestamp with time zone,
	"cancel_time" timestamp with time zone,
	"refund_time" timestamp with time zone,
	"remark" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "edu_orders_order_no_unique" UNIQUE("order_no")
);
--> statement-breakpoint
CREATE TABLE "edu_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_no" varchar(64) NOT NULL,
	"order_id" uuid NOT NULL,
	"order_type" varchar(32) NOT NULL,
	"user_id" uuid NOT NULL,
	"pay_type" varchar(50) NOT NULL,
	"pay_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"pay_url" varchar(500),
	"status" varchar(16) DEFAULT 'created' NOT NULL,
	"pay_time" timestamp with time zone,
	"third_party_no" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "edu_payments_payment_no_unique" UNIQUE("payment_no")
);
--> statement-breakpoint
CREATE TABLE "edu_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"order_type" varchar(32) NOT NULL,
	"order_no" varchar(64) NOT NULL,
	"user_id" uuid NOT NULL,
	"reason" varchar(500),
	"refund_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"refund_type" varchar(32) DEFAULT 'original' NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"apply_time" timestamp with time zone,
	"process_time" timestamp with time zone,
	"complete_time" timestamp with time zone,
	"process_message" varchar(500),
	"handle_message" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"pid" uuid,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"cover_image" varchar(500),
	"intro" text,
	"category_id" uuid,
	"lecturer_id" uuid,
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_lecturers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"avatar" varchar(500),
	"title" varchar(200),
	"intro" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"contact_name" varchar(100),
	"contact_phone" varchar(30),
	"address" varchar(500),
	"remark" varchar(500),
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"pid" uuid,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_member_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"growth_value" integer DEFAULT 0 NOT NULL,
	"discount" numeric(5, 2) DEFAULT '1.00' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(100),
	"mobile" varchar(30),
	"email" varchar(200),
	"password" varchar(128) DEFAULT '' NOT NULL,
	"avatar" varchar(500),
	"nickname" varchar(100),
	"gender" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 0 NOT NULL,
	"level_id" uuid,
	"company_id" uuid,
	"department_id" uuid,
	"growth_value" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"pid" uuid,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_downloads" (
	"id" serial PRIMARY KEY NOT NULL,
	"resource_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"ip" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"original_price" numeric(10, 2),
	"description" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_search_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"keyword" varchar(255),
	"result_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_tag_relations" (
	"id" serial PRIMARY KEY NOT NULL,
	"resource_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"cover_image" varchar(500),
	"intro" text,
	"category_id" uuid,
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
CREATE TABLE "edu_point_channel_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"point_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "edu_point_channel_relation_unique" UNIQUE("point_id","channel_id")
);
--> statement-breakpoint
CREATE TABLE "edu_point_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(50),
	"description" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_point_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid,
	"point" integer NOT NULL,
	"balance" integer NOT NULL,
	"type" varchar(32) NOT NULL,
	"description" varchar(255),
	"ref_id" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(50),
	"channel_id" uuid,
	"point" integer DEFAULT 0 NOT NULL,
	"description" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "department_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_dept_id" uuid,
	"child_dept_id" uuid,
	"relation_type" varchar(20) DEFAULT 'parent-child',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"pid" uuid,
	"company_id" integer,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"certificate_no" varchar(100),
	"issued_at" timestamp with time zone,
	"expire_at" timestamp with time zone,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"job_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"department_id" uuid,
	"company_id" integer,
	"employee_no" varchar(64),
	"position" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "schedule_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"task_name" varchar(200) NOT NULL,
	"status" varchar(20) NOT NULL,
	"start_time" timestamp with time zone,
	"end_time" timestamp with time zone,
	"duration" integer DEFAULT 0 NOT NULL,
	"message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"cron_expression" varchar(100) NOT NULL,
	"target_service" varchar(100),
	"target_method" varchar(100),
	"parameters" text,
	"priority" integer DEFAULT 5 NOT NULL,
	"max_retry_count" integer DEFAULT 3 NOT NULL,
	"timeout" integer DEFAULT 3600 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_run_time" timestamp with time zone,
	"last_run_status" varchar(20),
	"last_run_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "statistics_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(50) NOT NULL,
	"data" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"is_top" boolean DEFAULT false NOT NULL,
	"publish_time" timestamp with time zone,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"sender_id" uuid,
	"title" varchar(200),
	"content" text,
	"msg_type" varchar(32) DEFAULT 'system' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"ref_id" varchar(64),
	"ref_type" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_lesson_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"cover_image" varchar(512),
	"description" text,
	"lesson_ids" jsonb,
	"is_published" boolean DEFAULT false NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "behavior_watch_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"topic_id" varchar(128) NOT NULL,
	"topic_type" varchar(50) NOT NULL,
	"topic_title" varchar(200),
	"watch_duration" integer DEFAULT 0 NOT NULL,
	"last_position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "behavior_watch_records_user_topic_unique" UNIQUE("user_id","topic_id","topic_type")
);
--> statement-breakpoint
CREATE TABLE "visit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"ip" varchar(64),
	"city" varchar(100),
	"url" varchar(512),
	"referer" varchar(512),
	"user_agent" varchar(512),
	"session_id" varchar(128),
	"visit_date" varchar(10),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oss_drivers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"driver" varchar(32) NOT NULL,
	"credentials" jsonb,
	"config" jsonb,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"description" text,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oss_drivers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "edu_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group" varchar(64) DEFAULT 'general' NOT NULL,
	"key" varchar(128) NOT NULL,
	"value" text,
	"type" varchar(16) DEFAULT 'string' NOT NULL,
	"credentials" jsonb,
	"description" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid,
	"title" varchar(200) NOT NULL,
	"summary" varchar(500),
	"content" text NOT NULL,
	"cover_image" varchar(512),
	"author_id" uuid,
	"author_name" varchar(100),
	"is_published" boolean DEFAULT false NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificate_serial_numbers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"certificate_id" uuid,
	"serial_number" varchar(64) NOT NULL,
	"issued_to" varchar(100),
	"issued_at" timestamp with time zone,
	"status" varchar(20) DEFAULT 'active',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificate_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"background_image" varchar(512),
	"template_config" jsonb,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid,
	"user_id" uuid NOT NULL,
	"certificate_no" varchar(100) NOT NULL,
	"title" varchar(200) NOT NULL,
	"recipient_name" varchar(100),
	"source" varchar(20) DEFAULT 'manual' NOT NULL,
	"source_id" uuid,
	"issuer" varchar(100),
	"score" varchar(20),
	"valid_days" integer,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "token_flows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"op_type" integer NOT NULL,
	"quantity" integer NOT NULL,
	"balance_after" integer DEFAULT 0 NOT NULL,
	"remark" varchar(255),
	"operator_id" uuid,
	"related_order_no" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_margins" (
	"user_id" uuid NOT NULL,
	"token_quantity" integer DEFAULT 0 NOT NULL,
	"frozen_quantity" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_margins_user_id_pk" PRIMARY KEY("user_id")
);
--> statement-breakpoint
CREATE TABLE "commission_flows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"beneficiary_id" uuid NOT NULL,
	"invited_user_id" uuid,
	"order_id" uuid,
	"amount" integer DEFAULT 0 NOT NULL,
	"token" integer DEFAULT 0 NOT NULL,
	"type" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"remark" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity_proportions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"begin_time" timestamp with time zone,
	"end_time" timestamp with time zone,
	"status" integer DEFAULT 0 NOT NULL,
	"gift" integer DEFAULT 0 NOT NULL,
	"token_proportion" integer DEFAULT 0 NOT NULL,
	"vip_gift" integer DEFAULT 0 NOT NULL,
	"routine_proportion" integer DEFAULT 0 NOT NULL,
	"vip_proportion" integer DEFAULT 0 NOT NULL,
	"trader_proportion" integer DEFAULT 0 NOT NULL,
	"trader_gift" integer DEFAULT 0 NOT NULL,
	"trader_routine_proportion" integer DEFAULT 0 NOT NULL,
	"trader_vip_proportion" integer DEFAULT 0 NOT NULL,
	"trader_trader_proportion" integer DEFAULT 0 NOT NULL,
	"grand_routine_proportion" integer DEFAULT 0 NOT NULL,
	"grand_vip_proportion" integer DEFAULT 0 NOT NULL,
	"grand_trader_proportion" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "withdrawal_flows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"fee" integer DEFAULT 0 NOT NULL,
	"original_amount" integer NOT NULL,
	"status" integer DEFAULT 0 NOT NULL,
	"method" varchar(16) NOT NULL,
	"account_info" jsonb,
	"partner_trade_no" varchar(64),
	"payment_no" varchar(64),
	"reject_reason" varchar(500),
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_apps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar(100) NOT NULL,
	"client_secret" text NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"redirect_uris" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb,
	"icon" varchar(512),
	"owner_uuid" uuid,
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_apps_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "oauth_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event" varchar(64) NOT NULL,
	"client_id" varchar(100),
	"user_id" uuid,
	"ip" varchar(64),
	"status" varchar(16),
	"detail" text,
	"request_summary" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_scope_meta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" varchar(64) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"icon" varchar(512),
	"category" varchar(64),
	"is_active" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_scope_meta_scope_unique" UNIQUE("scope")
);
--> statement-breakpoint
CREATE TABLE "oauth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(100) NOT NULL,
	"client_id" varchar(100) NOT NULL,
	"user_id" uuid NOT NULL,
	"state" varchar(128),
	"scope" text,
	"code_challenge" varchar(256),
	"code_challenge_method" varchar(10),
	"expires_at" timestamp with time zone NOT NULL,
	"is_used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_sessions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "oauth_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_user_id" varchar(100) NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_sk" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"key" varchar(255) NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"type" integer DEFAULT 0 NOT NULL,
	"max" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_sk_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "user_third_party_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"open_id" varchar(100),
	"union_id" varchar(100),
	"platform" varchar(20) NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"expires_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_vips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"vip_level_id" uuid,
	"level_value" integer DEFAULT 0 NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"auto_renew" integer DEFAULT 0 NOT NULL,
	"order_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vip_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"level_name" varchar(100) NOT NULL,
	"level_value" integer DEFAULT 0 NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"duration_days" integer DEFAULT 30 NOT NULL,
	"benefits" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "captchas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"captcha_key" varchar(64) NOT NULL,
	"code" varchar(8) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sys_config" (
	"config_id" serial PRIMARY KEY NOT NULL,
	"config_name" varchar(100) NOT NULL,
	"config_key" varchar(100) NOT NULL,
	"config_value" varchar(500),
	"config_type" varchar(1) DEFAULT 'N' NOT NULL,
	"create_by" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"update_by" varchar(64),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"remark" varchar(500)
);
--> statement-breakpoint
CREATE TABLE "sys_dept" (
	"dept_id" serial PRIMARY KEY NOT NULL,
	"parent_id" bigint DEFAULT 0 NOT NULL,
	"ancestors" varchar(50) DEFAULT '0' NOT NULL,
	"dept_name" varchar(30) NOT NULL,
	"order_num" integer DEFAULT 0 NOT NULL,
	"leader" varchar(20),
	"phone" varchar(11),
	"email" varchar(50),
	"status" varchar(1) DEFAULT '0' NOT NULL,
	"del_flag" varchar(1) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sys_dict_data" (
	"dict_code" serial PRIMARY KEY NOT NULL,
	"dict_sort" integer DEFAULT 0 NOT NULL,
	"dict_label" varchar(100) NOT NULL,
	"dict_value" varchar(100) NOT NULL,
	"dict_type" varchar(100) NOT NULL,
	"css_class" varchar(100),
	"list_class" varchar(100),
	"is_default" varchar(1) DEFAULT 'N' NOT NULL,
	"status" varchar(1) DEFAULT '0' NOT NULL,
	"create_by" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"update_by" varchar(64),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"remark" varchar(500)
);
--> statement-breakpoint
CREATE TABLE "sys_dict_type" (
	"dict_id" serial PRIMARY KEY NOT NULL,
	"dict_name" varchar(100) NOT NULL,
	"dict_type" varchar(100) NOT NULL,
	"status" varchar(1) DEFAULT '0' NOT NULL,
	"create_by" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"update_by" varchar(64),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"remark" varchar(500)
);
--> statement-breakpoint
CREATE TABLE "sys_job_log" (
	"job_log_id" serial PRIMARY KEY NOT NULL,
	"job_name" varchar(64) NOT NULL,
	"job_group" varchar(64) NOT NULL,
	"invoke_target" varchar(500) NOT NULL,
	"job_message" varchar(500),
	"status" varchar(1) DEFAULT '0' NOT NULL,
	"exception_info" varchar(2000),
	"create_time" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sys_job" (
	"job_id" serial PRIMARY KEY NOT NULL,
	"job_name" varchar(64) NOT NULL,
	"job_group" varchar(64) DEFAULT 'DEFAULT' NOT NULL,
	"invoke_target" varchar(500) NOT NULL,
	"cron_expression" varchar(255) NOT NULL,
	"misfire_policy" varchar(20) DEFAULT '3' NOT NULL,
	"concurrent" varchar(1) DEFAULT '1' NOT NULL,
	"status" varchar(1) DEFAULT '0' NOT NULL,
	"create_by" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"update_by" varchar(64),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"remark" varchar(500)
);
--> statement-breakpoint
CREATE TABLE "sys_logininfor" (
	"info_id" bigserial PRIMARY KEY NOT NULL,
	"login_name" varchar(50),
	"ipaddr" varchar(50),
	"login_location" varchar(255),
	"browser" varchar(50),
	"os" varchar(50),
	"status" varchar(1) DEFAULT '0' NOT NULL,
	"msg" varchar(255),
	"login_time" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sys_menu" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"menu_name" varchar(128) NOT NULL,
	"order_num" integer DEFAULT 0 NOT NULL,
	"path" varchar(200),
	"component" varchar(255),
	"query" varchar(255),
	"is_frame" boolean DEFAULT false NOT NULL,
	"is_cache" boolean DEFAULT false NOT NULL,
	"menu_type" varchar(1) DEFAULT 'C' NOT NULL,
	"visible" varchar(1) DEFAULT '0' NOT NULL,
	"status" varchar(1) DEFAULT '0' NOT NULL,
	"perms" varchar(100),
	"icon" varchar(100),
	"create_by" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"update_by" varchar(64),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"remark" varchar(500)
);
--> statement-breakpoint
CREATE TABLE "sys_notice" (
	"notice_id" serial PRIMARY KEY NOT NULL,
	"notice_title" varchar(50) NOT NULL,
	"notice_type" varchar(1) NOT NULL,
	"notice_content" text,
	"status" varchar(1) DEFAULT '0' NOT NULL,
	"create_by" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"update_by" varchar(64),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"remark" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "sys_post" (
	"post_id" serial PRIMARY KEY NOT NULL,
	"post_code" varchar(64) NOT NULL,
	"post_name" varchar(50) NOT NULL,
	"post_sort" integer DEFAULT 0 NOT NULL,
	"status" varchar(1) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"remark" varchar(500)
);
--> statement-breakpoint
CREATE TABLE "sys_role_menu" (
	"role_id" integer NOT NULL,
	"menu_id" uuid NOT NULL,
	CONSTRAINT "sys_role_menu_pk" UNIQUE("role_id","menu_id")
);
--> statement-breakpoint
CREATE TABLE "edu_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid,
	"user_id" uuid,
	"title" varchar(200),
	"content" text NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_offline_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"type" varchar(50) NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"hours" integer DEFAULT 0 NOT NULL,
	"occurred_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_uploaded_certs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"cert_name" varchar(100) NOT NULL,
	"cert_url" varchar(500),
	"issuer" varchar(100),
	"issued_at" timestamp with time zone,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"reason" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_uploaded_papers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"paper_title" varchar(200) NOT NULL,
	"paper_url" varchar(500),
	"course_id" varchar(100),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"reason" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coze_variables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bot_id" varchar(100) NOT NULL,
	"variable_name" varchar(100) NOT NULL,
	"variable_value" text,
	"description" text,
	"data_type" varchar(20) DEFAULT 'string' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plaza_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"cover" varchar(500),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_callbacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"callback_url" text,
	"callback_data_1" varchar(500),
	"callback_data_2" varchar(500),
	"callback_data_3" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_categories" (
	"category_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"icon" varchar(100),
	"sort" integer DEFAULT 0 NOT NULL,
	"status" varchar(1) DEFAULT '1' NOT NULL,
	"is_paid" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_category_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid,
	"category_id" uuid,
	"is_primary" boolean DEFAULT false,
	"sort" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"config_key" varchar(100) NOT NULL,
	"config_value" text,
	"is_deleted" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_examines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid,
	"user_id" uuid,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"reason" text,
	"reviewer_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_heat_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"hit_count" bigint DEFAULT 0 NOT NULL,
	"date_str" varchar(10),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid,
	"buy_record_id" uuid,
	"order_no" varchar(100),
	"amount" integer DEFAULT 0 NOT NULL,
	"commission_rate" integer DEFAULT 0 NOT NULL,
	"commission_amount" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'unsettled' NOT NULL,
	"settled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"agent_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"avatar" varchar(500),
	"cover" varchar(500),
	"category_id" uuid,
	"user_id" uuid,
	"workspace_id" varchar(100),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"is_free" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"remark" text,
	"agent_version" varchar(32),
	"bot_id" varchar(64),
	"bot_id_str" varchar(64),
	"bot_name" varchar(200),
	"agent_prompt" text,
	"agent_model" varchar(100),
	"agent_temperature" integer,
	"agent_max_tokens" integer,
	"agent_variables" text,
	"publish_channel" varchar(50),
	"usage_count" bigint DEFAULT 0 NOT NULL,
	"like_count" bigint DEFAULT 0 NOT NULL,
	"share_count" bigint DEFAULT 0 NOT NULL,
	"coze_account_id" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "agent_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar(64) NOT NULL,
	"rule_name" varchar(128) NOT NULL,
	"rule_code" text NOT NULL,
	"rule_type" varchar(32) DEFAULT 'text',
	"priority" integer DEFAULT 0,
	"status" integer DEFAULT 1,
	"description" varchar(255) DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_rule_link" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid,
	"target_type" varchar(32) NOT NULL,
	"target_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_rule_param" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid,
	"param_name" varchar(100) NOT NULL,
	"param_value" text,
	"param_type" varchar(32) DEFAULT 'string',
	"sort" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_upload" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_path" varchar(500) NOT NULL,
	"file_size" bigint,
	"file_type" varchar(50),
	"mime_type" varchar(100),
	"status" varchar(20) DEFAULT 'pending',
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hot_words" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"word" varchar(100) NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_recommends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"news_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_tops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"news_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(50),
	"sort" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_member_company_relations" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"position" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_member_level_relations" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"level_id" integer NOT NULL,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_member_post_relations" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"post_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_member_tag_relations" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_resource_product_relations" (
	"id" serial PRIMARY KEY NOT NULL,
	"resource_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_group_member_relations" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"group_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(50),
	"sort" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"color" varchar(20),
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(50),
	"sort" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_chapter_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapter_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"question_ids" jsonb,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paper_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_signups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paper_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_wrong_question" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"paper_id" uuid NOT NULL,
	"paper_title" varchar(200),
	"user_answer" text,
	"right_answer" text,
	"wrong_count" integer DEFAULT 1 NOT NULL,
	"last_wrong_time" timestamp with time zone,
	"is_mastered" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learn_homework" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"chapter_id" uuid,
	"title" varchar(200) NOT NULL,
	"description" text,
	"content" jsonb,
	"due_date" timestamp with time zone,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learn_invoice_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" varchar(100) NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"title" varchar(200) NOT NULL,
	"tax_no" varchar(50) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learn_invoice_titles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"type" varchar(50) NOT NULL,
	"tax_no" varchar(50) NOT NULL,
	"bank" varchar(100),
	"bank_account" varchar(100),
	"address" varchar(200),
	"phone" varchar(50),
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learn_maps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"cover" varchar(500),
	"content" jsonb,
	"sort" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_callbacks" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"order_id" varchar(64),
	"payment_method" varchar(32),
	"callback_type" varchar(32),
	"raw_data" text,
	"status" integer DEFAULT 0 NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transfer_infos" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"transfer_no" varchar(64) NOT NULL,
	"from_user" varchar(64),
	"to_user" varchar(64),
	"amount" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 0 NOT NULL,
	"remark" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transfer_infos_transfer_no_unique" UNIQUE("transfer_no")
);
--> statement-breakpoint
CREATE TABLE "wx_pay_notifications" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"out_trade_no" varchar(64),
	"transaction_id" varchar(64),
	"openid" varchar(128),
	"trade_type" varchar(32),
	"bank_type" varchar(32),
	"total_fee" integer DEFAULT 0 NOT NULL,
	"cash_fee" integer DEFAULT 0 NOT NULL,
	"refund_no" varchar(64),
	"notification_type" varchar(32),
	"result_code" varchar(16),
	"raw_xml" text,
	"status" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_agent_free_times" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_uuid" varchar(64) NOT NULL,
	"agent_id" varchar(64) NOT NULL,
	"free_times" integer DEFAULT 0 NOT NULL,
	"used_times" integer DEFAULT 0 NOT NULL,
	"last_reset_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_user_agent_audio" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_uuid" varchar(64) NOT NULL,
	"agent_id" varchar(64) NOT NULL,
	"audio_url" varchar(500),
	"duration" integer,
	"create_time" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_user_agent_context" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_uuid" varchar(64) NOT NULL,
	"user_id" varchar(64),
	"agent_id" varchar(64) NOT NULL,
	"session_id" varchar(64),
	"role" varchar(20),
	"content" text,
	"content_type" varchar(20) DEFAULT 'text' NOT NULL,
	"tokens" integer DEFAULT 0 NOT NULL,
	"context_key" varchar(200),
	"context_value" text,
	"field_name" varchar(200),
	"create_time" timestamp with time zone DEFAULT now() NOT NULL,
	"update_time" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_user_agent_image" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_uuid" varchar(64) NOT NULL,
	"user_id" varchar(64),
	"user_name" varchar(100),
	"agent_id" varchar(64),
	"agent_name" varchar(200),
	"image_url" varchar(500) NOT NULL,
	"image_type" varchar(20) DEFAULT 'input' NOT NULL,
	"prompt" text,
	"model" varchar(50),
	"task_id" varchar(100),
	"status" integer DEFAULT 1 NOT NULL,
	"cost" integer DEFAULT 0 NOT NULL,
	"width" integer,
	"height" integer,
	"size" integer,
	"create_time" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_private_keys" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"app_id" varchar(64) NOT NULL,
	"key_type" varchar(32) DEFAULT 'rsa' NOT NULL,
	"key_data" text NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"create_time" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_identity" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"identity_name" varchar(100) NOT NULL,
	"identity_type" varchar(50),
	"status" integer DEFAULT 1 NOT NULL,
	"create_time" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_organization" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"org_name" varchar(200) NOT NULL,
	"org_type" varchar(50),
	"parent_id" bigint DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"create_time" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_model_config" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"provider_code" varchar(64) NOT NULL,
	"is_builtin" boolean DEFAULT false NOT NULL,
	"base_url" varchar(500) NOT NULL,
	"api_format" varchar(32) DEFAULT 'openai_chat' NOT NULL,
	"api_key_enc" text,
	"model_id_for_test" varchar(100),
	"enabled" boolean DEFAULT true NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"owner_uuid" varchar(64),
	"last_test_status" varchar(16),
	"last_test_response_ms" integer,
	"last_tested_at" varchar(32),
	"last_test_error" text,
	"extra_config" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_sk_info" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_uuid" varchar(255),
	"key" varchar(255),
	"status" integer,
	"type" integer,
	"max" bigint,
	"out_time" timestamp with time zone,
	"created_time" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_time" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_generation_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" varchar(36) NOT NULL,
	"user_uuid" varchar(255) NOT NULL,
	"chat_id" varchar(255),
	"status" varchar(50) DEFAULT 'accepted' NOT NULL,
	"message" varchar(512),
	"result" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_generation_tasks_task_id_unique" UNIQUE("task_id")
);
--> statement-breakpoint
CREATE TABLE "aibot_sites" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"short_desc" text,
	"section" varchar(128),
	"sub_section" varchar(255),
	"icon_url" varchar(512),
	"detail_url" varchar(512),
	"official_url" varchar(512),
	"panel_html" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simple_bot_configs" (
	"bot_id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"shortcut_commands" jsonb,
	"agents_variable" jsonb,
	"other_config" jsonb,
	"shortcut_count" integer DEFAULT 0 NOT NULL,
	"variable_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_user_post" (
	"user_id" bigint NOT NULL,
	"post_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_user_post_user_id_post_id_pk" PRIMARY KEY("user_id","post_id")
);
--> statement-breakpoint
CREATE TABLE "gen_table" (
	"table_id" bigserial PRIMARY KEY NOT NULL,
	"table_name" varchar(200) DEFAULT '' NOT NULL,
	"table_comment" varchar(500) DEFAULT '' NOT NULL,
	"sub_table_name" varchar(200),
	"sub_table_fk_name" varchar(200),
	"class_name" varchar(200) DEFAULT '' NOT NULL,
	"tpl_category" varchar(10) DEFAULT 'crud' NOT NULL,
	"tpl_web_type" varchar(10) DEFAULT 'tailwind' NOT NULL,
	"package_name" varchar(100) DEFAULT '' NOT NULL,
	"module_name" varchar(100) DEFAULT '' NOT NULL,
	"business_name" varchar(100) DEFAULT '' NOT NULL,
	"function_name" varchar(500) DEFAULT '' NOT NULL,
	"function_author" varchar(100) DEFAULT '' NOT NULL,
	"gen_type" varchar(1) DEFAULT '0' NOT NULL,
	"gen_path" varchar(200),
	"options" text,
	"create_by" varchar(64) DEFAULT '' NOT NULL,
	"create_time" timestamp with time zone DEFAULT now() NOT NULL,
	"update_by" varchar(64) DEFAULT '' NOT NULL,
	"update_time" timestamp with time zone DEFAULT now() NOT NULL,
	"remark" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gen_table_column" (
	"column_id" bigserial PRIMARY KEY NOT NULL,
	"table_id" bigint,
	"column_name" varchar(200) DEFAULT '' NOT NULL,
	"column_comment" varchar(1000) DEFAULT '' NOT NULL,
	"column_type" varchar(100) DEFAULT '' NOT NULL,
	"java_type" varchar(100) DEFAULT '' NOT NULL,
	"java_field" varchar(200) DEFAULT '' NOT NULL,
	"is_pk" varchar(1) DEFAULT '0' NOT NULL,
	"is_increment" varchar(1) DEFAULT '0' NOT NULL,
	"is_required" varchar(1) DEFAULT '0' NOT NULL,
	"is_insert" varchar(1) DEFAULT '0' NOT NULL,
	"is_edit" varchar(1) DEFAULT '0' NOT NULL,
	"is_list" varchar(1) DEFAULT '0' NOT NULL,
	"is_query" varchar(1) DEFAULT '0' NOT NULL,
	"query_type" varchar(200) DEFAULT 'EQ' NOT NULL,
	"html_type" varchar(200) DEFAULT 'input' NOT NULL,
	"dict_type" varchar(200) DEFAULT '' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"create_by" varchar(64) DEFAULT '' NOT NULL,
	"create_time" timestamp with time zone DEFAULT now() NOT NULL,
	"update_by" varchar(64) DEFAULT '' NOT NULL,
	"update_time" timestamp with time zone DEFAULT now() NOT NULL,
	"remark" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tbox_bean" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"bean_type" varchar(50),
	"bean_data" text,
	"status" integer DEFAULT 1 NOT NULL,
	"create_time" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refund_audit_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"refund_id" uuid NOT NULL,
	"auditor_id" uuid NOT NULL,
	"action" varchar(16) NOT NULL,
	"reason" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_service_agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"nickname" varchar(64) NOT NULL,
	"avatar" varchar(500),
	"status" varchar(16) DEFAULT 'offline' NOT NULL,
	"max_concurrent" integer DEFAULT 5 NOT NULL,
	"current_load" integer DEFAULT 0 NOT NULL,
	"skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cs_agents_user_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "customer_service_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(64) NOT NULL,
	"slug" varchar(64) NOT NULL,
	"description" varchar(255),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_service_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "customer_service_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"content" text NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_service_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid,
	"session_id" uuid,
	"user_id" uuid NOT NULL,
	"agent_id" uuid,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_service_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar(64) NOT NULL,
	"user_id" uuid NOT NULL,
	"agent_id" uuid,
	"status" varchar(16) DEFAULT 'waiting' NOT NULL,
	"source" varchar(16) DEFAULT 'web' NOT NULL,
	"queue_position" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"transferred_to" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_service_sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "customer_service_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_no" varchar(64) NOT NULL,
	"user_id" uuid NOT NULL,
	"category_id" uuid,
	"title" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"priority" varchar(16) DEFAULT 'medium' NOT NULL,
	"assignee_id" uuid,
	"source" varchar(16) DEFAULT 'web' NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_service_tickets_ticket_no_unique" UNIQUE("ticket_no")
);
--> statement-breakpoint
CREATE TABLE "tenant_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(32) DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_members_tenant_id_user_id_unique" UNIQUE("tenant_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "tenant_quotas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"api_calls_limit" integer DEFAULT 100000 NOT NULL,
	"api_calls_used" integer DEFAULT 0 NOT NULL,
	"storage_limit_mb" integer DEFAULT 10240 NOT NULL,
	"storage_used_mb" integer DEFAULT 0 NOT NULL,
	"user_limit" integer DEFAULT 50 NOT NULL,
	"user_count" integer DEFAULT 0 NOT NULL,
	"limits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"period_start" timestamp with time zone DEFAULT now() NOT NULL,
	"period_end" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_quotas_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"slug" varchar(128) NOT NULL,
	"description" text,
	"owner_id" uuid NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"plan" varchar(32) DEFAULT 'free' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "ai_budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" varchar(32) NOT NULL,
	"scope_key" varchar(128) NOT NULL,
	"model" varchar(128),
	"daily_token_limit" integer DEFAULT 1000000 NOT NULL,
	"monthly_token_limit" integer DEFAULT 30000000 NOT NULL,
	"daily_cost_limit" numeric(10, 4) DEFAULT '100' NOT NULL,
	"monthly_cost_limit" numeric(10, 4) DEFAULT '2000' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_cost_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"tenant_id" uuid,
	"model" varchar(128) NOT NULL,
	"provider" varchar(64) NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"cost" numeric(12, 6) DEFAULT '0' NOT NULL,
	"cached" boolean DEFAULT false NOT NULL,
	"request_type" varchar(32) DEFAULT 'chat' NOT NULL,
	"prompt_hash" varchar(64),
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_feed_hot_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_code" varchar(64) NOT NULL,
	"platform_item_id" varchar(128) NOT NULL,
	"title" varchar(500) NOT NULL,
	"summary" text,
	"url" varchar(1000),
	"cover_url" varchar(1000),
	"author" varchar(200),
	"current_rank" integer,
	"current_hot" bigint,
	"publish_time" timestamp with time zone,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"llm_category" varchar(64),
	"llm_tags" varchar(500),
	"llm_summary" text,
	"llm_processed_at" timestamp with time zone,
	"trend_tag" varchar(16),
	"trend_growth_pct" real,
	"title_en" varchar(500),
	"title_ja" varchar(500),
	"title_ko" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_ai_feed_item_source_pid" UNIQUE("source_code","platform_item_id")
);
--> statement-breakpoint
CREATE TABLE "ai_feed_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_code" varchar(64) NOT NULL,
	"platform_item_id" varchar(128) NOT NULL,
	"item_id" uuid,
	"title" varchar(500) NOT NULL,
	"rank" integer,
	"hot_value" bigint,
	"snapshot_date" date NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_ai_feed_snapshot_src_pid_date" UNIQUE("source_code","platform_item_id","snapshot_date")
);
--> statement-breakpoint
CREATE TABLE "ai_feed_source" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_code" varchar(64) NOT NULL,
	"source_name" varchar(100) NOT NULL,
	"source_type" varchar(32) DEFAULT 'hotlist' NOT NULL,
	"endpoint" varchar(255),
	"category" varchar(64) DEFAULT 'general' NOT NULL,
	"icon" varchar(255),
	"color" varchar(16),
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 100 NOT NULL,
	"fetch_interval_minutes" integer DEFAULT 60 NOT NULL,
	"last_fetch_at" timestamp with time zone,
	"last_fetch_status" varchar(32),
	"last_fetch_count" integer,
	"description" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_ai_feed_source_code" UNIQUE("source_code")
);
--> statement-breakpoint
CREATE TABLE "ai_feed_trend_signal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"source_code" varchar(64) NOT NULL,
	"platform_item_id" varchar(128) NOT NULL,
	"window_days" integer NOT NULL,
	"growth_pct" real,
	"rank_delta" integer,
	"ema_hot" bigint,
	"hot_then" bigint,
	"trend_tag" varchar(16) DEFAULT 'stable' NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"snapshot_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_ai_feed_trend_item_window" UNIQUE("item_id","window_days")
);
--> statement-breakpoint
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
CREATE TABLE "ai_gc_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_uuid" varchar(64) NOT NULL,
	"agent_id" varchar(64),
	"gc_type" varchar(32) DEFAULT 'text',
	"content" text,
	"status" integer DEFAULT 1,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_gc_task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gc_content_id" uuid NOT NULL,
	"user_uuid" varchar(64) NOT NULL,
	"action" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "circle_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pid" uuid,
	"name" varchar(100) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_show" boolean DEFAULT true NOT NULL,
	"icon" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "circle_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"circle_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(20) DEFAULT 'member' NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "circle_member_user_uniq" UNIQUE("circle_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "circle_post_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"content" text NOT NULL,
	"pid" uuid,
	"reply_user_id" uuid,
	"like_count" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "circle_post_likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "circle_post_like_uniq" UNIQUE("post_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "ask_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pid" uuid,
	"name" varchar(100) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_show" boolean DEFAULT true NOT NULL,
	"is_show_index" boolean DEFAULT false NOT NULL,
	"image" varchar(500),
	"level" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ask_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_type" varchar(20) NOT NULL,
	"target_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"content" text NOT NULL,
	"pid" uuid,
	"like_count" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ask_favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"target_type" varchar(20) NOT NULL,
	"target_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ask_favorite_uniq" UNIQUE("user_id","target_type","target_id")
);
--> statement-breakpoint
CREATE TABLE "ask_likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"target_type" varchar(20) NOT NULL,
	"target_id" uuid NOT NULL,
	"is_like" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ask_question_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ask_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ask_question_category_uniq" UNIQUE("ask_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "learn_homework_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"url" varchar(3000) NOT NULL,
	"status" varchar(200) DEFAULT 'pending' NOT NULL,
	"sign_up_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learn_learn_map_topic" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learn_map_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learn_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"lesson_chapter_section_id" uuid NOT NULL,
	"sign_up_id" uuid NOT NULL,
	"learn_time" bigint DEFAULT 0 NOT NULL,
	"max_progress_time" bigint DEFAULT 0 NOT NULL,
	"status" varchar(200) DEFAULT 'progressing' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learn_record_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"lesson_chapter_section_id" uuid NOT NULL,
	"sign_up_id" uuid NOT NULL,
	"learn_time" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learn_topic" (
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learn_topic_category" (
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learn_topic_category_relation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_category_id" uuid NOT NULL,
	"father_category_id" uuid NOT NULL,
	"direct_father_category_id" uuid NOT NULL,
	"is_sub" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learn_topic_lesson" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learn_topic_topic_category_relation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"access_type" varchar(20) DEFAULT 'all' NOT NULL,
	"access_values" text DEFAULT '[]' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_rate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"sign_id" uuid,
	"content" text,
	"content_utility_score" integer,
	"teacher_score" integer,
	"service_score" integer,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"lesson_chapter_id" uuid,
	"lesson_chapter_section_id" uuid,
	"title" varchar(200) NOT NULL,
	"content_type" varchar(50),
	"conditions" text,
	"status" varchar(20) DEFAULT 'enable' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_auth_info" (
	"user_uuid" uuid PRIMARY KEY NOT NULL,
	"phone" varchar(20),
	"cancel_phone" varchar(20),
	"real_name" varchar(50),
	"id_card" varchar(20),
	"auth_status" varchar(32) DEFAULT 'unverified' NOT NULL,
	"auth_source" varchar(50),
	"auth_at" timestamp with time zone,
	"reject_reason" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tbox_command" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"command" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"payload" jsonb,
	"sent_at" timestamp with time zone,
	"acked_at" timestamp with time zone,
	"result" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tbox_device" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_no" varchar(100) NOT NULL,
	"device_name" varchar(200),
	"device_type" varchar(50) DEFAULT 'tbox' NOT NULL,
	"user_id" uuid,
	"status" varchar(50) DEFAULT 'offline' NOT NULL,
	"signal" integer,
	"battery" integer,
	"latitude" varchar(50),
	"longitude" varchar(50),
	"firmware_version" varchar(100),
	"last_online_at" timestamp with time zone,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tbox_device_device_no_unique" UNIQUE("device_no")
);
--> statement-breakpoint
CREATE TABLE "stock_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"symbol" varchar(32) NOT NULL,
	"question" text NOT NULL,
	"analysis" text NOT NULL,
	"model" varchar(64),
	"conversation_id" varchar(64),
	"tokens_used" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "srs_servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"host" varchar(255) NOT NULL,
	"rtmp_port" integer DEFAULT 1935 NOT NULL,
	"http_port" integer DEFAULT 8080 NOT NULL,
	"webrtc_port" integer DEFAULT 1985 NOT NULL,
	"api_port" integer DEFAULT 1985 NOT NULL,
	"api_secret" varchar(256),
	"max_streams" integer DEFAULT 100 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"health_check_url" varchar(500),
	"last_health_check" timestamp with time zone,
	"status" varchar(20) DEFAULT 'online' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "srs_streams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stream_key" varchar(128) NOT NULL,
	"channel_id" uuid,
	"title" varchar(200) NOT NULL,
	"push_url" varchar(500),
	"play_url" varchar(500),
	"webrtc_url" varchar(500),
	"hls_url" varchar(500),
	"flv_url" varchar(500),
	"status" varchar(20) DEFAULT 'inactive' NOT NULL,
	"publisher_ip" varchar(45),
	"client_id" varchar(128),
	"video_codec" varchar(32),
	"audio_codec" varchar(32),
	"video_bitrate" integer,
	"audio_bitrate" integer,
	"video_width" integer,
	"video_height" integer,
	"video_fps" integer,
	"start_time" timestamp with time zone,
	"end_time" timestamp with time zone,
	"duration" integer DEFAULT 0,
	"recv_bytes" integer DEFAULT 0,
	"send_bytes" integer DEFAULT 0,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "srs_streams_stream_key_unique" UNIQUE("stream_key")
);
--> statement-breakpoint
CREATE TABLE "remote_device_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"task_type" varchar(50) NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"payload" jsonb,
	"priority" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"dispatched_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"result" jsonb,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "remote_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_no" varchar(100) NOT NULL,
	"device_name" varchar(200),
	"device_type" varchar(50),
	"model" varchar(100),
	"manufacturer" varchar(100),
	"firmware_version" varchar(50),
	"ip_address" varchar(45),
	"mac_address" varchar(17),
	"location" varchar(255),
	"longitude" varchar(20),
	"latitude" varchar(20),
	"status" varchar(20) DEFAULT 'offline' NOT NULL,
	"battery_level" integer,
	"signal_strength" integer,
	"user_id" uuid,
	"last_online_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "remote_devices_device_no_unique" UNIQUE("device_no")
);
--> statement-breakpoint
CREATE TABLE "canary_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_id" uuid NOT NULL,
	"action" varchar(50) NOT NULL,
	"from_stage" varchar(50),
	"to_stage" varchar(50),
	"reason" text,
	"operator_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canary_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"target" varchar(200),
	"current_stage" varchar(50) NOT NULL,
	"target_stage" varchar(50) NOT NULL,
	"failure_threshold" integer NOT NULL,
	"cooldown_minutes" integer NOT NULL,
	"auto_rollback" boolean DEFAULT true NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone,
	"last_promoted_at" timestamp with time zone,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "canary_configs_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "tool_favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tool_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"category" varchar(64) NOT NULL,
	"icon" varchar(512),
	"url" varchar(512),
	"rating" integer DEFAULT 0 NOT NULL,
	"favorite_count" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'published' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "developer_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"key" varchar(128) NOT NULL,
	"secret" varchar(255) NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"last_used_at" timestamp with time zone,
	"rate_limit" integer DEFAULT 60 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "developer_api_keys_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "app_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" varchar(32) NOT NULL,
	"platform" varchar(16) NOT NULL,
	"build_number" integer NOT NULL,
	"download_url" varchar(512),
	"force_update" boolean DEFAULT false NOT NULL,
	"release_notes" text,
	"status" varchar(20) DEFAULT 'history' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monitor_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"source" varchar(100) NOT NULL,
	"severity" varchar(20) DEFAULT 'warning' NOT NULL,
	"status" varchar(20) DEFAULT 'firing' NOT NULL,
	"message" text,
	"labels" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"annotations" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"fired_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppression_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"match_labels" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"match_source" varchar(100),
	"is_active" boolean DEFAULT true NOT NULL,
	"suppress_minutes" integer DEFAULT 60 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" uuid NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"response_code" integer,
	"response_body" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"url" varchar(512) NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"secret" varchar(255),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "traders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"commission_rate" integer DEFAULT 0 NOT NULL,
	"performance" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"specialties" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"intro" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "traders_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "sdks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"version" varchar(32) NOT NULL,
	"language" varchar(32) NOT NULL,
	"download_url" varchar(512),
	"documentation_url" varchar(512),
	"description" text,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "miniprogram_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" varchar(64) NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(32) NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "miniprogram_configs_app_id_unique" UNIQUE("app_id")
);
--> statement-breakpoint
CREATE TABLE "miniprogram_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" varchar(64) NOT NULL,
	"version" varchar(32) NOT NULL,
	"version_desc" varchar(500),
	"qrcode_url" varchar(512),
	"status" varchar(20) DEFAULT 'preview' NOT NULL,
	"build" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(64) NOT NULL,
	"type" varchar(32) NOT NULL,
	"value" varchar(255) NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_identities_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "user_group_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(32) DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_group_members_group_user_unique" UNIQUE("group_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "user_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(32) DEFAULT 'custom' NOT NULL,
	"description" text,
	"owner_id" uuid,
	"member_count" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_key_quotas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_key_id" varchar(128) NOT NULL,
	"hourly_used" integer DEFAULT 0 NOT NULL,
	"daily_used" integer DEFAULT 0 NOT NULL,
	"hourly_limit" integer DEFAULT 1000 NOT NULL,
	"daily_limit" integer DEFAULT 10000 NOT NULL,
	"reset_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_key_quotas_api_key_id_unique" UNIQUE("api_key_id")
);
--> statement-breakpoint
CREATE TABLE "audit_chain_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"previous_hash" varchar(64) NOT NULL,
	"hash" varchar(64) NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_chain_entries_hash_unique" UNIQUE("hash")
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(64) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"last_attempt_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ab_test_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"bucket" varchar(32) NOT NULL,
	"samples" integer DEFAULT 0 NOT NULL,
	"conversions" integer DEFAULT 0 NOT NULL,
	"revenue" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ab_test_results_variant_bucket_uniq" UNIQUE("variant_id","bucket")
);
--> statement-breakpoint
CREATE TABLE "ab_test_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"is_control" boolean DEFAULT false NOT NULL,
	"traffic_weight" integer DEFAULT 1 NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ab_test_variants_test_name_uniq" UNIQUE("test_id","name")
);
--> statement-breakpoint
CREATE TABLE "ab_tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"traffic_percent" integer DEFAULT 100 NOT NULL,
	"target_metric" varchar(100) NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"winning_variant_id" uuid,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"auto_promote" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ab_tests_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "tour_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"type" varchar(32) DEFAULT 'route' NOT NULL,
	"summary" text,
	"content" text NOT NULL,
	"cover_image" varchar(512),
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"destination" varchar(200),
	"duration" integer,
	"price" integer,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"release_stage" varchar(32) DEFAULT 'off' NOT NULL,
	"author_id" uuid,
	"view_count" integer DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tour_dependencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" uuid NOT NULL,
	"depends_on_id" uuid NOT NULL,
	"relation_type" varchar(32) DEFAULT 'requires' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tour_dependencies_pair_uniq" UNIQUE("content_id","depends_on_id","relation_type")
);
--> statement-breakpoint
CREATE TABLE "tour_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(100) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"processed_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tour_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"content_id" uuid NOT NULL,
	"score" real NOT NULL,
	"reason" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"strategy" varchar(32) DEFAULT 'default' NOT NULL,
	"clicked" boolean DEFAULT false NOT NULL,
	"dismissed" boolean DEFAULT false NOT NULL,
	"served_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tour_recommendations_user_content_strategy_uniq" UNIQUE("user_id","content_id","strategy")
);
--> statement-breakpoint
CREATE TABLE "ai_capabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"display_name" varchar(200) NOT NULL,
	"category" varchar(64) NOT NULL,
	"provider" varchar(64) NOT NULL,
	"version" varchar(32) DEFAULT '1.0.0' NOT NULL,
	"description" text,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"capability_schema" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"input_example" jsonb,
	"output_example" jsonb,
	"avg_latency_ms" integer,
	"avg_cost_usd" real,
	"quality_score" real,
	"enabled" boolean DEFAULT true NOT NULL,
	"author_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_capabilities_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "ai_capability_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"category" varchar(64) NOT NULL,
	"description" text,
	"template_schema" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"default_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_builtin" boolean DEFAULT false NOT NULL,
	"use_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_capability_templates_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "news_crawler_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"title" varchar(500) NOT NULL,
	"summary" text,
	"content" text,
	"original_url" varchar(1000) NOT NULL,
	"author" varchar(200),
	"published_at" timestamp with time zone,
	"cover_image" varchar(1000),
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dedupe_hash" varchar(64),
	"status" varchar(32) DEFAULT 'stored' NOT NULL,
	"raw_payload" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "news_crawler_articles_source_url_uniq" UNIQUE("source_id","original_url")
);
--> statement-breakpoint
CREATE TABLE "news_crawler_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"url" varchar(1000) NOT NULL,
	"source_type" varchar(32) DEFAULT 'rss' NOT NULL,
	"schedule_cron" varchar(64) DEFAULT '0 * * * *' NOT NULL,
	"selector_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"last_fetch_at" timestamp with time zone,
	"last_fetch_status" varchar(32),
	"last_fetch_count" integer,
	"last_error" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "news_crawler_sources_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"memory_type" varchar(32) NOT NULL,
	"content" text NOT NULL,
	"summary" varchar(500),
	"importance" integer DEFAULT 50 NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"source" varchar(64),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_accessed_at" timestamp with time zone,
	"access_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_buy_scheduled_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buy_id" uuid NOT NULL,
	"task_type" varchar(32) DEFAULT 'expiry_check' NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"executed_at" timestamp with time zone,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"result" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_agent_buy" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"duration" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"payment_method" varchar(32),
	"payment_id" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_agent_withdrawal_detail" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"agent_id" uuid,
	"amount" numeric(10, 2) NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"bank_info" text,
	"reject_reason" text,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sensitive_words" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"word" varchar(128) NOT NULL,
	"category" varchar(32) DEFAULT 'default' NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"replacement" varchar(128) DEFAULT '***',
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(32) NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"version" varchar(32) NOT NULL,
	"effective_date" timestamp with time zone NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"published_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carousels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"position" varchar(64) NOT NULL,
	"title" varchar(255),
	"image_url" varchar(512) NOT NULL,
	"link_url" varchar(512),
	"description" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"start_at" timestamp with time zone,
	"end_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"channel" varchar(32) NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"variables" jsonb DEFAULT '[]'::jsonb,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_templates_code_unique" UNIQUE("code")
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
	"channel_id" uuid NOT NULL,
	"is_notify" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "live_subscribe_user_channel_uniq" UNIQUE("user_id","channel_id")
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
CREATE TABLE "exam_sign_up" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"exam_id" integer NOT NULL,
	"status" varchar(50) NOT NULL,
	"completed_time" timestamp with time zone,
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
CREATE TABLE "message_private_letter" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" varchar(100) NOT NULL,
	"receiver_id" varchar(100) NOT NULL,
	"content" text NOT NULL,
	"read_time" timestamp with time zone,
	"is_read" boolean DEFAULT false NOT NULL,
	"status" varchar(30) DEFAULT 'normal' NOT NULL,
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
CREATE TABLE "upload_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"upload_id" varchar(128) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_size" bigint DEFAULT 0 NOT NULL,
	"file_md5" varchar(64),
	"total_chunks" integer NOT NULL,
	"uploaded_chunks" integer DEFAULT 0 NOT NULL,
	"chunk_size" integer DEFAULT 5242880 NOT NULL,
	"mime_type" varchar(128),
	"status" varchar(32) DEFAULT 'uploading' NOT NULL,
	"file_path" varchar(512),
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "upload_sessions_upload_id_unique" UNIQUE("upload_id")
);
--> statement-breakpoint
CREATE TABLE "auth_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"real_name" varchar(50) NOT NULL,
	"id_card" varchar(20) NOT NULL,
	"id_card_front" varchar(500),
	"id_card_back" varchar(500),
	"phone" varchar(20),
	"status" integer DEFAULT 0 NOT NULL,
	"audit_user" varchar(64),
	"audit_time" timestamp with time zone,
	"audit_remark" varchar(500),
	"expire_time" timestamp with time zone,
	"type" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "education_platform" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(50) NOT NULL,
	"type" varchar(20) DEFAULT 'mooc',
	"api_url" varchar(500),
	"api_key" varchar(200),
	"api_secret" varchar(200),
	"config" text,
	"sync_url" varchar(500),
	"last_sync_time" timestamp with time zone,
	"status" integer DEFAULT 1,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "education_platform_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "education_sync_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform_code" varchar(50) NOT NULL,
	"type" varchar(20) DEFAULT 'course',
	"sync_type" varchar(20) DEFAULT 'pull',
	"success" boolean DEFAULT false,
	"request" text,
	"response" text,
	"error_msg" varchar(500),
	"record_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_demand_square" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"type" varchar(20) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"reject_reason" varchar(500),
	"reviewed_by" varchar(64),
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_faq" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"question" varchar(200) NOT NULL,
	"answer" text NOT NULL,
	"keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_faq_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(64) NOT NULL,
	"slug" varchar(64) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "zhs_faq_category_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "zhs_zone" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(64) NOT NULL,
	"code" varchar(32) NOT NULL,
	"parent_id" uuid,
	"level" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "zhs_zone_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "zhs_ai_user_model_chat_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"name" varchar(64) NOT NULL,
	"vendor" varchar(20) NOT NULL,
	"model_id" varchar(128) NOT NULL,
	"base_url" varchar(500),
	"api_key" varchar(256) NOT NULL,
	"temperature" real,
	"max_tokens" integer,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_ai_user_model_chat_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"config_id" uuid NOT NULL,
	"model" varchar(128) NOT NULL,
	"content" text NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_vendor_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_code" varchar(64) NOT NULL,
	"vendor_name" varchar(128) NOT NULL,
	"base_url" varchar(500) NOT NULL,
	"auth_type" varchar(32) NOT NULL,
	"key_env_name" varchar(100),
	"secret_key_env_name" varchar(100),
	"is_enabled" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"rate_limit" integer DEFAULT 100,
	"config_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_vendor_configs_vendor_code_unique" UNIQUE("vendor_code")
);
--> statement-breakpoint
CREATE TABLE "knowledge_base" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"summary" text,
	"content" text,
	"cover_image" varchar(500),
	"category_id" uuid,
	"author_id" uuid,
	"view_count" integer DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"icon" varchar(500),
	"category_id" uuid,
	"difficulty" integer DEFAULT 1 NOT NULL,
	"content" text,
	"author_id" uuid,
	"is_published" boolean DEFAULT false NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"group" varchar(50) NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_user_group_key_unique" UNIQUE("user_id","group","key")
);
--> statement-breakpoint
CREATE TABLE "fund_net_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fund_id" uuid NOT NULL,
	"date" date NOT NULL,
	"value" numeric(10, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(50),
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_funds_code" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "ai_feed_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text,
	"cover_image" varchar(500),
	"author_id" uuid,
	"view_count" integer DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_world_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"icon" varchar(500),
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_world_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid,
	"title" varchar(200) NOT NULL,
	"content" text,
	"cover_image" varchar(500),
	"author_id" uuid,
	"view_count" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_ai_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"input" text,
	"output" text,
	"status" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "security_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"ip" varchar(45),
	"user_agent" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "export_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"status" integer DEFAULT 0 NOT NULL,
	"file_url" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "content_generation_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"template_id" uuid,
	"input" text,
	"output" text,
	"status" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_generation_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"prompt" text,
	"category" varchar(50),
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"endpoint" varchar(500) NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "openclaw_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text,
	"cover_image" varchar(500),
	"author_id" uuid,
	"view_count" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(50) NOT NULL,
	"icon" varchar(500),
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"event" varchar(100) NOT NULL,
	"properties" jsonb,
	"ip" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"resource_type" varchar(50) NOT NULL,
	"resource_id" varchar(100) NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resource_likes_unique" UNIQUE("resource_type","resource_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "ai_aigc_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"status" integer DEFAULT 0 NOT NULL,
	"input" text,
	"output" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_careers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"company" varchar(100),
	"description" text,
	"salary" varchar(50),
	"location" varchar(100),
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_chat_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"icon" varchar(500),
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_community_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"title" varchar(200) NOT NULL,
	"content" text,
	"likes" integer DEFAULT 0 NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(200),
	"model_id" varchar(100),
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_ext_capabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"config" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_ext_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"content" text,
	"status" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_index_banners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(100),
	"image" varchar(500),
	"link" varchar(500),
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"avatar" varchar(500),
	"description" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "developer_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"status" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "developer_pricing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"period" varchar(50),
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "developer_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"pricing_id" uuid,
	"period" varchar(50),
	"start_time" timestamp with time zone DEFAULT now() NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"auto_renew" integer DEFAULT 0 NOT NULL,
	"order_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coze_chat_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bot_id" varchar(100) NOT NULL,
	"conversation_id" varchar(100) NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar(100) NOT NULL,
	"user_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"content" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_shares" ADD CONSTRAINT "file_shares_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_shares" ADD CONSTRAINT "file_shares_shared_by_users_id_fk" FOREIGN KEY ("shared_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_shares" ADD CONSTRAINT "file_shares_shared_with_users_id_fk" FOREIGN KEY ("shared_with") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_history" ADD CONSTRAINT "search_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_favorites" ADD CONSTRAINT "chat_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_favorites" ADD CONSTRAINT "chat_favorites_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_invitee_id_users_id_fk" FOREIGN KEY ("invitee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_logs" ADD CONSTRAINT "workflow_logs_instance_id_workflow_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."workflow_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_logs" ADD CONSTRAINT "workflow_logs_task_id_workflow_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."workflow_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_tasks" ADD CONSTRAINT "workflow_tasks_instance_id_workflow_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."workflow_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_participants" ADD CONSTRAINT "activity_participants_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_participants" ADD CONSTRAINT "activity_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_codes" ADD CONSTRAINT "invitation_codes_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_codes" ADD CONSTRAINT "invitation_codes_invitee_id_users_id_fk" FOREIGN KEY ("invitee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sign_in_records" ADD CONSTRAINT "sign_in_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_points" ADD CONSTRAINT "user_points_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs" ADD CONSTRAINT "docs_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_logs" ADD CONSTRAINT "api_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_configs" ADD CONSTRAINT "system_configs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_relations" ADD CONSTRAINT "tag_relations_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_relations" ADD CONSTRAINT "tag_relations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_favorites" ADD CONSTRAINT "user_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_following_id_users_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ask_answers" ADD CONSTRAINT "ask_answers_ask_id_asks_id_fk" FOREIGN KEY ("ask_id") REFERENCES "public"."asks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ask_answers" ADD CONSTRAINT "ask_answers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asks" ADD CONSTRAINT "asks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_posts" ADD CONSTRAINT "circle_posts_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_posts" ADD CONSTRAINT "circle_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circles" ADD CONSTRAINT "circles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_chapter_sections" ADD CONSTRAINT "lesson_chapter_sections_chapter_id_lesson_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."lesson_chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_chapters" ADD CONSTRAINT "lesson_chapters_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_sign_ups" ADD CONSTRAINT "lesson_sign_ups_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_sign_ups" ADD CONSTRAINT "lesson_sign_ups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_category_id_learn_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."learn_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_lecturer_id_users_id_fk" FOREIGN KEY ("lecturer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_papers" ADD CONSTRAINT "exam_papers_category_id_exam_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."exam_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_papers" ADD CONSTRAINT "exam_papers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_paper_id_exam_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."exam_papers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_records" ADD CONSTRAINT "exam_records_paper_id_exam_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."exam_papers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_records" ADD CONSTRAINT "exam_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_invoice_applications" ADD CONSTRAINT "edu_invoice_applications_order_id_edu_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."edu_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_invoice_applications" ADD CONSTRAINT "edu_invoice_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_invoice_applications" ADD CONSTRAINT "edu_invoice_applications_title_id_edu_invoice_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."edu_invoice_titles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_invoice_titles" ADD CONSTRAINT "edu_invoice_titles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_orders" ADD CONSTRAINT "edu_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_payments" ADD CONSTRAINT "edu_payments_order_id_edu_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."edu_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_payments" ADD CONSTRAINT "edu_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_refunds" ADD CONSTRAINT "edu_refunds_order_id_edu_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."edu_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_refunds" ADD CONSTRAINT "edu_refunds_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_channels" ADD CONSTRAINT "live_channels_category_id_live_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."live_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_channels" ADD CONSTRAINT "live_channels_lecturer_id_live_lecturers_id_fk" FOREIGN KEY ("lecturer_id") REFERENCES "public"."live_lecturers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_departments" ADD CONSTRAINT "edu_departments_company_id_edu_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."edu_companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_members" ADD CONSTRAINT "edu_members_level_id_edu_member_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."edu_member_levels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_members" ADD CONSTRAINT "edu_members_company_id_edu_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."edu_companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_members" ADD CONSTRAINT "edu_members_department_id_edu_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."edu_departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_products" ADD CONSTRAINT "resource_products_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_tag_relations" ADD CONSTRAINT "resource_tag_relations_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_tag_relations" ADD CONSTRAINT "resource_tag_relations_tag_id_resource_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."resource_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_category_id_resource_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."resource_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_point_channel_relations" ADD CONSTRAINT "edu_point_channel_relations_point_id_edu_points_id_fk" FOREIGN KEY ("point_id") REFERENCES "public"."edu_points"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_point_channel_relations" ADD CONSTRAINT "edu_point_channel_relations_channel_id_edu_point_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."edu_point_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_point_records" ADD CONSTRAINT "edu_point_records_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_points" ADD CONSTRAINT "edu_points_channel_id_edu_point_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."edu_point_channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_relations" ADD CONSTRAINT "department_relations_parent_dept_id_departments_id_fk" FOREIGN KEY ("parent_dept_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_relations" ADD CONSTRAINT "department_relations_child_dept_id_departments_id_fk" FOREIGN KEY ("child_dept_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_certificates" ADD CONSTRAINT "user_certificates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_logs" ADD CONSTRAINT "schedule_logs_task_id_schedule_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."schedule_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_messages" ADD CONSTRAINT "edu_messages_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_messages" ADD CONSTRAINT "edu_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "behavior_watch_records" ADD CONSTRAINT "behavior_watch_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_logs" ADD CONSTRAINT "visit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oss_drivers" ADD CONSTRAINT "oss_drivers_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_settings" ADD CONSTRAINT "edu_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_articles" ADD CONSTRAINT "news_articles_category_id_news_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."news_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_articles" ADD CONSTRAINT "news_articles_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificate_serial_numbers" ADD CONSTRAINT "certificate_serial_numbers_certificate_id_certificates_id_fk" FOREIGN KEY ("certificate_id") REFERENCES "public"."certificates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_template_id_certificate_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."certificate_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_flows" ADD CONSTRAINT "token_flows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_margins" ADD CONSTRAINT "user_margins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_flows" ADD CONSTRAINT "commission_flows_beneficiary_id_users_id_fk" FOREIGN KEY ("beneficiary_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_flows" ADD CONSTRAINT "commission_flows_invited_user_id_users_id_fk" FOREIGN KEY ("invited_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_flows" ADD CONSTRAINT "commission_flows_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal_flows" ADD CONSTRAINT "withdrawal_flows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_apps" ADD CONSTRAINT "oauth_apps_owner_uuid_users_id_fk" FOREIGN KEY ("owner_uuid") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_audit_logs" ADD CONSTRAINT "oauth_audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_sessions" ADD CONSTRAINT "oauth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_users" ADD CONSTRAINT "oauth_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sk" ADD CONSTRAINT "user_sk_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_third_party_accounts" ADD CONSTRAINT "user_third_party_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_vips" ADD CONSTRAINT "user_vips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_vips" ADD CONSTRAINT "user_vips_vip_level_id_vip_levels_id_fk" FOREIGN KEY ("vip_level_id") REFERENCES "public"."vip_levels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_vips" ADD CONSTRAINT "user_vips_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_notes" ADD CONSTRAINT "edu_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_offline_records" ADD CONSTRAINT "edu_offline_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_uploaded_certs" ADD CONSTRAINT "edu_uploaded_certs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_uploaded_certs" ADD CONSTRAINT "edu_uploaded_certs_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_uploaded_papers" ADD CONSTRAINT "edu_uploaded_papers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_uploaded_papers" ADD CONSTRAINT "edu_uploaded_papers_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_category_links" ADD CONSTRAINT "agent_category_links_agent_id_agents_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("agent_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_category_links" ADD CONSTRAINT "agent_category_links_category_id_agent_categories_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."agent_categories"("category_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_rule_link" ADD CONSTRAINT "agent_rule_link_rule_id_agent_rule_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."agent_rule"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_rule_param" ADD CONSTRAINT "agent_rule_param_rule_id_agent_rule_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."agent_rule"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_group_member_relations" ADD CONSTRAINT "member_group_member_relations_group_id_member_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."member_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_chapter_sections" ADD CONSTRAINT "exam_chapter_sections_chapter_id_exam_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."exam_chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_chapters" ADD CONSTRAINT "exam_chapters_paper_id_exam_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."exam_papers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_signups" ADD CONSTRAINT "exam_signups_paper_id_exam_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."exam_papers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learn_invoice_applications" ADD CONSTRAINT "learn_invoice_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learn_invoice_titles" ADD CONSTRAINT "learn_invoice_titles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_audit_records" ADD CONSTRAINT "refund_audit_records_order_id_edu_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."edu_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_audit_records" ADD CONSTRAINT "refund_audit_records_refund_id_edu_refunds_id_fk" FOREIGN KEY ("refund_id") REFERENCES "public"."edu_refunds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_audit_records" ADD CONSTRAINT "refund_audit_records_auditor_id_users_id_fk" FOREIGN KEY ("auditor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_service_agents" ADD CONSTRAINT "customer_service_agents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_service_comments" ADD CONSTRAINT "customer_service_comments_ticket_id_customer_service_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."customer_service_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_service_comments" ADD CONSTRAINT "customer_service_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_service_ratings" ADD CONSTRAINT "customer_service_ratings_ticket_id_customer_service_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."customer_service_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_service_ratings" ADD CONSTRAINT "customer_service_ratings_session_id_customer_service_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."customer_service_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_service_ratings" ADD CONSTRAINT "customer_service_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_service_ratings" ADD CONSTRAINT "customer_service_ratings_agent_id_customer_service_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."customer_service_agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_service_sessions" ADD CONSTRAINT "customer_service_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_service_sessions" ADD CONSTRAINT "customer_service_sessions_agent_id_customer_service_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."customer_service_agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_service_sessions" ADD CONSTRAINT "customer_service_sessions_transferred_to_customer_service_agents_id_fk" FOREIGN KEY ("transferred_to") REFERENCES "public"."customer_service_agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_service_tickets" ADD CONSTRAINT "customer_service_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_service_tickets" ADD CONSTRAINT "customer_service_tickets_category_id_customer_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."customer_service_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_service_tickets" ADD CONSTRAINT "customer_service_tickets_assignee_id_customer_service_agents_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."customer_service_agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_quotas" ADD CONSTRAINT "tenant_quotas_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_cost_records" ADD CONSTRAINT "ai_cost_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_feed_snapshot" ADD CONSTRAINT "ai_feed_snapshot_item_id_ai_feed_hot_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."ai_feed_hot_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_feed_trend_signal" ADD CONSTRAINT "ai_feed_trend_signal_item_id_ai_feed_hot_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."ai_feed_hot_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_gc_task" ADD CONSTRAINT "ai_gc_task_gc_content_id_ai_gc_content_id_fk" FOREIGN KEY ("gc_content_id") REFERENCES "public"."ai_gc_content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_members" ADD CONSTRAINT "circle_members_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_members" ADD CONSTRAINT "circle_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_post_comments" ADD CONSTRAINT "circle_post_comments_post_id_circle_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."circle_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_post_comments" ADD CONSTRAINT "circle_post_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_post_comments" ADD CONSTRAINT "circle_post_comments_reply_user_id_users_id_fk" FOREIGN KEY ("reply_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_post_likes" ADD CONSTRAINT "circle_post_likes_post_id_circle_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."circle_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_post_likes" ADD CONSTRAINT "circle_post_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ask_comments" ADD CONSTRAINT "ask_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ask_favorites" ADD CONSTRAINT "ask_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ask_likes" ADD CONSTRAINT "ask_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ask_question_categories" ADD CONSTRAINT "ask_question_categories_ask_id_asks_id_fk" FOREIGN KEY ("ask_id") REFERENCES "public"."asks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ask_question_categories" ADD CONSTRAINT "ask_question_categories_category_id_ask_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."ask_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_auth_info" ADD CONSTRAINT "user_auth_info_user_uuid_users_id_fk" FOREIGN KEY ("user_uuid") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_analyses" ADD CONSTRAINT "stock_analyses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remote_device_tasks" ADD CONSTRAINT "remote_device_tasks_device_id_remote_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."remote_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canary_audit_logs" ADD CONSTRAINT "canary_audit_logs_config_id_canary_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."canary_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_favorites" ADD CONSTRAINT "tool_favorites_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_api_keys" ADD CONSTRAINT "developer_api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traders" ADD CONSTRAINT "traders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_group_members" ADD CONSTRAINT "user_group_members_group_id_user_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."user_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_group_members" ADD CONSTRAINT "user_group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ab_test_results" ADD CONSTRAINT "ab_test_results_test_id_ab_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."ab_tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ab_test_results" ADD CONSTRAINT "ab_test_results_variant_id_ab_test_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."ab_test_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ab_test_variants" ADD CONSTRAINT "ab_test_variants_test_id_ab_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."ab_tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tour_content" ADD CONSTRAINT "tour_content_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tour_dependencies" ADD CONSTRAINT "tour_dependencies_content_id_tour_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."tour_content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tour_dependencies" ADD CONSTRAINT "tour_dependencies_depends_on_id_tour_content_id_fk" FOREIGN KEY ("depends_on_id") REFERENCES "public"."tour_content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tour_recommendations" ADD CONSTRAINT "tour_recommendations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tour_recommendations" ADD CONSTRAINT "tour_recommendations_content_id_tour_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."tour_content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_capabilities" ADD CONSTRAINT "ai_capabilities_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_crawler_articles" ADD CONSTRAINT "news_crawler_articles_source_id_news_crawler_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."news_crawler_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zhs_agent_buy" ADD CONSTRAINT "zhs_agent_buy_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zhs_agent_withdrawal_detail" ADD CONSTRAINT "zhs_agent_withdrawal_detail_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base" ADD CONSTRAINT "knowledge_base_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fund_net_values" ADD CONSTRAINT "fund_net_values_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."funds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_world_items" ADD CONSTRAINT "ai_world_items_category_id_ai_world_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."ai_world_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_ai_tasks" ADD CONSTRAINT "workspace_ai_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_logs" ADD CONSTRAINT "security_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_tasks" ADD CONSTRAINT "export_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_generation_tasks" ADD CONSTRAINT "content_generation_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_likes" ADD CONSTRAINT "resource_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_aigc_tasks" ADD CONSTRAINT "ai_aigc_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_community_posts" ADD CONSTRAINT "ai_community_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_ext_reports" ADD CONSTRAINT "ai_ext_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_applications" ADD CONSTRAINT "developer_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_subscriptions" ADD CONSTRAINT "developer_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_subscriptions" ADD CONSTRAINT "developer_subscriptions_pricing_id_developer_pricing_id_fk" FOREIGN KEY ("pricing_id") REFERENCES "public"."developer_pricing"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_subscriptions" ADD CONSTRAINT "developer_subscriptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_reviews" ADD CONSTRAINT "agent_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_pricing_model_idx" ON "ai_pricing" USING btree ("model_id");--> statement-breakpoint
CREATE INDEX "ai_pricing_effective_idx" ON "ai_pricing" USING btree ("effective_at");--> statement-breakpoint
CREATE INDEX "payment_configs_provider_idx" ON "payment_configs" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "learn_categories_pid_idx" ON "learn_categories" USING btree ("pid");--> statement-breakpoint
CREATE INDEX "lesson_chapter_sections_chapter_idx" ON "lesson_chapter_sections" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX "lesson_chapters_lesson_idx" ON "lesson_chapters" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "lesson_sign_ups_user_idx" ON "lesson_sign_ups" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "lessons_category_idx" ON "lessons" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "lessons_published_idx" ON "lessons" USING btree ("is_published");--> statement-breakpoint
CREATE INDEX "exam_categories_pid_idx" ON "exam_categories" USING btree ("pid");--> statement-breakpoint
CREATE INDEX "edu_invoice_applications_user_idx" ON "edu_invoice_applications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "edu_invoice_applications_status_idx" ON "edu_invoice_applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "edu_invoice_titles_user_idx" ON "edu_invoice_titles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "edu_orders_user_idx" ON "edu_orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "edu_orders_status_idx" ON "edu_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "edu_orders_type_idx" ON "edu_orders" USING btree ("order_type");--> statement-breakpoint
CREATE INDEX "edu_payments_user_idx" ON "edu_payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "edu_payments_order_idx" ON "edu_payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "edu_refunds_user_idx" ON "edu_refunds" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "edu_refunds_order_idx" ON "edu_refunds" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "live_categories_pid_idx" ON "live_categories" USING btree ("pid");--> statement-breakpoint
CREATE INDEX "live_channels_category_idx" ON "live_channels" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "live_channels_lecturer_idx" ON "live_channels" USING btree ("lecturer_id");--> statement-breakpoint
CREATE INDEX "live_channels_live_idx" ON "live_channels" USING btree ("is_live");--> statement-breakpoint
CREATE INDEX "live_lecturers_sort_idx" ON "live_lecturers" USING btree ("sort");--> statement-breakpoint
CREATE INDEX "edu_companies_sort_idx" ON "edu_companies" USING btree ("sort");--> statement-breakpoint
CREATE INDEX "edu_departments_company_idx" ON "edu_departments" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "edu_departments_pid_idx" ON "edu_departments" USING btree ("pid");--> statement-breakpoint
CREATE INDEX "edu_member_levels_sort_idx" ON "edu_member_levels" USING btree ("sort");--> statement-breakpoint
CREATE INDEX "edu_members_username_idx" ON "edu_members" USING btree ("username");--> statement-breakpoint
CREATE INDEX "edu_members_mobile_idx" ON "edu_members" USING btree ("mobile");--> statement-breakpoint
CREATE INDEX "edu_members_level_idx" ON "edu_members" USING btree ("level_id");--> statement-breakpoint
CREATE INDEX "resource_categories_pid_idx" ON "resource_categories" USING btree ("pid");--> statement-breakpoint
CREATE INDEX "resource_products_resource_idx" ON "resource_products" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "resources_category_idx" ON "resources" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "resources_published_idx" ON "resources" USING btree ("is_published");--> statement-breakpoint
CREATE INDEX "edu_point_channel_relations_point_idx" ON "edu_point_channel_relations" USING btree ("point_id");--> statement-breakpoint
CREATE INDEX "edu_point_channel_relations_channel_idx" ON "edu_point_channel_relations" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "edu_point_records_member_idx" ON "edu_point_records" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "edu_points_channel_idx" ON "edu_points" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "department_relations_parent_idx" ON "department_relations" USING btree ("parent_dept_id");--> statement-breakpoint
CREATE INDEX "department_relations_child_idx" ON "department_relations" USING btree ("child_dept_id");--> statement-breakpoint
CREATE INDEX "departments_pid_idx" ON "departments" USING btree ("pid");--> statement-breakpoint
CREATE INDEX "user_certificates_user_idx" ON "user_certificates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_profiles_dept_idx" ON "user_profiles" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "schedule_logs_task_idx" ON "schedule_logs" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "schedule_logs_status_idx" ON "schedule_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "schedule_tasks_enabled_idx" ON "schedule_tasks" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "schedule_tasks_priority_idx" ON "schedule_tasks" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "statistics_snapshots_type_idx" ON "statistics_snapshots" USING btree ("type");--> statement-breakpoint
CREATE INDEX "statistics_snapshots_created_idx" ON "statistics_snapshots" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "edu_announcements_published_idx" ON "edu_announcements" USING btree ("is_published");--> statement-breakpoint
CREATE INDEX "edu_announcements_status_idx" ON "edu_announcements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "edu_messages_member_idx" ON "edu_messages" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "edu_messages_member_read_idx" ON "edu_messages" USING btree ("member_id","is_read");--> statement-breakpoint
CREATE INDEX "edu_lesson_topics_published_idx" ON "edu_lesson_topics" USING btree ("is_published");--> statement-breakpoint
CREATE INDEX "edu_lesson_topics_status_idx" ON "edu_lesson_topics" USING btree ("status");--> statement-breakpoint
CREATE INDEX "behavior_watch_records_topic_idx" ON "behavior_watch_records" USING btree ("topic_id","topic_type");--> statement-breakpoint
CREATE INDEX "behavior_watch_records_user_idx" ON "behavior_watch_records" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "visit_logs_date_idx" ON "visit_logs" USING btree ("visit_date");--> statement-breakpoint
CREATE INDEX "visit_logs_ip_city_idx" ON "visit_logs" USING btree ("ip","city");--> statement-breakpoint
CREATE INDEX "oss_drivers_driver_idx" ON "oss_drivers" USING btree ("driver");--> statement-breakpoint
CREATE INDEX "oss_drivers_enabled_idx" ON "oss_drivers" USING btree ("is_enabled");--> statement-breakpoint
CREATE INDEX "edu_settings_group_idx" ON "edu_settings" USING btree ("group");--> statement-breakpoint
CREATE INDEX "edu_settings_group_key_idx" ON "edu_settings" USING btree ("group","key");--> statement-breakpoint
CREATE INDEX "edu_settings_public_idx" ON "edu_settings" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "news_articles_category_idx" ON "news_articles" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "news_articles_published_idx" ON "news_articles" USING btree ("is_published");--> statement-breakpoint
CREATE INDEX "news_categories_sort_idx" ON "news_categories" USING btree ("sort");--> statement-breakpoint
CREATE INDEX "certificate_serial_numbers_certificate_id_idx" ON "certificate_serial_numbers" USING btree ("certificate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "certificate_serial_numbers_serial_number_uniq" ON "certificate_serial_numbers" USING btree ("serial_number");--> statement-breakpoint
CREATE INDEX "certificate_templates_status_idx" ON "certificate_templates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "certificates_user_idx" ON "certificates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "certificates_template_idx" ON "certificates" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "certificates_no_idx" ON "certificates" USING btree ("certificate_no");--> statement-breakpoint
CREATE INDEX "commission_flows_beneficiary_idx" ON "commission_flows" USING btree ("beneficiary_id");--> statement-breakpoint
CREATE INDEX "commission_flows_invited_idx" ON "commission_flows" USING btree ("invited_user_id");--> statement-breakpoint
CREATE INDEX "commission_flows_status_idx" ON "commission_flows" USING btree ("status");--> statement-breakpoint
CREATE INDEX "withdrawal_flows_user_idx" ON "withdrawal_flows" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "withdrawal_flows_status_idx" ON "withdrawal_flows" USING btree ("status");--> statement-breakpoint
CREATE INDEX "oauth_apps_owner_idx" ON "oauth_apps" USING btree ("owner_uuid");--> statement-breakpoint
CREATE INDEX "oauth_audit_logs_client_idx" ON "oauth_audit_logs" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "oauth_audit_logs_user_idx" ON "oauth_audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oauth_sessions_user_idx" ON "oauth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oauth_users_user_idx" ON "oauth_users" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oauth_users_provider_idx" ON "oauth_users" USING btree ("provider","provider_user_id");--> statement-breakpoint
CREATE INDEX "user_sk_user_idx" ON "user_sk" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_third_party_user_idx" ON "user_third_party_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_third_party_platform_idx" ON "user_third_party_accounts" USING btree ("platform","open_id");--> statement-breakpoint
CREATE INDEX "user_vips_user_idx" ON "user_vips" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_vips_status_idx" ON "user_vips" USING btree ("status");--> statement-breakpoint
CREATE INDEX "vip_levels_status_idx" ON "vip_levels" USING btree ("status");--> statement-breakpoint
CREATE INDEX "captchas_key_idx" ON "captchas" USING btree ("captcha_key");--> statement-breakpoint
CREATE INDEX "sys_role_menu_menu_idx" ON "sys_role_menu" USING btree ("menu_id");--> statement-breakpoint
CREATE INDEX "agent_callbacks_agent_idx" ON "agent_callbacks" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_categories_status_idx" ON "agent_categories" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agent_category_links_agent_idx" ON "agent_category_links" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_category_links_category_idx" ON "agent_category_links" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "agent_configs_agent_idx" ON "agent_configs" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_examines_agent_idx" ON "agent_examines" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_examines_status_idx" ON "agent_examines" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agent_examines_user_idx" ON "agent_examines" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_heat_stats_agent_idx" ON "agent_heat_stats" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_settlements_agent_idx" ON "agent_settlements" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_settlements_status_idx" ON "agent_settlements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agent_settlements_order_no_idx" ON "agent_settlements" USING btree ("order_no");--> statement-breakpoint
CREATE INDEX "agents_user_idx" ON "agents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agents_category_idx" ON "agents" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "agents_status_idx" ON "agents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_rule_agent_id" ON "agent_rule" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "ix_agent_rule_status" ON "agent_rule" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_rule_link_rule_id" ON "agent_rule_link" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "idx_rule_link_target" ON "agent_rule_link" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "idx_rule_param_rule_id" ON "agent_rule_param" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "idx_agent_upload_agent_id" ON "agent_upload" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_agent_upload_user_id" ON "agent_upload" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "exam_chapter_sections_chapter_idx" ON "exam_chapter_sections" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX "exam_chapters_paper_idx" ON "exam_chapters" USING btree ("paper_id");--> statement-breakpoint
CREATE INDEX "exam_signups_paper_idx" ON "exam_signups" USING btree ("paper_id");--> statement-breakpoint
CREATE INDEX "exam_signups_user_idx" ON "exam_signups" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "exam_wrong_question_user_idx" ON "exam_wrong_question" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "exam_wrong_question_question_idx" ON "exam_wrong_question" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "learn_homework_lesson_idx" ON "learn_homework" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "learn_homework_chapter_idx" ON "learn_homework" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX "learn_invoice_applications_user_idx" ON "learn_invoice_applications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "learn_invoice_applications_status_idx" ON "learn_invoice_applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "learn_invoice_titles_user_idx" ON "learn_invoice_titles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "learn_maps_published_idx" ON "learn_maps" USING btree ("is_published");--> statement-breakpoint
CREATE INDEX "payment_callbacks_order_idx" ON "payment_callbacks" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "wx_pay_notifications_out_trade_no_idx" ON "wx_pay_notifications" USING btree ("out_trade_no");--> statement-breakpoint
CREATE INDEX "wx_pay_notifications_transaction_id_idx" ON "wx_pay_notifications" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "user_agent_free_times_user_uuid_idx" ON "user_agent_free_times" USING btree ("user_uuid");--> statement-breakpoint
CREATE INDEX "user_agent_free_times_agent_id_idx" ON "user_agent_free_times" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "zhs_user_agent_audio_user_uuid_idx" ON "zhs_user_agent_audio" USING btree ("user_uuid");--> statement-breakpoint
CREATE INDEX "zhs_user_agent_audio_agent_id_idx" ON "zhs_user_agent_audio" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "zhs_user_agent_context_user_uuid_idx" ON "zhs_user_agent_context" USING btree ("user_uuid");--> statement-breakpoint
CREATE INDEX "zhs_user_agent_context_user_id_idx" ON "zhs_user_agent_context" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "zhs_user_agent_context_agent_id_idx" ON "zhs_user_agent_context" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "zhs_user_agent_image_user_uuid_idx" ON "zhs_user_agent_image" USING btree ("user_uuid");--> statement-breakpoint
CREATE INDEX "zhs_user_agent_image_user_id_idx" ON "zhs_user_agent_image" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "zhs_user_agent_image_agent_id_idx" ON "zhs_user_agent_image" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "ix_oauth_private_keys_status" ON "oauth_private_keys" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ix_zhs_identity_status" ON "zhs_identity" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ix_zhs_organization_parent_id" ON "zhs_organization" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "ix_zhs_organization_status" ON "zhs_organization" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ix_ai_model_config_owner" ON "ai_model_config" USING btree ("owner_uuid");--> statement-breakpoint
CREATE INDEX "ix_ai_model_config_enabled" ON "ai_model_config" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "ix_ai_model_config_provider" ON "ai_model_config" USING btree ("provider_code");--> statement-breakpoint
CREATE INDEX "ix_user_sk_info_status" ON "user_sk_info" USING btree ("status");--> statement-breakpoint
CREATE INDEX "user_sk_info_user_uuid_idx" ON "user_sk_info" USING btree ("user_uuid");--> statement-breakpoint
CREATE INDEX "ix_video_generation_tasks_status" ON "video_generation_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "video_generation_tasks_user_uuid_idx" ON "video_generation_tasks" USING btree ("user_uuid");--> statement-breakpoint
CREATE INDEX "ix_gen_table_create_by" ON "gen_table" USING btree ("create_by");--> statement-breakpoint
CREATE INDEX "ix_gen_table_update_by" ON "gen_table" USING btree ("update_by");--> statement-breakpoint
CREATE INDEX "ix_gen_table_column_create_by" ON "gen_table_column" USING btree ("create_by");--> statement-breakpoint
CREATE INDEX "ix_gen_table_column_update_by" ON "gen_table_column" USING btree ("update_by");--> statement-breakpoint
CREATE INDEX "ix_tbox_bean_status" ON "tbox_bean" USING btree ("status");--> statement-breakpoint
CREATE INDEX "refund_audit_records_refund_idx" ON "refund_audit_records" USING btree ("refund_id");--> statement-breakpoint
CREATE INDEX "refund_audit_records_auditor_idx" ON "refund_audit_records" USING btree ("auditor_id");--> statement-breakpoint
CREATE INDEX "cs_agents_status_idx" ON "customer_service_agents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cs_categories_slug_idx" ON "customer_service_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "cs_comments_ticket_idx" ON "customer_service_comments" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "cs_ratings_ticket_idx" ON "customer_service_ratings" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "cs_ratings_session_idx" ON "customer_service_ratings" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "cs_sessions_user_idx" ON "customer_service_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cs_sessions_agent_idx" ON "customer_service_sessions" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "cs_sessions_status_idx" ON "customer_service_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cs_tickets_user_idx" ON "customer_service_tickets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cs_tickets_status_idx" ON "customer_service_tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cs_tickets_category_idx" ON "customer_service_tickets" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "cs_tickets_assignee_idx" ON "customer_service_tickets" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "ai_budget_scope_idx" ON "ai_budgets" USING btree ("scope","scope_key","model");--> statement-breakpoint
CREATE INDEX "ai_cost_user_idx" ON "ai_cost_records" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_cost_tenant_idx" ON "ai_cost_records" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "ai_cost_model_idx" ON "ai_cost_records" USING btree ("model");--> statement-breakpoint
CREATE INDEX "ai_cost_created_idx" ON "ai_cost_records" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ix_ai_feed_item_source" ON "ai_feed_hot_item" USING btree ("source_code");--> statement-breakpoint
CREATE INDEX "ix_ai_feed_item_category" ON "ai_feed_hot_item" USING btree ("llm_category");--> statement-breakpoint
CREATE INDEX "ix_ai_feed_item_trend" ON "ai_feed_hot_item" USING btree ("trend_tag");--> statement-breakpoint
CREATE INDEX "ix_ai_feed_item_hot" ON "ai_feed_hot_item" USING btree ("current_hot");--> statement-breakpoint
CREATE INDEX "ix_ai_feed_item_last_seen" ON "ai_feed_hot_item" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "ix_ai_feed_snapshot_source_date" ON "ai_feed_snapshot" USING btree ("source_code","snapshot_date");--> statement-breakpoint
CREATE INDEX "ix_ai_feed_snapshot_date" ON "ai_feed_snapshot" USING btree ("snapshot_date");--> statement-breakpoint
CREATE INDEX "ix_ai_feed_source_enabled" ON "ai_feed_source" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "ix_ai_feed_source_sort" ON "ai_feed_source" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "ix_ai_feed_trend_tag" ON "ai_feed_trend_signal" USING btree ("trend_tag");--> statement-breakpoint
CREATE INDEX "ix_ai_feed_trend_window" ON "ai_feed_trend_signal" USING btree ("window_days");--> statement-breakpoint
CREATE INDEX "ix_ai_edu_policy_level" ON "ai_education_policy" USING btree ("policy_level");--> statement-breakpoint
CREATE INDEX "ix_ai_edu_policy_status" ON "ai_education_policy" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ix_ai_teacher_cert_level" ON "ai_teacher_certification" USING btree ("level");--> statement-breakpoint
CREATE INDEX "ix_aigc_tool_category" ON "aigc_tool_detail" USING btree ("category");--> statement-breakpoint
CREATE INDEX "ix_aigc_tool_rating" ON "aigc_tool_detail" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "ix_k12_ai_curr_stage" ON "k12_ai_curriculum" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "ix_uni_ai_course_university" ON "university_ai_course" USING btree ("university");--> statement-breakpoint
CREATE INDEX "ix_uni_ai_course_type" ON "university_ai_course" USING btree ("course_type");--> statement-breakpoint
CREATE INDEX "ix_ai_gc_content_status" ON "ai_gc_content" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ix_ai_gc_content_user_uuid" ON "ai_gc_content" USING btree ("user_uuid");--> statement-breakpoint
CREATE INDEX "ix_ai_gc_task_gc_content" ON "ai_gc_task" USING btree ("gc_content_id");--> statement-breakpoint
CREATE INDEX "ix_ai_gc_task_user_uuid" ON "ai_gc_task" USING btree ("user_uuid");--> statement-breakpoint
CREATE INDEX "circle_categories_pid_idx" ON "circle_categories" USING btree ("pid");--> statement-breakpoint
CREATE INDEX "circle_members_circle_idx" ON "circle_members" USING btree ("circle_id");--> statement-breakpoint
CREATE INDEX "circle_members_user_idx" ON "circle_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "circle_members_status_idx" ON "circle_members" USING btree ("status");--> statement-breakpoint
CREATE INDEX "circle_post_comments_post_idx" ON "circle_post_comments" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "circle_post_comments_user_idx" ON "circle_post_comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "circle_post_comments_pid_idx" ON "circle_post_comments" USING btree ("pid");--> statement-breakpoint
CREATE INDEX "circle_post_likes_post_idx" ON "circle_post_likes" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "circle_post_likes_user_idx" ON "circle_post_likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ask_categories_pid_idx" ON "ask_categories" USING btree ("pid");--> statement-breakpoint
CREATE INDEX "ask_comments_target_idx" ON "ask_comments" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "ask_comments_user_idx" ON "ask_comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ask_comments_pid_idx" ON "ask_comments" USING btree ("pid");--> statement-breakpoint
CREATE INDEX "ask_favorites_user_target_idx" ON "ask_favorites" USING btree ("user_id","target_type","target_id");--> statement-breakpoint
CREATE INDEX "ask_favorites_target_idx" ON "ask_favorites" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "ask_likes_user_target_idx" ON "ask_likes" USING btree ("user_id","target_type","target_id");--> statement-breakpoint
CREATE INDEX "ask_likes_target_idx" ON "ask_likes" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "ask_question_categories_ask_idx" ON "ask_question_categories" USING btree ("ask_id");--> statement-breakpoint
CREATE INDEX "ask_question_categories_category_idx" ON "ask_question_categories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "learn_homework_record_member_idx" ON "learn_homework_record" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "learn_homework_record_lesson_idx" ON "learn_homework_record" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "learn_homework_record_signup_idx" ON "learn_homework_record" USING btree ("sign_up_id");--> statement-breakpoint
CREATE INDEX "learn_learn_map_topic_map_idx" ON "learn_learn_map_topic" USING btree ("learn_map_id");--> statement-breakpoint
CREATE INDEX "learn_learn_map_topic_topic_idx" ON "learn_learn_map_topic" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "learn_record_member_idx" ON "learn_record" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "learn_record_lesson_idx" ON "learn_record" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "learn_record_signup_idx" ON "learn_record" USING btree ("sign_up_id");--> statement-breakpoint
CREATE INDEX "learn_record_log_member_idx" ON "learn_record_log" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "learn_record_log_lesson_idx" ON "learn_record_log" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "learn_topic_status_idx" ON "learn_topic" USING btree ("status");--> statement-breakpoint
CREATE INDEX "learn_topic_lesson_topic_idx" ON "learn_topic_lesson" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "learn_topic_lesson_lesson_idx" ON "learn_topic_lesson" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "learn_topic_topic_category_relation_category_idx" ON "learn_topic_topic_category_relation" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "learn_topic_topic_category_relation_topic_idx" ON "learn_topic_topic_category_relation" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "lesson_access_lesson_idx" ON "lesson_access" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "lesson_rate_lesson_idx" ON "lesson_rate" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "lesson_rate_user_idx" ON "lesson_rate" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "lesson_task_lesson_idx" ON "lesson_task" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "lesson_task_chapter_idx" ON "lesson_task" USING btree ("lesson_chapter_id");--> statement-breakpoint
CREATE INDEX "ix_tbox_command_device_id" ON "tbox_command" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "ix_tbox_command_status" ON "tbox_command" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ix_tbox_device_device_no" ON "tbox_device" USING btree ("device_no");--> statement-breakpoint
CREATE INDEX "ix_tbox_device_user_id" ON "tbox_device" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_tbox_device_status" ON "tbox_device" USING btree ("status");--> statement-breakpoint
CREATE INDEX "srs_servers_active_idx" ON "srs_servers" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "srs_streams_key_idx" ON "srs_streams" USING btree ("stream_key");--> statement-breakpoint
CREATE INDEX "srs_streams_channel_idx" ON "srs_streams" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "srs_streams_status_idx" ON "srs_streams" USING btree ("status");--> statement-breakpoint
CREATE INDEX "remote_device_tasks_device_idx" ON "remote_device_tasks" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "remote_device_tasks_status_idx" ON "remote_device_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "remote_device_tasks_type_idx" ON "remote_device_tasks" USING btree ("task_type");--> statement-breakpoint
CREATE INDEX "remote_devices_no_idx" ON "remote_devices" USING btree ("device_no");--> statement-breakpoint
CREATE INDEX "remote_devices_status_idx" ON "remote_devices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "remote_devices_user_idx" ON "remote_devices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tool_favorites_user_tool_idx" ON "tool_favorites" USING btree ("user_id","tool_id");--> statement-breakpoint
CREATE INDEX "tools_category_idx" ON "tools" USING btree ("category");--> statement-breakpoint
CREATE INDEX "tools_status_idx" ON "tools" USING btree ("status");--> statement-breakpoint
CREATE INDEX "developer_api_keys_user_idx" ON "developer_api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "developer_api_keys_key_idx" ON "developer_api_keys" USING btree ("key");--> statement-breakpoint
CREATE INDEX "app_versions_platform_idx" ON "app_versions" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "app_versions_status_idx" ON "app_versions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "monitor_alerts_status_idx" ON "monitor_alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "monitor_alerts_source_idx" ON "monitor_alerts" USING btree ("source");--> statement-breakpoint
CREATE INDEX "monitor_alerts_severity_idx" ON "monitor_alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "suppression_rules_active_idx" ON "suppression_rules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "webhook_events_webhook_idx" ON "webhook_events" USING btree ("webhook_id");--> statement-breakpoint
CREATE INDEX "webhook_events_status_idx" ON "webhook_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "webhooks_user_idx" ON "webhooks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "webhooks_status_idx" ON "webhooks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "traders_status_idx" ON "traders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sdks_language_idx" ON "sdks" USING btree ("language");--> statement-breakpoint
CREATE INDEX "sdks_status_idx" ON "sdks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "miniprogram_configs_status_idx" ON "miniprogram_configs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "miniprogram_versions_app_idx" ON "miniprogram_versions" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "miniprogram_versions_status_idx" ON "miniprogram_versions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "product_identities_type_idx" ON "product_identities" USING btree ("type");--> statement-breakpoint
CREATE INDEX "product_identities_status_idx" ON "product_identities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "user_group_members_group_idx" ON "user_group_members" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "user_group_members_user_idx" ON "user_group_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_groups_owner_idx" ON "user_groups" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "user_groups_type_idx" ON "user_groups" USING btree ("type");--> statement-breakpoint
CREATE INDEX "api_key_quotas_key_idx" ON "api_key_quotas" USING btree ("api_key_id");--> statement-breakpoint
CREATE INDEX "audit_chain_entries_hash_idx" ON "audit_chain_entries" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "audit_chain_entries_created_idx" ON "audit_chain_entries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "outbox_events_status_idx" ON "outbox_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "outbox_events_created_idx" ON "outbox_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ab_test_results_test_idx" ON "ab_test_results" USING btree ("test_id");--> statement-breakpoint
CREATE INDEX "ab_test_results_variant_idx" ON "ab_test_results" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "ab_test_variants_test_idx" ON "ab_test_variants" USING btree ("test_id");--> statement-breakpoint
CREATE INDEX "ab_tests_status_idx" ON "ab_tests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tour_content_status_idx" ON "tour_content" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tour_content_type_idx" ON "tour_content" USING btree ("type");--> statement-breakpoint
CREATE INDEX "tour_content_destination_idx" ON "tour_content" USING btree ("destination");--> statement-breakpoint
CREATE INDEX "tour_dependencies_content_idx" ON "tour_dependencies" USING btree ("content_id");--> statement-breakpoint
CREATE INDEX "tour_dependencies_depends_on_idx" ON "tour_dependencies" USING btree ("depends_on_id");--> statement-breakpoint
CREATE INDEX "tour_events_status_idx" ON "tour_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tour_events_type_idx" ON "tour_events" USING btree ("type");--> statement-breakpoint
CREATE INDEX "tour_recommendations_user_idx" ON "tour_recommendations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tour_recommendations_content_idx" ON "tour_recommendations" USING btree ("content_id");--> statement-breakpoint
CREATE INDEX "ai_capabilities_category_idx" ON "ai_capabilities" USING btree ("category");--> statement-breakpoint
CREATE INDEX "ai_capabilities_provider_idx" ON "ai_capabilities" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "ai_capabilities_status_idx" ON "ai_capabilities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_capability_templates_category_idx" ON "ai_capability_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "news_crawler_articles_source_idx" ON "news_crawler_articles" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "news_crawler_articles_status_idx" ON "news_crawler_articles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "news_crawler_articles_dedupe_idx" ON "news_crawler_articles" USING btree ("dedupe_hash");--> statement-breakpoint
CREATE INDEX "news_crawler_sources_status_idx" ON "news_crawler_sources" USING btree ("status");--> statement-breakpoint
CREATE INDEX "news_crawler_sources_enabled_idx" ON "news_crawler_sources" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "user_memories_user_idx" ON "user_memories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_memories_type_idx" ON "user_memories" USING btree ("memory_type");--> statement-breakpoint
CREATE INDEX "user_memories_status_idx" ON "user_memories" USING btree ("status");--> statement-breakpoint
CREATE INDEX "user_memories_importance_idx" ON "user_memories" USING btree ("importance");--> statement-breakpoint
CREATE INDEX "agent_buy_scheduled_buy_idx" ON "agent_buy_scheduled_tasks" USING btree ("buy_id");--> statement-breakpoint
CREATE INDEX "agent_buy_scheduled_status_idx" ON "agent_buy_scheduled_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "zhs_agent_buy_agent_idx" ON "zhs_agent_buy" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "zhs_agent_buy_user_idx" ON "zhs_agent_buy" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "zhs_agent_buy_status_idx" ON "zhs_agent_buy" USING btree ("status");--> statement-breakpoint
CREATE INDEX "zhs_agent_withdrawal_user_idx" ON "zhs_agent_withdrawal_detail" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "zhs_agent_withdrawal_status_idx" ON "zhs_agent_withdrawal_detail" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sensitive_words_word_idx" ON "sensitive_words" USING btree ("word");--> statement-breakpoint
CREATE INDEX "sensitive_words_category_idx" ON "sensitive_words" USING btree ("category");--> statement-breakpoint
CREATE INDEX "agreements_type_idx" ON "agreements" USING btree ("type");--> statement-breakpoint
CREATE INDEX "agreements_status_idx" ON "agreements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "carousels_position_idx" ON "carousels" USING btree ("position");--> statement-breakpoint
CREATE INDEX "carousels_status_idx" ON "carousels" USING btree ("status");--> statement-breakpoint
CREATE INDEX "message_templates_channel_idx" ON "message_templates" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "message_templates_status_idx" ON "message_templates" USING btree ("status");--> statement-breakpoint
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
CREATE INDEX "live_tencent_cloud_live_stream_chan_idx" ON "live_tencent_cloud_live_stream" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "ix_admin_user_create_by" ON "admin_user" USING btree ("create_by");--> statement-breakpoint
CREATE INDEX "ix_admin_user_update_by" ON "admin_user" USING btree ("update_by");--> statement-breakpoint
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
CREATE INDEX "idx_esu_member" ON "exam_sign_up" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_esu_exam" ON "exam_sign_up" USING btree ("exam_id");--> statement-breakpoint
CREATE INDEX "idx_esu_status" ON "exam_sign_up" USING btree ("status");--> statement-breakpoint
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
CREATE INDEX "idx_mpl_sender" ON "message_private_letter" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "idx_mpl_receiver" ON "message_private_letter" USING btree ("receiver_id");--> statement-breakpoint
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
CREATE INDEX "idx_vs_target" ON "visit_stats" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "upload_sessions_upload_id_idx" ON "upload_sessions" USING btree ("upload_id");--> statement-breakpoint
CREATE INDEX "upload_sessions_user_idx" ON "upload_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "upload_sessions_status_idx" ON "upload_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "zhs_demand_square_status_idx" ON "zhs_demand_square" USING btree ("status");--> statement-breakpoint
CREATE INDEX "zhs_demand_square_type_idx" ON "zhs_demand_square" USING btree ("type");--> statement-breakpoint
CREATE INDEX "zhs_faq_category_id_idx" ON "zhs_faq" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "zhs_faq_pinned_idx" ON "zhs_faq" USING btree ("pinned");--> statement-breakpoint
CREATE INDEX "zhs_zone_parent_idx" ON "zhs_zone" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "zhs_zone_level_idx" ON "zhs_zone" USING btree ("level");--> statement-breakpoint
CREATE INDEX "zhs_ai_user_model_chat_config_user_idx" ON "zhs_ai_user_model_chat_config" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "zhs_ai_user_model_chat_history_user_idx" ON "zhs_ai_user_model_chat_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "zhs_ai_user_model_chat_history_config_idx" ON "zhs_ai_user_model_chat_history" USING btree ("config_id");--> statement-breakpoint
CREATE INDEX "ix_ai_vendor_configs_enabled" ON "ai_vendor_configs" USING btree ("is_enabled");--> statement-breakpoint
CREATE INDEX "ix_ai_vendor_configs_code" ON "ai_vendor_configs" USING btree ("vendor_code");--> statement-breakpoint
CREATE INDEX "ix_ai_vendor_configs_priority" ON "ai_vendor_configs" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "knowledge_base_category_idx" ON "knowledge_base" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "knowledge_base_author_idx" ON "knowledge_base" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "ix_fund_net_values_fund" ON "fund_net_values" USING btree ("fund_id");--> statement-breakpoint
CREATE INDEX "ix_ai_feed_posts_published" ON "ai_feed_posts" USING btree ("is_published");--> statement-breakpoint
CREATE INDEX "ix_ai_world_categories_sort" ON "ai_world_categories" USING btree ("sort");--> statement-breakpoint
CREATE INDEX "ix_ai_world_items_category" ON "ai_world_items" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "ix_workspace_ai_tasks_user" ON "workspace_ai_tasks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_workspace_ai_tasks_status" ON "workspace_ai_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "security_logs_user_idx" ON "security_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "export_tasks_user_idx" ON "export_tasks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "content_generation_tasks_user_idx" ON "content_generation_tasks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "openclaw_items_author_idx" ON "openclaw_items" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "analytics_events_user_idx" ON "analytics_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "resource_likes_user_id_idx" ON "resource_likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_ai_aigc_tasks_user" ON "ai_aigc_tasks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_ai_aigc_tasks_status" ON "ai_aigc_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ix_ai_careers_status" ON "ai_careers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ix_ai_chat_types_status" ON "ai_chat_types" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ix_ai_community_posts_user" ON "ai_community_posts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_ai_community_posts_status" ON "ai_community_posts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ix_ai_conversations_user" ON "ai_conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_ai_ext_reports_user" ON "ai_ext_reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_ai_index_banners_status" ON "ai_index_banners" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ix_ai_team_members_status" ON "ai_team_members" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ix_developer_applications_user" ON "developer_applications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_developer_applications_status" ON "developer_applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ix_developer_pricing_status" ON "developer_pricing" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ix_developer_subscriptions_user" ON "developer_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_developer_subscriptions_status" ON "developer_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ix_coze_chat_history_bot_conv" ON "coze_chat_history" USING btree ("bot_id","conversation_id");--> statement-breakpoint
CREATE INDEX "ix_agent_reviews_agent" ON "agent_reviews" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "ix_agent_reviews_user" ON "agent_reviews" USING btree ("user_id");