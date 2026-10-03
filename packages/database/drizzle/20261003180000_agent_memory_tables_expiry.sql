-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- ============================================================================
-- 20261003180000_agent_memory_tables_expiry
--
-- 背景:2026-10-03 数据出域合规整改(对标智谱 ZCode 未经知情留存用户数据事件)的
--   收尾一票。前几票把 codebase_chunks / chat_messages / relay_messages / 记忆磁盘
--   全部收进了保留期,剩下这 6 张表仍是无期限留存用户内容的最后一块敞口。
--
-- 这 6 张表存的是什么(决定了各自的档位,**不是一刀切**):
--   agent_user_profile       用户画像(profile jsonb + system_prompt_snippet 片段)
--                           —— 不是流水,是"最近一次提炼结果",只留**最新一份**,
--                              过期即整行删(没有"删旧的留新的"这种语义)。
--   agent_session_summary    会话摘要(summary / key_facts / key_decisions)
--                           —— 从对话提炼,与 relay_messages 同性质但已提炼过,
--                              单独留一份没有意义 ⇒ 与会话同档。
--   agent_meta_lessons       元经验教训(content + system_prompt_snippet)
--   team_memories            团队记忆(content + tags)
--   agent_federated_lessons  联邦聚合教训(跨用户,已匿名化 + DP 噪声)
--   agent_multimodal_memory  多模态记忆(caption + source_uri + content_bytes)
--                           —— source_uri 可能指向本地文件路径,最敏感 ⇒ 最短档。
--
-- 档位(与既有分档对齐,理由写在列注释里):
--   · agent_user_profile / agent_session_summary / agent_meta_lessons : 180 天
--     (与 relay_messages / IM messages 同档 —— 都是"从对话提炼出来的",删太早
--      会让跨会话能力失忆,而它们不是原始正文,信息密度已被压缩过)
--   · team_memories                                              : 365 天
--     (团队级资产,多人共用,过期会让团队知识断层;但仍必须有期限)
--   · agent_federated_lessons                                    : 365 天
--     (跨用户聚合,是"经验库"不是"某人的数据",生命周期比个人记忆长)
--   · agent_multimodal_memory                                    : 90 天
--     (caption/source_uri 最敏感,最小必要留)
--
-- 幂等:全部 ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS。
-- 存量行:owner 不猜、created_at 不猜 ⇒ expires_at 一律按 NOW() 落,
--   即"存量全部标记为已到期",由清理任务分批回收。理由同
--   20261003020000_codebase_chunks_tenant_ttl:猜一个日期就是伪造事实。
--
-- ⚠ 与 agent_memory_semantic/episodic 的区别:那两张表有 expires_at 且由
--   DreamService.forget() 按遗忘曲线驱动(且 DREAM_ENABLED 默认关)。本票这 6 张
--   **没有**任何清理路径,不是"有机制但没开",是"机制根本不存在"。

-- ---------------------------------------------------------------------------
-- 1) 加 expires_at
-- ---------------------------------------------------------------------------
ALTER TABLE "agent_user_profile"      ADD COLUMN IF NOT EXISTS "expires_at" timestamptz;
ALTER TABLE "agent_meta_lessons"      ADD COLUMN IF NOT EXISTS "expires_at" timestamptz;
ALTER TABLE "team_memories"           ADD COLUMN IF NOT EXISTS "expires_at" timestamptz;
ALTER TABLE "agent_federated_lessons" ADD COLUMN IF NOT EXISTS "expires_at" timestamptz;
ALTER TABLE "agent_multimodal_memory" ADD COLUMN IF NOT EXISTS "expires_at" timestamptz;
ALTER TABLE "agent_session_summary"   ADD COLUMN IF NOT EXISTS "expires_at" timestamptz;

