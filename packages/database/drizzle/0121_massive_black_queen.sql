-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

ALTER TABLE "search_contents" ADD COLUMN "es_indexed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "search_contents" ADD COLUMN "es_index_status" varchar(20) DEFAULT 'pending';
