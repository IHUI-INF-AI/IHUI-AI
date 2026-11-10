-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 系统管理员凭据轮换例外(2026-11-11)
-- 立因:0071 将系统管理员行定为"任何字段都不可变"(含 password_hash),
--   个人中心"修改密码"对 admin 恒被 P0001 拒绝:前端看似成功、库里仍是旧哈希,
--   机主用新密码登录必然 401。
-- 口径:只放行 password_hash(允许伴随 updated_at 刷新);其余字段与 DELETE 仍完全不可变。
--   鉴权边界不变:自助改密必须先校验原密码,管理员重置走管理员鉴权。
-- 幂等可重复执行。

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
  IF OLD.is_system_admin AND NEW IS DISTINCT FROM OLD THEN
    -- 唯一例外:凭据轮换。password_hash 变化,且除 password_hash / updated_at 外无任何字段变化。
    IF NEW."password_hash" IS DISTINCT FROM OLD."password_hash"
       AND (to_jsonb(NEW) - 'password_hash' - 'updated_at')
         = (to_jsonb(OLD) - 'password_hash' - 'updated_at')
    THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION
      'system admin (id=%) is immutable: only password_hash can be changed', OLD.id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;
