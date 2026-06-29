-- =====================================================
-- 模拟报名数据生成脚本
-- 为每个已发布的课程生成随机数量的模拟报名记录
-- =====================================================

-- 1. 先创建模拟会员数据（如果不存在）
-- 检查是否有会员数据，如果没有则创建模拟会员
INSERT IGNORE INTO t_member (id, name, avatar, phone, email, status, create_time, update_time)
SELECT * FROM (
    SELECT 1 AS id, '张三' AS name, 'https://api.dicebear.com/7.x/avataaars/svg?seed=1' AS avatar, '13800000001' AS phone, 'user1@example.com' AS email, 'active' AS status, NOW() AS create_time, NOW() AS update_time UNION ALL
    SELECT 2, '李四', 'https://api.dicebear.com/7.x/avataaars/svg?seed=2', '13800000002', 'user2@example.com', 'active', NOW(), NOW() UNION ALL
    SELECT 3, '王五', 'https://api.dicebear.com/7.x/avataaars/svg?seed=3', '13800000003', 'user3@example.com', 'active', NOW(), NOW() UNION ALL
    SELECT 4, '赵六', 'https://api.dicebear.com/7.x/avataaars/svg?seed=4', '13800000004', 'user4@example.com', 'active', NOW(), NOW() UNION ALL
    SELECT 5, '钱七', 'https://api.dicebear.com/7.x/avataaars/svg?seed=5', '13800000005', 'user5@example.com', 'active', NOW(), NOW() UNION ALL
    SELECT 6, '孙八', 'https://api.dicebear.com/7.x/avataaars/svg?seed=6', '13800000006', 'user6@example.com', 'active', NOW(), NOW() UNION ALL
    SELECT 7, '周九', 'https://api.dicebear.com/7.x/avataaars/svg?seed=7', '13800000007', 'user7@example.com', 'active', NOW(), NOW() UNION ALL
    SELECT 8, '吴十', 'https://api.dicebear.com/7.x/avataaars/svg?seed=8', '13800000008', 'user8@example.com', 'active', NOW(), NOW() UNION ALL
    SELECT 9, '郑一一', 'https://api.dicebear.com/7.x/avataaars/svg?seed=9', '13800000009', 'user9@example.com', 'active', NOW(), NOW() UNION ALL
    SELECT 10, '王小明', 'https://api.dicebear.com/7.x/avataaars/svg?seed=10', '13800000010', 'user10@example.com', 'active', NOW(), NOW() UNION ALL
    SELECT 11, '李小红', 'https://api.dicebear.com/7.x/avataaars/svg?seed=11', '13800000011', 'user11@example.com', 'active', NOW(), NOW() UNION ALL
    SELECT 12, '张小强', 'https://api.dicebear.com/7.x/avataaars/svg?seed=12', '13800000012', 'user12@example.com', 'active', NOW(), NOW() UNION ALL
    SELECT 13, '刘小芳', 'https://api.dicebear.com/7.x/avataaars/svg?seed=13', '13800000013', 'user13@example.com', 'active', NOW(), NOW() UNION ALL
    SELECT 14, '陈小伟', 'https://api.dicebear.com/7.x/avataaars/svg?seed=14', '13800000014', 'user14@example.com', 'active', NOW(), NOW() UNION ALL
    SELECT 15, '杨小丽', 'https://api.dicebear.com/7.x/avataaars/svg?seed=15', '13800000015', 'user15@example.com', 'active', NOW(), NOW() UNION ALL
    SELECT 16, 'AI学习者', 'https://api.dicebear.com/7.x/avataaars/svg?seed=16', '13800000016', 'user16@example.com', 'active', NOW(), NOW() UNION ALL
    SELECT 17, '技术达人', 'https://api.dicebear.com/7.x/avataaars/svg?seed=17', '13800000017', 'user17@example.com', 'active', NOW(), NOW() UNION ALL
    SELECT 18, '编程爱好者', 'https://api.dicebear.com/7.x/avataaars/svg?seed=18', '13800000018', 'user18@example.com', 'active', NOW(), NOW() UNION ALL
    SELECT 19, '设计师小王', 'https://api.dicebear.com/7.x/avataaars/svg?seed=19', '13800000019', 'user19@example.com', 'active', NOW(), NOW() UNION ALL
    SELECT 20, '产品经理', 'https://api.dicebear.com/7.x/avataaars/svg?seed=20', '13800000020', 'user20@example.com', 'active', NOW(), NOW() UNION ALL
    SELECT 21, '数据分析师', 'https://api.dicebear.com/7.x/avataaars/svg?seed=21', '13800000021', 'user21@example.com', 'active', NOW(), NOW() UNION ALL
    SELECT 22, '运营专员', 'https://api.dicebear.com/7.x/avataaars/svg?seed=22', '13800000022', 'user22@example.com', 'active', NOW(), NOW() UNION ALL
    SELECT 23, '市场营销', 'https://api.dicebear.com/7.x/avataaars/svg?seed=23', '13800000023', 'user23@example.com', 'active', NOW(), NOW() UNION ALL
    SELECT 24, '全栈工程师', 'https://api.dicebear.com/7.x/avataaars/svg?seed=24', '13800000024', 'user24@example.com', 'active', NOW(), NOW() UNION ALL
    SELECT 25, '前端开发', 'https://api.dicebear.com/7.x/avataaars/svg?seed=25', '13800000025', 'user25@example.com', 'active', NOW(), NOW() UNION ALL
    SELECT 26, '后端架构', 'https://api.dicebear.com/7.x/avataaars/svg?seed=26', '13800000026', 'user26@example.com', 'active', NOW(), NOW() UNION ALL
    SELECT 27, 'AI研究员', 'https://api.dicebear.com/7.x/avataaars/svg?seed=27', '13800000027', 'user27@example.com', 'active', NOW(), NOW() UNION ALL
    SELECT 28, '机器学习', 'https://api.dicebear.com/7.x/avataaars/svg?seed=28', '13800000028', 'user28@example.com', 'active', NOW(), NOW() UNION ALL
    SELECT 29, '深度学习', 'https://api.dicebear.com/7.x/avataaars/svg?seed=29', '13800000029', 'user29@example.com', 'active', NOW(), NOW() UNION ALL
    SELECT 30, '创业者', 'https://api.dicebear.com/7.x/avataaars/svg?seed=30', '13800000030', 'user30@example.com', 'active', NOW(), NOW()
) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM t_member WHERE id <= 30 LIMIT 1);

