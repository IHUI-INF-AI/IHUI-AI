-- Wave 18: Resource module (categories/resources/products/tags)
CREATE TABLE IF NOT EXISTS "resource_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(100) NOT NULL,
  "pid" uuid,
  "sort" integer DEFAULT 0 NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "resource_categories_pid_idx" ON "resource_categories"("pid");

CREATE TABLE IF NOT EXISTS "resources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" varchar(200) NOT NULL,
  "cover_image" varchar(500),
  "intro" text,
  "category_id" uuid REFERENCES "resource_categories"("id") ON DELETE SET NULL,
  "file_url" varchar(500),
  "file_type" varchar(50),
  "file_size" integer DEFAULT 0 NOT NULL,
  "is_published" boolean DEFAULT false NOT NULL,
  "view_count" integer DEFAULT 0 NOT NULL,
  "download_count" integer DEFAULT 0 NOT NULL,
  "sort" integer DEFAULT 0 NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "resources_category_idx" ON "resources"("category_id");
CREATE INDEX IF NOT EXISTS "resources_published_idx" ON "resources"("is_published");

CREATE TABLE IF NOT EXISTS "resource_products" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "resource_id" uuid NOT NULL REFERENCES "resources"("id") ON DELETE CASCADE,
  "name" varchar(200) NOT NULL,
  "price" numeric(10,2) DEFAULT '0' NOT NULL,
  "original_price" numeric(10,2),
  "description" text,
  "is_published" boolean DEFAULT false NOT NULL,
  "sort" integer DEFAULT 0 NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "resource_products_resource_idx" ON "resource_products"("resource_id");

CREATE TABLE IF NOT EXISTS "resource_tags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(100) NOT NULL,
  "sort" integer DEFAULT 0 NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
