// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { sql } from 'drizzle-orm'
import { createDb } from '../src/client.js'

const db = createDb(process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/ihui')

/**
 * 中转站定价 seed(2026-09-13 立)。
 *
 * 背景:relay discovery 审批落库的 120 个中转站模型全部 input/output=0 + multiplier=1.0,
 *       导致计费 calculateCost 恒为 0 分,公开价目(/api/relay/models/public)全为免费。
 *
 * 三步(全部幂等,可重复执行):
 *   1. 倍率 1.0000 → 1.2000(仅 is_relay_public=true;不覆盖管理员手动调整过的值)
 *   2. swiftapi 渠道进价快照写入 ai_pricing(2026-09-13 取自上游报价页「到手」价,
 *      元/百万 token ÷ 10 = 分/千 token)—— ai_pricing 是 calculateCost 的第一优先定价源
 *   3. 从 ai_pricing 有效价回填 is_relay_public 且 0/0 的模型进价
 *      —— 计费虽以 ai_pricing 优先,但公开价目表读 model config,回填让价格可见
 *      (2026-09-13:价格列 integer→numeric(18,6),小数进价可回填,不再 ::int 归零)
 */
export async function seedRelayPricing(): Promise<void> {
  // ── 1. 倍率:仅把仍是默认 1.0000 的中转站公开模型提到 1.2 ──
  const mulRes = await db.execute(sql`
    UPDATE ai_model_config_models
    SET relay_price_multiplier = '1.2000'
    WHERE is_relay_public = true
      AND relay_price_multiplier = '1.0000'
  `)

  // ── 2. swiftapi 渠道进价快照(2026-09-13 取自上游报价页「到手」价,元/百万 token ÷ 10 = 分/千 token)。
  //      幂等:INSERT ... WHERE NOT EXISTS(ai_pricing 无 model_id 唯一约束,ON CONFLICT 不适用);
  //      已有记录仅当 0/0 时升价(不覆盖管理员手动调价)。
  //      数据源:https://api.x5m5x.com/pricing/(按量计费 · 到手价)
  const snapshotRes = await db.execute(sql`
    INSERT INTO ai_pricing (model_id, input_token_price, output_token_price, region_pricing, currency)
    SELECT v.model_id, v.ip, v.op, '{"cn":1.0}'::jsonb, 'CNY'
    FROM (VALUES
      ('glm-5.3-flash',             0.008::numeric,  0.028::numeric),
      ('deepseek-v4-flash-vision-exp', 0.01::numeric,   0.04::numeric),
      ('qwen3.7-max',               0.096::numeric,  0.288::numeric),
      ('qwen3.8-flash',             0.0064::numeric, 0.0216::numeric),
      ('mimo-v2.5',                 0.005::numeric,  0.01::numeric),
      ('mimo-v2.5-pro',             0.0155::numeric, 0.0305::numeric),
      ('hy3',                       0.005::numeric,  0.02::numeric),
      ('claude-fable-5.1',          0.5::numeric,    2.5::numeric),
      ('gemini-3.1-pro-preview',    0.05::numeric,   0.3::numeric)
    ) AS v(model_id, ip, op)
    WHERE NOT EXISTS (
      SELECT 1 FROM ai_pricing p
      WHERE p.model_id = v.model_id
        AND p.effective_at <= now()
        AND (p.expires_at IS NULL OR p.expires_at > now())
    )
  `)
  const snapshotUpdRes = await db.execute(sql`
    UPDATE ai_pricing p
    SET input_token_price = v.ip, output_token_price = v.op, updated_at = now()
    FROM (VALUES
      ('glm-5.3-flash',             0.008::numeric,  0.028::numeric),
      ('deepseek-v4-flash-vision-exp', 0.01::numeric,   0.04::numeric),
      ('qwen3.7-max',               0.096::numeric,  0.288::numeric),
      ('qwen3.8-flash',             0.0064::numeric, 0.0216::numeric),
      ('mimo-v2.5',                 0.005::numeric,  0.01::numeric),
      ('mimo-v2.5-pro',             0.0155::numeric, 0.0305::numeric),
      ('hy3',                       0.005::numeric,  0.02::numeric),
      ('claude-fable-5.1',          0.5::numeric,    2.5::numeric),
      ('gemini-3.1-pro-preview',    0.05::numeric,   0.3::numeric)
    ) AS v(model_id, ip, op)
    WHERE p.model_id = v.model_id
      AND p.input_token_price = 0 AND p.output_token_price = 0
      AND p.effective_at <= now()
      AND (p.expires_at IS NULL OR p.expires_at > now())
  `)

  // ── 2.5 多模态计费快照(2026-09-13,同源报价页):
  //      per_call(按次三档,分/次)+ per_image(按张,分/张)。
  //      幂等单语句:① 已存在但仍是 token 模式的行 → 升级为多模态模式(token 价清零,
  //      避免同模型双配置;不覆盖管理员已设的 per_* 配置);② 不存在的行 → INSERT。
  //      管理员调价走 admin/ai-pricing/upsert。
  const mmSnapshotRes = await db.execute(sql`
    WITH mm(model_id, mode, unit, tiered, vunit) AS (VALUES
      ('gpt-5.6',   'per_call',  NULL::numeric, '{"le256k":0.01,"mid":0.015,"gt512k":0.02}'::jsonb,  NULL::text),
      ('Auto-Model','per_call',  NULL::numeric, '{"le256k":0.001,"mid":0.0015,"gt512k":0.002}'::jsonb, NULL::text),
      ('gpt-image-2',          'per_image', 0.02::numeric, NULL::jsonb, NULL::text),
      ('gpt-image-2.5',        'per_image', 0.03::numeric, NULL::jsonb, NULL::text),
      ('gpt-image-2.5-flare',  'per_image', 0.03::numeric, NULL::jsonb, NULL::text),
      ('gpt-image-2.5-sunburst','per_image', 0.03::numeric, NULL::jsonb, NULL::text)
    ),
    upd AS (
      UPDATE ai_pricing p
      SET billing_mode = v.mode,
          per_unit_price = v.unit,
          tiered_call_prices = v.tiered,
          video_unit = v.vunit,
          input_token_price = 0,
          output_token_price = 0
      FROM mm v
      WHERE p.model_id = v.model_id
        AND p.effective_at <= now()
        AND (p.expires_at IS NULL OR p.expires_at > now())
        AND (p.billing_mode IS NULL OR p.billing_mode = 'token')
      RETURNING 1
    )
    INSERT INTO ai_pricing (
      model_id, input_token_price, output_token_price,
      billing_mode, per_unit_price, tiered_call_prices, video_unit,
      region_pricing, currency
    )
    SELECT v.model_id, 0, 0, v.mode, v.unit, v.tiered, v.vunit, '{"cn":1.0}'::jsonb, 'CNY'
    FROM mm v
    WHERE NOT EXISTS (
      SELECT 1 FROM ai_pricing p
      WHERE p.model_id = v.model_id
        AND p.effective_at <= now()
        AND (p.expires_at IS NULL OR p.expires_at > now())
    )
  `)
  // drizzle db.execute 的 rowCount 不可靠(恒 0),以库内实查为准

  // ── 3. ai_pricing 有效价回填到中转站公开模型的 0/0 进价 ──
  //      2026-09-13:价格列已 integer→numeric(18,6),小数进价可直接回填,不再 ::int 归零
  const backfillRes = await db.execute(sql`
    UPDATE ai_model_config_models m
    SET input_price_per_1k  = p.input_token_price,
        output_price_per_1k = p.output_token_price
    FROM (
      SELECT DISTINCT ON (model_id)
             model_id, input_token_price, output_token_price
      FROM ai_pricing
      WHERE effective_at <= now()
        AND (expires_at IS NULL OR expires_at > now())
        AND (input_token_price > 0 OR output_token_price > 0)
      ORDER BY model_id, effective_at DESC
    ) p
    WHERE p.model_id = m.model_id
      AND m.is_relay_public = true
      AND m.input_price_per_1k = 0
      AND m.output_price_per_1k = 0
  `)

  console.info(
    `[relay-pricing] multiplier→1.2: ${mulRes.rowCount ?? 0} 行, ` +
      `swiftapi 进价快照(insert/zero-upd): ${snapshotRes.rowCount ?? 0}/${snapshotUpdRes.rowCount ?? 0} 行, ` +
      `多模态计费快照: ${mmSnapshotRes.rowCount ?? 0} 行, ` +
      `ai_pricing→model_config 回填: ${backfillRes.rowCount ?? 0} 行`,
  )
}

// 独立执行入口:tsx seed/relay-pricing-seed.ts
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('relay-pricing-seed.ts')) {
  seedRelayPricing()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[relay-pricing] seed 失败:', err)
      process.exit(1)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
