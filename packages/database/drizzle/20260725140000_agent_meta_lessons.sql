-- L4 元学习元知识持久化 migration(2026-07-25 立)
-- 持久化 MetaLearner.learn() 抽取的 meta_lessons(避坑指南 / 最佳实践),
-- 使进程重启不丢失元知识。启动时由 ai-service lifespan 从本表全量 hydrate 到
-- MetaLearner._lessons 内存 Map,运行时 learn() 增量 UPSERT 同步。
--
-- 设计:每条 lesson 1 行,lesson_type 区分:
--   failure_pattern:  跨 skill 失败案例聚类出的失败模式
--   improvement_tip:   自评器识别的改进点沉淀的可复用经验
--   best_practice:     优势项沉淀的推荐做法
--
-- 说明:db:generate 自 idx 128 起因 snapshot 缺失无法非交互运行(详见 _journal.json),
--       本 migration 沿用项目 20260722* 系列手写 SQL 约定(IF NOT EXISTS 幂等),
--       不修改 _journal.json。
--
-- 执行方式(与项目 20260722* 系列手写 migration 一致):
--   pnpm tsx packages/database/scripts/apply-migration.mjs drizzle/20260725140000_agent_meta_lessons.sql
-- 或直接 psql:
--   psql "$DATABASE_URL" -f packages/database/drizzle/20260725140000_agent_meta_lessons.sql

-- ============================================================================
-- 1. agent_meta_lessons — 元知识持久化表
-- ============================================================================
-- 本表是 MetaLearner._lessons(Map<lessonId, MetaLesson>)的持久化镜像,
-- 启动时由 lifespan 全量读取并 hydrate 到内存,运行时由 MetaLearner 增量同步。
CREATE TABLE IF NOT EXISTS "agent_meta_lessons" (
  -- 元知识 ID(UUID,主键)
  "id" uuid PRIMARY KEY NOT NULL,
  -- 元知识类型:failure_pattern / improvement_tip / best_practice
  "lesson_type" text NOT NULL,
  -- 短标题(≤ 200 字符)
  "title" text NOT NULL,
  -- 详细内容(失败模式描述 / 改进建议 / 最佳实践做法,≤ 2000 字符)
  "content" text NOT NULL,
  -- 来源 skill 名集合(text[],空数组表示跨 skill 共性)
  "source_skills" text[] NOT NULL DEFAULT '{}',
  -- 关联的 failure_pattern_id(可空,仅 failure_pattern 类型有值)
  "failure_pattern_id" text,
  -- 出现次数(同 lesson 累计计数,越大表示越频繁)
  "occurrence_count" integer DEFAULT 1 NOT NULL,
  -- 置信度(0-1,LLM 评估的可信度,用于注入过滤 < 0.3 不注入)
  "confidence" real DEFAULT 0.5 NOT NULL,
  -- LLM 预生成的紧凑摘要(供 AgentLoop 注入 system prompt)
  -- 若为 null 表示尚未生成,AgentLoop 调 build_system_prompt_snippet 实时生成
  "system_prompt_snippet" text,
  -- 创建时间(首次持久化时写入)
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  -- 更新时间(每次增量同步时刷新)
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 类型索引:按 lesson_type 过滤(failure_pattern / improvement_tip / best_practice)
CREATE INDEX IF NOT EXISTS "agent_meta_lessons_type_idx" ON "agent_meta_lessons" ("lesson_type");
-- 置信度索引:按 confidence 倒序查询高置信度 lesson(优先注入 system prompt)
CREATE INDEX IF NOT EXISTS "agent_meta_lessons_confidence_idx" ON "agent_meta_lessons" ("confidence" DESC);
-- 出现次数索引:按 occurrence_count 倒序查询高频 lesson(优先注入 + 优先 hydrate)
CREATE INDEX IF NOT EXISTS "agent_meta_lessons_occurrence_idx" ON "agent_meta_lessons" ("occurrence_count" DESC);
-- 更新时间索引:按 updated_at 排序查询最近活跃 lesson(用于增量同步 / 审计)
CREATE INDEX IF NOT EXISTS "agent_meta_lessons_updated_idx" ON "agent_meta_lessons" ("updated_at" DESC);
