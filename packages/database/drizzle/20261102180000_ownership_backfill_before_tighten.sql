-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 归属回填(**先回填、后收紧**)2026-11-02。
--
-- 顺序契约(文件名里的 before_tighten 就是这条):
--   1. 本迁移先把可推导的 agent_tasks.created_by 回填(来源:agents.user_id 智能体属主),
--      并**最后**写入 ownership_backfill_state(scope='agent_tasks.creator')标记;
--   2. 应用代码只有读到该标记,才把仍为 NULL 的历史行收紧为 orphan(仅系统管理员可见);
--      标记缺失时维持旧口径(createdBy = viewer OR createdBy IS NULL)。
--   因此两种部署顺序都安全:
--     · 先跑迁移、后发版:旧代码不认识标记,口径不变;
--     · 先发版、后跑迁移:标记缺失,代码不收紧,历史数据不会集体消失。
--   绝不允许「迁移没跑、代码已收紧」的第三种状态。
--
-- 幂等/可重入:
--   - 建表 IF NOT EXISTS;
--   - 备份/标记 INSERT 均 ON CONFLICT DO NOTHING;
--   - 回填 UPDATE 只动 created_by IS NULL 的行,已回填行不覆盖;
--   - 中途失败可原样重跑:标记在回填之后才写,失败时不会出现「标记已写、数据未回填」。
--   迁移运行器(packages/database/scripts/apply-all-migrations.mjs)逐条执行,本文件不依赖事务。
--
-- 回滚(必须**先回退应用谓词并发布**,否则恢复 NULL 后会被新代码当 orphan 隐藏):
--   UPDATE "agent_tasks" t SET "created_by" = NULL
--   FROM "_ownership_backfill_20261102_agent_tasks" b
--   WHERE t."id" = b."task_id";
--
--   DELETE FROM "ownership_backfill_state" WHERE "scope" = 'agent_tasks.creator';
--
--   备份表保留审计;确认无需回滚后再手工 DROP TABLE "_ownership_backfill_20261102_agent_tasks"。
--
-- Redis 侧回填(服务启动装载时写入 ownerUserId / ownership,记账在
-- subagent:dispatch:ownership-backfill:20261102)回滚同样先回退代码谓词,再:
--   SMEMBERS subagent:dispatch:ownership-backfill:20261102
--   → 对每个 member 取 '|' 前的 dispatchId:HDEL subagent:dispatch:{dispatchId} ownerUserId ownership
--   → DEL subagent:dispatch:ownership-backfill:20261102

CREATE TABLE IF NOT EXISTS "ownership_backfill_state" (
  "scope" varchar(64) PRIMARY KEY,
  "total_null" integer NOT NULL DEFAULT 0,
  "derived" integer NOT NULL DEFAULT 0,
  "orphan" integer NOT NULL DEFAULT 0,
  "applied_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "_ownership_backfill_20261102_agent_tasks" (
  "task_id" uuid PRIMARY KEY,
  "derived_created_by" uuid NOT NULL,
  "applied_at" timestamptz NOT NULL DEFAULT now()
);

-- 1) 备份将被回填的行(只记 NULL→可推导;重复执行不重复记)
INSERT INTO "_ownership_backfill_20261102_agent_tasks" ("task_id", "derived_created_by")
SELECT t."id", a."user_id"
FROM "agent_tasks" t
JOIN "agents" a ON a."agent_id" = t."agent_id"
WHERE t."created_by" IS NULL
  AND a."user_id" IS NOT NULL
ON CONFLICT ("task_id") DO NOTHING;

-- 2) 回填(只动仍为 NULL 的行;孤儿行保持 NULL,由标记后的代码口径收敛)
UPDATE "agent_tasks" t
SET "created_by" = a."user_id"
FROM "agents" a
WHERE t."agent_id" = a."agent_id"
  AND t."created_by" IS NULL
  AND a."user_id" IS NOT NULL;

-- 3) 最后写标记(计数:derived = 备份行数;orphan = 回填后仍为 NULL 的行数)
INSERT INTO "ownership_backfill_state" ("scope", "total_null", "derived", "orphan", "applied_at")
SELECT
  'agent_tasks.creator',
  (SELECT count(*) FROM "_ownership_backfill_20261102_agent_tasks")::int
    + (SELECT count(*) FROM "agent_tasks" WHERE "created_by" IS NULL)::int,
  (SELECT count(*) FROM "_ownership_backfill_20261102_agent_tasks")::int,
  (SELECT count(*) FROM "agent_tasks" WHERE "created_by" IS NULL)::int,
  now()
ON CONFLICT ("scope") DO NOTHING;
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
