-- ============================================================================
-- 0067: 系统内置管理员 + 不可变保护
-- 目标:
--   1. users 表新增 is_system_admin boolean(默认 false,NOT NULL)
--   2. 写入 system admin 账号 (username=admin / password=admin123 的 bcrypt 哈希 /
--      email=502319984@qq.com / phone=18643389808 / role_id=1)
--   3. 创建 BEFORE UPDATE / BEFORE DELETE 触发器:对 is_system_admin=true 的行
--      拒绝任何修改和删除(包含直接 SQL 写入),保证永久不可变
--   4. 创建辅助函数用于应用层预检
-- 幂等可重复执行
-- ============================================================================

-- 1) 加列(幂等)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_system_admin'
  ) THEN
    ALTER TABLE "users"
      ADD COLUMN "is_system_admin" boolean NOT NULL DEFAULT false;
    CREATE INDEX "users_is_system_admin_idx" ON "users" ("is_system_admin");
  END IF;
END$$;

-- 2) 写入 system admin(若已存在则更新密码哈希并强制 is_system_admin=true)
--    密码 "admin123" bcrypt cost=10 的哈希(由外部生成,见 apps/api/scripts/seed-system-admin.mjs)
--    哈希: $2a$10$ptHqzPRDOrIh/ryWlw7vS.zxDA4nZ4AVvgUgw6AmVSKJUpwSnSXmK
DO $$
DECLARE
  v_hash text := '$2a$10$ptHqzPRDOrIh/ryWlw7vS.zxDA4nZ4AVvgUgw6AmVSKJUpwSnSXmK';
  v_id   uuid;
BEGIN
  -- 2.1 找现有的 admin 用户(按 username / email / phone 任一)
  SELECT "id" INTO v_id
  FROM "users"
  WHERE "username" = 'admin'
     OR "email"    = '502319984@qq.com'
     OR "phone"    = '18643389808'
  ORDER BY ("username" = 'admin') DESC, ("email" = '502319984@qq.com') DESC
  LIMIT 1;

  IF v_id IS NULL THEN
    -- 全新插入
    INSERT INTO "users"
      ("username","phone","email","password_hash","nickname","role_id","status","is_vip","level","is_system_admin")
    VALUES
      ('admin','18643389808','502319984@qq.com',v_hash,'系统管理员',1,1,0,0,true)
    RETURNING "id" INTO v_id;
  ELSE
    -- 已存在:同步 username/phone/email/password/nickname/role/status,确保字段一致
    -- 此时 is_system_admin 触发器还未创建,可安全 UPDATE
    UPDATE "users"
       SET "username"        = 'admin',
           "phone"           = '18643389808',
           "email"           = '502319984@qq.com',
           "password_hash"   = v_hash,
           "nickname"        = '系统管理员',
           "role_id"         = 1,
           "status"          = 1,
           "is_system_admin" = true,
           "updated_at"      = now()
     WHERE "id" = v_id;
  END IF;
END$$;

-- 3) 触发器函数:BEFORE UPDATE / BEFORE DELETE
--    规则:若 OLD.is_system_admin = true → 抛错,禁止修改/删除
--    注:触发器函数必须在 system admin 写入完成后再创建
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
    -- 唯一例外:允许 updated_at 自动刷新(防止 updated_at 一直停在初始化时间)
    -- 其他任何字段变更一律拒绝
    IF NEW IS DISTINCT FROM OLD THEN
      -- 仅当除 updated_at 之外有差异时才报错
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
          'system admin (id=%) is immutable: field % cannot be changed',
          OLD.id, TG_ARGV[0]
          USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 4) 绑定触发器(幂等 DROP + CREATE)
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

-- 5) 辅助函数(应用层预检,减少无效写入)
CREATE OR REPLACE FUNCTION "is_system_admin"(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_system_admin FROM "users" WHERE "id" = p_user_id LIMIT 1),
    false
  );
$$;

-- 6) 兜底:清理 4 位短号 / 19900000xxx / e2e_* / 其他明显测试数据
--    排除 e2e 测试时可能需要的固定 id(00000000-0000-0000-0000-000000000001)
--    排除刚写入的 system admin
--    仅在 dev/test 环境执行(避免误删生产数据)
DO $$
BEGIN
  IF current_setting('app.allow_cleanup', true) = 'true' THEN
    DELETE FROM "users"
     WHERE "id" <> '00000000-0000-0000-0000-000000000002'  -- 保留 system admin
       AND (
         "username" IN ('e2e_admin', 'e2e_user')
         OR "phone"   ~ '^[0-9]{1,4}$'                      -- 4 位及以下短号
         OR "phone"   LIKE '19900000%'                       -- 19900000xxx 测试段
         OR "phone"   IN ('13133287445')                    -- 单条短号测试
       );
  END IF;
END$$;
