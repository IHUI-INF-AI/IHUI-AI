-- 为测试agent-settlement/list接口插入测试数据
-- 包括 zhs_agent_settlement, zhs_agent_category, zhs_agent_buy 三个表的关联数据

-- 1. 插入 zhs_agent_category 测试数据
INSERT INTO zhs_agent_category (
    id, agent_id, agent_name, create_uuid, create_name, create_time,
    agent_main_category, agent_category, type, type_child, account, 
    `group`, limit_free, discount_month, prologue
) VALUES
(UUID(), 'agent_001', '智能助手001', 'dev_001', '开发者001', NOW(), '1', '1', '3', '1', 50000, '2', NULL, '1', '这是一个智能助手'),
(UUID(), 'agent_002', '智能助手002', 'dev_002', '开发者002', NOW(), '1', '2', '3', '2', 120000, '2', NULL, '2', '这是另一个智能助手'),
(UUID(), 'agent_003', '智能助手003', 'dev_003', '开发者003', NOW(), '2', '1', '3', '3', 300000, '1', NULL, '3', '这是第三个智能助手'),
(UUID(), 'agent_004', '智能助手004', 'dev_004', '开发者004', NOW(), '1', '3', '3', '1', 80000, '2', NULL, '1', '这是第四个智能助手'),
(UUID(), 'agent_005', '智能助手005', 'dev_005', '开发者005', NOW(), '3', '2', '3', '2', 200000, '1', NULL, '2', '这是第五个智能助手');

-- 2. 插入 zhs_agent_buy 测试数据
INSERT INTO zhs_agent_buy (
    id, agent_id, agent_name, agent_order_uuid, bug_uuid, bug_name, bug_time,
    category_id, discount, real_price, price, count, expiration_date, 
    order_no, status, settlement, prologue
) VALUES
(UUID(), 'agent_001', '智能助手001', 'dev_001', 'user_001', '用户001', NOW(), 'cat_001', 80, 40000, 50000, 1, DATE_ADD(NOW(), INTERVAL 1 MONTH), 'ORDER_001', '0', '0', '智能助手开场白'),
(UUID(), 'agent_002', '智能助手002', 'dev_002', 'user_002', '用户002', NOW(), 'cat_002', 70, 84000, 120000, 12, DATE_ADD(NOW(), INTERVAL 1 YEAR), 'ORDER_002', '0', '0', '智能助手开场白'),
(UUID(), 'agent_003', '智能助手003', 'dev_003', 'user_003', '用户003', NOW(), 'cat_003', 50, 150000, 300000, 1, NULL, 'ORDER_003', '0', '0', '智能助手开场白'),
(UUID(), 'agent_004', '智能助手004', 'dev_004', 'user_004', '用户004', NOW(), 'cat_004', 90, 72000, 80000, 1, DATE_ADD(NOW(), INTERVAL 1 MONTH), 'ORDER_004', '0', '0', '智能助手开场白'),
(UUID(), 'agent_005', '智能助手005', 'dev_005', 'user_005', '用户005', NOW(), 'cat_005', 60, 120000, 200000, 12, DATE_ADD(NOW(), INTERVAL 1 YEAR), 'ORDER_005', '0', '0', '智能助手开场白');

-- 3. 插入 zhs_agent_settlement 测试数据
INSERT INTO zhs_agent_settlement (
    id, uuid, order_no, create_time, buy_uuid, agent_id, agent_name,
    prologue, agent_avatar, expiration_date, settlement, withdrawal
) VALUES
(UUID(), 'dev_001', 'ORDER_001', NOW(), 'user_001', 'agent_001', '智能助手001', '智能助手开场白', 'https://example.com/avatar1.jpg', DATE_ADD(NOW(), INTERVAL 1 MONTH), '0', '0'),
(UUID(), 'dev_002', 'ORDER_002', NOW(), 'user_002', 'agent_002', '智能助手002', '智能助手开场白', 'https://example.com/avatar2.jpg', DATE_ADD(NOW(), INTERVAL 1 YEAR), '0', '0'),
(UUID(), 'dev_003', 'ORDER_003', NOW(), 'user_003', 'agent_003', '智能助手003', '智能助手开场白', 'https://example.com/avatar3.jpg', NULL, '1', '0'),
(UUID(), 'dev_004', 'ORDER_004', NOW(), 'user_004', 'agent_004', '智能助手004', '智能助手开场白', 'https://example.com/avatar4.jpg', DATE_ADD(NOW(), INTERVAL 1 MONTH), '0', '0'),
(UUID(), 'dev_005', 'ORDER_005', NOW(), 'user_005', 'agent_005', '智能助手005', '智能助手开场白', 'https://example.com/avatar5.jpg', DATE_ADD(NOW(), INTERVAL 1 YEAR), '1', '1');

-- 验证插入的数据
SELECT 'zhs_agent_category 表记录数:' as info, COUNT(*) as count FROM zhs_agent_category WHERE agent_id LIKE 'agent_%'
UNION ALL
SELECT 'zhs_agent_buy 表记录数:' as info, COUNT(*) as count FROM zhs_agent_buy WHERE agent_id LIKE 'agent_%'
UNION ALL  
SELECT 'zhs_agent_settlement 表记录数:' as info, COUNT(*) as count FROM zhs_agent_settlement WHERE agent_id LIKE 'agent_%';
