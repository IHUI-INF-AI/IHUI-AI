-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- Migration 20261113100000: 流程待办表(HR-6 第 4 期)
-- 创建时间: 2026-11-13
-- 描述: 让"需要人决策的点"从报错字符串变成可认领、可关闭、带上下文的条目。
--
--   此前流程自检发现的问题(缺薪资配置 / 环比异常 / 月结为空)只以
--   `problems: string[]` 返回,HR 看到"3 人缺薪资配置"却不知道该点哪里。
--   本表把它们落成待办:谁、哪一步、影响多少人多少钱、去哪个页面处理。
--
--   三条设计铁律(与 apps/api/src/services/workflow-todo.ts 一致):
--     ① dedupe_key 唯一 ⇒ 重跑只刷新计数,不堆重复条目;
--     ② 已 resolved/ignored 的条目**不复活** ⇒ 不反复打扰;
--     ③ 本次上报集合外的旧 open 条目**不自动关闭** ⇒ 防止流程半途崩溃误清待办。
--
-- 幂等安全:CREATE TABLE IF NOT EXISTS,可安全重复执行。
-- 与 packages/database/src/schema/workflow-todo.ts 逐字对齐。
--
-- 执行方式:
--   pnpm tsx packages/database/scripts/apply-migration.mjs drizzle/20261113100000_workflow_todo.sql

CREATE TABLE IF NOT EXISTS "workflow_todo" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "dedupe_key" varchar(200) NOT NULL,
  "source_type" varchar(80) NOT NULL,
  "source_ref" varchar(120),
  "severity" varchar(20) DEFAULT 'warn' NOT NULL,
  "title" varchar(200) NOT NULL,
  "detail" text,
  "affected_count" integer,
  "affected_amount_cents" integer,
  "action_path" varchar(300),
  "action_hint" varchar(300),
  "context" jsonb,
  "status" varchar(20) DEFAULT 'open' NOT NULL,
  "assignee_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "resolved_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "resolved_at" timestamptz,
  "resolution_note" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "last_seen_at" timestamptz DEFAULT now() NOT NULL
);

-- 幂等锚点:同 dedupeKey 只有一行
CREATE UNIQUE INDEX IF NOT EXISTS "uq_workflow_todo_dedupe" ON "workflow_todo" ("dedupe_key");
CREATE INDEX IF NOT EXISTS "ix_workflow_todo_status" ON "workflow_todo" ("status");
CREATE INDEX IF NOT EXISTS "ix_workflow_todo_source" ON "workflow_todo" ("source_type", "source_ref");
CREATE INDEX IF NOT EXISTS "ix_workflow_todo_severity" ON "workflow_todo" ("severity");
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
