-- Wave 16: Learn module (courses/lessons/chapters/signups)
CREATE TABLE IF NOT EXISTS "learn_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(100) NOT NULL,
  "pid" uuid,
  "sort" integer DEFAULT 0 NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "learn_categories_pid_idx" ON "learn_categories"("pid");

CREATE TABLE IF NOT EXISTS "lessons" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" varchar(200) NOT NULL,
  "cover_image" varchar(512),
  "intro" text,
  "category_id" uuid REFERENCES "learn_categories"("id") ON DELETE SET NULL,
  "lecturer_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "lecturer_name" varchar(100),
  "price" numeric(10,2) DEFAULT '0' NOT NULL,
  "original_price" numeric(10,2),
  "is_free" boolean DEFAULT false NOT NULL,
  "is_published" boolean DEFAULT false NOT NULL,
  "sort" integer DEFAULT 0 NOT NULL,
  "view_count" integer DEFAULT 0 NOT NULL,
  "signup_count" integer DEFAULT 0 NOT NULL,
  "lesson_count" integer DEFAULT 0 NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "lessons_category_idx" ON "lessons"("category_id");
CREATE INDEX IF NOT EXISTS "lessons_published_idx" ON "lessons"("is_published");

CREATE TABLE IF NOT EXISTS "lesson_chapters" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lesson_id" uuid NOT NULL REFERENCES "lessons"("id") ON DELETE CASCADE,
  "title" varchar(200) NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "lesson_chapters_lesson_idx" ON "lesson_chapters"("lesson_id");

CREATE TABLE IF NOT EXISTS "lesson_chapter_sections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chapter_id" uuid NOT NULL REFERENCES "lesson_chapters"("id") ON DELETE CASCADE,
  "title" varchar(200) NOT NULL,
  "content" text,
  "video_url" varchar(512),
  "duration" integer DEFAULT 0 NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_free" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "lesson_chapter_sections_chapter_idx" ON "lesson_chapter_sections"("chapter_id");

CREATE TABLE IF NOT EXISTS "lesson_sign_ups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lesson_id" uuid NOT NULL REFERENCES "lessons"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" integer DEFAULT 1 NOT NULL,
  "progress" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "lesson_sign_ups_lesson_user_unique" UNIQUE("lesson_id","user_id")
);
CREATE INDEX IF NOT EXISTS "lesson_sign_ups_user_idx" ON "lesson_sign_ups"("user_id");
