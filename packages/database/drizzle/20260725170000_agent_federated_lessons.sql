-- L7 联邦学习元知识持久化 migration(2026-07-25 立,对标 Google Federated Learning)
-- 持久化 FederatedLearner.aggregate_user_lessons 抽取的群体智慧 lessons,
-- 使进程重启不丢失跨用户群体知识。启动时由 ai-service lifespan 从本表全量
-- hydrate 到 FederatedLearner._cache,运行时 aggregate_user_lessons 增量 UPSERT。
--
-- 设计要点(对标 Google FL + 差分隐私):
-- 1. 每条 lesson 1 行,lesson_type 区分:
--    failure_pattern:     跨用户群体失败模式共性
--    success_pattern:     跨用户群体成功模式共性
--    tool_usage:          跨用户群体工具使用经验
--    skill_improvement:   跨用户群体 skill 改进建议
-- 2. 隐私保护三件套:
--    - source_user_count 加 DP 噪声(dp_noise_added 记录噪声量,审计用)
--    - source_user_ids_hash 仅存 hash(不存原 user_id,sha256+salt 不可逆)
--    - content 已经过 anonymize_text 脱敏(anonymized=true 标记)
-- 3. UPSERT 模式:不用 UNIQUE 约束(SELECT + INSERT/UPDATE,与 meta_learner 一致),
--    按 (lesson_type, title) 联合定位。
--
-- 说明:db:generate 自 idx 128 起因 snapshot 缺失无法非交互运行(详见 _journal.json),
--       本 migration 沿用项目 20260722* 系列手写 SQL 约定(IF NOT EXISTS 幂等),
--       不修改 _journal.json。
--
-- 执行方式(与项目 20260722* 系列手写 migration 一致):
--   pnpm tsx packages/database/scripts/apply-migration.mjs drizzle/20260725170000_agent_federated_lessons.sql
-- 或直接 psql:
--   psql "$DATABASE_URL" -f packages/database/drizzle/20260725170000_agent_federated_lessons.sql

-- ============================================================================
-- 1. agent_federated_lessons — 群体智慧持久化表
-- ============================================================================
-- 本表是 FederatedLearner._cache(list[dict])的持久化镜像,
-- 启动时由 lifespan 全量读取并 hydrate 到内存,运行时由 FederatedLearner 增量同步。
-- 不使用 UNIQUE 约束(UPSERT 由应用层 SELECT+INSERT/UPDATE 实现,与 meta_learner 一致)。
CREATE TABLE IF NOT EXISTS "agent_federated_lessons" (
  -- 联邦 lesson ID(UUID,主键,gen_random_uuid 自动生成)
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 群体 lesson 类型:
  --   failure_pattern:    跨用户群体失败模式共性
  --   success_pattern:    跨用户群体成功模式共性
  --   tool_usage:         跨用户群体工具使用经验
  --   skill_improvement:  跨用户群体 skill 改进建议
  "lesson_type" text NOT NULL,
  -- 短标题(≤ 200 字符,与 meta_lessons 标题对齐,用于 UPSERT 定位)
  "title" text NOT NULL,
  -- 通用化后的 lesson 内容(已脱敏,可能含 [EMAIL]/[PHONE]/[IP]/[ID] 占位符)
  "content" text NOT NULL,
  -- 贡献此 lesson 的用户数(已加 DP 噪声,可能不是整数)
  "source_user_count" integer NOT NULL DEFAULT 1,
  -- 贡献用户 id 的 hash 列表(sha256+salt 不可逆,用于去重统计,不存原 id)
  "source_user_ids_hash" text,
  -- 置信度(0.0-1.0,已加 DP 噪声,用于注入过滤)
  "confidence" real NOT NULL DEFAULT 0.5,
  -- 累计出现次数(同 lesson 多轮聚合时累加)
  "occurrence_count" integer NOT NULL DEFAULT 1,
  -- 添加的 DP 噪声量(审计用,记录 source_user_count 的扰动幅度)
  "dp_noise_added" real DEFAULT 0.0,
  -- 已脱敏标记(默认 true,anonymize_text 处理后置 true)
  "anonymized" boolean DEFAULT true,
  -- 创建时间(首次持久化时写入)
  "created_at" timestamp with time zone DEFAULT now(),
  -- 更新时间(每次增量同步时刷新)
  "updated_at" timestamp with time zone DEFAULT now()
);

-- 类型索引:按 lesson_type 过滤(failure_pattern / success_pattern / tool_usage / skill_improvement)
CREATE INDEX IF NOT EXISTS "agent_federated_lessons_type_idx"
  ON "agent_federated_lessons" ("lesson_type");
-- 置信度索引:按 confidence 倒序查询高置信度 lesson(优先注入 system prompt)
CREATE INDEX IF NOT EXISTS "agent_federated_lessons_confidence_idx"
  ON "agent_federated_lessons" ("confidence" DESC);
-- 类型+标题联合索引:UPSERT 时按 (lesson_type, title) 查找,加速 SELECT
CREATE INDEX IF NOT EXISTS "agent_federated_lessons_type_title_idx"
  ON "agent_federated_lessons" ("lesson_type", "title");
