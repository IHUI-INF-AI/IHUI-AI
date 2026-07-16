-- certificate_templates 表新增 4 字段:颁发机构/颁发人/获奖条件/有效期策略
-- 对应 schema: packages/database/src/schema/certificate.ts certificateTemplates.awardingOrganization/awarderName/awardConditions/validityPolicy
ALTER TABLE "certificate_templates"
  ADD COLUMN IF NOT EXISTS "awarding_organization" text,
  ADD COLUMN IF NOT EXISTS "awarder_name" text,
  ADD COLUMN IF NOT EXISTS "award_conditions" text,
  ADD COLUMN IF NOT EXISTS "validity_policy" text;
