-- Wave 25: Behavior 模块 (浏览记录表)
CREATE TABLE IF NOT EXISTS "behavior_watch_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "topic_id" varchar(128) NOT NULL,
  "topic_type" varchar(50) NOT NULL,
  "topic_title" varchar(200),
  "watch_duration" integer DEFAULT 0 NOT NULL,
  "last_position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "behavior_watch_records_user_topic_unique" UNIQUE("user_id","topic_id","topic_type")
);
CREATE INDEX IF NOT EXISTS "behavior_watch_records_topic_idx" ON "behavior_watch_records"("topic_id","topic_type");
CREATE INDEX IF NOT EXISTS "behavior_watch_records_user_idx" ON "behavior_watch_records"("user_id");
