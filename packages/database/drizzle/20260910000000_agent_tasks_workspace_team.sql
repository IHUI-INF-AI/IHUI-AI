-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- Migration 20260910000000: agent_tasks 工作区锁与团队维度(2-2)
-- 创建时间: 2026-09-10
-- 描述: 多 Agent 工作区锁与团队任务板。
--   - workspace_path: 任务操作的工作区目录路径(锁粒度,可空)
--   - team_id: 所属团队(团队任务板过滤维度,onDelete set null)
--   - locked_by/locked_at: 最近一次获取工作区锁的持有者与时间
--     (Redis 锁为执行权威[TTL 自愈],DB 字段仅作看板展示与审计回溯)
--
-- 幂等安全:列/索引/外键已存在则为 no-op。

ALTER TABLE "agent_tasks" ADD COLUMN IF NOT EXISTS "workspace_path" varchar(512);
ALTER TABLE "agent_tasks" ADD COLUMN IF NOT EXISTS "team_id" uuid;
ALTER TABLE "agent_tasks" ADD COLUMN IF NOT EXISTS "locked_by" varchar(128);
ALTER TABLE "agent_tasks" ADD COLUMN IF NOT EXISTS "locked_at" timestamptz;

CREATE INDEX IF NOT EXISTS "agent_tasks_team_idx" ON "agent_tasks" ("team_id");
CREATE INDEX IF NOT EXISTS "agent_tasks_workspace_idx" ON "agent_tasks" ("workspace_path");

-- 外键: team_id 引用 teams.id,onDelete set null(团队删除时任务保留)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agent_tasks_team_id_teams_id_fk'
  ) THEN
    ALTER TABLE "agent_tasks"
      ADD CONSTRAINT "agent_tasks_team_id_teams_id_fk"
      FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
