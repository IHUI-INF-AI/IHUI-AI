-- 0080: sys_operlog 操作日志表
-- 对齐 RuoYi sys_operlog 标准 schema,记录用户操作行为
-- 幂等可重复执行(IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS "sys_operlog" (
	"oper_id" bigserial PRIMARY KEY,
	"title" varchar(50) DEFAULT '' NOT NULL,
	"business_type" integer DEFAULT 0 NOT NULL,
	"method" varchar(100) DEFAULT '' NOT NULL,
	"request_method" varchar(10) DEFAULT '' NOT NULL,
	"operator_type" integer DEFAULT 0 NOT NULL,
	"oper_name" varchar(50) DEFAULT '' NOT NULL,
	"dept_name" varchar(50) DEFAULT '' NOT NULL,
	"oper_url" varchar(255) DEFAULT '' NOT NULL,
	"oper_ip" varchar(128) DEFAULT '' NOT NULL,
	"oper_param" text,
	"json_result" text,
	"status" integer DEFAULT 0 NOT NULL,
	"error_msg" text,
	"oper_time" timestamptz DEFAULT now() NOT NULL,
	"cost_time" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sys_operlog_oper_time_idx" ON "sys_operlog" USING btree ("oper_time");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sys_operlog_business_type_idx" ON "sys_operlog" USING btree ("business_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sys_operlog_oper_name_idx" ON "sys_operlog" USING btree ("oper_name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sys_operlog_status_idx" ON "sys_operlog" USING btree ("status");