-- ---------------------------------------------------------------------------
-- 2) 清理任务驱动索引
--   只扫"已到期"这一小撮;没有它,清理任务每次全表扫,而这几张表在有用户后
--   会是本仓增长最快的表之一(每个会话一条 summary)。
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "ix_agent_user_profile_expires_at"
  ON "agent_user_profile" ("expires_at") WHERE "expires_at" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "ix_agent_meta_lessons_expires_at"
  ON "agent_meta_lessons" ("expires_at") WHERE "expires_at" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "ix_team_memories_expires_at"
  ON "team_memories" ("expires_at") WHERE "expires_at" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "ix_agent_federated_lessons_expires_at"
  ON "agent_federated_lessons" ("expires_at") WHERE "expires_at" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "ix_agent_multimodal_memory_expires_at"
  ON "agent_multimodal_memory" ("expires_at") WHERE "expires_at" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "ix_agent_session_summary_expires_at"
  ON "agent_session_summary" ("expires_at") WHERE "expires_at" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3) 存量标记为已到期
--   这 6 张表在生产库几乎为空(唯一有数据的是 agent_meta_lessons,3 行),
--   所以这一步的实际影响接近于零 —— 正是动手的最好时机:等有数据后再补,
--   "存量该不该留"就会变成一道需要逐条判断的题。
-- ---------------------------------------------------------------------------
UPDATE "agent_user_profile"      SET "expires_at" = NOW() WHERE "expires_at" IS NULL;
UPDATE "agent_meta_lessons"      SET "expires_at" = NOW() WHERE "expires_at" IS NULL;
UPDATE "team_memories"           SET "expires_at" = NOW() WHERE "expires_at" IS NULL;
UPDATE "agent_federated_lessons" SET "expires_at" = NOW() WHERE "expires_at" IS NULL;
UPDATE "agent_multimodal_memory" SET "expires_at" = NOW() WHERE "expires_at" IS NULL;
UPDATE "agent_session_summary"   SET "expires_at" = NOW() WHERE "expires_at" IS NULL;

-- ---------------------------------------------------------------------------
-- 4) 列注释(写到库而不是只写迁移文件 —— 下一个查表的人不必翻文件)
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN "agent_user_profile"."expires_at" IS
  '过期时间。2026-10-03 加列:用户画像此前无任何清理路径(且本表只有 updated_at,无 created_at —— 它是"最近一次提炼结果"而非流水,故按 updated_at 判定过期)。NULL = 永不过期,仅限显式选择长期保留的画像。默认档 180 天,与 relay_messages 同档(都是对话提炼物,信息已压缩)。';
COMMENT ON COLUMN "agent_multimodal_memory"."expires_at" IS
  '过期时间。2026-10-03 加列。多模态记忆是本组里最短档(90 天):caption/source_uri 可能带本地文件路径,最敏感。NULL = 永不过期。';
COMMENT ON COLUMN "agent_federated_lessons"."expires_at" IS
  '过期时间。2026-10-03 加列。跨用户聚合经验(已匿名化 + DP 噪声),生命周期比个人记忆长 ⇒ 365 天档。NULL = 永不过期。';
COMMENT ON COLUMN "team_memories"."expires_at" IS
  '过期时间。2026-10-03 加列。团队级资产(多人共用),过早清理会让团队知识断层 ⇒ 365 天档。NULL = 永不过期。';

-- ============================================================================
-- 回滚
--   ALTER TABLE "agent_user_profile"      DROP COLUMN IF EXISTS "expires_at";
--   ALTER TABLE "agent_meta_lessons"      DROP COLUMN IF EXISTS "expires_at";
--   ALTER TABLE "team_memories"           DROP COLUMN IF EXISTS "expires_at";
--   ALTER TABLE "agent_federated_lessons" DROP COLUMN IF EXISTS "expires_at";
--   ALTER TABLE "agent_multimodal_memory" DROP COLUMN IF EXISTS "expires_at";
--   ALTER TABLE "agent_session_summary"   DROP COLUMN IF EXISTS "expires_at";
--   (6 个索引随列自动处理,也可显式 DROP INDEX IF EXISTS ...)
--
-- 回滚**不恢复**已被清理任务删掉的行 —— 那正是这张迁移要达成的效果。
-- ============================================================================
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
