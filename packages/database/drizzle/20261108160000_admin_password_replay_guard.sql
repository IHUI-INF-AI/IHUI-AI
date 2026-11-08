-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

-- ============================================================================
-- DB-38: 阻断「重放 0067/0071 即把管理员口令写回仓库公开散列」的通道
--
-- 背景:
--   0067_system_admin.sql 把 admin123 的 bcrypt 散列写进 INSERT/UPDATE;
--   0071_restore_admin_immutability.sql 在 DO 块里**无条件** UPDATE users
--   SET password_hash = <admin123 散列>(仅临时禁用 users_system_admin_immutable_update)。
--   收口只靠一次性迁移 20261022234000_invalidate_public_admin_password.sql:
--   它把命中已知散列的行换成不可登录占位散列,但自己不会在 0071 重放后再跑。
--   ⇒ 任何能执行迁移/SQL 的人重放 0071,就能把管理员口令重置回公开的 admin123。
--
-- 为什么是「新增守卫」而不是就地改写 0067/0071:
--   已入库迁移的文件内容参与账本 hash(apply-migration.mjs 以整份 SQL 的 sha256 记账,
--   同 created_at 不同 hash 会 fail-closed「账本冲突」)。就地改写历史迁移会让
--   已应用环境无法再跑迁移链,故历史文件保持原样,由本迁移起一条**常驻写侧守卫**。
--
-- 守卫语义(不是"建议",是 DB 层拒绝):
--   对 users 的 INSERT 与 UPDATE OF password_hash 建 BEFORE ROW 触发器;
--   只要写入值命中仓库公开过的默认口令散列(0067/0071/收口占位三枚)即抛错。
--   ⇒ 0071 重放时那条无条件 UPDATE 会当场失败(其 DO 块整体回滚、触发器状态一并回滚),
--     口令不会被覆盖;正常运维用 reset:admin-password 生成强口令不受影响。
--
-- 幂等:CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS / CREATE TRIGGER。
-- 锁表评估:DROP/CREATE TRIGGER 取 users 表的 ShareRowExclusiveLock(会短暂阻塞该表写入),
--   仅迁移窗口内持有;本迁移不含数据扫描、不 UPDATE 任何行,时长与 users 表大小基本无关(毫秒级)。
-- 回滚:
--   DROP TRIGGER IF EXISTS "users_block_public_admin_hash_ins" ON "users";
--   DROP TRIGGER IF EXISTS "users_block_public_admin_hash_upd" ON "users";
--   DROP FUNCTION IF EXISTS "users_block_public_admin_hash"();
-- ============================================================================

CREATE OR REPLACE FUNCTION "users_block_public_admin_hash"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  -- 仓库公开过的默认口令散列(0067 / 0071 / 20261022234000 占位),命中即拒绝写入
  v_public_hashes text[] := ARRAY[
    '$2a$10$ptHqzPRDOrIh/ryWlw7vS.zxDA4nZ4AVvgUgw6AmVSKJUpwSnSXmK',
    '$2a$10$npl.CXEg8eRL8hNrf1dYKO5fYPNGJDAzt9PtaX44185OwxdNSnFtm',
    '$2b$10$B33OfuUuinNDQ4FywmENAOKDqOfaFyngH2td6aNvAxvonzACi7CjC'
  ];
BEGIN
  IF NEW."password_hash" IS NOT NULL
     AND NEW."password_hash" = ANY (v_public_hashes)
  THEN
    RAISE EXCEPTION
      'DB-38: 拒绝写入仓库公开过的默认口令散列(password_hash),该散列对应 admin123,任何读过仓库的人都能用它登录'
      USING ERRCODE = 'P0001',
            HINT = '用 pnpm --filter @ihui/api reset:admin-password 设置强口令;不要重放 0067/0071 的数据重置段';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "users_block_public_admin_hash_ins" ON "users";
CREATE TRIGGER "users_block_public_admin_hash_ins"
BEFORE INSERT ON "users"
FOR EACH ROW
EXECUTE FUNCTION "users_block_public_admin_hash"();

DROP TRIGGER IF EXISTS "users_block_public_admin_hash_upd" ON "users";
CREATE TRIGGER "users_block_public_admin_hash_upd"
BEFORE UPDATE OF "password_hash" ON "users"
FOR EACH ROW
EXECUTE FUNCTION "users_block_public_admin_hash"();
