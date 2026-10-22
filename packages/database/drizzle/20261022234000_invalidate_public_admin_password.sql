-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- ============================================================================
-- 20261022234000: 让仓内公开过的 system admin 默认口令失效(G-875)
--
-- 背景:0067/0071 曾把 "admin123"(及另一个同口令散列)写进本仓并已同步到公开镜像;
--   任何读过仓库的人都能用它登录尚未轮换口令的部署。按 IM1/IM2 纪律,已入库迁移
--   不得就地改写,故本迁移只做数据面收口:命中这两个已知散列的系统管理员,
--   password_hash 一律替换为不可登录的占位散列(其明文随机生成后即丢弃)。
--
-- 幂等:只更新 password_hash 命中已知值的行;已轮换的口令不受影响。
-- 执行后:部署侧必须用 reset:admin-password 设置新口令(见 deploy 脚本提示)。
-- ============================================================================

DO $$
DECLARE
  v_placeholder text := '$2b$10$B33OfuUuinNDQ4FywmENAOKDqOfaFyngH2td6aNvAxvonzACi7CjC';
  v_known text[] := ARRAY[
    '$2a$10$ptHqzPRDOrIh/ryWlw7vS.zxDA4nZ4AVvgUgw6AmVSKJUpwSnSXmK',
    '$2a$10$npl.CXEg8eRL8hNrf1dYKO5fYPNGJDAzt9PtaX44185OwxdNSnFtm'
  ];
  v_count integer;
BEGIN
  ALTER TABLE "users" DISABLE TRIGGER "users_system_admin_immutable_update";
  UPDATE "users"
     SET "password_hash" = v_placeholder
   WHERE "is_system_admin" = true
     AND "password_hash" = ANY (v_known);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  ALTER TABLE "users" ENABLE TRIGGER "users_system_admin_immutable_update";
  RAISE NOTICE 'invalidated % system admin password(s) still using repo-public default', v_count;
END$$;
