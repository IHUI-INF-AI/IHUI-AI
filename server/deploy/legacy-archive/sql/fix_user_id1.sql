-- ============================================================
-- 修复 UserCenterFeignClient 500 错误
-- 问题：t_user 表缺少 id=1 的管理员用户
-- 数据库：cloud_learning_content
-- 执行时间：请在数据库管理工具中执行
-- ============================================================

-- 第一步：检查现有数据
-- 查看 t_user 表是否有数据，以及现有用户的 ID
SELECT id, username, name, mobile, status, create_time 
FROM t_user 
ORDER BY id 
LIMIT 20;

-- 查看是否已存在 id=1 的用户
SELECT * FROM t_user WHERE id = 1;

-- ============================================================
-- 第二步：插入管理员用户（如果 id=1 不存在）
-- 密码：admin123 (BCrypt 加密)
-- ============================================================

-- 方式1：直接插入（如果 id=1 不存在）
INSERT INTO t_user (id, username, password, name, mobile, status, code, gender, create_time, update_time)
SELECT 1, 'admin', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iAt1vKT.', '超级管理员', '13800000000', 'normal', '001', '', NOW(), NOW()
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM t_user WHERE id = 1);

-- 同时需要关联部门（假设部门 id=1 或 id=2 存在）
INSERT INTO t_user_department (user_id, department_id, create_time, update_time)
SELECT 1, 2, NOW(), NOW()
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM t_user_department WHERE user_id = 1);

-- ============================================================
-- 第三步：验证插入结果
-- ============================================================

-- 确认用户已创建
SELECT id, username, name, mobile, status FROM t_user WHERE id = 1;

-- 确认部门关联
SELECT * FROM t_user_department WHERE user_id = 1;

-- ============================================================
-- 可选：如果需要检查部门表
-- ============================================================
SELECT id, name FROM t_department ORDER BY id LIMIT 10;
