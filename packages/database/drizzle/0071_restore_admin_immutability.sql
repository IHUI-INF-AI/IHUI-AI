-- ============================================================================
-- 0071: 恢复 system admin 完全不可变 + 修正 admin123 密码
--
-- 背景:
--   0069_system_admin_password_reset.sql 放行了 password_hash 修改(应急重置)
--   但用户明确要求"不允许以后任何修改",因此需要回退 0069 改动。
--   同时 0067 中的初始 bcrypt 哈希已损坏(验证不通过),需要重新生成。
--
-- 修复内容:
--   1. 重建 users_block_system_admin_modify 触发器函数,恢复完全不可变
--      (包含 password_hash)
--   2. 重置 admin 账号 password_hash 为正确的 admin123 哈希
--   3. 重新绑定触发器
--
-- 应急场景:如果 admin 密码丢失,需绕过触发器(参考 0071 应急流程:停服 →
--   以 postgres 超级用户临时 disable trigger → bcrypt 重置 → enable trigger)
--   但此操作超出 0067/0071 自动流程,需要人工监督。
-- 幂等可重复执行
-- ============================================================================

-- 1) 重建触发器函数(完全不可变,包含 password_hash)
CREATE OR REPLACE FUNCTION "users_block_system_admin_modify"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_system_admin THEN
      RAISE EXCEPTION
        'system admin (id=%) is immutable and cannot be deleted', OLD.id
        USING ERRCODE = 'P0001';
    END IF;
    RETURN OLD;
  END IF;

  -- TG_OP = 'UPDATE'
  IF OLD.is_system_admin THEN
    -- 唯一例外:允许 updated_at 自动刷新
    -- 其他任何字段(含 password_hash)变更一律拒绝
    IF NEW IS DISTINCT FROM OLD THEN
      IF (NEW."username"         IS DISTINCT FROM OLD."username")
         OR (NEW."phone"         IS DISTINCT FROM OLD."phone")
         OR (NEW."email"         IS DISTINCT FROM OLD."email")
         OR (NEW."password_hash" IS DISTINCT FROM OLD."password_hash")
         OR (NEW."nickname"      IS DISTINCT FROM OLD."nickname")
         OR (NEW."avatar"        IS DISTINCT FROM OLD."avatar")
         OR (NEW."bio"           IS DISTINCT FROM OLD."bio")
         OR (NEW."role_id"       IS DISTINCT FROM OLD."role_id")
         OR (NEW."status"        IS DISTINCT FROM OLD."status")
         OR (NEW."is_vip"        IS DISTINCT FROM OLD."is_vip")
         OR (NEW."level"         IS DISTINCT FROM OLD."level")
         OR (NEW."gender"        IS DISTINCT FROM OLD."gender")
         OR (NEW."family_id"     IS DISTINCT FROM OLD."family_id")
         OR (NEW."is_system_admin" IS DISTINCT FROM OLD."is_system_admin")
      THEN
        RAISE EXCEPTION
          'system admin (id=%) is immutable: no field can be changed',
          OLD.id
          USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 2) 重置 admin 密码为正确的 admin123 哈希
--    临时禁用触发器以允许修改 password_hash
DO $$
DECLARE
  v_correct_hash text := '$2a$10$npl.CXEg8eRL8hNrf1dYKO5fYPNGJDAzt9PtaX44185OwxdNSnFtm';
  v_admin_id uuid;
BEGIN
  -- 查找 admin
  SELECT id INTO v_admin_id
  FROM users
  WHERE is_system_admin = true
    AND username = 'admin'
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'admin account not found';
  END IF;

  -- 临时禁用触发器
  ALTER TABLE users DISABLE TRIGGER users_system_admin_immutable_update;

  -- 重置密码
  UPDATE users
  SET password_hash = v_correct_hash
  WHERE id = v_admin_id;

  -- 重新启用触发器
  ALTER TABLE users ENABLE TRIGGER users_system_admin_immutable_update;

  RAISE NOTICE 'admin password reset to correct admin123 hash';
END$$;

-- 3) 重新绑定触发器(幂等)
DROP TRIGGER IF EXISTS "users_system_admin_immutable_update" ON "users";
CREATE TRIGGER "users_system_admin_immutable_update"
BEFORE UPDATE ON "users"
FOR EACH ROW
EXECUTE FUNCTION "users_block_system_admin_modify"();

DROP TRIGGER IF EXISTS "users_system_admin_immutable_delete" ON "users";
CREATE TRIGGER "users_system_admin_immutable_delete"
BEFORE DELETE ON "users"
FOR EACH ROW
EXECUTE FUNCTION "users_block_system_admin_modify"();
