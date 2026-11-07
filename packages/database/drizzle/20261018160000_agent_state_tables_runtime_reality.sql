-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-- ============================================================================
-- 2026-10-18:agent 持久化状态 9 表 —— TS schema / 库里实际结构 / 运行时代码 三方对齐
-- ============================================================================
--
-- 背景(本轮 31 条 schema_check "字段类型不匹配" WARNING 的根治):
--   20260725120000~20260725190000 这 8 份手写 migration 声明了 agent_* 9 表,
--   但它们**从未进入 _journal.json、也从未在 __drizzle_migrations 记账**(2026-10-18 现读:
--   账本 321 行全为 drizzle-kit hash,无一条 manual_/2026* 记录)。库里这 9 张表的真实结构
--   由别的途径长成:agent_meta_lessons 由 apps/ai-service meta_learner._ensure_lesson_table
--   自愈建表(bigserial/varchar/jsonb/double/boolean 一套),其余 8 张与迁移声明也不同。
--   packages/database/src/schema/agent-state.ts 是后来照 migration 文案补的镜像,
--   从未与库对账 —— 于是 schema_check(TS ↔ DB)每启动刷 31 条 WARNING。
--
-- 更严重的:4 张表的**库里结构与运行时代码实际发的 SQL 不兼容**,写入/读取一直在静默失败
--   (调用方 except 后降级仅内存,表现为"功能好像没生效"但无任何报错):
--     · agent_user_profile.user_id 库里是 text,代码发 UUID 对象(asyncpg 客户端即拒)
--     · agent_memory_decay_state 缺 config/created_at/updated_at,代码 ON CONFLICT 引用 updated_at
--     · agent_working_memory_compression.id 是 bigint(代码发 uuid4())、original_messages 是
--       jsonb(代码发 int)、compressed_to 是 text(代码发 int)
--     · agent_metacognition_log.findings 是 text(代码写 json 字符串、读取却按数组 list()),
--       llm_used 是 text(代码发 bool)
--
-- ⚠ findings 改 jsonb 只是必要条件,不是充分条件:共享池(app/core/db_pool.py)不注册
--   jsonb codec,asyncpg 对 jsonb 列默认返回 str。故同步修
--   apps/ai-service/app/services/metacognition.py —— 新增 _coerce_jsonb_list()
--   (沿用 meta_learner._coerce_source_skills 2026-09-12 的同款范式),读路径由
--   list(row["findings"]) 改为 _coerce_jsonb_list(row["findings"])。
--   实证:probe_v3 对真实行抽真实函数验证 PASS(findings/actions_taken 回列表,
--   llm_used 回 bool,None/坏 JSON/非数组 JSON 均归空列表不抛错)。
--
-- 本迁移把库收敛到"运行时代码实际形状 + 既有 DB 形态"的并集:
--   · 代码能跑的列类型 → 以代码/migration 意图为准改库(上述 4 张)
--   · 代码对 text/varchar、real/double 都能跑的列 → 保留库里现状(double/varchar),
--     同步改 TS 声明(不在本迁移里做无损却无谓的窄化)
--   · DB 有而 TS 没声明的列(user_id/anonymized_content/source_user_ids_hash/
--     dp_noise_added/content_bytes)→ 本迁移补 ADD COLUMN IF NOT EXISTS 给出处,
--     使 check-db-schema-drift 的"migration 缺失列"尺子能对 TS 全列放行
--
-- 幂等性:全部语句可重复执行(同类型 ALTER 为 no-op;USING 分支在 0 行表上不求值)。
-- 记账:本文件属 2026* 手写系列,**不走 apply-migration.mjs**(那会往 __drizzle_migrations
--   写 manual_ 行,使账本行数超过 journal 条目数,触发守门 49 B9 与 ledger-drift surplus)。
--   应用方式:psql/asyncpg 直跑,与本系列既有 8 份一致。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) agent_memory_decay_state:补代码引用的三列 + user_id 收敛为 uuid
--    现存 5 行 user_id 全为 NULL ⇒ text→uuid 无数据风险
-- ---------------------------------------------------------------------------
ALTER TABLE "agent_memory_decay_state" ADD COLUMN IF NOT EXISTS "config" jsonb;
ALTER TABLE "agent_memory_decay_state" ADD COLUMN IF NOT EXISTS "created_at" timestamptz NOT NULL DEFAULT now();
ALTER TABLE "agent_memory_decay_state" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now();
ALTER TABLE "agent_memory_decay_state" ALTER COLUMN "user_id" TYPE uuid USING nullif("user_id"::text, '')::uuid;
ALTER TABLE "agent_memory_decay_state" ALTER COLUMN "entry_id" TYPE text USING "entry_id"::text;
ALTER TABLE "agent_memory_decay_state" ALTER COLUMN "retention_score" TYPE double precision USING "retention_score"::double precision;

-- ---------------------------------------------------------------------------
-- 2) agent_user_profile:user_id 收敛为 uuid(代码发 UUID 对象)+ 补 created_at
--    现存 0 行
-- ---------------------------------------------------------------------------
ALTER TABLE "agent_user_profile" ADD COLUMN IF NOT EXISTS "created_at" timestamptz NOT NULL DEFAULT now();
ALTER TABLE "agent_user_profile" ALTER COLUMN "user_id" TYPE uuid USING "user_id"::uuid;
ALTER TABLE "agent_user_profile" ALTER COLUMN "completeness" TYPE double precision USING "completeness"::double precision;

