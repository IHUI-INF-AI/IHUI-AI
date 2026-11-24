-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 微信智联（WeChat Hub）五张表：账号 / 会话 / 消息 / 分析任务 / 动作审计。
-- 只落 PostgreSQL；凭据由应用层 AES-256-GCM 加密后写入 credentials_encrypted。

CREATE TABLE IF NOT EXISTS "wechat_hub_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "label" varchar(120) NOT NULL,
  "backend" varchar(16) NOT NULL,
  "status" varchar(24) DEFAULT 'disconnected' NOT NULL,
  "external_id" varchar(255),
  "avatar_url" text,
  "credentials_encrypted" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "cursor" varchar(512),
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "allowlist_enabled" boolean DEFAULT true NOT NULL,
  "last_error" text,
  "last_poll_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "wechat_hub_accounts_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "wechat_hub_accounts_user_label_uniq"
  ON "wechat_hub_accounts" ("user_id", "label");
CREATE INDEX IF NOT EXISTS "wechat_hub_accounts_user_idx"
  ON "wechat_hub_accounts" ("user_id");
CREATE INDEX IF NOT EXISTS "wechat_hub_accounts_status_idx"
  ON "wechat_hub_accounts" ("status");

CREATE TABLE IF NOT EXISTS "wechat_hub_conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL,
  "platform_chat_id" varchar(255) NOT NULL,
  "kind" varchar(16) DEFAULT 'private' NOT NULL,
  "title" varchar(255) DEFAULT '' NOT NULL,
  "member_count" integer DEFAULT 0 NOT NULL,
  "unread_count" integer DEFAULT 0 NOT NULL,
  "last_message_at" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "wechat_hub_conversations_account_id_accounts_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "wechat_hub_accounts"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "wechat_hub_conversations_account_chat_uniq"
  ON "wechat_hub_conversations" ("account_id", "platform_chat_id");
CREATE INDEX IF NOT EXISTS "wechat_hub_conversations_account_last_idx"
  ON "wechat_hub_conversations" ("account_id", "last_message_at");

CREATE TABLE IF NOT EXISTS "wechat_hub_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL,
  "conversation_id" uuid NOT NULL,
  "direction" varchar(16) NOT NULL,
  "kind" varchar(16) DEFAULT 'text' NOT NULL,
  "content" text DEFAULT '' NOT NULL,
  "media_url" text,
  "sender_id" varchar(255),
  "sender_name" varchar(255),
  "platform_message_id" varchar(255),
  "sent_at" timestamp with time zone DEFAULT now() NOT NULL,
  "delivery_status" varchar(16) DEFAULT 'sent' NOT NULL,
  "error_message" text,
  "raw_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "wechat_hub_messages_account_id_accounts_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "wechat_hub_accounts"("id") ON DELETE CASCADE,
  CONSTRAINT "wechat_hub_messages_conversation_id_conversations_id_fk"
    FOREIGN KEY ("conversation_id") REFERENCES "wechat_hub_conversations"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "wechat_hub_messages_account_msg_uniq"
  ON "wechat_hub_messages" ("account_id", "platform_message_id");
CREATE INDEX IF NOT EXISTS "wechat_hub_messages_conversation_created_idx"
  ON "wechat_hub_messages" ("conversation_id", "created_at");
CREATE INDEX IF NOT EXISTS "wechat_hub_messages_account_created_idx"
  ON "wechat_hub_messages" ("account_id", "created_at");

CREATE TABLE IF NOT EXISTS "wechat_hub_analysis_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL,
  "conversation_id" uuid,
  "kind" varchar(16) NOT NULL,
  "status" varchar(16) DEFAULT 'pending' NOT NULL,
  "input_hash" varchar(64) NOT NULL,
  "result" jsonb,
  "model" varchar(128),
  "tokens" integer,
  "error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  CONSTRAINT "wechat_hub_analysis_runs_account_id_accounts_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "wechat_hub_accounts"("id") ON DELETE CASCADE,
  CONSTRAINT "wechat_hub_analysis_runs_conversation_id_conversations_id_fk"
    FOREIGN KEY ("conversation_id") REFERENCES "wechat_hub_conversations"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "wechat_hub_analysis_account_kind_hash_idx"
  ON "wechat_hub_analysis_runs" ("account_id", "kind", "input_hash");
CREATE INDEX IF NOT EXISTS "wechat_hub_analysis_conversation_created_idx"
  ON "wechat_hub_analysis_runs" ("conversation_id", "created_at");

CREATE TABLE IF NOT EXISTS "wechat_hub_action_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "action" varchar(32) NOT NULL,
  "target" varchar(255),
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" varchar(24) NOT NULL,
  "error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "wechat_hub_action_logs_account_id_accounts_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "wechat_hub_accounts"("id") ON DELETE CASCADE,
  CONSTRAINT "wechat_hub_action_logs_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "wechat_hub_action_logs_account_created_idx"
  ON "wechat_hub_action_logs" ("account_id", "created_at");
CREATE INDEX IF NOT EXISTS "wechat_hub_action_logs_user_created_idx"
  ON "wechat_hub_action_logs" ("user_id", "created_at");
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
