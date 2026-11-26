-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 2026-11-26: 积分预扣冻结 + 成本可信度 + 内置媒体工具补价
-- 1) user_points.reserved_points: 并发请求冻结额度,可用余额 = permanent + daily - reserved
-- 2) point_holds: 冻结流水,结算/释放/过期都落状态,支持幂等
-- 3) ai_cost_records.cost_status: priced | unknown | zero_cost,杜绝“无价记 0”被当真实成本
-- 4) 内置媒体工具/语音链路的显式零售价:全部 >0,未定价模型继续 fail-closed

ALTER TABLE "user_points"
  ADD COLUMN IF NOT EXISTS "reserved_points" integer DEFAULT 0 NOT NULL;

-- 聊天结算引用 = `${conversationId}:${messageId}`(36+1+36=73 字符),
-- 旧 varchar(64) 会直接 insert 失败,导致回调结算整笔跳过(免费)。
ALTER TABLE "point_transactions"
  ALTER COLUMN "reference_id" TYPE varchar(160);

CREATE TABLE IF NOT EXISTS "point_holds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "source" varchar(32) NOT NULL,
  "reference_id" varchar(160) NOT NULL,
  "model_id" varchar(128),
  "amount" integer NOT NULL,
  "status" varchar(16) DEFAULT 'held' NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "settled_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ix_point_holds_user_ref"
  ON "point_holds" ("user_id", "reference_id");
CREATE UNIQUE INDEX IF NOT EXISTS "ux_point_holds_user_source_ref_active"
  ON "point_holds" ("user_id", "source", "reference_id")
  WHERE "status" = 'held';
CREATE INDEX IF NOT EXISTS "ix_point_holds_status_expiry"
  ON "point_holds" ("status", "expires_at");

ALTER TABLE "ai_cost_records"
  ADD COLUMN IF NOT EXISTS "cost_status" varchar(16) DEFAULT 'priced' NOT NULL;

-- 内置媒体工具补价(per_unit_price 单位:分;1 积分 = 1 分)
-- 只补“平台自有/固定动作”的低成本链路,避免这些功能因 fail-closed 直接不可用;
-- 上游成本未采集的行 cost_unit_price 留 NULL,成本账会标记 unknown,不会伪装成 0。
INSERT INTO "ai_pricing"
  ("model_id", "input_token_price", "output_token_price", "billing_mode", "per_unit_price", "cost_unit_price", "video_unit", "currency")
SELECT v.model_id, 0, 0, v.billing_mode, v.per_unit_price, NULL, v.video_unit, 'CNY'
FROM (VALUES
  ('cosyvoice-v2',         'per_call',  2::numeric,   NULL::varchar),
  ('paraformer-v2',        'per_call',  2::numeric,   NULL::varchar),
  ('speaker-recognition',  'per_call',  2::numeric,   NULL::varchar),
  ('voice-clone',          'per_call',  2::numeric,   NULL::varchar),
  ('video-compose',        'per_call', 30::numeric,   NULL::varchar),
  ('hunyuan3d',            'per_call', 30::numeric,   NULL::varchar),
  ('image-edit',           'per_image',20::numeric,   NULL::varchar),
  ('jimeng4',              'per_image',20::numeric,   NULL::varchar),
  ('jimeng_t2i_v40',       'per_image',20::numeric,   NULL::varchar),
  ('jimeng_t2i_v31',       'per_image',20::numeric,   NULL::varchar),
  ('watermark-image',      'per_image',20::numeric,   NULL::varchar),
  ('watermark-video',      'per_video',100::numeric,  'call'::varchar),
  ('gpt-4o-mini-tts',      'per_call',  5::numeric,   NULL::varchar),
  ('whisper-1',            'per_call',  5::numeric,   NULL::varchar)
) AS v(model_id, billing_mode, per_unit_price, video_unit)
WHERE NOT EXISTS (
  SELECT 1 FROM "ai_pricing" p
  WHERE p."model_id" = v.model_id
    AND p."billing_mode" = v.billing_mode
    AND p."expires_at" IS NULL
);

-- 清零历史 0 倍率:0 倍率在旧口径里等于免费,本产品不再提供免费模型。
-- 有 token 成本价的按成本 ×3 回填,最低 1;没有定价的也置 1(实际结算仍会 fail-closed)。
UPDATE "ai_model_config_models" m
SET "points_multiplier" = GREATEST(
  1,
  CEIL(
    GREATEST(
      COALESCE(p."input_token_price", 0),
      COALESCE(p."output_token_price", 0)
    ) * 3
  )
)
FROM (
  SELECT DISTINCT ON ("model_id") "model_id", "input_token_price", "output_token_price"
  FROM "ai_pricing"
  WHERE "billing_mode" = 'token' AND "expires_at" IS NULL
  ORDER BY "model_id", "effective_at" DESC
) p
WHERE lower(m."model_id") = lower(p."model_id")
  AND COALESCE(m."points_multiplier", 1) <= 0;

UPDATE "ai_model_config_models"
SET "points_multiplier" = 1
WHERE COALESCE("points_multiplier", 1) <= 0;
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
