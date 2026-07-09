-- News module (资讯分类 + 文章)
CREATE TABLE IF NOT EXISTS "news_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(100) NOT NULL,
  "sort" integer DEFAULT 0 NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "news_categories_sort_idx" ON "news_categories"("sort");

CREATE TABLE IF NOT EXISTS "news_articles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "category_id" uuid REFERENCES "news_categories"("id") ON DELETE SET NULL,
  "title" varchar(200) NOT NULL,
  "summary" varchar(500),
  "content" text NOT NULL,
  "cover_image" varchar(512),
  "author_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "author_name" varchar(100),
  "is_published" boolean DEFAULT false NOT NULL,
  "is_pinned" boolean DEFAULT false NOT NULL,
  "view_count" integer DEFAULT 0 NOT NULL,
  "sort" integer DEFAULT 0 NOT NULL,
  "status" integer DEFAULT 0 NOT NULL,
  "published_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "news_articles_category_idx" ON "news_articles"("category_id");
CREATE INDEX IF NOT EXISTS "news_articles_published_idx" ON "news_articles"("is_published");

-- Certificate module (证书模板 + 发放记录)
CREATE TABLE IF NOT EXISTS "certificate_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(200) NOT NULL,
  "description" text,
  "background_image" varchar(512),
  "template_config" jsonb,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "certificate_templates_status_idx" ON "certificate_templates"("status");

CREATE TABLE IF NOT EXISTS "certificates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "template_id" uuid REFERENCES "certificate_templates"("id") ON DELETE SET NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "certificate_no" varchar(100) NOT NULL,
  "title" varchar(200) NOT NULL,
  "recipient_name" varchar(100),
  "source" varchar(20) DEFAULT 'manual' NOT NULL,
  "source_id" uuid,
  "issued_at" timestamptz DEFAULT now() NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "certificates_user_idx" ON "certificates"("user_id");
CREATE INDEX IF NOT EXISTS "certificates_template_idx" ON "certificates"("template_id");
CREATE INDEX IF NOT EXISTS "certificates_no_idx" ON "certificates"("certificate_no");
