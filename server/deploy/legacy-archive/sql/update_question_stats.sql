-- 为问答数据生成模拟的交互数据
-- 数据库: cloud_learning_content
-- 表: t_question
-- 来源: H:\历史项目存档\edu client\scripts\update_question_stats.sql
-- 归档时间: 2026-06-28（第 16 轮深度核查补齐）

-- 策略说明：
-- 1. 热门问题（约10%）：查看数 10000-50000，点赞 500-3000，收藏 200-1500
-- 2. 中等热度（约30%）：查看数 2000-10000，点赞 100-500，收藏 50-300
-- 3. 普通问题（约40%）：查看数 500-2000，点赞 20-100，收藏 10-80
-- 4. 冷门问题（约20%）：查看数 50-500，点赞 5-20，收藏 2-15

-- 首先查看当前有多少问题
SELECT COUNT(*) as total_questions FROM t_question;

-- 创建临时变量来存储总数
SET @total = (SELECT COUNT(*) FROM t_question);
SET @hot_count = FLOOR(@total * 0.1);
SET @medium_count = FLOOR(@total * 0.3);
SET @normal_count = FLOOR(@total * 0.4);

-- 方法1：使用随机函数直接更新所有记录
-- 为所有问题生成随机的交互数据

UPDATE t_question 
SET 
    view_num = CASE 
        -- 热门问题 (根据id取模模拟随机分布)
        WHEN (id % 10) = 0 THEN FLOOR(10000 + RAND() * 40000)
        -- 中等热度
        WHEN (id % 10) IN (1, 2, 3) THEN FLOOR(2000 + RAND() * 8000)
        -- 普通问题
        WHEN (id % 10) IN (4, 5, 6, 7) THEN FLOOR(500 + RAND() * 1500)
        -- 冷门问题
        ELSE FLOOR(50 + RAND() * 450)
    END,
    like_num = CASE 
        WHEN (id % 10) = 0 THEN FLOOR(500 + RAND() * 2500)
        WHEN (id % 10) IN (1, 2, 3) THEN FLOOR(100 + RAND() * 400)
        WHEN (id % 10) IN (4, 5, 6, 7) THEN FLOOR(20 + RAND() * 80)
        ELSE FLOOR(5 + RAND() * 15)
    END,
    collect_num = CASE 
        WHEN (id % 10) = 0 THEN FLOOR(200 + RAND() * 1300)
        WHEN (id % 10) IN (1, 2, 3) THEN FLOOR(50 + RAND() * 250)
        WHEN (id % 10) IN (4, 5, 6, 7) THEN FLOOR(10 + RAND() * 70)
        ELSE FLOOR(2 + RAND() * 13)
    END,
    answer_num = CASE 
        WHEN (id % 10) = 0 THEN FLOOR(20 + RAND() * 80)
        WHEN (id % 10) IN (1, 2, 3) THEN FLOOR(5 + RAND() * 25)
        WHEN (id % 10) IN (4, 5, 6, 7) THEN FLOOR(1 + RAND() * 10)
        ELSE FLOOR(0 + RAND() * 5)
    END
WHERE 1=1;

-- 验证更新结果
SELECT 
    id,
    title,
    view_num,
    like_num,
    collect_num,
    answer_num
FROM t_question 
ORDER BY view_num DESC
LIMIT 20;

-- 统计数据分布
SELECT 
    CASE 
        WHEN view_num >= 10000 THEN '热门(10000+)'
        WHEN view_num >= 2000 THEN '中等(2000-10000)'
        WHEN view_num >= 500 THEN '普通(500-2000)'
        ELSE '冷门(<500)'
    END as category,
    COUNT(*) as count,
    AVG(view_num) as avg_views,
    AVG(like_num) as avg_likes,
    AVG(collect_num) as avg_collects,
    AVG(answer_num) as avg_answers
FROM t_question
GROUP BY 
    CASE 
        WHEN view_num >= 10000 THEN '热门(10000+)'
        WHEN view_num >= 2000 THEN '中等(2000-10000)'
        WHEN view_num >= 500 THEN '普通(500-2000)'
        ELSE '冷门(<500)'
    END
ORDER BY avg_views DESC;
