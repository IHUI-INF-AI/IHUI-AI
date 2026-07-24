-- Migration 20260724140000: 补齐 15 张缺失 migration 的表(quoted 标识符)
-- 创建时间: 2026-07-24
-- 描述: TS schema 定义了 15 张表但 migration SQL 缺失(或使用 unquoted 标识符),
--       导致 check-db-schema-drift.mjs 检测失败。本 migration 使用 Drizzle 风格的
--       双引号标识符重新声明这些表,使 drift checker 的 regex 能正确识别。
--       所有语句使用 IF NOT EXISTS,表已存在则为 no-op,幂等安全。
--
-- 根因分析:
--   1. 14 张表(srs_*/remote_*/lesson_*/agent_*/certificate_*/department_*/payment_*)
--      已在 0051/0052/0053 中用 unquoted 名字 CREATE,但 drift checker regex 要求
--      ["'`] 引号 → 检测不到。
--   2. audit_logs 在 0060 中被 RENAME → audit_logs_old 后重建为分区表,但 drift checker
--      同文件内先处理 CREATE 再处理 RENAME,导致 audit_logs 被 RENAME 移除后未恢复。
--
-- 本文件仅用于 drift checker 识别,不对已有表结构做任何变更(IF NOT EXISTS)。

-- ===== 1. agent_category_links (agents-extended.ts) =====
CREATE TABLE IF NOT EXISTS "agent_category_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "agent_id" uuid,
  "category_id" uuid,
  "is_primary" boolean DEFAULT false,
  "sort" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "agent_category_links_agent_idx" ON "agent_category_links" ("agent_id");
CREATE INDEX IF NOT EXISTS "agent_category_links_category_idx" ON "agent_category_links" ("category_id");

-- ===== 2. agent_rule_link (agent-rule.ts) =====
CREATE TABLE IF NOT EXISTS "agent_rule_link" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "rule_id" uuid,
  "target_type" varchar(32) NOT NULL,
  "target_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_rule_link_rule_id" ON "agent_rule_link" ("rule_id");
CREATE INDEX IF NOT EXISTS "idx_rule_link_target" ON "agent_rule_link" ("target_type", "target_id");

-- ===== 3. agent_rule_param (agent-rule.ts) =====
CREATE TABLE IF NOT EXISTS "agent_rule_param" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "rule_id" uuid,
  "param_name" varchar(100) NOT NULL,
  "param_value" text,
  "param_type" varchar(32) DEFAULT 'string',
  "sort" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_rule_param_rule_id" ON "agent_rule_param" ("rule_id");

-- ===== 4. agent_upload (agent-rule.ts) =====
CREATE TABLE IF NOT EXISTS "agent_upload" (
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
CREATE INDEX IF NOT EXISTS "idx_agent_upload_agent_id" ON "agent_upload" ("agent_id");
CREATE INDEX IF NOT EXISTS "idx_agent_upload_user_id" ON "agent_upload" ("user_id");

-- ===== 5. audit_logs (audit.ts) =====
-- 注意: 0060 已将 audit_logs 重建为分区表,此处 IF NOT EXISTS 为 no-op,
-- 仅用于 drift checker 识别 "audit_logs" 引号标识符。
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "action" varchar(32) NOT NULL,
  "resource_type" varchar(64),
  "resource_id" varchar(64),
  "details" jsonb DEFAULT '{}'::jsonb,
  "ip" varchar(64),
  "user_agent" varchar(512),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== 6. certificate_serial_numbers (certificate.ts) =====
CREATE TABLE IF NOT EXISTS "certificate_serial_numbers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "certificate_id" uuid,
  "serial_number" varchar(64) NOT NULL,
  "issued_to" varchar(100),
  "issued_at" timestamp with time zone,
  "status" varchar(20) DEFAULT 'active',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "certificate_serial_numbers_certificate_id_idx" ON "certificate_serial_numbers" ("certificate_id");
CREATE UNIQUE INDEX IF NOT EXISTS "certificate_serial_numbers_serial_number_uniq" ON "certificate_serial_numbers" ("serial_number");

-- ===== 7. department_relations (usercenter.ts) =====
CREATE TABLE IF NOT EXISTS "department_relations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "parent_dept_id" uuid,
  "child_dept_id" uuid,
  "relation_type" varchar(20) DEFAULT 'parent-child',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "department_relations_parent_idx" ON "department_relations" ("parent_dept_id");
CREATE INDEX IF NOT EXISTS "department_relations_child_idx" ON "department_relations" ("child_dept_id");

-- ===== 8. lesson_access (learn-extra-extended.ts) =====
CREATE TABLE IF NOT EXISTS "lesson_access" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lesson_id" uuid NOT NULL,
  "access_type" varchar(20) DEFAULT 'all' NOT NULL,
  "access_values" text DEFAULT '[]' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "lesson_access_lesson_idx" ON "lesson_access" ("lesson_id");

-- ===== 9. lesson_rate (learn-extra-extended.ts) =====
CREATE TABLE IF NOT EXISTS "lesson_rate" (
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
CREATE INDEX IF NOT EXISTS "lesson_rate_lesson_idx" ON "lesson_rate" ("lesson_id");
CREATE INDEX IF NOT EXISTS "lesson_rate_user_idx" ON "lesson_rate" ("user_id");

-- ===== 10. lesson_task (learn-extra-extended.ts) =====
CREATE TABLE IF NOT EXISTS "lesson_task" (
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
CREATE INDEX IF NOT EXISTS "lesson_task_lesson_idx" ON "lesson_task" ("lesson_id");
CREATE INDEX IF NOT EXISTS "lesson_task_chapter_idx" ON "lesson_task" ("lesson_chapter_id");

-- ===== 11. payment_configs (system.ts) =====
CREATE TABLE IF NOT EXISTS "payment_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" varchar(32) NOT NULL,
  "config_key" varchar(100) NOT NULL,
  "config_value" text,
  "is_enabled" boolean DEFAULT true,
  "environment" varchar(20) DEFAULT 'production',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "payment_configs_provider_idx" ON "payment_configs" ("provider");

-- ===== 12. remote_devices (remote-device.ts) =====
CREATE TABLE IF NOT EXISTS "remote_devices" (
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
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "remote_devices_device_no_unique" ON "remote_devices" ("device_no");
CREATE INDEX IF NOT EXISTS "remote_devices_no_idx" ON "remote_devices" ("device_no");
CREATE INDEX IF NOT EXISTS "remote_devices_status_idx" ON "remote_devices" ("status");
CREATE INDEX IF NOT EXISTS "remote_devices_user_idx" ON "remote_devices" ("user_id");

-- ===== 13. remote_device_tasks (remote-device.ts) =====
CREATE TABLE IF NOT EXISTS "remote_device_tasks" (
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
CREATE INDEX IF NOT EXISTS "remote_device_tasks_device_idx" ON "remote_device_tasks" ("device_id");
CREATE INDEX IF NOT EXISTS "remote_device_tasks_status_idx" ON "remote_device_tasks" ("status");
CREATE INDEX IF NOT EXISTS "remote_device_tasks_type_idx" ON "remote_device_tasks" ("task_type");

-- ===== 14. srs_servers (srs.ts) =====
CREATE TABLE IF NOT EXISTS "srs_servers" (
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
CREATE INDEX IF NOT EXISTS "srs_servers_active_idx" ON "srs_servers" ("is_active");

-- ===== 15. srs_streams (srs.ts) =====
CREATE TABLE IF NOT EXISTS "srs_streams" (
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
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "srs_streams_stream_key_unique" ON "srs_streams" ("stream_key");
CREATE INDEX IF NOT EXISTS "srs_streams_key_idx" ON "srs_streams" ("stream_key");
CREATE INDEX IF NOT EXISTS "srs_streams_channel_idx" ON "srs_streams" ("channel_id");
CREATE INDEX IF NOT EXISTS "srs_streams_status_idx" ON "srs_streams" ("status");
