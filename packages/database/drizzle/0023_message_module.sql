-- Wave 23: 教育平台 Message 模块（公告 + 站内消息，与通用 notifications 区分）

CREATE TABLE IF NOT EXISTS "edu_announcements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" varchar(200) NOT NULL,
  "content" text,
  "is_published" boolean DEFAULT false NOT NULL,
  "is_top" boolean DEFAULT false NOT NULL,
  "publish_time" timestamptz,
  "sort" integer DEFAULT 0 NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "edu_announcements_published_idx" ON "edu_announcements"("is_published");
CREATE INDEX IF NOT EXISTS "edu_announcements_status_idx" ON "edu_announcements"("status");

CREATE TABLE IF NOT EXISTS "edu_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "member_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "sender_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "title" varchar(200),
  "content" text,
  "msg_type" varchar(32) DEFAULT 'system' NOT NULL,
  "is_read" boolean DEFAULT false NOT NULL,
  "ref_id" varchar(64),
  "ref_type" varchar(32),
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "edu_messages_member_idx" ON "edu_messages"("member_id");
CREATE INDEX IF NOT EXISTS "edu_messages_member_read_idx" ON "edu_messages"("member_id", "is_read");
