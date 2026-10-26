-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).
--
-- 未设置头像的用户统一使用平台 Logo。使用跨端绝对地址:小程序端无法把
-- `/images/...`、`/uploads/...` 解析成远端资源,会当成本地包内路径而加载失败。
-- 资源落点 apps/web/public/images/default-avatar.jpg。
--
-- 不含系统管理员行(其 avatar 非空),因此不会触发
-- users_system_admin_immutable_update。

ALTER TABLE users
  ALTER COLUMN avatar SET DEFAULT 'https://aizhs.top/images/default-avatar.jpg';

UPDATE users
   SET avatar = 'https://aizhs.top/images/default-avatar.jpg'
 WHERE avatar IS NULL OR btrim(avatar) = '';
