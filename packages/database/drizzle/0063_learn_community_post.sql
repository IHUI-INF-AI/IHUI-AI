-- 课程讨论帖表 (社区/学习圈讨论)
-- 对应 schema: packages/database/src/schema/learn-extra-extended.ts learnCommunityPost

CREATE TABLE IF NOT EXISTS "learn_community_post" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "lesson_id" uuid,
  "title" varchar(200) NOT NULL,
  "content" text,
  "is_pinned" boolean DEFAULT false NOT NULL,
  "status" varchar(20) DEFAULT 'published' NOT NULL,
  "reply_count" integer DEFAULT 0 NOT NULL,
  "view_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "learn_community_post_user_idx" ON "learn_community_post" ("user_id");
CREATE INDEX IF NOT EXISTS "learn_community_post_lesson_idx" ON "learn_community_post" ("lesson_id");
CREATE INDEX IF NOT EXISTS "learn_community_post_status_idx" ON "learn_community_post" ("status");
