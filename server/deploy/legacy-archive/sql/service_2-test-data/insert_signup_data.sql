-- =====================================================
-- 模拟报名数据插入脚本
-- 数据库: cloud_learning_content
-- 表: t_sign_up
-- =====================================================

-- 使用数据库
USE cloud_learning_content;

-- 查看现有课程
SELECT id, name, status FROM t_lesson WHERE status = 'published' LIMIT 20;

-- 查看现有会员（如果有的话）
SELECT id, name FROM t_member LIMIT 10;

-- 先清空现有的报名数据（可选，根据需要取消注释）
-- TRUNCATE TABLE t_sign_up;

-- 为每个已发布的课程插入模拟报名数据
-- 使用INSERT IGNORE避免重复插入

-- 课程1的报名数据 (假设课程ID从1开始，实际ID根据查询结果调整)
INSERT IGNORE INTO t_sign_up (member_id, lesson_id, status, create_time, update_time) VALUES
(1, 1, 'sign_up', DATE_SUB(NOW(), INTERVAL FLOOR(RAND()*90) DAY), NOW()),
(2, 1, 'sign_up', DATE_SUB(NOW(), INTERVAL FLOOR(RAND()*90) DAY), NOW()),
(3, 1, 'completed', DATE_SUB(NOW(), INTERVAL FLOOR(RAND()*90) DAY), NOW()),
(4, 1, 'sign_up', DATE_SUB(NOW(), INTERVAL FLOOR(RAND()*90) DAY), NOW()),
(5, 1, 'sign_up', DATE_SUB(NOW(), INTERVAL FLOOR(RAND()*90) DAY), NOW());

-- 动态生成报名数据的存储过程
DELIMITER //

DROP PROCEDURE IF EXISTS insert_mock_signups//

CREATE PROCEDURE insert_mock_signups()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_lesson_id BIGINT;
    DECLARE v_member_count INT DEFAULT 30;  -- 模拟30个会员
    DECLARE v_signup_count INT;
    DECLARE i INT;
    DECLARE v_member_id INT;
    DECLARE v_status VARCHAR(50);
    DECLARE v_days INT;
    
    -- 游标获取所有已发布课程
    DECLARE lesson_cursor CURSOR FOR 
        SELECT id FROM t_lesson WHERE status = 'published';
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    -- 确保有模拟会员数据
    -- 如果t_member表为空或数据不足，先插入模拟会员
    INSERT IGNORE INTO t_member (id, name, phone, status, create_time, update_time)
    SELECT n, CONCAT('用户', n), CONCAT('1380000', LPAD(n, 4, '0')), 'active', NOW(), NOW()
    FROM (
        SELECT 1 AS n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5
        UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10
        UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15
        UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19 UNION SELECT 20
        UNION SELECT 21 UNION SELECT 22 UNION SELECT 23 UNION SELECT 24 UNION SELECT 25
        UNION SELECT 26 UNION SELECT 27 UNION SELECT 28 UNION SELECT 29 UNION SELECT 30
    ) AS nums;
    
    OPEN lesson_cursor;
    
    lesson_loop: LOOP
        FETCH lesson_cursor INTO v_lesson_id;
        IF done THEN
            LEAVE lesson_loop;
        END IF;
        
        -- 每个课程生成 50-300 个报名记录
        SET v_signup_count = 50 + FLOOR(RAND() * 251);
        
        SET i = 1;
        WHILE i <= v_signup_count DO
            -- 随机会员ID (1-30)
            SET v_member_id = 1 + FLOOR(RAND() * v_member_count);
            
            -- 随机状态 (85% 已报名, 10% 已完成, 5% 已取消)
            SET v_status = CASE 
                WHEN RAND() < 0.85 THEN 'sign_up'
                WHEN RAND() < 0.95 THEN 'completed'
                ELSE 'cancel_sign_up'
            END;
            
            -- 随机天数 (过去90天内)
            SET v_days = FLOOR(RAND() * 90);
            
            -- 插入报名记录
            INSERT IGNORE INTO t_sign_up (member_id, lesson_id, status, create_time, update_time, completed_time)
            VALUES (
                v_member_id,
                v_lesson_id,
                v_status,
                DATE_SUB(NOW(), INTERVAL v_days DAY),
                NOW(),
                CASE WHEN v_status = 'completed' THEN DATE_SUB(NOW(), INTERVAL FLOOR(v_days/2) DAY) ELSE NULL END
            );
            
            SET i = i + 1;
        END WHILE;
    END LOOP;
    
    CLOSE lesson_cursor;
    
    SELECT '报名数据插入完成！' AS message;
END//

DELIMITER ;

-- 执行存储过程
CALL insert_mock_signups();

-- 清理
DROP PROCEDURE IF EXISTS insert_mock_signups;

-- 验证结果：查看每个课程的报名人数
SELECT 
    l.id AS 课程ID,
    l.name AS 课程名称,
    COUNT(DISTINCT s.member_id) AS 报名人数
FROM t_lesson l
LEFT JOIN t_sign_up s ON l.id = s.lesson_id
WHERE l.status = 'published'
GROUP BY l.id, l.name
ORDER BY 报名人数 DESC
LIMIT 20;

-- 查看总体统计
SELECT 
    (SELECT COUNT(*) FROM t_lesson WHERE status = 'published') AS 已发布课程数,
    (SELECT COUNT(*) FROM t_sign_up) AS 总报名记录数,
    (SELECT COUNT(DISTINCT member_id) FROM t_sign_up) AS 报名会员数;
