-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

-- Custom migration: add is_show_index to learn_topic
ALTER TABLE "learn_topic" ADD COLUMN IF NOT EXISTS "is_show_index" boolean DEFAULT true NOT NULL;
