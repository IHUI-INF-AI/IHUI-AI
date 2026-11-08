-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

-- 2026-11-08 立(F-335):帖子可见性落库。
-- POST /api/community/posts 此前接受 visibility 却直接丢弃,private/followers 帖进入全局公开流。
-- 只加列 + 默认 public(存量帖按既有公开行为保持不变),不重建表。
ALTER TABLE "circle_posts"
  ADD COLUMN IF NOT EXISTS "visibility" varchar(16) NOT NULL DEFAULT 'public';
