// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { pathToFileURL } from 'node:url'
import { sql } from 'drizzle-orm'
import { createDb } from '../src/client.js'

const db = createDb(process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/ihui')

/**
 * 媒体上游真实成本价 seed（2026-11-26）。
 *
 * 目的：把 `ai_pricing.cost_unit_price` 回填成可核实的上游成本，
 * 供 `chargeMediaPoints` 在积分结算后写 `ai_cost_records`。
 *
 * 口径：
 * - 单位与 `per_unit_price` 相同：分/张、分/秒、分/次；
 * - 美元价按 7.2 CNY/USD 折算：`美元 × 7.2 = 人民币分`；
 * - 人民币官方价直接取数：`0.50 元/秒 = 50 分/秒`；
 * - 只更新当前生效行（effective_at <= now() 且未过期），不碰历史行；
 * - 成本为 0 是合法值（限时免费），但这笔不会写 `ai_cost_records`；
 * - 无法核实上游的模型不猜测，保持 null，由管理端人工补。
 *
 * 数据来源见每条的 `source` / `note`。本文件可重复执行（幂等 UPDATE）。
 */

interface MediaCostEntry {
  modelId: string
  billingMode: 'per_image' | 'per_video' | 'per_call'
  costUnitPrice: number
  source: string
  note: string
}

const COSTS: MediaCostEntry[] = [
  // ── 图片 ────────────────────────────────────────────────────────────────
  {
    modelId: 'agnes-image-2.0-flash',
    billingMode: 'per_image',
    costUnitPrice: 7.2,
    source: 'https://wiki.agnes-ai.com/en/docs/pricing',
    note: '1K 输出 $0.010/张 × 7.2 = 7.2 分/张；与 2.1/2.5 同价',
  },
  {
    modelId: 'agnes-image-2.1-flash',
    billingMode: 'per_image',
    costUnitPrice: 7.2,
    source: 'https://wiki.agnes-ai.com/en/docs/pricing',
    note: '1K 输出 $0.010/张 × 7.2 = 7.2 分/张',
  },
  {
    modelId: 'agnes-image-2.5-flash',
    billingMode: 'per_image',
    costUnitPrice: 7.2,
    source: 'https://wiki.agnes-ai.com/en/docs/pricing',
    note: '与 agnes-image-2.1-flash 同价：1K $0.010/张 × 7.2 = 7.2 分/张',
  },
  {
    modelId: 'grok-imagine-image',
    billingMode: 'per_image',
    costUnitPrice: 14.4,
    source: 'https://docs.x.ai/developers/pricing',
    note: '官方 $0.02/张 × 7.2 = 14.4 分/张；输入图另计 $0.002/张',
  },
  {
    modelId: 'grok-imagine-image-2.0',
    billingMode: 'per_image',
    costUnitPrice: 43.2,
    source: 'https://docs.x.ai/developers/pricing',
    note: '官方 2K low $0.06/张 × 7.2 = 43.2 分/张；medium 2K $0.08 更高',
  },
  {
    modelId: 'openmoss-team/moss-image',
    billingMode: 'per_image',
    costUnitPrice: 30,
    source: 'https://siliconflow.cn/pricing',
    note: 'SiliconFlow OpenMOSS-Team/MOSS-Image ¥0.30/张 = 30 分/张',
  },
  {
    modelId: 'qwen/qwen-image-edit',
    billingMode: 'per_image',
    costUnitPrice: 30,
    source: 'https://siliconflow.cn/pricing',
    note: 'SiliconFlow Qwen/Qwen-Image-Edit ¥0.30/张 = 30 分/张',
  },
  {
    modelId: 'qwen/qwen-image-edit-2509',
    billingMode: 'per_image',
    costUnitPrice: 30,
    source: 'https://siliconflow.cn/pricing',
    note: 'SiliconFlow Qwen/Qwen-Image-Edit-2509 ¥0.30/张 = 30 分/张',
  },
  {
    modelId: 'tongyi-mai/z-image',
    billingMode: 'per_image',
    costUnitPrice: 30,
    source: 'https://siliconflow.cn/pricing',
    note: 'SiliconFlow Tongyi-MAI/Z-Image ¥0.30/张 = 30 分/张',
  },
  {
    modelId: 'tongyi-mai/z-image-turbo',
    billingMode: 'per_image',
    costUnitPrice: 10,
    source: 'https://siliconflow.cn/pricing',
    note: 'SiliconFlow Tongyi-MAI/Z-Image-Turbo ¥0.10/张 = 10 分/张',
  },

  // ── 视频 ────────────────────────────────────────────────────────────────
  {
    modelId: 'agnes-video-2.5',
    billingMode: 'per_video',
    costUnitPrice: 18,
    source: 'https://wiki.agnes-ai.com/en/docs/pricing',
    note: '720P $0.025/秒 × 7.2 = 18 分/秒；1080P/1K $0.040、2K $0.055 更高',
  },
  {
    modelId: 'agnes-video-2.5-flash',
    billingMode: 'per_video',
    costUnitPrice: 0,
    source: 'https://wiki.agnes-ai.com/en/docs/pricing',
    note: '限时免费期 $0/秒 = 0 分/秒；刊例价同为 $0.025/秒（18 分/秒），恢复收费后改回 18',
  },
  {
    modelId: 'grok-imagine-video',
    billingMode: 'per_video',
    costUnitPrice: 36,
    source: 'https://docs.x.ai/developers/pricing',
    note: '480P $0.05/秒 × 7.2 = 36 分/秒；720P $0.07 更高',
  },
  {
    modelId: 'grok-imagine-video-1.5',
    billingMode: 'per_video',
    costUnitPrice: 57.6,
    source: 'https://docs.x.ai/developers/pricing',
    note: '480P $0.08/秒 × 7.2 = 57.6 分/秒；720P $0.14、1080P $0.25 更高',
  },
  {
    modelId: 'grok-imagine-video-1.5-lite',
    billingMode: 'per_video',
    costUnitPrice: 14.4,
    source: 'https://docs.x.ai/developers/pricing',
    note: '480P $0.02/秒 × 7.2 = 14.4 分/秒；720P $0.03 更高',
  },
  {
    modelId: 'magi-2',
    billingMode: 'per_video',
    costUnitPrice: 50,
    source: 'https://36kr.com/p/4084870019197572',
    note: 'Sand.ai 官方 1080P 0.5 元/秒 = 50 分/秒（2026-11-25 发布价）',
  },
  {
    modelId: 'magi-2-preview',
    billingMode: 'per_video',
    costUnitPrice: 50,
    source: 'https://36kr.com/p/4084870019197572',
    note: '同 magi-2：1080P 0.5 元/秒 = 50 分/秒',
  },
  {
    modelId: 'magi-2-preview-latest',
    billingMode: 'per_video',
    costUnitPrice: 50,
    source: 'https://36kr.com/p/4084870019197572',
    note: '同 magi-2：1080P 0.5 元/秒 = 50 分/秒',
  },
  {
    modelId: 'minimaxai/minimax-h3',
    billingMode: 'per_video',
    costUnitPrice: 50,
    source: 'https://platform.minimaxi.com/docs/guides/pricing-paygo',
    note: '768P 0.50 元/秒 = 50 分/秒；2K 为 0.80 元/秒 = 80 分/秒',
  },

  // ── 音乐 / 按次 ────────────────────────────────────────────────────────
  {
    modelId: 'lyria-3-clip-preview',
    billingMode: 'per_call',
    costUnitPrice: 28.8,
    source: 'https://ai.google.dev/gemini-api/docs/pricing',
    note: '官方 $0.04/首 × 7.2 = 28.8 分/首（30 秒片段）',
  },
  {
    modelId: 'lyria-3-pro-preview',
    billingMode: 'per_call',
    costUnitPrice: 57.6,
    source: 'https://ai.google.dev/gemini-api/docs/pricing',
    note: '官方 $0.08/首 × 7.2 = 57.6 分/首（完整歌曲）',
  },
  {
    modelId: 'lyria-3.5',
    billingMode: 'per_call',
    costUnitPrice: 57.6,
    source: 'https://ai.google.dev/gemini-api/docs/pricing',
    note: '官方 $0.08/首 × 7.2 = 57.6 分/首（完整歌曲）',
  },
  {
    modelId: 'lyria-realtime-exp',
    billingMode: 'per_call',
    costUnitPrice: 57.6,
    source: 'https://ai.google.dev/gemini-api/docs/pricing',
    note: '官方价目未单列 RealTime；LiteLLM 记录 $0.08/次 × 7.2 = 57.6 分/次',
  },
]

export async function seedMediaCostPricing(): Promise<void> {
  // gpt-image-2 / 2.5 / flare / sunburst 的历史行是早期占位价(0.02~0.03 分/张),
  // 低于 1 分地板且没有可核实的上游成本;这批模型也没有 relay_public 配置。
  // 按“未定价不卖”直接过期停售,不硬编假成本;后台补到真实成本后再重新上架。
  const expiredGptImage = await db.execute(sql`
    UPDATE ai_pricing
       SET expires_at = now()
     WHERE lower(model_id) IN (
       'gpt-image-2', 'gpt-image-2.5', 'gpt-image-2.5-flare', 'gpt-image-2.5-sunburst'
     )
       AND per_unit_price < 1
       AND (expires_at IS NULL OR expires_at > now())
    RETURNING model_id
  `)
  const expiredRows = ((expiredGptImage as { rows?: Array<{ model_id: string }> }).rows ??
    (Array.isArray(expiredGptImage)
      ? (expiredGptImage as Array<{ model_id: string }>)
      : [])) as Array<{ model_id: string }>
  if (expiredRows.length > 0) {
    console.info(
      `[media-cost] 已过期 ${expiredRows.length} 条 gpt-image 占位低价行(未定价不卖):${[
        ...new Set(expiredRows.map((row) => row.model_id)),
      ].join(', ')}`,
    )
  }

  let updated = 0
  const missing: string[] = []

  for (const entry of COSTS) {
    const result = await db.execute(sql`
      UPDATE ai_pricing
          SET cost_unit_price = ${entry.costUnitPrice}::numeric
        WHERE lower(model_id) = ${entry.modelId.toLowerCase()}
          AND billing_mode = ${entry.billingMode}
          AND effective_at <= now()
          AND (expires_at IS NULL OR expires_at > now())
        RETURNING model_id
    `)
    const rows = ((result as { rows?: Array<{ model_id: string }> }).rows ??
      (Array.isArray(result) ? (result as Array<{ model_id: string }>) : [])) as Array<{
      model_id: string
    }>
    if (rows.length === 0) {
      missing.push(entry.modelId)
    } else {
      updated += rows.length
    }
  }

  console.info(`[media-cost] 已回填 ${updated} 条当前生效定价行的 cost_unit_price`)
  if (missing.length > 0) {
    console.warn(`[media-cost] 未找到当前生效行（需人工确认）：${missing.join(', ')}`)
  }

  // 自检：只对“真的可能卖出去”的媒体行告警——有正零售价且存在启用的 relay_public
  // 配置。gpt-image 系列当前没有公开配置(不可售),缺成本不应被当成在售缺口;
  // 一旦后台重新上架,这里的告警会立刻出现,继续 fail-closed。
  const uncovered = await db.execute(sql`
    SELECT p.model_id
      FROM ai_pricing p
     WHERE p.billing_mode IN ('per_image', 'per_video', 'per_call')
       AND p.model_id <> 'gpt-5.6'
       AND p.per_unit_price > 0
       AND p.effective_at <= now()
       AND (p.expires_at IS NULL OR p.expires_at > now())
       AND p.cost_unit_price IS NULL
       AND EXISTS (
         SELECT 1 FROM ai_model_config_models m
          WHERE lower(m.model_id) = lower(p.model_id)
            AND m.enabled = true
            AND m.is_relay_public = true
       )
     ORDER BY p.model_id
  `)
  const uncoveredRows = ((uncovered as { rows?: Array<{ model_id: string }> }).rows ??
    (Array.isArray(uncovered)
      ? (uncovered as Array<{ model_id: string }>)
      : [])) as Array<{ model_id: string }>
  if (uncoveredRows.length > 0) {
    console.warn(
      `[media-cost] 仍有 ${uncoveredRows.length} 条媒体定价行缺少成本价：${uncoveredRows
        .map((row) => row.model_id)
        .join(', ')}`,
    )
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  seedMediaCostPricing()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('[media-cost] seed 失败', error)
      process.exit(1)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
