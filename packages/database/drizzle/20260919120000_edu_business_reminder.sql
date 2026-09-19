-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌​‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​​‌‍‍​‌‌​‌‌​‌‌‌‍‍‌‌​​​​​‌‍‍​‌‌​‌​​‌‍‍​‌​‌​​‌‍‍​‌​‌​​‌‍‍​‌‌​‌‌​⁠

-- 教育业务线与催费(2026-09-19 立):edu_class.business_line 区分托管/幼儿园/文化课/AI课等,
-- 机构按业务线管理班级与学生名册;edu_fee_reminder 催费动作留痕(欠费快照 due_amount)。
-- 幂等:IF NOT EXISTS。外键 users/edu_enrollment/edu_class,除 student 级联外均 ON DELETE SET NULL。

ALTER TABLE "edu_class" ADD COLUMN IF NOT EXISTS "business_line" varchar(30) DEFAULT 'other' NOT NULL;
CREATE INDEX IF NOT EXISTS "ix_edu_class_business" ON "edu_class" ("business_line");

CREATE TABLE IF NOT EXISTS "edu_fee_reminder" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "enrollment_id" uuid REFERENCES "edu_enrollment" ("id") ON DELETE SET NULL,
  "class_id" uuid REFERENCES "edu_class" ("id") ON DELETE SET NULL,
  "due_amount" integer DEFAULT 0 NOT NULL,
  "channel" varchar(30) DEFAULT 'in_app' NOT NULL,
  "status" varchar(20) DEFAULT 'sent' NOT NULL,
  "message" text,
  "operator_id" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ix_edu_reminder_student" ON "edu_fee_reminder" ("student_id");
CREATE INDEX IF NOT EXISTS "ix_edu_reminder_enrollment" ON "edu_fee_reminder" ("enrollment_id");
CREATE INDEX IF NOT EXISTS "ix_edu_reminder_created" ON "edu_fee_reminder" ("created_at");
