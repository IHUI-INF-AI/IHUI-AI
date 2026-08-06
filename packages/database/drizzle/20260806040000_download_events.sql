-- Migration 20260806040000: download_events 下载事件表
-- 创建时间: 2026-08-06
-- 描述: 记录用户点击下载按钮的事件,支持按平台/日期聚合统计。
--       user_id 为 null 表示匿名用户(未登录也记录,不阻断下载点击)。
--       platform: web/desktop/ios/android-apk/mobile/wechat-miniapp/extension/cli
--       source: sidebar/detail_page
--
-- 幂等安全:使用 IF NOT EXISTS,表/索引已存在则为 no-op。

CREATE TABLE IF NOT EXISTS "download_events" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" VARCHAR(32),
    "platform" VARCHAR(32) NOT NULL,
    "asset_href" TEXT,
    "source" VARCHAR(16) NOT NULL,
    "ip" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "download_events_platform_idx" ON "download_events"("platform");
CREATE INDEX IF NOT EXISTS "download_events_created_at_idx" ON "download_events"("created_at");
CREATE INDEX IF NOT EXISTS "download_events_user_id_idx" ON "download_events"("user_id");
