-- 修复 t_exam_chapter 表缺少 sort_order 列的问题
-- 执行方式：通过 MySQL 客户端工具（如 Navicat、DBeaver、MySQL Workbench）连接数据库后执行
-- 来源: H:\历史项目存档\edu client\scripts\fix_exam_chapter_table.sql
-- 归档时间: 2026-06-28（第 16 轮深度核查补齐）
-- 注意: 原始脚本含数据库连接信息（已脱敏移除），上线前必须使用新凭证

-- 数据库连接信息（脱敏后，请使用 .env 配置的实际凭证）：
-- Host: <DB_HOST>（参考 .env / config.py）
-- Port: 3306
-- Database: cloud_learning_content

-- 检查列是否已存在，如果不存在则添加
SET @dbname = 'cloud_learning_content';
SET @tablename = 't_exam_chapter';
SET @columnname = 'sort_order';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
    AND TABLE_NAME = @tablename
    AND COLUMN_NAME = @columnname
  ) > 0,
  'SELECT "Column already exists."',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' INT DEFAULT 0 COMMENT "排序";')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 或者直接执行（如果确定列不存在）：
-- ALTER TABLE t_exam_chapter ADD COLUMN sort_order INT DEFAULT 0 COMMENT '排序';
