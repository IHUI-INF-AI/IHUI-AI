-- users 表添加 level 字段(用户会员等级)
-- 修复 admin-missing-routes.ts GET/PATCH /api/admin/member/users 中 level 被静默忽略的 bug
-- 前端管理后台使用 0=普通 / 1=白银 / 2=黄金 / 3=钻石
-- 与 is_vip 区分:is_vip 是会员身份(-1/0/1/2),level 是显示等级(0-3)
-- 幂等可重复执行

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "level" integer DEFAULT 0 NOT NULL;
CREATE INDEX IF NOT EXISTS "users_level_idx" ON "users" ("level");
