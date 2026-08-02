-- Migration 20260802040000: user_devices 用户设备表
-- 创建时间: 2026-08-02
-- 描述: 按设备指纹(fingerprintHash)识别真实设备,替代 api_logs 聚合 IP+UA 的旧方案。
--       同一用户同一设备只保留一条记录,登录成功时 upsert 更新 lastSeenAt/userAgent/ip。
--       (userId, fingerprintHash) 唯一约束作为 onConflictDoUpdate 的 conflict target。
--
-- 幂等安全:使用 IF NOT EXISTS,表/索引/约束已存在则为 no-op。

CREATE TABLE IF NOT EXISTS "user_devices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "fingerprint_hash" varchar(64) NOT NULL,
  "user_agent" text,
  "ip" varchar(45) NOT NULL,
  "first_seen_at" timestamptz DEFAULT now() NOT NULL,
  "last_seen_at" timestamptz DEFAULT now() NOT NULL,
  "trusted" boolean DEFAULT false NOT NULL,
  "last_location" varchar(128)
);

CREATE INDEX IF NOT EXISTS "user_devices_user_id_idx" ON "user_devices" ("user_id");
CREATE INDEX IF NOT EXISTS "user_devices_fingerprint_hash_idx" ON "user_devices" ("fingerprint_hash");

-- (user_id, fingerprint_hash) 唯一约束:同一用户同一设备只一条记录,upsert conflict target
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_devices_user_id_fingerprint_hash_unique'
  ) THEN
    ALTER TABLE "user_devices"
      ADD CONSTRAINT "user_devices_user_id_fingerprint_hash_unique" UNIQUE ("user_id", "fingerprint_hash");
  END IF;
END $$;

-- 外键:user_id 引用 users.id,onDelete cascade(用户删除时设备记录级联清除)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_devices_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "user_devices"
      ADD CONSTRAINT "user_devices_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
