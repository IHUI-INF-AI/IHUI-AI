-- 添加 issue_no 字段到 zhs_agent_settlement 表
-- 执行时间: 2025-01-15
-- 描述: 为结算表添加期号字段，用于按月分期结算管理

-- 检查字段是否存在，如果不存在则添加
SET @column_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'zhs_agent_settlement'
    AND COLUMN_NAME = 'issue_no'
);

-- 如果字段不存在，则添加
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE zhs_agent_settlement ADD COLUMN issue_no INT COMMENT "期号，按过期时间排序从1开始递增" AFTER expiration_date',
    'SELECT "issue_no 字段已存在，跳过添加" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加复合索引（如果不存在）
SET @index_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'zhs_agent_settlement'
    AND INDEX_NAME = 'idx_settlement_order_issue'
);

SET @sql = IF(@index_exists = 0,
    'CREATE INDEX idx_settlement_order_issue ON zhs_agent_settlement(order_no, issue_no)',
    'SELECT "索引 idx_settlement_order_issue 已存在，跳过创建" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 显示执行结果
SELECT 
    'issue_no 字段迁移完成' AS status,
    NOW() AS executed_at,
    DATABASE() AS database_name;
