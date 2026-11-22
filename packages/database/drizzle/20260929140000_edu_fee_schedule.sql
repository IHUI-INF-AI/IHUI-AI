-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- D180(2026-09-29 立):教育学费账目补「账期/到期日」载体 + 缴费单号唯一约束。
--
-- 三条各自独立、都必须在这一枚里落地(缺一条,上层账目出口就无从谈起):
--
-- ① 「什么时间该缴费」此前**结构上算不出来**。
--   全 schema 唯一的 due_date 长在学习计划表(edu_plan_item)上,学费域只有
--   billing_cycle = term/monthly/yearly 一个字符串档 + effective_date(生效日,不是到期日)。
--   所以催费只能"欠总额就喊一次",答不出"哪天到期、逾期几天、该不该提前提醒"。
--   新增 edu_fee_schedule 把"一期应缴"变成一行有到期日与状态的数据;
--   edu_tuition_fee.due_date / grace_days 是生成账期时的默认值来源,
--   edu_enrollment.next_due_date 是列表与扫描用的**派生缓存**(唯一写入口在 api 层)。
--
-- ② 缴费单号必须唯一,否则在线支付回调会**把同一笔款累加两次**。
--   现状 applyEduTuitionOrder 的幂等靠"先按 receipt_no 查一次、没命中就 insert + 累加",
--   而这一次读与随后两次写不在同一事务、也没有任何唯一约束兜底 ⇒ 两个并发回调
--   能同时通过查重,结果是已缴金额翻倍、欠费变负数(账面一路绿)。
--   这里把判重交给数据库:partial unique index(仅非空且未软删)。
--   建索引前先做一次**无损消歧** —— 若历史上已经存在重复单号(即已经发生过双入账),
--   保留每组最早那一行不动,其余行的 receipt_no 追加「#dup<id 前 8 位>」后缀:
--   不删行、不改金额、不改 status,原单号仍是前缀可反查,只是不再冒充"唯一凭据"。
--   重复数为 0 时这一句什么都不做(幂等,零副作用)。
--   刻意不把消歧写成"直接建索引让它失败":迁移炸在半路会让人手动跳过,
--   而跳过之后这张表就永久没有唯一约束了。
--
-- ③ edu_payment_record.schedule_id:钱与账期之间需要一根线。
--   可空是刻意的 —— 历史流水与未排期的一次性缴费本就没有归属,
--   强行 not null 要么逼迁移编造归属(编出来的账期是假账),要么阻塞上线。
--
-- 金额单位 = **整数元**,与 edu_enrollment.total_fee / paid_amount、
-- edu_payment_record.amount 一致(在线支付侧 order.amount 是分,入账时折成元)。
-- 全部为加表 / 加列 / 加索引,**没有任何 DROP、没有改任何既有列的类型或语义**。

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "edu_fee_schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"class_id" uuid,
	"term_id" uuid,
	"fee_id" uuid,
	"period_label" varchar(40) NOT NULL,
	"due_date" date NOT NULL,
	"grace_days" integer DEFAULT 0 NOT NULL,
	"amount_due" integer NOT NULL,
	"paid_amount" integer DEFAULT 0 NOT NULL,
	"refund_amount" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"last_reminded_at" timestamp with time zone,
	"remark" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
ALTER TABLE "edu_fee_schedule" ADD CONSTRAINT "edu_fee_schedule_enrollment_id_edu_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."edu_enrollment"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "edu_fee_schedule" ADD CONSTRAINT "edu_fee_schedule_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "edu_fee_schedule" ADD CONSTRAINT "edu_fee_schedule_class_id_edu_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."edu_class"("id") ON DELETE set null ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "edu_fee_schedule" ADD CONSTRAINT "edu_fee_schedule_term_id_edu_term_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."edu_term"("id") ON DELETE set null ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "edu_fee_schedule" ADD CONSTRAINT "edu_fee_schedule_fee_id_edu_tuition_fee_id_fk" FOREIGN KEY ("fee_id") REFERENCES "public"."edu_tuition_fee"("id") ON DELETE set null ON UPDATE no action;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_edu_sched_enrollment" ON "edu_fee_schedule" USING btree ("enrollment_id","due_date");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_edu_sched_status_due" ON "edu_fee_schedule" USING btree ("status","due_date");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_edu_sched_student" ON "edu_fee_schedule" USING btree ("student_id");

--> statement-breakpoint
ALTER TABLE "edu_tuition_fee" ADD COLUMN IF NOT EXISTS "due_date" date;

--> statement-breakpoint
ALTER TABLE "edu_tuition_fee" ADD COLUMN IF NOT EXISTS "grace_days" integer DEFAULT 0 NOT NULL;

--> statement-breakpoint
ALTER TABLE "edu_enrollment" ADD COLUMN IF NOT EXISTS "next_due_date" date;

--> statement-breakpoint
ALTER TABLE "edu_payment_record" ADD COLUMN IF NOT EXISTS "schedule_id" uuid;

--> statement-breakpoint
ALTER TABLE "edu_payment_record" ADD COLUMN IF NOT EXISTS "enrollment_id" uuid;

