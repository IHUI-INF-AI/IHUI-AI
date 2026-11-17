-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 号池授权会话表（2026-11-17 立）
--
-- 立因：对标 qoder2api 系开源网关（shuishuipingan/qoder2api-hub 等）的「OAuth 设备授权免客户端
-- 登录入池」那一格。本仓号池此前的入池面是「本机提取登录态」+「JSON/tokens 导入」，两者都要求
-- 有一台装着官方客户端、且人已登录的机器；服务器/Web 控制台无法自助拿票。
--
-- 这张表面向的是**授权会话本身**（不是凭据）：device_code 与换到的票都属 bearer 凭据，按 RFC 8628
-- §5.2 必须加密存储（bearer_secret_enc 列，密文带 v0/v1 形态标签）；票本体只经 importAccounts
-- 唯一入池通道落号池，本表只留 sha256 短指纹与号池行指针。
--
-- 形态上比对照程序多做两件事：
--   ① 会话即审计（谁发起 / 上游裁决 / 退避了几次 / 终局落点），蓝绿切流不丢会话；
--   ② 终局即销毁把手（credential_scrubbed），撤销/过期/被拒的 device_code 密文不留库。
create table if not exists "ai_relay_auth_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() not null,
	"provider_code" varchar(64) not null,
	"kind" varchar(24) not null,
	"status" varchar(16) default 'pending' not null,
	"bearer_secret_enc" text,
	"user_code" varchar(64),
	"verification_uri" text,
	"verification_uri_complete" text,
	"interval_seconds" integer default 5 not null,
	"next_poll_at" timestamp with time zone,
	"poll_attempts" integer default 0 not null,
	"expires_at" timestamp with time zone not null,
	"failure_code" varchar(64),
	"failure_message" text,
	"owner_user_id" varchar(64),
	"requested_by" varchar(128),
	"scene" varchar(64),
	"account_id" uuid,
	"cred_fingerprint" varchar(16),
	"upstream_metadata" jsonb,
	"credential_scrubbed" boolean default false not null,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() not null,
	"updated_at" timestamp with time zone DEFAULT now() not null
);
--> statement-breakpoint
create index if not exists "ai_relay_auth_session_provider_status_idx"
	on "ai_relay_auth_session" using btree ("provider_code","status");
--> statement-breakpoint
create index if not exists "ai_relay_auth_session_pending_poll_idx"
	on "ai_relay_auth_session" using btree ("status","next_poll_at")
	where "ai_relay_auth_session"."status" = 'pending';
--> statement-breakpoint
create index if not exists "ai_relay_auth_session_account_idx"
	on "ai_relay_auth_session" using btree ("account_id");
--> statement-breakpoint
create index if not exists "ai_relay_auth_session_expires_idx"
	on "ai_relay_auth_session" using btree ("expires_at");
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
