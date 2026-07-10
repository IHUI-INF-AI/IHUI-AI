-- 0036: OAuth2 + Third-party accounts + User SK module

-- OAuth2 应用表
CREATE TABLE IF NOT EXISTS "oauth_apps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" varchar(100) NOT NULL,
  "client_secret" text NOT NULL,
  "name" varchar(100) NOT NULL,
  "description" text,
  "redirect_uris" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "scopes" jsonb DEFAULT '[]'::jsonb,
  "icon" varchar(512),
  "owner_uuid" uuid,
  "is_active" integer DEFAULT 1 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE "oauth_apps" DROP CONSTRAINT IF EXISTS "oauth_apps_owner_uuid_users_id_fk";
ALTER TABLE "oauth_apps" ADD CONSTRAINT "oauth_apps_owner_uuid_users_id_fk" FOREIGN KEY ("owner_uuid") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
CREATE UNIQUE INDEX IF NOT EXISTS "oauth_apps_client_id_unique" ON "oauth_apps" ("client_id");
CREATE INDEX IF NOT EXISTS "oauth_apps_owner_idx" ON "oauth_apps" ("owner_uuid");

-- OAuth2 授权码会话表
CREATE TABLE IF NOT EXISTS "oauth_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" varchar(100) NOT NULL,
  "client_id" varchar(100) NOT NULL,
  "user_id" uuid NOT NULL,
  "state" varchar(128),
  "scope" text,
  "code_challenge" varchar(256),
  "code_challenge_method" varchar(10),
  "expires_at" timestamptz NOT NULL,
  "is_used" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE "oauth_sessions" DROP CONSTRAINT IF EXISTS "oauth_sessions_user_id_users_id_fk";
ALTER TABLE "oauth_sessions" ADD CONSTRAINT "oauth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
CREATE UNIQUE INDEX IF NOT EXISTS "oauth_sessions_code_unique" ON "oauth_sessions" ("code");
CREATE INDEX IF NOT EXISTS "oauth_sessions_user_idx" ON "oauth_sessions" ("user_id");

-- OAuth 用户映射表（provider → user）
CREATE TABLE IF NOT EXISTS "oauth_users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "provider" varchar(50) NOT NULL,
  "provider_user_id" varchar(100) NOT NULL,
  "access_token" text,
  "refresh_token" text,
  "expires_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE "oauth_users" DROP CONSTRAINT IF EXISTS "oauth_users_user_id_users_id_fk";
ALTER TABLE "oauth_users" ADD CONSTRAINT "oauth_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
CREATE INDEX IF NOT EXISTS "oauth_users_user_idx" ON "oauth_users" ("user_id");
CREATE INDEX IF NOT EXISTS "oauth_users_provider_idx" ON "oauth_users" ("provider", "provider_user_id");

-- OAuth 审计日志表
CREATE TABLE IF NOT EXISTS "oauth_audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event" varchar(64) NOT NULL,
  "client_id" varchar(100),
  "user_id" uuid,
  "ip" varchar(64),
  "status" varchar(16),
  "detail" text,
  "request_summary" jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE "oauth_audit_logs" DROP CONSTRAINT IF EXISTS "oauth_audit_logs_user_id_users_id_fk";
ALTER TABLE "oauth_audit_logs" ADD CONSTRAINT "oauth_audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
CREATE INDEX IF NOT EXISTS "oauth_audit_logs_client_idx" ON "oauth_audit_logs" ("client_id");
CREATE INDEX IF NOT EXISTS "oauth_audit_logs_user_idx" ON "oauth_audit_logs" ("user_id");

-- OAuth scope 元数据表
CREATE TABLE IF NOT EXISTS "oauth_scope_meta" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scope" varchar(64) NOT NULL,
  "name" varchar(100) NOT NULL,
  "description" text,
  "icon" varchar(512),
  "category" varchar(64),
  "is_active" integer DEFAULT 1 NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "oauth_scope_meta_scope_unique" ON "oauth_scope_meta" ("scope");

-- 用户第三方账号绑定表
CREATE TABLE IF NOT EXISTS "user_third_party_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "open_id" varchar(100),
  "union_id" varchar(100),
  "platform" varchar(20) NOT NULL,
  "access_token" text,
  "refresh_token" text,
  "expires_at" timestamptz,
  "deleted_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE "user_third_party_accounts" DROP CONSTRAINT IF EXISTS "user_third_party_accounts_user_id_users_id_fk";
ALTER TABLE "user_third_party_accounts" ADD CONSTRAINT "user_third_party_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
CREATE INDEX IF NOT EXISTS "user_third_party_user_idx" ON "user_third_party_accounts" ("user_id");
CREATE INDEX IF NOT EXISTS "user_third_party_platform_idx" ON "user_third_party_accounts" ("platform", "open_id");

-- 用户 Secret Key 表
CREATE TABLE IF NOT EXISTS "user_sk" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "key" varchar(255) NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "type" integer DEFAULT 0 NOT NULL,
  "max" integer DEFAULT 0 NOT NULL,
  "expires_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE "user_sk" DROP CONSTRAINT IF EXISTS "user_sk_user_id_users_id_fk";
ALTER TABLE "user_sk" ADD CONSTRAINT "user_sk_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
CREATE INDEX IF NOT EXISTS "user_sk_user_idx" ON "user_sk" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "user_sk_key_unique" ON "user_sk" ("key");

-- 初始化 scope 元数据
INSERT INTO "oauth_scope_meta" ("scope", "name", "description", "category", "is_active", "sort_order")
VALUES
  ('read:profile', '读取资料', '读取用户基本资料', 'profile', 1, 1),
  ('write:profile', '修改资料', '修改用户基本资料', 'profile', 1, 2),
  ('read:orders', '读取订单', '读取用户订单信息', 'order', 1, 3),
  ('write:orders', '创建订单', '创建用户订单', 'order', 1, 4),
  ('read:wallet', '读取钱包', '读取用户钱包余额', 'wallet', 1, 5),
  ('write:wallet', '操作钱包', '钱包充值/提现操作', 'wallet', 1, 6)
ON CONFLICT ("scope") DO NOTHING;
