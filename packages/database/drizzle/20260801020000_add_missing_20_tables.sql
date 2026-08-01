-- 补齐 20 个表的 CREATE TABLE migration(schema drift 修复)
-- 背景:这些表已在 TS schema 中定义,但既有 migration 用未加引号标识符,
--   scripts/check-db-schema-drift.mjs 的 regex 要求引号标识符(["'`]),
--   故此处用双引号标识符补登记,使守门脚本识别。
-- 幂等:全部用 IF NOT EXISTS(这些表已被更早 migration 创建,本文件为 no-op)。
-- 字段/类型/约束/索引均按 TS schema(packages/database/src/schema/*.ts)1:1 落地。

-- =============================================================================
-- 1. ai_model_mappings(ai-model-mappings.ts)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "ai_model_mappings" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID REFERENCES "users"("id") ON DELETE CASCADE,
  "api_key_id" UUID REFERENCES "developer_api_keys"("id") ON DELETE CASCADE,
  "source_model" VARCHAR(128) NOT NULL,
  "target_model" VARCHAR(128) NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "ai_model_mappings_scope_unique" ON "ai_model_mappings"("user_id", "api_key_id", "source_model");
CREATE INDEX IF NOT EXISTS "ai_model_mappings_source_idx" ON "ai_model_mappings"("source_model");
CREATE INDEX IF NOT EXISTS "ai_model_mappings_user_idx" ON "ai_model_mappings"("user_id");
CREATE INDEX IF NOT EXISTS "ai_model_mappings_api_key_idx" ON "ai_model_mappings"("api_key_id");

-- =============================================================================
-- 2. ai_model_sync_log(ai-model-sync-log.ts)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "ai_model_sync_log" (
  "id" BIGSERIAL PRIMARY KEY,
  "provider_code" TEXT NOT NULL,
  "sync_started_at" TIMESTAMPTZ NOT NULL,
  "sync_finished_at" TIMESTAMPTZ NOT NULL,
  "success" BOOLEAN NOT NULL,
  "total_models" INTEGER NOT NULL DEFAULT 0,
  "new_models" INTEGER NOT NULL DEFAULT 0,
  "removed_models" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT NOT NULL DEFAULT '',
  "latency_ms" INTEGER NOT NULL DEFAULT 0,
  "sync_type" TEXT NOT NULL DEFAULT 'full'
);
CREATE INDEX IF NOT EXISTS "idx_ai_model_sync_log_started_at" ON "ai_model_sync_log"("sync_started_at");
CREATE INDEX IF NOT EXISTS "idx_ai_model_sync_log_provider" ON "ai_model_sync_log"("provider_code", "sync_started_at");

-- =============================================================================
-- 3. ai_relay_channel_groups(ai-relay-channel-groups.ts)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "ai_relay_channel_groups" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(64) NOT NULL,
  "description" TEXT,
  "load_balance_strategy" VARCHAR(32) NOT NULL DEFAULT 'weight',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "ai_relay_channel_groups_enabled_idx" ON "ai_relay_channel_groups"("enabled");
CREATE INDEX IF NOT EXISTS "ai_relay_channel_groups_priority_idx" ON "ai_relay_channel_groups"("priority");
CREATE UNIQUE INDEX IF NOT EXISTS "ai_relay_channel_groups_name_unique" ON "ai_relay_channel_groups"("name");

-- =============================================================================
-- 4. ai_relay_channel_group_members(ai-relay-channel-groups.ts,依赖 3)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "ai_relay_channel_group_members" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "group_id" UUID NOT NULL REFERENCES "ai_relay_channel_groups"("id") ON DELETE CASCADE,
  "key_pool_id" UUID NOT NULL,
  "weight" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "ai_relay_channel_group_members_group_id_idx" ON "ai_relay_channel_group_members"("group_id");
CREATE INDEX IF NOT EXISTS "ai_relay_channel_group_members_key_pool_id_idx" ON "ai_relay_channel_group_members"("key_pool_id");
CREATE UNIQUE INDEX IF NOT EXISTS "ai_relay_channel_group_members_group_key_unique" ON "ai_relay_channel_group_members"("group_id", "key_pool_id");

-- =============================================================================
-- 5. api_key_groups(api-key-groups.ts)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "api_key_groups" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(64) NOT NULL,
  "owner_id" UUID NOT NULL,
  "description" TEXT,
  "shared_token_balance" INTEGER NOT NULL DEFAULT 0,
  "shared_cost_balance_cents" INTEGER NOT NULL DEFAULT 0,
  "rate_limit_qpm" INTEGER NOT NULL DEFAULT 100,
  "allowed_models" JSONB,
  "allowed_ips" JSONB,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "api_key_groups_owner_idx" ON "api_key_groups"("owner_id");

-- =============================================================================
-- 6. api_key_group_members(api-key-groups.ts,依赖 5)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "api_key_group_members" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "group_id" UUID NOT NULL REFERENCES "api_key_groups"("id") ON DELETE CASCADE,
  "api_key_id" UUID NOT NULL,
  "role" VARCHAR(16) NOT NULL DEFAULT 'member',
  "max_tokens_per_req" INTEGER,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "api_key_group_members_group_idx" ON "api_key_group_members"("group_id");
CREATE INDEX IF NOT EXISTS "api_key_group_members_api_key_unique" ON "api_key_group_members"("api_key_id");

-- =============================================================================
-- 7. api_key_group_invites(api-key-groups.ts,依赖 5)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "api_key_group_invites" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "group_id" UUID NOT NULL REFERENCES "api_key_groups"("id") ON DELETE CASCADE,
  "invite_code" VARCHAR(16) NOT NULL UNIQUE,
  "created_by" UUID NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "used" BOOLEAN NOT NULL DEFAULT false,
  "used_by" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "api_key_group_invites_group_idx" ON "api_key_group_invites"("group_id");
CREATE INDEX IF NOT EXISTS "api_key_group_invites_code_idx" ON "api_key_group_invites"("invite_code");

-- =============================================================================
-- 8. api_key_shares(api-key-shares.ts)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "api_key_shares" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "source_api_key_id" UUID NOT NULL REFERENCES "developer_api_keys"("id") ON DELETE CASCADE,
  "shared_with_user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "share_token" VARCHAR(64) NOT NULL UNIQUE,
  "scope_models" TEXT[],
  "scope_endpoints" TEXT[],
  "rate_limit_rpm" INTEGER NOT NULL DEFAULT 60,
  "rate_limit_tpm" INTEGER NOT NULL DEFAULT 100000,
  "max_total_tokens" BIGINT,
  "used_total_tokens" BIGINT NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "revoked_at" TIMESTAMPTZ,
  "created_by" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_api_key_shares_token" ON "api_key_shares"("share_token");
CREATE INDEX IF NOT EXISTS "idx_api_key_shares_source" ON "api_key_shares"("source_api_key_id");
CREATE INDEX IF NOT EXISTS "idx_api_key_shares_expires" ON "api_key_shares"("expires_at");

-- =============================================================================
-- 9. model_price_history(model-price-history.ts)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "model_price_history" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "model_id" VARCHAR(128) NOT NULL,
  "input_token_price_cents" INTEGER NOT NULL,
  "output_token_price_cents" INTEGER NOT NULL,
  "relay_multiplier" NUMERIC(5,2) NOT NULL DEFAULT '1.00',
  "effective_at" TIMESTAMPTZ NOT NULL,
  "reason" VARCHAR(256),
  "changed_by" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "model_price_history_model_idx" ON "model_price_history"("model_id");
CREATE INDEX IF NOT EXISTS "model_price_history_effective_idx" ON "model_price_history"("effective_at");

-- =============================================================================
-- 10. price_discount_schedules(model-price-history.ts)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "price_discount_schedules" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(128) NOT NULL,
  "model_id" VARCHAR(128),
  "discount_multiplier" NUMERIC(5,2) NOT NULL,
  "starts_at" TIMESTAMPTZ NOT NULL,
  "ends_at" TIMESTAMPTZ NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_by" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "price_discount_schedules_model_idx" ON "price_discount_schedules"("model_id");
CREATE INDEX IF NOT EXISTS "price_discount_schedules_starts_at_idx" ON "price_discount_schedules"("starts_at");
CREATE INDEX IF NOT EXISTS "price_discount_schedules_enabled_idx" ON "price_discount_schedules"("enabled");

-- =============================================================================
-- 11. promo_coupons(coupons.ts)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "promo_coupons" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" VARCHAR(32) NOT NULL UNIQUE,
  "name" VARCHAR(128) NOT NULL,
  "type" VARCHAR(16) NOT NULL,
  "value" NUMERIC(5,2),
  "min_spend" INTEGER,
  "referrer_gets" VARCHAR(16),
  "referral_value" INTEGER,
  "applicable_models" JSONB,
  "applicable_scope" VARCHAR(16) NOT NULL DEFAULT 'relay',
  "total_quota" INTEGER,
  "issued_count" INTEGER NOT NULL DEFAULT 0,
  "per_user_limit" INTEGER NOT NULL DEFAULT 1,
  "starts_at" TIMESTAMPTZ NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "promo_coupons_code_idx" ON "promo_coupons"("code");
CREATE INDEX IF NOT EXISTS "promo_coupons_type_idx" ON "promo_coupons"("type");
CREATE INDEX IF NOT EXISTS "promo_coupons_enabled_idx" ON "promo_coupons"("enabled");

-- =============================================================================
-- 12. redemption_codes(redemption-codes.ts)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "redemption_codes" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" VARCHAR(32) NOT NULL UNIQUE,
  "batch_id" UUID,
  "face_value_cents" INTEGER NOT NULL,
  "token_amount" BIGINT NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'unused',
  "created_by" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "used_by" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "used_at" TIMESTAMPTZ,
  "expires_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "redemption_codes_code_idx" ON "redemption_codes"("code");
CREATE INDEX IF NOT EXISTS "redemption_codes_batch_idx" ON "redemption_codes"("batch_id");
CREATE INDEX IF NOT EXISTS "redemption_codes_status_idx" ON "redemption_codes"("status");

-- =============================================================================
-- 13. relay_commission_records(relay-commission-records.ts)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "relay_commission_records" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "source_user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "source_call_log_id" UUID REFERENCES "llm_call_logs"("id") ON DELETE SET NULL,
  "source_cost_cents" INTEGER NOT NULL,
  "beneficiary_user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "beneficiary_level" INTEGER NOT NULL,
  "commission_rate" NUMERIC(5,4) NOT NULL,
  "commission_cents" INTEGER NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'frozen',
  "frozen_until" TIMESTAMPTZ NOT NULL,
  "released_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "relay_commission_records_source_user_idx" ON "relay_commission_records"("source_user_id");
CREATE INDEX IF NOT EXISTS "relay_commission_records_beneficiary_idx" ON "relay_commission_records"("beneficiary_user_id");
CREATE INDEX IF NOT EXISTS "relay_commission_records_status_idx" ON "relay_commission_records"("status");
CREATE INDEX IF NOT EXISTS "relay_commission_records_frozen_until_idx" ON "relay_commission_records"("frozen_until");

-- =============================================================================
-- 14. relay_conversations(relay-conversations.ts)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "relay_conversations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversation_id" VARCHAR(100) NOT NULL UNIQUE,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "api_key_id" UUID NOT NULL REFERENCES "developer_api_keys"("id") ON DELETE CASCADE,
  "title" VARCHAR(200),
  "model" VARCHAR(100),
  "message_count" INTEGER NOT NULL DEFAULT 0,
  "total_tokens" BIGINT NOT NULL DEFAULT 0,
  "total_cost_cents" INTEGER NOT NULL DEFAULT 0,
  "last_message_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "metadata" JSONB DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_relay_conversations_user" ON "relay_conversations"("user_id", "last_message_at");
CREATE INDEX IF NOT EXISTS "idx_relay_conversations_api_key" ON "relay_conversations"("api_key_id");
CREATE INDEX IF NOT EXISTS "idx_relay_conversations_user_updated" ON "relay_conversations"("user_id", "updated_at");

-- =============================================================================
-- 15. relay_messages(relay-conversations.ts,依赖 14)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "relay_messages" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversation_id" UUID NOT NULL REFERENCES "relay_conversations"("id") ON DELETE CASCADE,
  "log_id" UUID REFERENCES "llm_call_logs"("id") ON DELETE SET NULL,
  "role" VARCHAR(20) NOT NULL,
  "content" TEXT NOT NULL,
  "model" VARCHAR(100),
  "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
  "completion_tokens" INTEGER NOT NULL DEFAULT 0,
  "total_tokens" INTEGER NOT NULL DEFAULT 0,
  "cost_cents" INTEGER NOT NULL DEFAULT 0,
  "latency_ms" INTEGER,
  "status" VARCHAR(20) NOT NULL DEFAULT 'success',
  "error_message" TEXT,
  "metadata" JSONB DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_relay_messages_conversation" ON "relay_messages"("conversation_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_relay_messages_log" ON "relay_messages"("log_id");

-- =============================================================================
-- 16. tiered_pricing_rules(tiered-pricing-rules.ts)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "tiered_pricing_rules" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(64) NOT NULL,
  "model_id" VARCHAR(128) NOT NULL,
  "from_tokens" INTEGER NOT NULL,
  "to_tokens" INTEGER,
  "multiplier" NUMERIC(5,2) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "tiered_pricing_rules_model_idx" ON "tiered_pricing_rules"("model_id");
CREATE INDEX IF NOT EXISTS "tiered_pricing_rules_enabled_idx" ON "tiered_pricing_rules"("enabled");

-- =============================================================================
-- 17. user_billing_groups(user-billing-groups.ts)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "user_billing_groups" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(64) NOT NULL,
  "description" TEXT,
  "default_multiplier" NUMERIC(5,2) NOT NULL DEFAULT '1.00',
  "rate_limit_qpm" INTEGER NOT NULL DEFAULT 10,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_billing_groups_name_unique" ON "user_billing_groups"("name");
CREATE INDEX IF NOT EXISTS "user_billing_groups_enabled_idx" ON "user_billing_groups"("enabled");
CREATE INDEX IF NOT EXISTS "user_billing_groups_sort_order_idx" ON "user_billing_groups"("sort_order");

-- =============================================================================
-- 18. user_billing_group_members(user-billing-groups.ts,依赖 17)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "user_billing_group_members" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL UNIQUE,
  "group_id" UUID NOT NULL REFERENCES "user_billing_groups"("id") ON DELETE CASCADE,
  "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "assigned_reason" VARCHAR(128),
  "expires_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "user_billing_group_members_group_id_idx" ON "user_billing_group_members"("group_id");
CREATE INDEX IF NOT EXISTS "user_billing_group_members_expires_at_idx" ON "user_billing_group_members"("expires_at");

-- =============================================================================
-- 19. user_billing_group_model_multipliers(user-billing-groups.ts,依赖 17)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "user_billing_group_model_multipliers" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "group_id" UUID NOT NULL REFERENCES "user_billing_groups"("id") ON DELETE CASCADE,
  "model_id" VARCHAR(128) NOT NULL,
  "multiplier" NUMERIC(5,2) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_billing_group_model_multipliers_group_model_unique" ON "user_billing_group_model_multipliers"("group_id", "model_id");
CREATE INDEX IF NOT EXISTS "user_billing_group_model_multipliers_group_id_idx" ON "user_billing_group_model_multipliers"("group_id");

-- =============================================================================
-- 20. user_coupons(coupons.ts,依赖 11 promo_coupons)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "user_coupons" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "coupon_id" UUID NOT NULL REFERENCES "promo_coupons"("id") ON DELETE CASCADE,
  "status" VARCHAR(16) NOT NULL DEFAULT 'unused',
  "referrer_user_id" UUID,
  "referred_by" UUID,
  "used_at" TIMESTAMPTZ,
  "used_on_order_id" UUID,
  "used_on_call_log_id" UUID,
  "discount_cents" INTEGER,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "user_coupons_user_status_idx" ON "user_coupons"("user_id", "status");
CREATE INDEX IF NOT EXISTS "user_coupons_coupon_idx" ON "user_coupons"("coupon_id");
CREATE INDEX IF NOT EXISTS "user_coupons_referrer_idx" ON "user_coupons"("referrer_user_id");
