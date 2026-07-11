-- 0046_missing_tables_h3.sql
-- 补建历史项目缺失的 9 张表（订单明细/资源下载/资源搜索/用户岗位/企业会员关联等）
-- 依据：历史项目 init_database.sql 与新项目 schema 深度比对结果

-- 1. 订单明细表
CREATE TABLE IF NOT EXISTS "edu_order_items" (
  "id" serial PRIMARY KEY,
  "order_id" integer NOT NULL,
  "product_id" integer,
  "product_name" varchar(255),
  "quantity" integer DEFAULT 1,
  "price" decimal(10, 2),
  "subtotal" decimal(10, 2),
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "edu_order_items_order_id_idx" ON "edu_order_items" ("order_id");

-- 2. 资源下载记录表
CREATE TABLE IF NOT EXISTS "resource_downloads" (
  "id" serial PRIMARY KEY,
  "resource_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "ip" varchar(45),
  "user_agent" text,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "resource_downloads_resource_id_idx" ON "resource_downloads" ("resource_id");
CREATE INDEX IF NOT EXISTS "resource_downloads_user_id_idx" ON "resource_downloads" ("user_id");

-- 3. 资源搜索记录表
CREATE TABLE IF NOT EXISTS "resource_search_logs" (
  "id" serial PRIMARY KEY,
  "user_id" integer,
  "keyword" varchar(255),
  "result_count" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "resource_search_logs_user_id_idx" ON "resource_search_logs" ("user_id");
CREATE INDEX IF NOT EXISTS "resource_search_logs_keyword_idx" ON "resource_search_logs" ("keyword");

-- 4. 用户岗位关联表
CREATE TABLE IF NOT EXISTS "user_jobs" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL,
  "job_id" integer NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "user_jobs_user_id_idx" ON "user_jobs" ("user_id");
CREATE INDEX IF NOT EXISTS "user_jobs_job_id_idx" ON "user_jobs" ("job_id");

-- 5. 企业会员关联表
CREATE TABLE IF NOT EXISTS "edu_member_company_relations" (
  "id" serial PRIMARY KEY,
  "member_id" integer NOT NULL,
  "company_id" integer NOT NULL,
  "position" varchar(100),
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "edu_member_company_relations_member_id_idx" ON "edu_member_company_relations" ("member_id");
CREATE INDEX IF NOT EXISTS "edu_member_company_relations_company_id_idx" ON "edu_member_company_relations" ("company_id");

-- 6. 会员等级关联表
CREATE TABLE IF NOT EXISTS "edu_member_level_relations" (
  "id" serial PRIMARY KEY,
  "member_id" integer NOT NULL,
  "level_id" integer NOT NULL,
  "start_date" timestamptz,
  "end_date" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "edu_member_level_relations_member_id_idx" ON "edu_member_level_relations" ("member_id");

-- 7. 会员岗位关联表
CREATE TABLE IF NOT EXISTS "edu_member_post_relations" (
  "id" serial PRIMARY KEY,
  "member_id" integer NOT NULL,
  "post_id" integer NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "edu_member_post_relations_member_id_idx" ON "edu_member_post_relations" ("member_id");

-- 8. 会员标签关联表
CREATE TABLE IF NOT EXISTS "edu_member_tag_relations" (
  "id" serial PRIMARY KEY,
  "member_id" integer NOT NULL,
  "tag_id" integer NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "edu_member_tag_relations_member_id_idx" ON "edu_member_tag_relations" ("member_id");

-- 9. 资源产品关联表
CREATE TABLE IF NOT EXISTS "edu_resource_product_relations" (
  "id" serial PRIMARY KEY,
  "resource_id" integer NOT NULL,
  "product_id" integer NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "edu_resource_product_relations_resource_id_idx" ON "edu_resource_product_relations" ("resource_id");
CREATE INDEX IF NOT EXISTS "edu_resource_product_relations_product_id_idx" ON "edu_resource_product_relations" ("product_id");