--> statement-breakpoint
ALTER TABLE "edu_payment_record" ADD CONSTRAINT "edu_payment_record_schedule_id_edu_fee_schedule_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."edu_fee_schedule"("id") ON DELETE set null ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "edu_payment_record" ADD CONSTRAINT "edu_payment_record_enrollment_id_edu_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."edu_enrollment"("id") ON DELETE set null ON UPDATE no action;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_edu_pay_schedule" ON "edu_payment_record" USING btree ("schedule_id");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_edu_pay_enrollment" ON "edu_payment_record" USING btree ("enrollment_id");

--> statement-breakpoint
ALTER TABLE "edu_refund_record" ADD COLUMN IF NOT EXISTS "enrollment_id" uuid;

--> statement-breakpoint
ALTER TABLE "edu_refund_record" ADD CONSTRAINT "edu_refund_record_enrollment_id_edu_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."edu_enrollment"("id") ON DELETE set null ON UPDATE no action;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_edu_refund_enrollment" ON "edu_refund_record" USING btree ("enrollment_id");

--> statement-breakpoint
DO $$
BEGIN
  -- 退费归属回填:与流水同一套纪律 —— 只在确定时回填,不猜。
  -- 第一路:退费挂着 payment_id,而该流水已有报名归属(确定信息)。
  UPDATE "edu_refund_record" r
     SET "enrollment_id" = p."enrollment_id"
    FROM "edu_payment_record" p
   WHERE r."enrollment_id" IS NULL
     AND r."deleted_at" IS NULL
     AND r."payment_id" = p."id"
     AND p."enrollment_id" IS NOT NULL;

  -- 第二路:没有 payment_id 的(手工登记的退费),仅当该 student×class 只有一个
  -- 未删除报名时回填。多候选留 NULL,由账目出口点名而不是重复计钱。
  UPDATE "edu_refund_record" r
     SET "enrollment_id" = c.enrollment_id
    FROM (
          SELECT e."student_id", e."class_id", min(e."id"::text)::uuid AS enrollment_id, count(*) AS n
            FROM "edu_enrollment" e
           WHERE e."deleted_at" IS NULL
           GROUP BY e."student_id", e."class_id"
         ) c
   WHERE r."enrollment_id" IS NULL
     AND r."deleted_at" IS NULL
     AND c.n = 1
     AND r."student_id" = c."student_id"
     AND r."class_id" = c."class_id";
END $$;

--> statement-breakpoint
DO $$
BEGIN
  -- 流水归属回填:只在**候选唯一**时回填,多候选一律留 NULL。
  -- 这张表此前只有 (student_id, class_id),没有 enrollment_id,而欠费是按报名
  -- (student × class × term) 算的 ⇒ 同一班级续读两个学期的学生,流水根本归不到期次上,
  -- 这正是"流水与 paidAmount 两套账"能长期各说各话的地基原因。
  -- 刻意不用「取最近一条报名」这类猜测式归并:猜出来的归属会把钱记到错误的期次上,
  -- 那比留 NULL(承认不知道)更坏 —— 留 NULL 的行仍计入报名级总额,只是不参与分期摊派。
  UPDATE "edu_payment_record" p
     SET "enrollment_id" = c.enrollment_id
    FROM (
          SELECT e."student_id", e."class_id", min(e."id"::text)::uuid AS enrollment_id, count(*) AS n
            FROM "edu_enrollment" e
           WHERE e."deleted_at" IS NULL
           GROUP BY e."student_id", e."class_id"
         ) c
   WHERE p."enrollment_id" IS NULL
     AND p."deleted_at" IS NULL
     AND c.n = 1
     AND p."student_id" = c."student_id"
     AND p."class_id" = c."class_id";

  -- 第二路:能通过账期反推归属的(账期天生带 enrollment_id),这是确定信息不是猜测。
  UPDATE "edu_payment_record" p
     SET "enrollment_id" = s."enrollment_id"
    FROM "edu_fee_schedule" s
   WHERE p."enrollment_id" IS NULL
     AND p."deleted_at" IS NULL
     AND p."schedule_id" = s."id";
END $$;

--> statement-breakpoint
DO $$
BEGIN
  -- 无损消歧:同一 receipt_no(未软删)只留最早一行动原样,其余加可追溯后缀。
  UPDATE "edu_payment_record" p
     SET "receipt_no" = p."receipt_no" || '#dup' || substr(p."id"::text, 1, 8)
   WHERE p."receipt_no" IS NOT NULL
     AND p."deleted_at" IS NULL
     AND p."id" <> (
           SELECT keep."id"
             FROM "edu_payment_record" keep
            WHERE keep."receipt_no" = p."receipt_no"
              AND keep."deleted_at" IS NULL
            ORDER BY keep."created_at" ASC, keep."id" ASC
            LIMIT 1
         );
END $$;

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_edu_payment_receipt_no" ON "edu_payment_record" ("receipt_no") WHERE "receipt_no" IS NOT NULL AND "deleted_at" IS NULL;
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
