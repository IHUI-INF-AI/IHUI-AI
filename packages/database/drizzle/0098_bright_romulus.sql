ALTER TABLE "zhs_agent_withdrawal_detail" ADD COLUMN "type" integer;--> statement-breakpoint
ALTER TABLE "zhs_agent_withdrawal_detail" ADD COLUMN "out_bill_no" varchar(255);--> statement-breakpoint
ALTER TABLE "zhs_agent_withdrawal_detail" ADD COLUMN "order_ids" text;--> statement-breakpoint
ALTER TABLE "zhs_agent_withdrawal_detail" ADD COLUMN "reviewer" uuid;--> statement-breakpoint
ALTER TABLE "zhs_agent_withdrawal_detail" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "zhs_agent_withdrawal_detail" ADD COLUMN "initiate_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "zhs_agent_withdrawal_out_bill_no_idx" ON "zhs_agent_withdrawal_detail" USING btree ("out_bill_no");