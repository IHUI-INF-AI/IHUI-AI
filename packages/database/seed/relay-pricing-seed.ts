// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

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
 *   2. glm-5.3-flash 保底价(in=15/out=30 分/千token,对标 glm-5.2 半价)写入 ai_pricing
 *      —— ai_pricing 是 calculateCost 的第一优先定价源;flash 档 45 token 量级探针调用
 *         也能产生非零 costCents(15in+30out ≈ 1.35 分 → round 1)
 *   3. 从 ai_pricing 有效价回填 is_relay_public 且 0/0 的模型进价
 *      —— 计费虽以 ai_pricing 优先,但公开价目表读 model config,回填让价格可见
 */
export async function seedRelayPricing(): Promise<void> {
  // ── 1. 倍率:仅把仍是默认 1.0000 的中转站公开模型提到 1.2 ──
  const mulRes = await db.execute(sql`
    UPDATE ai_model_config_models
    SET relay_price_multiplier = '1.2000'
    WHERE is_relay_public = true
      AND relay_price_multiplier = '1.0000'
  `)

  // ── 2. glm-5.3-flash 保底价(ai_pricing 无有效价时插入) ──
  const floorRes = await db.execute(sql`
    INSERT INTO ai_pricing (model_id, input_token_price, output_token_price, region_pricing, currency)
    SELECT 'glm-5.3-flash', 15, 30, '{"cn":1.0}'::jsonb, 'CNY'
    WHERE NOT EXISTS (
      SELECT 1 FROM ai_pricing
      WHERE model_id = 'glm-5.3-flash'
        AND effective_at <= now()
        AND (expires_at IS NULL OR expires_at > now())
    )
  `)

  // ── 3. ai_pricing 有效价回填到中转站公开模型的 0/0 进价 ──
  const backfillRes = await db.execute(sql`
    UPDATE ai_model_config_models m
    SET input_price_per_1k  = p.input_token_price::int,
        output_price_per_1k = p.output_token_price::int
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
      `glm-5.3-flash 保底价: ${floorRes.rowCount ?? 0} 行, ` +
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
