-- 0039: 补齐 circle/ask/search 模块子表 (4 + 5 + 2 = 11 张)

-- ========== circle 模块 ==========

-- 圈子分类
CREATE TABLE IF NOT EXISTS "circle_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "pid" uuid,
  "name" varchar(100) NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_show" boolean DEFAULT true NOT NULL,
  "icon" varchar(500),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "circle_categories_pid_idx" ON "circle_categories" ("pid");

-- 圈子成员
CREATE TABLE IF NOT EXISTS "circle_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "circle_id" uuid NOT NULL REFERENCES "circles"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" varchar(20) DEFAULT 'member' NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "circle_members_circle_idx" ON "circle_members" ("circle_id");
CREATE INDEX IF NOT EXISTS "circle_members_user_idx" ON "circle_members" ("user_id");
CREATE INDEX IF NOT EXISTS "circle_members_status_idx" ON "circle_members" ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "circle_member_user_uniq" ON "circle_members" ("circle_id", "user_id");

-- 圈子帖子点赞
CREATE TABLE IF NOT EXISTS "circle_post_likes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "post_id" uuid NOT NULL REFERENCES "circle_posts"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "circle_post_likes_post_idx" ON "circle_post_likes" ("post_id");
CREATE INDEX IF NOT EXISTS "circle_post_likes_user_idx" ON "circle_post_likes" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "circle_post_like_uniq" ON "circle_post_likes" ("post_id", "user_id");

-- 圈子帖子评论
CREATE TABLE IF NOT EXISTS "circle_post_comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "post_id" uuid NOT NULL REFERENCES "circle_posts"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "content" text NOT NULL,
  "pid" uuid,
  "reply_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "like_count" integer DEFAULT 0 NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "circle_post_comments_post_idx" ON "circle_post_comments" ("post_id");
CREATE INDEX IF NOT EXISTS "circle_post_comments_user_idx" ON "circle_post_comments" ("user_id");
CREATE INDEX IF NOT EXISTS "circle_post_comments_pid_idx" ON "circle_post_comments" ("pid");

-- ========== ask 模块 ==========

-- 问答分类
CREATE TABLE IF NOT EXISTS "ask_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "pid" uuid,
  "name" varchar(100) NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_show" boolean DEFAULT true NOT NULL,
  "is_show_index" boolean DEFAULT false NOT NULL,
  "image" varchar(500),
  "level" integer DEFAULT 1 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ask_categories_pid_idx" ON "ask_categories" ("pid");

-- 问题-分类多对多
CREATE TABLE IF NOT EXISTS "ask_question_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ask_id" uuid NOT NULL REFERENCES "asks"("id") ON DELETE CASCADE,
  "category_id" uuid NOT NULL REFERENCES "ask_categories"("id") ON DELETE CASCADE,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ask_question_categories_ask_idx" ON "ask_question_categories" ("ask_id");
CREATE INDEX IF NOT EXISTS "ask_question_categories_category_idx" ON "ask_question_categories" ("category_id");
CREATE UNIQUE INDEX IF NOT EXISTS "ask_question_category_uniq" ON "ask_question_categories" ("ask_id", "category_id");

-- 问答点赞（通用：问题/回答）
CREATE TABLE IF NOT EXISTS "ask_likes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "target_type" varchar(20) NOT NULL,
  "target_id" uuid NOT NULL,
  "is_like" boolean DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ask_likes_user_target_idx" ON "ask_likes" ("user_id", "target_type", "target_id");
CREATE INDEX IF NOT EXISTS "ask_likes_target_idx" ON "ask_likes" ("target_type", "target_id");

-- 问答收藏（通用：问题/回答）
CREATE TABLE IF NOT EXISTS "ask_favorites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "target_type" varchar(20) NOT NULL,
  "target_id" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ask_favorites_user_target_idx" ON "ask_favorites" ("user_id", "target_type", "target_id");
CREATE INDEX IF NOT EXISTS "ask_favorites_target_idx" ON "ask_favorites" ("target_type", "target_id");
CREATE UNIQUE INDEX IF NOT EXISTS "ask_favorite_uniq" ON "ask_favorites" ("user_id", "target_type", "target_id");

-- 问答评论（对问题/回答评论）
CREATE TABLE IF NOT EXISTS "ask_comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "target_type" varchar(20) NOT NULL,
  "target_id" uuid NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "content" text NOT NULL,
  "pid" uuid,
  "like_count" integer DEFAULT 0 NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ask_comments_target_idx" ON "ask_comments" ("target_type", "target_id");
CREATE INDEX IF NOT EXISTS "ask_comments_user_idx" ON "ask_comments" ("user_id");
CREATE INDEX IF NOT EXISTS "ask_comments_pid_idx" ON "ask_comments" ("pid");

-- ========== search 模块 ==========

-- 搜索索引（通用全文索引）
CREATE TABLE IF NOT EXISTS "search_index" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "target_type" varchar(50) NOT NULL,
  "target_id" varchar(64) NOT NULL,
  "title" varchar(500) NOT NULL,
  "content" text,
  "keywords" varchar(500),
  "category" varchar(100),
  "tags" varchar(500),
  "cover" varchar(500),
  "url" varchar(500),
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "user_name" varchar(100),
  "weight" integer DEFAULT 0 NOT NULL,
  "view_num" integer DEFAULT 0 NOT NULL,
  "like_num" integer DEFAULT 0 NOT NULL,
  "comment_num" integer DEFAULT 0 NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "is_top" boolean DEFAULT false NOT NULL,
  "is_essence" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "search_index_target_idx" ON "search_index" ("target_type", "target_id");
CREATE INDEX IF NOT EXISTS "search_index_category_idx" ON "search_index" ("category");
CREATE INDEX IF NOT EXISTS "search_index_status_idx" ON "search_index" ("status");
CREATE INDEX IF NOT EXISTS "search_index_user_idx" ON "search_index" ("user_id");

-- 热搜词
CREATE TABLE IF NOT EXISTS "search_hot_keywords" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "keyword" varchar(100) NOT NULL,
  "search_count" integer DEFAULT 0 NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_hot" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "search_hot_keywords_status_idx" ON "search_hot_keywords" ("status");
CREATE INDEX IF NOT EXISTS "search_hot_keywords_keyword_idx" ON "search_hot_keywords" ("keyword");
