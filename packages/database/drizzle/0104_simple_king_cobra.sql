ALTER TABLE "wechat_pay_contracts" ADD COLUMN "out_contract_code" varchar(64);--> statement-breakpoint
ALTER TABLE "wechat_pay_contracts" ADD COLUMN "pre_entrustweb_id" varchar(128);--> statement-breakpoint
ALTER TABLE "wechat_pay_contracts" ADD COLUMN "contract_state" varchar(30);--> statement-breakpoint
ALTER TABLE "wechat_pay_contracts" ADD COLUMN "contract_expired_at" timestamp with time zone;