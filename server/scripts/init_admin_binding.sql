-- =============================================================
-- init_admin_binding.sql (2026-07-06 立)
--
-- 目的:
--   给 admin_user 表的 phone 和 email 列加 UNIQUE 约束, 防止多个 user 用
--   同一个手机号/邮箱, 导致 login_by_password OR 查询命中非预期的 user.
--
-- 适用场景:
--   1. 已存在 admin_user 数据但不想跑 alembic upgrade 的项目
--   2. init_db.py / Base.metadata.create_all 没被调用过 (例如手动建表)
--   3. 旧版迁移链 (001-028) 未包含此约束
--
-- 跨数据库兼容:
--   - PostgreSQL: CREATE UNIQUE INDEX IF NOT EXISTS (支持)
--   - SQLite: CREATE UNIQUE INDEX IF NOT EXISTS (支持, 9.0+)
--
-- 幂等: IF NOT EXISTS 保证重复执行不报错
-- 重复数据检查: 如果之前已有重复 phone/email, 本脚本会失败, 需先人工清理
-- =============================================================

-- 1. phone 唯一索引 (DB 列名 phone, Python 属性名 phonenumber)
CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_user_phone
  ON admin_user (phone);

-- 2. email 唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_user_email
  ON admin_user (email);

-- 3. (可选) 加速 login_by_password 的三路 OR 查询
--    user_name 已有 unique 约束, 这里只补 phone/email 的非唯一索引 (已有 unique 自动有索引)
--    此处不创建, 避免冗余

-- =============================================================
-- 验证脚本
-- =============================================================
-- PG:
--   SELECT indexname, indexdef FROM pg_indexes
--   WHERE tablename = 'admin_user' AND indexname LIKE 'uq_admin_user_%';
--
-- SQLite:
--   SELECT name, sql FROM sqlite_master
--   WHERE type='index' AND tbl_name='admin_user' AND name LIKE 'uq_admin_user_%';
--
-- 期望输出: 2 行 (uq_admin_user_phone, uq_admin_user_email)
-- =============================================================
