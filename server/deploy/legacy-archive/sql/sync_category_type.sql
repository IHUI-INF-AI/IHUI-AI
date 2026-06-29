-- ================================================================
-- 同步分类数据 - 让所有板块共享同一套分类
-- 执行此脚本将把所有分类的 type 设置为 'live'
-- 来源: H:\历史项目存档\edu client\scripts\sync_category_type.sql
-- 归档时间: 2026-06-28（第 16 轮深度核查补齐）
-- ================================================================

USE `cloud_learning_content`;

-- 查看当前分类数据分布
SELECT 
    IFNULL(type, 'NULL') as category_type, 
    COUNT(*) as count 
FROM t_category 
GROUP BY type;

-- 更新所有分类的 type 为 'live'
UPDATE t_category SET type = 'live' WHERE type IS NULL OR type != 'live';

-- 验证更新结果
SELECT 
    IFNULL(type, 'NULL') as category_type, 
    COUNT(*) as count 
FROM t_category 
GROUP BY type;

-- 显示更新后的分类总数
SELECT COUNT(*) as total_categories FROM t_category WHERE is_show = 1;
