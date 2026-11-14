-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

--
-- F-271:第三方账号绑定补齐租户维度(企业微信 corpId)
--
-- 病灶:suite 模式一次授权覆盖多家企业,`open_userid` 只在**单个企业内**唯一;而
-- user_third_party_accounts 的绑定键只有 (platform, open_id) —— B 企业里与 A 企业同值的
-- open_userid 会命中 A 的活绑定,直接登入 A 的本地账号(跨租户接管)。
--
-- 修法:加 tenant_id(not null default ''),唯一部分索引从 (platform, open_id) 扩到
-- (platform, tenant_id, open_id)。代码侧:
--   · 企业微信查/建绑定一律带 corpId(db/oauth-queries.findThirdPartyAccount 第三参);
--   · 登录前 corpId 过 services/oauth-providers.resolveWecomTenant(空值/名单外一律拒);
--   · 自建应用(单租户)登录时把 tenant_id='' 的同键活行改判为 WECOM_CORP_ID(存量回填);
--     suite 模式(多企业)不做该回填 —— 老行属于哪家企业无法判定,按 fail-closed 让用户重绑。
--
-- 幂等:ADD COLUMN IF NOT EXISTS / 索引先 DROP IF EXISTS 再建。
-- 注意:老索引名沿用 user_third_party_platform_openid_live_uidx(代码侧 uniqueIndex 同名),
-- 只改列集合;先删后建在同一条 DDL 事务内完成,不存在"无唯一约束窗口"。
--

ALTER TABLE "user_third_party_accounts"
  ADD COLUMN IF NOT EXISTS "tenant_id" varchar(64) NOT NULL DEFAULT '';

-- 历史行没有租户信息:统一落空串(不是"所有租户可见",查询层按精确等值匹配 ⇒ 空串只匹配空串)。
UPDATE "user_third_party_accounts" SET "tenant_id" = '' WHERE "tenant_id" IS NULL;

DROP INDEX IF EXISTS "user_third_party_platform_openid_live_uidx";

CREATE UNIQUE INDEX IF NOT EXISTS "user_third_party_platform_openid_live_uidx"
  ON "user_third_party_accounts" ("platform", "tenant_id", "open_id")
  WHERE "deleted_at" IS NULL AND "open_id" IS NOT NULL AND "open_id" <> '';

-- 存量分布如实现报(运维据此外判:若 suite 模式已接多家企业,下面这个数就是待重绑的用户数)。
DO $f271_tenant_report$
DECLARE
  v_total integer;
  v_tenantless integer;
BEGIN
  SELECT count(*) INTO v_total FROM "user_third_party_accounts";
  SELECT count(*) INTO v_tenantless
    FROM "user_third_party_accounts"
   WHERE "platform" = 'enterpriseWechat' AND "tenant_id" = '' AND "deleted_at" IS NULL;
  RAISE NOTICE 'F-271 绑定行总数=%,企业微信无租户活绑定=%', v_total, v_tenantless;
END $f271_tenant_report$;
