-- 批次7：财务管理 - 学费标准表 + 缴费记录表 + 退费记录表
CREATE TABLE IF NOT EXISTS "edu_tuition_fee" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "class_id" uuid NOT NULL REFERENCES "edu_class"("id") ON DELETE CASCADE,
  "term_id" uuid NOT NULL REFERENCES "edu_term"("id") ON DELETE CASCADE,
  "fee_name" varchar(100) NOT NULL,
  "amount" integer NOT NULL,
  "billing_cycle" varchar(30) DEFAULT 'term' NOT NULL,
  "effective_date" date NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ix_edu_fee_class" ON "edu_tuition_fee" ("class_id");
CREATE INDEX IF NOT EXISTS "ix_edu_fee_term" ON "edu_tuition_fee" ("term_id");
CREATE INDEX IF NOT EXISTS "ix_edu_fee_active" ON "edu_tuition_fee" ("is_active");

CREATE TABLE IF NOT EXISTS "edu_payment_record" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "student_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "class_id" uuid NOT NULL REFERENCES "edu_class"("id") ON DELETE CASCADE,
  "fee_id" uuid REFERENCES "edu_tuition_fee"("id"),
  "amount" integer NOT NULL,
  "payment_date" date NOT NULL,
  "payment_method" varchar(30) NOT NULL,
  "status" varchar(20) DEFAULT 'paid' NOT NULL,
  "receipt_no" varchar(100),
  "remark" text,
  "operator_id" uuid REFERENCES "users"("id"),
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ix_edu_pay_student" ON "edu_payment_record" ("student_id");
CREATE INDEX IF NOT EXISTS "ix_edu_pay_class" ON "edu_payment_record" ("class_id");
CREATE INDEX IF NOT EXISTS "ix_edu_pay_fee" ON "edu_payment_record" ("fee_id");
CREATE INDEX IF NOT EXISTS "ix_edu_pay_date" ON "edu_payment_record" ("payment_date");

CREATE TABLE IF NOT EXISTS "edu_refund_record" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "student_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "class_id" uuid NOT NULL REFERENCES "edu_class"("id") ON DELETE CASCADE,
  "payment_id" uuid REFERENCES "edu_payment_record"("id"),
  "amount" integer NOT NULL,
  "refund_date" date NOT NULL,
  "refund_method" varchar(30),
  "reason" text NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "approver_id" uuid REFERENCES "users"("id"),
  "approve_remark" text,
  "approve_at" timestamp with time zone,
  "operator_id" uuid REFERENCES "users"("id"),
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ix_edu_refund_student" ON "edu_refund_record" ("student_id");
CREATE INDEX IF NOT EXISTS "ix_edu_refund_class" ON "edu_refund_record" ("class_id");
CREATE INDEX IF NOT EXISTS "ix_edu_refund_payment" ON "edu_refund_record" ("payment_id");
CREATE INDEX IF NOT EXISTS "ix_edu_refund_status" ON "edu_refund_record" ("status");