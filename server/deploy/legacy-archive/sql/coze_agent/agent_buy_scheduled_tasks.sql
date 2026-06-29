-- 智能体购买任务调度备份表
-- 用于Redis重启后的任务恢复

CREATE TABLE IF NOT EXISTS agent_buy_scheduled_tasks (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    buy_record_id VARCHAR(36) NOT NULL COMMENT '购买记录ID',
    user_uuid VARCHAR(36) NOT NULL COMMENT '用户UUID',
    agent_id VARCHAR(64) NOT NULL COMMENT '智能体ID',
    agent_name VARCHAR(128) COMMENT '智能体名称',
    event_type ENUM('24h_before', '3h_before', '1h_before', 'expired') NOT NULL COMMENT '事件类型',
    scheduled_time DATETIME NOT NULL COMMENT '调度时间',
    status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending' COMMENT '任务状态',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    -- 唯一约束：同一购买记录的同一事件类型只能有一个任务
    UNIQUE KEY uk_task (buy_record_id, event_type),
    
    -- 索引优化
    INDEX idx_scheduled_time (scheduled_time, status) COMMENT '按调度时间和状态查询',
    INDEX idx_buy_record (buy_record_id) COMMENT '按购买记录查询',
    INDEX idx_status (status) COMMENT '按状态查询',
    INDEX idx_user_uuid (user_uuid) COMMENT '按用户查询',
    INDEX idx_agent_id (agent_id) COMMENT '按智能体查询'
) COMMENT='智能体购买任务调度备份表 - 用于Redis重启后的任务恢复';

-- 创建清理过期任务的存储过程
DELIMITER //

CREATE PROCEDURE IF NOT EXISTS CleanupCompletedTasks(
    IN cleanup_days INT DEFAULT 7
)
BEGIN
    DECLARE cleaned_count INT DEFAULT 0;
    
    -- 清理指定天数前的已完成任务
    DELETE FROM agent_buy_scheduled_tasks 
    WHERE status IN ('completed', 'failed')
    AND updated_at < DATE_SUB(NOW(), INTERVAL cleanup_days DAY);
    
    SET cleaned_count = ROW_COUNT();
    
    -- 记录清理结果
    SELECT CONCAT('清理了 ', cleaned_count, ' 个过期任务') as result;
END //

DELIMITER ;

-- 创建获取待处理任务的存储过程
DELIMITER //

CREATE PROCEDURE IF NOT EXISTS GetPendingTasks(
    IN hours_ahead INT DEFAULT 25,
    IN limit_count INT DEFAULT 1000
)
BEGIN
    -- 获取指定时间范围内的待处理任务
    SELECT 
        id,
        buy_record_id,
        user_uuid,
        agent_id,
        agent_name,
        event_type,
        scheduled_time,
        TIMESTAMPDIFF(MINUTE, NOW(), scheduled_time) as minutes_to_execute
    FROM agent_buy_scheduled_tasks 
    WHERE status = 'pending'
    AND scheduled_time > NOW()
    AND scheduled_time <= DATE_ADD(NOW(), INTERVAL hours_ahead HOUR)
    ORDER BY scheduled_time ASC
    LIMIT limit_count;
END //

DELIMITER ;

-- 创建标记任务完成的存储过程
DELIMITER //

CREATE PROCEDURE IF NOT EXISTS MarkTaskCompleted(
    IN task_id VARCHAR(36),
    IN task_status ENUM('completed', 'failed') DEFAULT 'completed'
)
BEGIN
    UPDATE agent_buy_scheduled_tasks 
    SET 
        status = task_status,
        updated_at = NOW()
    WHERE id = task_id;
    
    SELECT ROW_COUNT() as affected_rows;
END //

DELIMITER ;

-- 插入示例数据（可选，用于测试）
/*
INSERT INTO agent_buy_scheduled_tasks 
(buy_record_id, user_uuid, agent_id, agent_name, event_type, scheduled_time)
VALUES 
('test_buy_001', 'user_001', 'agent_001', '测试智能体1', '24h_before', DATE_ADD(NOW(), INTERVAL 23 HOUR)),
('test_buy_001', 'user_001', 'agent_001', '测试智能体1', '3h_before', DATE_ADD(NOW(), INTERVAL 2 HOUR)),
('test_buy_001', 'user_001', 'agent_001', '测试智能体1', '1h_before', DATE_ADD(NOW(), INTERVAL 30 MINUTE)),
('test_buy_001', 'user_001', 'agent_001', '测试智能体1', 'expired', DATE_ADD(NOW(), INTERVAL 1 DAY));
*/

-- 查看表结构
DESCRIBE agent_buy_scheduled_tasks;

-- 查看索引
SHOW INDEX FROM agent_buy_scheduled_tasks;

-- 查看存储过程
SHOW PROCEDURE STATUS WHERE Name LIKE '%Task%';
