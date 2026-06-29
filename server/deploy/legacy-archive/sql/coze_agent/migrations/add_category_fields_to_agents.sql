-- 为agents表添加分类冗余字段以提高查询性能
-- 执行时间: 2025-01-15
-- 描述: 添加agent_main_category和agent_category字段，从zhs_agent_category表同步数据

-- 检查agent_main_category字段是否存在，如果不存在则添加
SET @column_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'agents'
    AND COLUMN_NAME = 'agent_main_category'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE agents ADD COLUMN agent_main_category VARCHAR(500) COMMENT "主分类ID列表，逗号分割，对应zhs_agent_category.agent_main_category" AFTER type',
    'SELECT "agent_main_category 字段已存在，跳过添加" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 检查agent_category字段是否存在，如果不存在则添加
SET @column_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'agents'
    AND COLUMN_NAME = 'agent_category'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE agents ADD COLUMN agent_category VARCHAR(500) COMMENT "子分类ID列表，逗号分割，对应zhs_agent_category.agent_category" AFTER agent_main_category',
    'SELECT "agent_category 字段已存在，跳过添加" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 从zhs_agent_category表同步现有数据到agents表
UPDATE agents a 
LEFT JOIN zhs_agent_category ac ON a.agent_id = ac.agent_id 
SET 
    a.agent_main_category = ac.agent_main_category,
    a.agent_category = ac.agent_category
WHERE ac.agent_id IS NOT NULL;

-- 添加索引以提高查询性能
SET @index_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'agents'
    AND INDEX_NAME = 'idx_agents_categories'
);

SET @sql = IF(@index_exists = 0,
    'CREATE INDEX idx_agents_categories ON agents(agent_main_category, agent_category)',
    'SELECT "索引 idx_agents_categories 已存在，跳过创建" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加发布状态和分类的复合索引
SET @index_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'agents'
    AND INDEX_NAME = 'idx_agents_publish_categories'
);

SET @sql = IF(@index_exists = 0,
    'CREATE INDEX idx_agents_publish_categories ON agents(publish_status, agent_main_category, agent_category)',
    'SELECT "索引 idx_agents_publish_categories 已存在，跳过创建" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 显示执行结果
SELECT 
    'agents表分类字段迁移完成' AS status,
    NOW() AS executed_at,
    DATABASE() AS database_name,
    (SELECT COUNT(*) FROM agents WHERE agent_main_category IS NOT NULL) AS synced_main_category_count,
    (SELECT COUNT(*) FROM agents WHERE agent_category IS NOT NULL) AS synced_category_count;
