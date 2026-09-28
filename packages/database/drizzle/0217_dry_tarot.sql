-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

ALTER TABLE "srs_servers" ALTER COLUMN "http_port" SET DEFAULT 8802;--> statement-breakpoint
DO $col$ BEGIN ALTER TABLE "chat_conversations" ADD COLUMN "share_token" varchar(32); EXCEPTION WHEN duplicate_column THEN NULL; END $col$;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "reasoning" text;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_share_token_unique" UNIQUE("share_token");
