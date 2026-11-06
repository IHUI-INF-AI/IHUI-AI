-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

-- 批次 4:输入幂等 receipt / 流式投影 / 按轮变更集(2026-11-06)。
-- 全部为新增独立表,不改写任何既有表定义(与并行批次 2/3 的迁移互不依赖)。
-- 四条硬约束落在存储层:
--   1) 同一会话同一 inputId 只允许一条 receipt → 唯一索引 (conversation_id, input_id);
--   2) 同一会话同一占位消息只允许一条投影 → 唯一索引 (conversation_id, client_message_id);
--   3) 同一轮只允许一条变更集、同一变更集内同一路径只允许一行 → 两条唯一索引;
--   4) 状态值域封闭 → CHECK 约束,越界写入当场失败。

CREATE TABLE "chat_input_receipts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "input_id" varchar(128) NOT NULL,
  "fingerprint" varchar(64) NOT NULL,
  "message_id" varchar(64),
  "status" varchar(16) DEFAULT 'dispatching' NOT NULL,
  "attempt_count" integer DEFAULT 1 NOT NULL,
  "last_error_code" varchar(64),
  "lease_expires_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chat_input_receipts_status_check" CHECK ("status" in ('dispatching', 'dispatched', 'failed'))
);

ALTER TABLE "chat_input_receipts"
  ADD CONSTRAINT "chat_input_receipts_conversation_id_chat_conversations_id_fk"
  FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "chat_input_receipts"
  ADD CONSTRAINT "chat_input_receipts_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

CREATE UNIQUE INDEX "uq_chat_input_receipts_conv_input" ON "chat_input_receipts" USING btree ("conversation_id","input_id");
CREATE INDEX "ix_chat_input_receipts_user_created" ON "chat_input_receipts" USING btree ("user_id","created_at");

CREATE TABLE "chat_message_projections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "client_message_id" varchar(64) NOT NULL,
  "state" varchar(16) DEFAULT 'pending' NOT NULL,
  "attempt_count" integer DEFAULT 1 NOT NULL,
  "content" text,
  "reasoning" text,
  "tokens" integer,
  "metadata" jsonb,
  "committed_message_id" uuid,
  "error_code" varchar(64),
  "last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chat_message_projections_state_check" CHECK ("state" in ('pending', 'materializing', 'committed', 'failed'))
);

ALTER TABLE "chat_message_projections"
  ADD CONSTRAINT "chat_message_projections_conversation_id_chat_conversations_id_fk"
  FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "chat_message_projections"
  ADD CONSTRAINT "chat_message_projections_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "chat_message_projections"
  ADD CONSTRAINT "chat_message_projections_committed_message_id_chat_messages_id_fk"
  FOREIGN KEY ("committed_message_id") REFERENCES "public"."chat_messages"("id") ON DELETE set null ON UPDATE no action;

CREATE UNIQUE INDEX "uq_chat_message_projections_conv_client_msg" ON "chat_message_projections" USING btree ("conversation_id","client_message_id");
CREATE INDEX "ix_chat_message_projections_user_state" ON "chat_message_projections" USING btree ("user_id","state");

CREATE TABLE "chat_turn_change_sets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "turn_id" varchar(64) NOT NULL,
  "session_id" varchar(128),
  "workspace_root" text,
  "status" varchar(16) DEFAULT 'open' NOT NULL,
  "file_count" integer DEFAULT 0 NOT NULL,
  "additions" integer DEFAULT 0 NOT NULL,
  "deletions" integer DEFAULT 0 NOT NULL,
  "rewind_status" varchar(16) DEFAULT 'available' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chat_turn_change_sets_status_check" CHECK ("status" in ('open', 'committed', 'partial')),
  CONSTRAINT "chat_turn_change_sets_rewind_check" CHECK ("rewind_status" in ('available', 'rewinding', 'rewound', 'conflict', 'unavailable'))
);

ALTER TABLE "chat_turn_change_sets"
  ADD CONSTRAINT "chat_turn_change_sets_conversation_id_chat_conversations_id_fk"
  FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "chat_turn_change_sets"
  ADD CONSTRAINT "chat_turn_change_sets_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

CREATE UNIQUE INDEX "uq_chat_turn_change_sets_conv_turn" ON "chat_turn_change_sets" USING btree ("conversation_id","turn_id");
CREATE INDEX "ix_chat_turn_change_sets_user_created" ON "chat_turn_change_sets" USING btree ("user_id","created_at");

CREATE TABLE "chat_turn_change_files" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "change_set_id" uuid NOT NULL,
  "path" text NOT NULL,
  "operation" varchar(8) NOT NULL,
  "before_sha256" varchar(64),
  "after_sha256" varchar(64),
  "additions" integer DEFAULT 0 NOT NULL,
  "deletions" integer DEFAULT 0 NOT NULL,
  "unified_diff" text,
  "before_content" text,
  "content_truncated" boolean DEFAULT false NOT NULL,
  "rewind_tracked" boolean DEFAULT true NOT NULL,
  "rewind_applied_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chat_turn_change_files_operation_check" CHECK ("operation" in ('add', 'modify', 'delete'))
);

ALTER TABLE "chat_turn_change_files"
  ADD CONSTRAINT "chat_turn_change_files_change_set_id_chat_turn_change_sets_id_fk"
  FOREIGN KEY ("change_set_id") REFERENCES "public"."chat_turn_change_sets"("id") ON DELETE cascade ON UPDATE no action;

CREATE UNIQUE INDEX "uq_chat_turn_change_files_set_path" ON "chat_turn_change_files" USING btree ("change_set_id","path");
