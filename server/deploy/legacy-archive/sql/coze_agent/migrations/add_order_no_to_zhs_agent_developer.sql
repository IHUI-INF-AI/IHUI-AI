-- 为 zhs_agent_developer 表添加 order_no 订单编号字段
-- 执行时间: 2025-01-11
-- 描述: 新增订单编号字段，格式为 WXK+年月日+6位数自增

-- 1. 添加 order_no 字段
ALTER TABLE zhs_agent_developer 
ADD COLUMN order_no varchar(64) DEFAULT NULL COMMENT '订单编号，格式：WXK+年月日+6位数自增，如：WXK20250811000001';

-- 2. 添加唯一索引
ALTER TABLE zhs_agent_developer 
ADD UNIQUE KEY uk_order_no (order_no) COMMENT '订单编号唯一索引';

-- 3. 为现有数据生成订单编号（如果有现有数据的话）
-- 注意：这个脚本会为现有记录生成订单编号，基于创建时间或购买时间
UPDATE zhs_agent_developer 
SET order_no = CONCAT(
    'WXK',
    DATE_FORMAT(COALESCE(bug_time, NOW()), '%Y%m%d'),
    LPAD(
        (@row_number := COALESCE(@row_number, 0) + 1), 
        6, 
        '0'
    )
)
WHERE order_no IS NULL
AND (@row_number := 0) IS NOT NULL
ORDER BY COALESCE(bug_time, NOW()), id;

-- 重置变量
SET @row_number = NULL;
