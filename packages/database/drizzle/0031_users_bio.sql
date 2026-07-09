-- 0031: users 表新增 bio 列(个人简介)
-- 前端 profile 页已有 bio 表单,但后端/DB 缺失该字段,导致表单失效
ALTER TABLE "users" ADD COLUMN "bio" text;
