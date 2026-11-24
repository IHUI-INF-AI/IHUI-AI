-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 微信智联 P0 增补：联系人 / 群成员 / 自动回复规则 / 日报计划。
-- 只落 PostgreSQL；群成员与联系人分开，避免大群成员塞进会话 metadata。

CREATE TABLE IF NOT EXISTS "wechat_hub_contacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL,
  "platform_user_id" varchar(255) NOT NULL,
  "display_name" varchar(255) DEFAULT '' NOT NULL,
  "remark" varchar(255) DEFAULT '' NOT NULL,
  "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "blocked" boolean DEFAULT false NOT NULL,
  "last_seen_at" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "wechat_hub_contacts_account_id_wechat_hub_accounts_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "wechat_hub_accounts"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "wechat_hub_contacts_account_user_uniq"
  ON "wechat_hub_contacts" ("account_id", "platform_user_id");
CREATE INDEX IF NOT EXISTS "wechat_hub_contacts_account_last_seen_idx"
  ON "wechat_hub_contacts" ("account_id", "last_seen_at");

CREATE TABLE IF NOT EXISTS "wechat_hub_group_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL,
  "conversation_id" uuid NOT NULL,
  "member_id" varchar(255) NOT NULL,
  "nickname" varchar(255) DEFAULT '' NOT NULL,
  "role" varchar(16) DEFAULT 'member' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "wechat_hub_group_members_account_id_wechat_hub_accounts_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "wechat_hub_accounts"("id") ON DELETE CASCADE,
  CONSTRAINT "wechat_hub_group_members_conversation_id_wechat_hub_conversations_id_fk"
    FOREIGN KEY ("conversation_id") REFERENCES "wechat_hub_conversations"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "wechat_hub_group_members_conv_member_uniq"
  ON "wechat_hub_group_members" ("account_id", "conversation_id", "member_id");
CREATE INDEX IF NOT EXISTS "wechat_hub_group_members_conversation_idx"
  ON "wechat_hub_group_members" ("conversation_id");

CREATE TABLE IF NOT EXISTS "wechat_hub_auto_reply_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL,
  "name" varchar(120) NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "match_type" varchar(16) DEFAULT 'contains' NOT NULL,
  "keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "reply_text" text DEFAULT '' NOT NULL,
  "scope" varchar(16) DEFAULT 'all' NOT NULL,
  "cooldown_seconds" integer DEFAULT 0 NOT NULL,
  "last_triggered_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "wechat_hub_auto_reply_rules_account_id_wechat_hub_accounts_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "wechat_hub_accounts"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "wechat_hub_auto_reply_account_enabled_idx"
  ON "wechat_hub_auto_reply_rules" ("account_id", "enabled");

CREATE TABLE IF NOT EXISTS "wechat_hub_digest_schedules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "hour" integer DEFAULT 9 NOT NULL,
  "minute" integer DEFAULT 0 NOT NULL,
  "timezone" varchar(64) DEFAULT 'Asia/Shanghai' NOT NULL,
  "target" varchar(255) DEFAULT '' NOT NULL,
  "last_run_at" timestamp with time zone,
  "last_run_day" varchar(10),
  "last_status" varchar(24),
  "last_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "wechat_hub_digest_schedules_account_id_wechat_hub_accounts_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "wechat_hub_accounts"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "wechat_hub_digest_schedules_account_uniq"
  ON "wechat_hub_digest_schedules" ("account_id");
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
