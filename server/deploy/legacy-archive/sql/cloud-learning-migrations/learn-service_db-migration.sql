-- 数据库迁移脚本 - 修复 learn 服务的表结构问题
-- 请在 MySQL 中执行以下 SQL 语句

-- 使用正确的数据库
USE cloud_learning_content;

-- 1. 修复 t_sign_up 表：将 sign_up 状态值更新为 signed_up（如果需要保持一致性）
-- 注意：代码已经添加了 sign_up 枚举值，所以这一步是可选的
-- UPDATE t_sign_up SET status = 'signed_up' WHERE status = 'sign_up';

-- 2. 为 t_lesson 表添加 exam_paper_id 列（如果不存在）
SET @columnExists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                     WHERE TABLE_SCHEMA = 'cloud_learning_content' 
                     AND TABLE_NAME = 't_lesson' 
                     AND COLUMN_NAME = 'exam_paper_id');
SET @query = IF(@columnExists = 0, 
    'ALTER TABLE t_lesson ADD COLUMN exam_paper_id BIGINT DEFAULT NULL COMMENT ''试卷ID''',
    'SELECT ''exam_paper_id column already exists'' as message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. 为 t_record 表添加缺失的列（如果不存在）
-- 添加 progress 列
SET @columnExists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                     WHERE TABLE_SCHEMA = 'cloud_learning_content' 
                     AND TABLE_NAME = 't_record' 
                     AND COLUMN_NAME = 'progress');
SET @query = IF(@columnExists = 0, 
    'ALTER TABLE t_record ADD COLUMN progress DECIMAL(10,2) DEFAULT 0 COMMENT ''进度''',
    'SELECT ''progress column already exists'' as message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. 验证表结构
SELECT 'Checking t_lesson columns:' as info;
SHOW COLUMNS FROM t_lesson;

SELECT 'Checking t_record columns:' as info;
SHOW COLUMNS FROM t_record;

SELECT 'Checking t_sign_up status values:' as info;
SELECT DISTINCT status FROM t_sign_up;
