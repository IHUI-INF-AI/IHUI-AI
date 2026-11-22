-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- ============================================================================
-- 20261003020000_codebase_chunks_tenant_ttl
--
-- 背景:2026-09 智谱 ZCode 因未经知情把用户仓库数据传上 MaaS 引发争议。本仓
--   codebase_chunks 表同时踩中三项 —— 这是全仓留存面里最重的一处:
--     1. 存**用户代码明文** content + vector(1536) 向量;
--     2. **无 owner/tenant 归属** —— 表上只有 repo_id,而 repo_id 是
--        `local-<path_hash>`(codebase_indexer._derive_repo_id),不是用户身份;
--     3. **无 TTL、无任何清理任务** —— 永不过期。
--   读面同样敞开:apps/api/src/services/codebase-index-service.ts 的 search()
--   / hybridSearch() 的 repoId 是**可选**参数,不传即跨全部仓库检索。
--
-- 本迁移做三件事(只做数据面,不动任何业务逻辑):
--   1. 加 owner_uuid(uuid,回填自 users.id,存量行尽力回填) + 归属索引;
--   2. 加 expires_at(timestamptz) + 过期清理所依赖的索引;
--   3. 回填:老行按"无法证明归属"处理 → owner_uuid 置 NULL 并立即标记过期,
--      宁可让存量索引失效,也不让它变成一份无主的外泄面。
--
-- ⚠ 为何**不**给本表套 RLS(与 20260927100000_tenant_rls_policies_batch1.sql 的
--   告诫同源,不是遗漏):
--   - 读写通道有两类且都**没有 app.user_id 会话变量**:
--       · ai-service codebase_indexer → POST /api/v1/codebase/index,走
--         `X-User-Id` 内部服务头(AI_CALLBACK_SECRET 通道);
--       · api 自身 drizzle 直连(asyncpg),从不 SET app.user_id。
--     套上 `owner_uuid = current_setting('app.user_id')::uuid` 的策略后,
--     这两条路径会**静默 0 行** —— 现象是"功能坏了但没有报错",极难定位。
--   - 归属隔离改为**应用层强制**落地(v1-codebase-search.ts 每个端点用
--     req.userId 过滤 + 传入 ownerUuid;codebase-index-service 的每个方法把
--     ownerUuid 列入 WHERE 谓词),效果等价且不会误伤正当路径。
--   - 判据留在这里:若将来 api 侧统一了"每请求 SET LOCAL app.user_id",
--     本表即可安全纳入 RLS;在那之前套 RLS 是拿生产功能换合规文本。
--
-- 幂等:所有 ADD COLUMN / CREATE INDEX 均为 IF NOT EXISTS;回填带
--   WHERE owner_uuid IS NULL 守卫,重复执行等价。
-- 回滚:见文件末「回滚」注释块。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) 加列(分区管理 / 归属)
-- ---------------------------------------------------------------------------
ALTER TABLE "codebase_chunks" ADD COLUMN IF NOT EXISTS "owner_uuid" uuid;

-- expires_at:NULL = 永不过期(与 agent_memory_episodic 同语义)。
-- 治理策略(见 3)会给存量行填上明确时间点,不给 NULL 留默认常驻的口子。
ALTER TABLE "codebase_chunks" ADD COLUMN IF NOT EXISTS "expires_at" timestamptz;

-- owner_uuid → users.id 的外键:用 ON DELETE SET NULL 而非 CASCADE。
-- 理由:用户注销时(purge-user-pii)该用户的代码索引应随之失效,但保留
-- 行(置 NULL + 交给清理任务删)比级联删更可控 —— 不会在注销事务里
-- 一次删掉上万行把事务撑爆,且清理任务可观测、可重跑。
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'codebase_chunks_owner_uuid_fkey'
  ) THEN
    ALTER TABLE "codebase_chunks"
      ADD CONSTRAINT "codebase_chunks_owner_uuid_fkey"
      FOREIGN KEY ("owner_uuid") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- 2) 索引
-- ---------------------------------------------------------------------------
-- 归属 + 时间维度的复合索引:应用层过滤恒为 (owner_uuid, repo_id[, expires_at]),
-- 单列索引会让每次检索都退化成"先扫该用户全部切片再过滤过期"。
CREATE INDEX IF NOT EXISTS "ix_codebase_chunks_owner_repo"
  ON "codebase_chunks" ("owner_uuid", "repo_id");

-- 清理任务的驱动索引:只扫"已到期"这一小撮,不扫全表。
CREATE INDEX IF NOT EXISTS "ix_codebase_chunks_expires_at"
  ON "codebase_chunks" ("expires_at")
  WHERE "expires_at" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3) 存量回填
--
-- 存量行无法证明属于谁:写入口从未记录用户身份,repo_id 只是路径 hash。
-- 处理方式**不是**猜一个归属(猜错 = 把甲的代码判给乙,比无主更糟),而是:
--   owner_uuid 保持 NULL,并立即打上 expires_at = 迁移时刻
--   ⇒ 语义上"已到期但尚未被清理",清理任务跑一轮后即物理删除。
-- 副作用:升级当刻起,存量索引的语义检索会少召回一部分结果
--   (应用层过滤 owner_uuid IS NOT NULL),关键词检索不受影响
--   (走 BM25,按 repo_id 而非 owner_uuid)。**这是刻意的取舍**:
--   让"用户代码以明文长期留在库里且归属不明"继续存在,是比"语义检索
--   少召回"严重得多的后果;而重建索引只需用户重新授权,一次成本很低。
-- ---------------------------------------------------------------------------
UPDATE "codebase_chunks"
SET "expires_at" = NOW()
WHERE "owner_uuid" IS NULL
  AND "expires_at" IS NULL;

-- 注释写进库,让下一个查表的人(尤其是运维)能直接看到这些列的判据,
-- 而不必去翻迁移文件 —— "不可为 NULL 的沉默"是这类治理最常见的失效方式。
COMMENT ON COLUMN "codebase_chunks"."owner_uuid" IS
  '索引归属用户(uuid)。2026-10-03 加列:此前表无任何归属列,repo_id 仅为路径 hash,导致跨用户可检索。未接入 RLS 的原因见迁移文件头(写入通道无 app.user_id 会话变量,套 RLS 会静默 0 行);归属由应用层(v1-codebase-search.ts + codebase-index-service)强制。NULL = 存量无主行,已标记过期待清理。';
COMMENT ON COLUMN "codebase_chunks"."expires_at" IS
  '过期时间。NULL = 永不过期(仅限明确选择长期保留的索引)。清理任务按此列回收;2026-10-03 起所有写入都带默认 TTL,不再产生 NULL 行。';

-- ---------------------------------------------------------------------------
-- 回滚
--
-- ALTER TABLE "codebase_chunks" DROP CONSTRAINT "codebase_chunks_owner_uuid_fkey";
-- DROP INDEX IF EXISTS "ix_codebase_chunks_owner_repo";
-- DROP INDEX IF EXISTS "ix_codebase_chunks_expires_at";
-- ALTER TABLE "codebase_chunks" DROP COLUMN IF EXISTS "owner_uuid";
-- ALTER TABLE "codebase_chunks" DROP COLUMN IF EXISTS "expires_at";
--
-- 注意:回滚**不恢复**已被清理任务删除的存量行 —— 代码索引可由用户重新
--   授权后重建,这是把"无主明文代码"尽早清掉的必然代价。
-- ============================================================================
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
