-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- dev 库唯一索引 uq_ai_model_config_global_provider_base 的迁移台账对齐(2026-10-26 立,未取号票:relay-capacity 席)
--
-- 立因:schema 早在 2026-10-18 已声明该部分唯一索引(packages/database/src/schema/ai-config.ts,
-- 全局配置按 (provider_code, COALESCE(base_url,'')) 防重,拦 token6688 型僵尸重复行再生),
-- 但整条迁移链里没有对应 .sql —— 索引此前因重复行存在而无法建立,重复行(id=46)已于
-- 2026-10-26 09:50 由 scripts/merge-dup-model-configs.mjs --apply 带外删除(先备份后删,
-- 快照 .ihui-agent/state/model-config-merge/token6688-2026-10-26T01-50-29-148Z.json),
-- 索引随后也已在 dev 库面存在(带外)。库态与台账面漂移:全新部署从链上拿不到这一硬闸。
-- 本枚把"备份→删重复行→建唯一索引"补进迁移链,让台账与 schema 声明、库态三者对齐。
--
-- 备份表为什么套在 EXISTS 守卫里(与草拟口径的唯一差异):
--   check-migration-from-zero 对迁移后库与 drizzle schema 做表/列双向 diff,且
--   "多表一律不豁免"(KNOWN_SCHEMA_HOLES 规则)—— 若无条件 `CREATE TABLE ... AS SELECT`,
--   从空库重放会多出两张空备份表把门判红。守卫后:备份表只在重复行真实存在的环境
--   (生产)落地;dev/从零库零多余对象。
--
-- 幂等写法(本仓手写迁移口径,同 20261026143000_agent_thumbs_collects_unique.sql):
--   备份 CREATE IF NOT EXISTS 且有 EXISTS 前置;DELETE 无行时零影响;索引 IF NOT EXISTS。
--   dev 库现读(2026-10-26):id=46 已删(0 行)、索引已在库且 indexdef 与 schema 声明一致
--   ⇒ 本枚在 dev 整条为 no-op,只补记账;在生产(若重复行仍在)才真正执行合并删除。
--
-- 回滚:
--   DROP INDEX IF EXISTS "uq_ai_model_config_global_provider_base";
--   -- 备份表仅在生产会存在,人工核对快照后可删:
--   --   DROP TABLE IF EXISTS "_backup_ai_model_config_dup_l28826";
--   --   DROP TABLE IF EXISTS "_backup_ai_model_config_models_dup_l28826";

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM "ai_model_config" WHERE "id" = 46 AND "owner_uuid" IS NULL) THEN
        CREATE TABLE IF NOT EXISTS "_backup_ai_model_config_dup_l28826"
            AS SELECT * FROM "ai_model_config" WHERE "id" = 46 AND "owner_uuid" IS NULL;
        CREATE TABLE IF NOT EXISTS "_backup_ai_model_config_models_dup_l28826"
            AS SELECT * FROM "ai_model_config_models" WHERE "config_id" = 46;
    END IF;
END $$;

DELETE FROM "ai_model_config_models" WHERE "config_id" = 46;

DELETE FROM "ai_model_config" WHERE "id" = 46 AND "owner_uuid" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_ai_model_config_global_provider_base"
    ON "ai_model_config" ("provider_code", COALESCE("base_url", ''))
    WHERE "owner_uuid" IS NULL;
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
