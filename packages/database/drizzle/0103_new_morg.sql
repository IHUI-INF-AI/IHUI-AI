CREATE TABLE "wechat_pay_contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_id" varchar(64) NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" uuid,
	"product_id" integer,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"wechat_plan_id" varchar(64),
	"out_trade_no" varchar(64),
	"next_charge_time" timestamp with time zone,
	"last_charge_time" timestamp with time zone,
	"last_charge_status" varchar(20),
	"signed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" varchar(500),
	"trial_end_at" timestamp with time zone,
	"raw_response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wechat_pay_contracts_contract_id_unique" UNIQUE("contract_id")
);
--> statement-breakpoint
ALTER TABLE "wx_pay_notifications" ALTER COLUMN "notification_type" SET DEFAULT 'pay';--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "wechat_plan_id" varchar(64);--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "billing_period" varchar(20) DEFAULT 'month' NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "trial_days" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "is_recurring" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "wx_pay_notifications" ADD COLUMN "contract_id" varchar(64);--> statement-breakpoint
ALTER TABLE "zhs_product" ADD COLUMN "is_recurring" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "zhs_product" ADD COLUMN "billing_period" varchar(20) DEFAULT 'month' NOT NULL;--> statement-breakpoint
ALTER TABLE "zhs_product" ADD COLUMN "trial_days" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "wechat_pay_contracts" ADD CONSTRAINT "wechat_pay_contracts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wechat_pay_contracts" ADD CONSTRAINT "wechat_pay_contracts_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wechat_pay_contracts" ADD CONSTRAINT "wechat_pay_contracts_product_id_zhs_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."zhs_product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wechat_pay_contracts_user_id_idx" ON "wechat_pay_contracts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wechat_pay_contracts_status_idx" ON "wechat_pay_contracts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wechat_pay_contracts_next_charge_time_idx" ON "wechat_pay_contracts" USING btree ("next_charge_time");