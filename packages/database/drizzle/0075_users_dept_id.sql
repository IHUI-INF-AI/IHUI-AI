-- users 表新增 dept_id 字段,关联 sys_dept 表(deptId)
-- 对应 schema: packages/database/src/schema/users.ts users.deptId
ALTER TABLE "users" ADD COLUMN "dept_id" integer REFERENCES "sys_dept"("dept_id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "users_dept_id_idx" ON "users" ("dept_id");
