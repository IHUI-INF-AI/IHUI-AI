-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

--
-- F-434:customer_service_sessions.status 的默认值与「唯一真相源」枚举对齐
--
-- 真相源:packages/types/src/notification.ts 的 CUSTOMER_SERVICE_STATUSES
--         = pending / open / resolved / closed / rejected。
-- 病灶:schema 默认值是 'waiting',建表迁移 0043_neat_the_spike.sql:2342 是 DEFAULT 'waiting',
--       查询层建会话写 'waiting'、认领写 'active' ⇒ 按枚举渲染/过滤的消费端永远匹配不到真实状态,
--       类型契约(@ihui/types 的 CustomerServiceStatus)与库里数据分叉。
-- 修法(只留一个口径):默认值改 'pending',认领态改 'open';存量 waiting/active/transferred 就地收敛。
--   waiting     → pending (排队中/未认领)
--   active      → open    (已认领/处理中;真相源里没有 active)
--   transferred → open    (转派后会话仍处于处理中)
-- 幂等:SET DEFAULT 与三条 UPDATE 均可重跑(第二次命中 0 行)。
--

ALTER TABLE "customer_service_sessions" ALTER COLUMN "status" SET DEFAULT 'pending';

UPDATE "customer_service_sessions" SET "status" = 'pending' WHERE "status" = 'waiting';
UPDATE "customer_service_sessions" SET "status" = 'open' WHERE "status" = 'active';
UPDATE "customer_service_sessions" SET "status" = 'open' WHERE "status" = 'transferred';

-- 收敛结果现报 + 剩余离群值点名(不静默):离群值说明还有别的写入方在用旧词。
DO $f434_status_vocab$
DECLARE
  v_waiting integer;
  v_active integer;
  v_transferred integer;
  v_outlier integer;
BEGIN
  SELECT count(*) INTO v_waiting FROM "customer_service_sessions" WHERE "status" = 'waiting';
  SELECT count(*) INTO v_active FROM "customer_service_sessions" WHERE "status" = 'active';
  SELECT count(*) INTO v_transferred FROM "customer_service_sessions" WHERE "status" = 'transferred';
  SELECT count(*) INTO v_outlier
    FROM "customer_service_sessions"
   WHERE "status" NOT IN ('pending', 'open', 'resolved', 'closed', 'rejected');
  RAISE NOTICE 'F-434 残留 waiting=%, active=%, transferred=%, 枚举外=%, 默认值=pending',
    v_waiting, v_active, v_transferred, v_outlier;
END $f434_status_vocab$;
