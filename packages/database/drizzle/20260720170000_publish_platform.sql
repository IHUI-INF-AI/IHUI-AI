-- 多平台一键发布系统(2026-07-20 新增)
-- 用途:支持 md/docx/html/pdf/图片/视频 多格式 → 14 平台一键发布
-- 14 平台:wordpress/medium/youtube/bilibili/wechat/toutiao/douyin/kuaishou/weibo/zhihu/csdn/juejin/xiaohongshu/shipinhao
--
-- 4 张表(与 ai-service app/services/publish/* 代码字段名严格对齐):
--   publish_accounts:       平台账号(凭证 AES-256-GCM 加密)
--   publish_tasks:          发布任务(BIGSERIAL + task_id 业务主键)
--   publish_history:        发布历史(每个平台一条,关联 task)
--   publish_notifications:  发布完成通知(DB 持久化 + Socket.IO 推送双通道)
--
-- 注意:ai-service 启动时 _ensure_tables 会 idempotent 建表(CREATE IF NOT EXISTS),
-- 与本 migration 共存(表已存在则跳过),不冲突。

-- 1. 平台账号表(ai-service 不自建此表,由 drizzle migration 唯一建表)
CREATE TABLE IF NOT EXISTS "publish_accounts" (
  "id" BIGSERIAL PRIMARY KEY,
  "user_id" VARCHAR(64),
  "platform" VARCHAR(32) NOT NULL,
  "nickname" VARCHAR(100),
  "credentials_enc" TEXT NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'active',
  "last_verified_at" TIMESTAMPTZ,
  "last_verify_result" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_publish_accounts_user_platform"
  ON "publish_accounts"("user_id", "platform");
CREATE INDEX IF NOT EXISTS "idx_publish_accounts_status"
  ON "publish_accounts"("status");

COMMENT ON TABLE "publish_accounts" IS '多平台发布:用户平台账号(凭证加密存储)';
COMMENT ON COLUMN "publish_accounts"."platform" IS 'wordpress/medium/youtube/bilibili/wechat/toutiao/douyin/kuaishou/weibo/zhihu/csdn/juejin/xiaohongshu/shipinhao';
COMMENT ON COLUMN "publish_accounts"."credentials_enc" IS '凭证 JSON 经 AES-256-GCM 加密的密文(含 iv/tag),明文结构因平台而异';
COMMENT ON COLUMN "publish_accounts"."status" IS 'active=启用 / disabled=禁用 / expired=凭证过期';

-- 2. 发布任务表(ai-service _ensure_tables 也会 idempotent 建此表,字段对齐)
CREATE TABLE IF NOT EXISTS "publish_tasks" (
  "id" BIGSERIAL PRIMARY KEY,
  "task_id" VARCHAR(64) UNIQUE NOT NULL,
  "user_id" VARCHAR(64),
  "title" VARCHAR(500) NOT NULL,
  "format" VARCHAR(32) NOT NULL,
  "content" JSONB NOT NULL,
  "targets" JSONB NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "scheduled_at" TIMESTAMPTZ,
  "started_at" TIMESTAMPTZ,
  "finished_at" TIMESTAMPTZ,
  "results" JSONB,
  "error" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_publish_tasks_user_id" ON "publish_tasks"("user_id");
CREATE INDEX IF NOT EXISTS "idx_publish_tasks_status" ON "publish_tasks"("status");
CREATE INDEX IF NOT EXISTS "idx_publish_tasks_scheduled_at"
  ON "publish_tasks"("scheduled_at")
  WHERE "status" = 'scheduled';
CREATE INDEX IF NOT EXISTS "idx_publish_tasks_created"
  ON "publish_tasks"("created_at" DESC);

COMMENT ON TABLE "publish_tasks" IS '多平台发布:任务(1 内容源 → N 平台)';
COMMENT ON COLUMN "publish_tasks"."task_id" IS '业务主键(UUID 字符串,跨服务引用,独立于 DB 主键)';
COMMENT ON COLUMN "publish_tasks"."format" IS 'md/docx/html/pdf/image/video';
COMMENT ON COLUMN "publish_tasks"."content" IS 'JSON: { text, file_path, cover_path, html, images, extra }';
COMMENT ON COLUMN "publish_tasks"."targets" IS 'JSON: [{ platform, account_id, config }]';
COMMENT ON COLUMN "publish_tasks"."status" IS 'pending/running/scheduled/success/partial/failed/cancelled';

-- 3. 发布历史表(ai-service _ensure_tables 也会 idempotent 建此表,字段对齐)
CREATE TABLE IF NOT EXISTS "publish_history" (
  "id" BIGSERIAL PRIMARY KEY,
  "task_id" VARCHAR(64) NOT NULL,
  "user_id" VARCHAR(64),
  "platform" VARCHAR(32) NOT NULL,
  "success" BOOLEAN NOT NULL,
  "published_url" TEXT,
  "platform_content_id" VARCHAR(255),
  "error_message" TEXT,
  "duration_ms" INTEGER DEFAULT 0,
  "payload" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_publish_history_task_id" ON "publish_history"("task_id");
CREATE INDEX IF NOT EXISTS "idx_publish_history_user_platform"
  ON "publish_history"("user_id", "platform");
CREATE INDEX IF NOT EXISTS "idx_publish_history_success"
  ON "publish_history"("success");
CREATE INDEX IF NOT EXISTS "idx_publish_history_created"
  ON "publish_history"("created_at" DESC);

COMMENT ON TABLE "publish_history" IS '多平台发布:历史(每个平台一条,关联 task)';
COMMENT ON COLUMN "publish_history"."success" IS 'true=成功 / false=失败';
COMMENT ON COLUMN "publish_history"."published_url" IS '平台返回的内容公开 URL';
COMMENT ON COLUMN "publish_history"."payload" IS '平台返回的完整响应(便于排查)';

-- 4. 发布通知表(ai-service _ensure_table 也会 idempotent 建此表,字段对齐)
CREATE TABLE IF NOT EXISTS "publish_notifications" (
  "id" BIGSERIAL PRIMARY KEY,
  "task_id" VARCHAR(64) NOT NULL,
  "user_id" VARCHAR(64),
  "status" VARCHAR(32) NOT NULL,
  "summary" TEXT,
  "payload" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_publish_notifications_task_id"
  ON "publish_notifications"("task_id");
CREATE INDEX IF NOT EXISTS "idx_publish_notifications_user_id"
  ON "publish_notifications"("user_id");

COMMENT ON TABLE "publish_notifications" IS '多平台发布:通知(DB 持久化 + Socket.IO 推送双通道)';
COMMENT ON COLUMN "publish_notifications"."status" IS 'success/partial/failed';
