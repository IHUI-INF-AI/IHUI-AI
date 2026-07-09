-- Wave 16: Community module (circles + asks)
CREATE TABLE IF NOT EXISTS "circles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(100) NOT NULL,
  "slug" varchar(120) NOT NULL UNIQUE,
  "description" text,
  "cover_image" varchar(512),
  "category_id" uuid,
  "member_count" integer DEFAULT 0 NOT NULL,
  "post_count" integer DEFAULT 0 NOT NULL,
  "is_published" boolean DEFAULT true NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "circle_posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "circle_id" uuid NOT NULL REFERENCES "circles"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" varchar(200) NOT NULL,
  "content" text NOT NULL,
  "images" jsonb,
  "view_count" integer DEFAULT 0 NOT NULL,
  "like_count" integer DEFAULT 0 NOT NULL,
  "reply_count" integer DEFAULT 0 NOT NULL,
  "is_pinned" boolean DEFAULT false NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "circle_posts_circle_idx" ON "circle_posts"("circle_id");
CREATE INDEX IF NOT EXISTS "circle_posts_user_idx" ON "circle_posts"("user_id");

CREATE TABLE IF NOT EXISTS "asks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" varchar(200) NOT NULL,
  "content" text NOT NULL,
  "tags" jsonb,
  "view_count" integer DEFAULT 0 NOT NULL,
  "answer_count" integer DEFAULT 0 NOT NULL,
  "like_count" integer DEFAULT 0 NOT NULL,
  "is_resolved" boolean DEFAULT false NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "asks_user_idx" ON "asks"("user_id");

CREATE TABLE IF NOT EXISTS "ask_answers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ask_id" uuid NOT NULL REFERENCES "asks"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "content" text NOT NULL,
  "like_count" integer DEFAULT 0 NOT NULL,
  "is_accepted" boolean DEFAULT false NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ask_answers_ask_idx" ON "ask_answers"("ask_id");
CREATE INDEX IF NOT EXISTS "ask_answers_user_idx" ON "ask_answers"("user_id");
