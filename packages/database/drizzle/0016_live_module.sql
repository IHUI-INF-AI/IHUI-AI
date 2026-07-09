-- Wave 17: Live module (categories + lecturers + channels)
CREATE TABLE IF NOT EXISTS "live_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(100) NOT NULL,
  "pid" uuid,
  "sort" integer DEFAULT 0 NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "live_categories_pid_idx" ON "live_categories"("pid");

CREATE TABLE IF NOT EXISTS "live_lecturers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(100) NOT NULL,
  "avatar" varchar(500),
  "title" varchar(200),
  "intro" text,
  "sort" integer DEFAULT 0 NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "live_lecturers_sort_idx" ON "live_lecturers"("sort");

CREATE TABLE IF NOT EXISTS "live_channels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" varchar(200) NOT NULL,
  "cover_image" varchar(500),
  "intro" text,
  "category_id" uuid REFERENCES "live_categories"("id") ON DELETE SET NULL,
  "lecturer_id" uuid REFERENCES "live_lecturers"("id") ON DELETE SET NULL,
  "lecturer_name" varchar(100),
  "push_url" varchar(500),
  "play_url" varchar(500),
  "start_time" timestamptz,
  "end_time" timestamptz,
  "is_live" boolean DEFAULT false NOT NULL,
  "is_published" boolean DEFAULT false NOT NULL,
  "view_count" integer DEFAULT 0 NOT NULL,
  "sort" integer DEFAULT 0 NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "live_channels_category_idx" ON "live_channels"("category_id");
CREATE INDEX IF NOT EXISTS "live_channels_lecturer_idx" ON "live_channels"("lecturer_id");
CREATE INDEX IF NOT EXISTS "live_channels_live_idx" ON "live_channels"("is_live");