-- 2. 清空现有的报名数据（可选，如果需要重新生成）
-- TRUNCATE TABLE t_sign_up;

-- 3. 使用存储过程生成模拟报名数据
DELIMITER //

DROP PROCEDURE IF EXISTS generate_mock_signups//

CREATE PROCEDURE generate_mock_signups()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_lesson_id BIGINT;
    DECLARE v_signup_count INT;
    DECLARE v_member_id INT;
    DECLARE v_random_days INT;
    DECLARE v_status VARCHAR(50);
    DECLARE i INT;
    
    -- 游标：获取所有已发布的课程
    DECLARE lesson_cursor CURSOR FOR 
        SELECT id FROM t_lesson WHERE status = 'published';
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    OPEN lesson_cursor;
    
    lesson_loop: LOOP
        FETCH lesson_cursor INTO v_lesson_id;
        IF done THEN
            LEAVE lesson_loop;
        END IF;
        
        -- 为每个课程生成随机数量的报名记录 (50-500人)
        SET v_signup_count = FLOOR(50 + RAND() * 450);
        
        SET i = 1;
        WHILE i <= v_signup_count DO
            -- 随机选择会员ID (1-30)
            SET v_member_id = FLOOR(1 + RAND() * 30);
            
            -- 随机状态 (80% 已报名, 15% 已完成, 5% 已取消)
            SET v_status = CASE 
                WHEN RAND() < 0.80 THEN 'sign_up'
                WHEN RAND() < 0.95 THEN 'completed'
                ELSE 'cancel_sign_up'
            END;
            
            -- 随机报名时间 (过去90天内)
            SET v_random_days = FLOOR(RAND() * 90);
            
            -- 插入报名记录（忽略重复）
            INSERT IGNORE INTO t_sign_up (
                member_id, 
                lesson_id, 
                status, 
                create_time, 
                update_time,
                completed_time
            ) VALUES (
                v_member_id,
                v_lesson_id,
                v_status,
                DATE_SUB(NOW(), INTERVAL v_random_days DAY),
                DATE_SUB(NOW(), INTERVAL v_random_days DAY),
                CASE WHEN v_status = 'completed' THEN DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * v_random_days) DAY) ELSE NULL END
            );
            
            SET i = i + 1;
        END WHILE;
        
    END LOOP;
    
    CLOSE lesson_cursor;
END//

DELIMITER ;

-- 4. 执行存储过程生成数据
CALL generate_mock_signups();

-- 5. 删除存储过程
DROP PROCEDURE IF EXISTS generate_mock_signups;

-- 6. 查看生成结果
SELECT 
    l.id AS lesson_id,
    l.name AS lesson_name,
    COUNT(DISTINCT s.member_id) AS signup_count
FROM t_lesson l
LEFT JOIN t_sign_up s ON l.id = s.lesson_id
WHERE l.status = 'published'
GROUP BY l.id, l.name
ORDER BY signup_count DESC;

-- 7. 查看总体统计
SELECT 
    '课程总数' AS metric,
    (SELECT COUNT(*) FROM t_lesson WHERE status = 'published') AS value
UNION ALL
SELECT 
    '报名记录总数',
    (SELECT COUNT(*) FROM t_sign_up)
UNION ALL
SELECT 
    '独立报名人数',
    (SELECT COUNT(DISTINCT member_id) FROM t_sign_up);
