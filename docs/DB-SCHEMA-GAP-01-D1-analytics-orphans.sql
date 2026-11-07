-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- DB-SCHEMA-GAP-01 / D1 证据：analytics_events 6 条孤儿行（已删除用户的埋点）
-- 采集时间: 2026-11-07T03:06:43Z（生产 ihui_dev, 8810）
-- 表顺序（information_schema.ordinal_position）:
--   1 id integer NOT NULL
--   2 user_id uuid NULL
--   3 event varchar NOT NULL
--   4 properties jsonb NULL
--   5 ip varchar NULL
--   6 user_agent text NULL
--   7 created_at timestamptz NOT NULL
--
-- 判定: user_id=01de64e5-52c6-4959-86a8-1701224d3ec6 在 users 中不存在；
--       6 行事件为 page_view/route_change，UA=HeadlessChrome，来源 127.0.0.1 与 218.27.68.23 ⇒ 已删除测试账号的导航埋点。
-- 决策: 删除（不置 NULL、不用 NOT VALID）。
--   置 NULL = 把「已删除用户的行为」改写成「匿名用户的行为」，污染匿名口径；
--   NOT VALID = 造出「约束已存在但 6 行违反它」的半真状态；
--   两者技术可行，但语义不可复核，故否决。
--
-- SELECT 计数（窗口执行前，按 id 精确）: 6
-- DELETE 影响行数（窗口内执行，按 id 精确）: 6
-- 删后同条件计数: 0
-- 窗口实测（2026-11-07T03:33:54Z，独立事务）: pre_count=6 / DELETE 6 / post_by_id=0 / post_by_condition=0

-- ---------- 可回放 INSERT（按原值逐字导出，仅用于回滚恢复；勿在 DELETE 之前执行） ----------
INSERT INTO analytics_events (id, user_id, event, properties, ip, user_agent, created_at) VALUES (12393, '01de64e5-52c6-4959-86a8-1701224d3ec6'::uuid, 'page_view', '{"ts": 1793287586024, "path": "/chat", "label": "/chat", "category": "navigation"}'::jsonb, '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.7922.34 Safari/537.36', '2026-10-29 23:26:31.037091+08'::timestamptz);
INSERT INTO analytics_events (id, user_id, event, properties, ip, user_agent, created_at) VALUES (12394, '01de64e5-52c6-4959-86a8-1701224d3ec6'::uuid, 'route_change', '{"to": "/chat", "ts": 1793287586024, "from": "", "label": "/chat", "category": "navigation"}'::jsonb, '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.7922.34 Safari/537.36', '2026-10-29 23:26:31.039709+08'::timestamptz);
INSERT INTO analytics_events (id, user_id, event, properties, ip, user_agent, created_at) VALUES (12457, '01de64e5-52c6-4959-86a8-1701224d3ec6'::uuid, 'page_view', '{"ts": 1793318694214, "path": "/chat", "label": "/chat", "category": "navigation"}'::jsonb, '218.27.68.23', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.7922.34 Safari/537.36', '2026-10-30 08:04:59.496404+08'::timestamptz);
INSERT INTO analytics_events (id, user_id, event, properties, ip, user_agent, created_at) VALUES (12458, '01de64e5-52c6-4959-86a8-1701224d3ec6'::uuid, 'route_change', '{"to": "/chat", "ts": 1793318694214, "from": "", "label": "/chat", "category": "navigation"}'::jsonb, '218.27.68.23', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.7922.34 Safari/537.36', '2026-10-30 08:04:59.499162+08'::timestamptz);
INSERT INTO analytics_events (id, user_id, event, properties, ip, user_agent, created_at) VALUES (12459, '01de64e5-52c6-4959-86a8-1701224d3ec6'::uuid, 'page_view', '{"ts": 1793319214118, "path": "/chat", "label": "/chat", "category": "navigation"}'::jsonb, '218.27.68.23', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.7922.34 Safari/537.36', '2026-10-30 08:13:39.533822+08'::timestamptz);
INSERT INTO analytics_events (id, user_id, event, properties, ip, user_agent, created_at) VALUES (12460, '01de64e5-52c6-4959-86a8-1701224d3ec6'::uuid, 'route_change', '{"to": "/chat", "ts": 1793319214119, "from": "", "label": "/chat", "category": "navigation"}'::jsonb, '218.27.68.23', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.7922.34 Safari/537.36', '2026-10-30 08:13:39.539216+08'::timestamptz);

-- ---------- 窗口内执行（独立事务，紧跟备份，#1 之前） ----------
-- 执行前:
SELECT count(*) AS pre_count FROM analytics_events WHERE id IN (12393,12394,12457,12458,12459,12460);
BEGIN;
DELETE FROM analytics_events WHERE id IN (12393,12394,12457,12458,12459,12460);
COMMIT;
-- 期望 psql 输出: DELETE 6
-- 执行后:
SELECT count(*) AS post_by_id FROM analytics_events WHERE id IN (12393,12394,12457,12458,12459,12460);
SELECT count(*) AS post_by_condition FROM analytics_events WHERE user_id = '01de64e5-52c6-4959-86a8-1701224d3ec6';
-- 期望: post_by_id=0 / post_by_condition=0
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