-- ---------------------------------------------------------------------------
-- 3) agent_working_memory_compression:三列类型与代码发的参数不兼容(0 行,重建列)
--    bigint→uuid / jsonb→integer / text→integer 均无可读转换,故 DROP+ADD(空表无损)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'agent_working_memory_compression'
               AND column_name = 'id' AND data_type <> 'uuid') THEN
    ALTER TABLE "agent_working_memory_compression" DROP COLUMN "id";
    ALTER TABLE "agent_working_memory_compression" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid();
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'agent_working_memory_compression'
               AND column_name = 'original_messages' AND data_type <> 'integer') THEN
    ALTER TABLE "agent_working_memory_compression" DROP COLUMN "original_messages";
    ALTER TABLE "agent_working_memory_compression" ADD COLUMN "original_messages" integer NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'agent_working_memory_compression'
               AND column_name = 'compressed_to' AND data_type <> 'integer') THEN
    ALTER TABLE "agent_working_memory_compression" DROP COLUMN "compressed_to";
    ALTER TABLE "agent_working_memory_compression" ADD COLUMN "compressed_to" integer NOT NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4) agent_metacognition_log:findings 收敛为 jsonb(读路径按数组取)、llm_used 收敛为
--    boolean(代码发 bool、读路径 bool());0 行无数据风险
-- ---------------------------------------------------------------------------
ALTER TABLE "agent_metacognition_log" ALTER COLUMN "findings" TYPE jsonb USING "findings"::jsonb;
ALTER TABLE "agent_metacognition_log" ALTER COLUMN "llm_used" TYPE boolean USING "llm_used"::boolean;
ALTER TABLE "agent_metacognition_log" ALTER COLUMN "reflection_type" TYPE varchar(64) USING "reflection_type"::varchar(64);
ALTER TABLE "agent_metacognition_log" ALTER COLUMN "target_layer" TYPE varchar(64) USING "target_layer"::varchar(64);
ALTER TABLE "agent_metacognition_log" ALTER COLUMN "confidence" TYPE double precision USING "confidence"::double precision;

-- ---------------------------------------------------------------------------
-- 5) 其余 5 表:库现状已与代码兼容,此处只做"从旧迁移声明形态收敛"的兜底 + 给出处
--    (在本库上全部为同类型 no-op)
-- ---------------------------------------------------------------------------
ALTER TABLE "agent_ab_tests" ALTER COLUMN "status" TYPE varchar(32) USING "status"::varchar(32);
ALTER TABLE "agent_ab_tests" ALTER COLUMN "shadow_ratio" TYPE double precision USING "shadow_ratio"::double precision;
ALTER TABLE "agent_ab_tests" ALTER COLUMN "significance_level" TYPE double precision USING "significance_level"::double precision;

ALTER TABLE "agent_federated_lessons" ALTER COLUMN "id" DROP DEFAULT, ALTER COLUMN "id" TYPE bigint USING "id"::text::bigint;
ALTER TABLE "agent_federated_lessons" ALTER COLUMN "lesson_type" TYPE varchar(64) USING "lesson_type"::varchar(64);
ALTER TABLE "agent_federated_lessons" ALTER COLUMN "confidence" TYPE double precision USING "confidence"::double precision;
ALTER TABLE "agent_federated_lessons" ALTER COLUMN "dp_noise_added" DROP DEFAULT, ALTER COLUMN "dp_noise_added" TYPE boolean USING nullif("dp_noise_added"::text, '')::boolean;

ALTER TABLE "agent_meta_lessons" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "agent_meta_lessons" ADD COLUMN IF NOT EXISTS "anonymized_content" text;
ALTER TABLE "agent_meta_lessons" ADD COLUMN IF NOT EXISTS "source_user_ids_hash" text;
ALTER TABLE "agent_meta_lessons" ADD COLUMN IF NOT EXISTS "dp_noise_added" boolean DEFAULT false;
ALTER TABLE "agent_meta_lessons" ADD COLUMN IF NOT EXISTS "expires_at" timestamptz;
ALTER TABLE "agent_meta_lessons" ALTER COLUMN "id" TYPE bigint USING "id"::text::bigint;
ALTER TABLE "agent_meta_lessons" ALTER COLUMN "lesson_type" TYPE varchar(64) USING "lesson_type"::varchar(64);
ALTER TABLE "agent_meta_lessons" ALTER COLUMN "source_skills" DROP DEFAULT, ALTER COLUMN "source_skills" TYPE jsonb USING to_jsonb("source_skills");
ALTER TABLE "agent_meta_lessons" ALTER COLUMN "failure_pattern_id" TYPE varchar(64) USING "failure_pattern_id"::varchar(64);
ALTER TABLE "agent_meta_lessons" ALTER COLUMN "confidence" TYPE double precision USING "confidence"::double precision;

ALTER TABLE "agent_multimodal_memory" ADD COLUMN IF NOT EXISTS "content_bytes" bytea;
ALTER TABLE "agent_multimodal_memory" ALTER COLUMN "modality" TYPE varchar(32) USING "modality"::varchar(32);
ALTER TABLE "agent_multimodal_memory" ALTER COLUMN "importance_score" TYPE double precision USING "importance_score"::double precision;

ALTER TABLE "agent_session_summary" ALTER COLUMN "importance_score" TYPE double precision USING "importance_score"::double precision;
