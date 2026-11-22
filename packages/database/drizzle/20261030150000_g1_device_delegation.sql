-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- Migration 20261030150000: G1 跨设备互联闭环(devices / device_pair_codes / device_tasks)
-- 创建时间: 2026-10-30
-- 描述: 《差距修复方案-第二轮》G1 后端落库。三张新表:
--       1. devices            工作端设备注册表(与 device_tokens 推送令牌、user_devices 登录指纹互不混用);
--                             (user_id, name) 唯一 = 重复注册幂等更新 last_seen_at 的 conflict target。
--       2. device_pair_codes  配对码表,只存 sha256(code|服务端密钥) 哈希,明文不落库;
--                             单次使用(used_at 原子置位)+ 5 分钟 TTL(expires_at)。
--       3. device_tasks       设备委托任务(session_id → chat_conversations),status 封闭集
--                             queued|claimed|running|completed|failed|expired;
--                             queued 超 24h 由 claim/列表查询惰性判定为 expired,无周期任务。
--
-- 幂等安全:全部使用 IF NOT EXISTS / DO $$ 守门,可安全重复执行。
--
-- 执行方式(与项目 202610* 系列手写 migration 一致):
--   pnpm tsx packages/database/scripts/apply-migration.mjs drizzle/20261030150000_g1_device_delegation.sql
-- 或直接 psql:
--   psql "$DATABASE_URL" -f packages/database/drizzle/20261030150000_g1_device_delegation.sql

CREATE TABLE IF NOT EXISTS "devices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "os" varchar(128),
  "capabilities" jsonb,
  "last_seen_at" timestamptz DEFAULT now() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "revoked_at" timestamptz
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'devices_user_name_unique') THEN
    ALTER TABLE "devices" ADD CONSTRAINT "devices_user_name_unique" UNIQUE ("user_id", "name");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'devices_user_id_users_id_fk') THEN
    ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "devices_user_revoked_idx" ON "devices" ("user_id", "revoked_at");

CREATE TABLE IF NOT EXISTS "device_pair_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "code_hash" varchar(64) NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "used_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'device_pair_codes_code_hash_unique') THEN
    ALTER TABLE "device_pair_codes" ADD CONSTRAINT "device_pair_codes_code_hash_unique" UNIQUE ("code_hash");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'device_pair_codes_user_id_users_id_fk') THEN
    ALTER TABLE "device_pair_codes" ADD CONSTRAINT "device_pair_codes_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "device_pair_codes_user_created_idx"
  ON "device_pair_codes" ("user_id", "created_at");

CREATE TABLE IF NOT EXISTS "device_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL,
  "target_device_id" uuid NOT NULL,
  "status" varchar(16) DEFAULT 'queued' NOT NULL,
  "claimed_at" timestamptz,
  "finished_at" timestamptz,
  "error" text,
  "result_summary" jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'device_tasks_session_id_chat_conversations_id_fk') THEN
    ALTER TABLE "device_tasks" ADD CONSTRAINT "device_tasks_session_id_chat_conversations_id_fk"
      FOREIGN KEY ("session_id") REFERENCES "chat_conversations"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'device_tasks_target_device_id_devices_id_fk') THEN
    ALTER TABLE "device_tasks" ADD CONSTRAINT "device_tasks_target_device_id_devices_id_fk"
      FOREIGN KEY ("target_device_id") REFERENCES "devices"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'device_tasks_created_by_users_id_fk') THEN
    ALTER TABLE "device_tasks" ADD CONSTRAINT "device_tasks_created_by_users_id_fk"
      FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "device_tasks_device_status_created_idx"
  ON "device_tasks" ("target_device_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "device_tasks_session_idx"
  ON "device_tasks" ("session_id");
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
