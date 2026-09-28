-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

ALTER TABLE "wechat_pay_contracts" ADD COLUMN "out_contract_code" varchar(64);--> statement-breakpoint
ALTER TABLE "wechat_pay_contracts" ADD COLUMN "pre_entrustweb_id" varchar(128);--> statement-breakpoint
ALTER TABLE "wechat_pay_contracts" ADD COLUMN "contract_state" varchar(30);--> statement-breakpoint
ALTER TABLE "wechat_pay_contracts" ADD COLUMN "contract_expired_at" timestamp with time zone;
