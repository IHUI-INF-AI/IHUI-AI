-- ============================================================================
-- 20260801040000: 测试验证码 bypass(admin 账号固定验证码 123456)
--
-- 目标:
--   admin 账号(email=502319984@qq.com / phone=18643389808)测试登录时
--   使用固定验证码 123456,无需收真实验证码
--
-- 安全:
--   - 仅 NODE_ENV !== 'production' 时生效(应用层守卫,见 apps/api/src/utils/code-store.ts)
--   - 生产环境永远走真实验证码流程,此表在生产环境不生效
--   - admin 账号由 0067/0071 触发器保证不可变
--
-- 幂等可重复执行
-- ============================================================================

-- 1) 建表
CREATE TABLE IF NOT EXISTS "test_verify_code_bypass" (
  "identifier" varchar(255) NOT NULL PRIMARY KEY,  -- phone 或 email
  "fixed_code" varchar(8) NOT NULL DEFAULT '123456',
  "is_active" boolean NOT NULL DEFAULT true,
  "note" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- 2) Seed admin 账号 bypass 规则
INSERT INTO "test_verify_code_bypass" ("identifier", "fixed_code", "is_active", "note")
VALUES
  ('502319984@qq.com', '123456', true, 'system admin email bypass'),
  ('18643389808', '123456', true, 'system admin phone bypass')
ON CONFLICT ("identifier") DO UPDATE
SET
  "fixed_code" = EXCLUDED."fixed_code",
  "is_active" = true,
  "note" = EXCLUDED."note",
  "updated_at" = now();

-- 3) 索引(按 is_active 查询)
CREATE INDEX IF NOT EXISTS "test_verify_code_bypass_active_idx"
  ON "test_verify_code_bypass" ("is_active")
  WHERE "is_active" = true;
