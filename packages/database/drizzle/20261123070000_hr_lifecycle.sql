-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- Migration 20261123070000: 人事生命周期(合同/试用转正/离职/招聘)
-- 创建时间: 2026-11-23
-- 描述:
--   补齐"招聘 → 录用入职 → 签合同 → 试用转正 → 离职办结"主干。
--   ① hr_employee 加 regular_date / resign_date 两个主档日期(转正/离职的常用筛选维);
--   ② 新建 hr_contract(劳动合同,含续签链与试用期)、hr_probation_review(转正评估)、
--      hr_resignation(离职申请与交接清单)、hr_job_opening(招聘岗位)、
--      hr_candidate(候选人)、hr_interview(面试轮次) 共 6 表。
--   全部 IF NOT EXISTS / 加列容错,可重复执行。

ALTER TABLE "hr_employee" ADD COLUMN IF NOT EXISTS "regular_date" date;
ALTER TABLE "hr_employee" ADD COLUMN IF NOT EXISTS "resign_date" date;

CREATE TABLE IF NOT EXISTS "hr_contract" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "employee_id" uuid NOT NULL REFERENCES "hr_employee"("id") ON DELETE CASCADE,
  "contract_no" varchar(60) NOT NULL,
  "contract_type" varchar(20) NOT NULL DEFAULT 'fixed',
  "start_date" date NOT NULL,
  "end_date" date,
  "probation_months" integer NOT NULL DEFAULT 0,
  "probation_end_date" date,
  "probation_salary_rate" numeric(5,2),
  "status" varchar(20) NOT NULL DEFAULT 'draft',
  "signed_at" timestamp with time zone,
  "file_url" varchar(500),
  "parent_contract_id" uuid REFERENCES "hr_contract"("id") ON DELETE SET NULL,
  "terminate_reason" text,
  "approval_ref" varchar(100),
  "remark" text,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ix_hr_contract_emp" ON "hr_contract" ("employee_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_hr_contract_no" ON "hr_contract" ("contract_no");
CREATE INDEX IF NOT EXISTS "ix_hr_contract_end" ON "hr_contract" ("end_date");
CREATE INDEX IF NOT EXISTS "ix_hr_contract_status" ON "hr_contract" ("status");

CREATE TABLE IF NOT EXISTS "hr_probation_review" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "employee_id" uuid NOT NULL REFERENCES "hr_employee"("id") ON DELETE CASCADE,
  "contract_id" uuid REFERENCES "hr_contract"("id") ON DELETE SET NULL,
  "result" varchar(20) NOT NULL,
  "score" integer,
  "self_summary" text,
  "manager_comment" text,
  "extended_until" date,
  "decided_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "decided_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ix_hr_probation_emp" ON "hr_probation_review" ("employee_id");
CREATE INDEX IF NOT EXISTS "ix_hr_probation_result" ON "hr_probation_review" ("result");

CREATE TABLE IF NOT EXISTS "hr_resignation" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "employee_id" uuid NOT NULL REFERENCES "hr_employee"("id") ON DELETE CASCADE,
  "apply_date" date NOT NULL,
  "last_work_date" date NOT NULL,
  "reason_type" varchar(20) NOT NULL DEFAULT 'voluntary',
  "reason" text,
  "handover_to" uuid REFERENCES "hr_employee"("id") ON DELETE SET NULL,
  "handover_note" text,
  "status" varchar(20) NOT NULL DEFAULT 'applied',
  "checklist" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "approved_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "approved_at" timestamp with time zone,
  "settled_at" timestamp with time zone,
  "certificate_no" varchar(60),
  "last_salary_period" varchar(20),
  "approval_ref" varchar(100),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ix_hr_resign_emp" ON "hr_resignation" ("employee_id");
CREATE INDEX IF NOT EXISTS "ix_hr_resign_status" ON "hr_resignation" ("status");
CREATE INDEX IF NOT EXISTS "ix_hr_resign_last_work" ON "hr_resignation" ("last_work_date");

CREATE TABLE IF NOT EXISTS "hr_job_opening" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" varchar(60) NOT NULL,
  "title" varchar(100) NOT NULL,
  "department_id" uuid NOT NULL REFERENCES "hr_department"("id") ON DELETE CASCADE,
  "head_count" integer NOT NULL DEFAULT 1,
  "hired_count" integer NOT NULL DEFAULT 0,
  "employment_type" varchar(20) NOT NULL DEFAULT 'fulltime',
  "salary_min" integer,
  "salary_max" integer,
  "requirements" text,
  "status" varchar(20) NOT NULL DEFAULT 'draft',
  "opened_at" timestamp with time zone,
  "closed_at" timestamp with time zone,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_hr_opening_code" ON "hr_job_opening" ("code");
CREATE INDEX IF NOT EXISTS "ix_hr_opening_dept" ON "hr_job_opening" ("department_id");
CREATE INDEX IF NOT EXISTS "ix_hr_opening_status" ON "hr_job_opening" ("status");

CREATE TABLE IF NOT EXISTS "hr_candidate" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "opening_id" uuid NOT NULL REFERENCES "hr_job_opening"("id") ON DELETE CASCADE,
  "name" varchar(100) NOT NULL,
  "phone" varchar(30),
  "email" varchar(120),
  "resume_url" varchar(500),
  "source" varchar(30) NOT NULL DEFAULT 'other',
  "stage" varchar(20) NOT NULL DEFAULT 'applied',
  "reject_reason" text,
  "expected_salary" integer,
  "applied_at" timestamp with time zone NOT NULL DEFAULT now(),
  "employee_id" uuid REFERENCES "hr_employee"("id") ON DELETE SET NULL,
  "remark" text,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ix_hr_candidate_opening" ON "hr_candidate" ("opening_id");
CREATE INDEX IF NOT EXISTS "ix_hr_candidate_stage" ON "hr_candidate" ("stage");
CREATE INDEX IF NOT EXISTS "ix_hr_candidate_emp" ON "hr_candidate" ("employee_id");

CREATE TABLE IF NOT EXISTS "hr_interview" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "candidate_id" uuid NOT NULL REFERENCES "hr_candidate"("id") ON DELETE CASCADE,
  "round" integer NOT NULL DEFAULT 1,
  "scheduled_at" timestamp with time zone,
  "mode" varchar(20) NOT NULL DEFAULT 'onsite',
  "interviewer_name" varchar(100),
  "interviewer_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "score" integer,
  "result" varchar(20) NOT NULL DEFAULT 'pending',
  "feedback" text,
  "decided_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ix_hr_interview_candidate" ON "hr_interview" ("candidate_id", "round");
CREATE INDEX IF NOT EXISTS "ix_hr_interview_result" ON "hr_interview" ("result");
CREATE INDEX IF NOT EXISTS "ix_hr_interview_scheduled" ON "hr_interview" ("scheduled_at");
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
