-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 默认头像域名收敛到 www.aizhs.top。
--
-- aizhs.top 走 Cloudflare(境内无 PoP,边缘 301 到 www 实测 1.13s),www.aizhs.top 走
-- 腾讯 EO 国内节点,/images/** 是 EO 命中常路径(实测 200 / 0.16s)。两者指向同一份静态资源
-- apps/web/public/images/default-avatar.jpg,故把库内已落地的默认头像地址整体换到 www,
-- 冷启动首访省掉一次 301 往返。
--
-- ① 列默认值同步(新注册用户直接落 www)
-- ② 存量回填:排除系统管理员行 —— users_system_admin_immutable_update 拒绝该行任何字段变更
-- ③ 系统管理员行走既有受控通道(同 0071_restore_admin_immutability):同一事务内
--    临时禁用不可变触发器 → 更新 → 立即恢复,不留禁用态。
--
-- 全语句幂等:仅匹配旧域名 'https://aizhs.top/images/default-avatar.jpg',
-- 重复执行 0 行,列默认值可重复 SET。

ALTER TABLE users
  ALTER COLUMN avatar SET DEFAULT 'https://www.aizhs.top/images/default-avatar.jpg';

UPDATE users
   SET avatar = 'https://www.aizhs.top/images/default-avatar.jpg'
 WHERE avatar = 'https://aizhs.top/images/default-avatar.jpg'
   AND NOT is_system_admin;

-- 注意:必须用 array_agg 先把 id 收干净再 ALTER —— PL/pgSQL 的 `FOR x IN SELECT` 会保持
-- 游标处于打开态,此时同会话 ALTER TABLE 会报
-- "cannot ALTER TABLE users because it is being used by active queries in this session"。
DO $$
DECLARE
  v_ids uuid[];
  v_id uuid;
BEGIN
  SELECT array_agg(id)
    INTO v_ids
    FROM users
   WHERE is_system_admin = true
     AND avatar = 'https://aizhs.top/images/default-avatar.jpg';

  IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE users DISABLE TRIGGER users_system_admin_immutable_update;
  FOREACH v_id IN ARRAY v_ids LOOP
    UPDATE users
       SET avatar = 'https://www.aizhs.top/images/default-avatar.jpg'
     WHERE id = v_id;
  END LOOP;
  ALTER TABLE users ENABLE TRIGGER users_system_admin_immutable_update;
END $$;
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
