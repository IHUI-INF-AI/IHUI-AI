/**
 * AI 模型定价 seed 脚本(AGENTS.md §24 P0-3a)。
 *
 * 用法:
 *   pnpm --filter @ihui/api tsx scripts/seed-ai-pricing.ts
 *
 * 行为:
 * 1. 按 modelId upsert 主流厂商模型定价(OpenAI/Anthropic/Gemini/DeepSeek/Qwen/Doubao/Kimi/Zhipu/MiniMax)
 * 2. inputTokenPrice/outputTokenPrice 单位"分/千 token"(整数,避免浮点误差)
 * 3. 区域系数 regionPricing: { cn, us, eu }(海外厂商 us=1.0, 国内 cn=1.0)
 * 4. currency: CNY(海外厂商按 1USD=6CNY 折算)
 *
 * 价格来源:2025-2026 各厂商官方价格表(USD/1M tokens → 分/千 tokens)
 *   海外:USD * 6 / 1000 * 100 = USD * 0.6 分/千 token
 *   国内:CNY / 1M * 1000 * 100 = CNY / 10 分/千 token
 *
 * P0 覆盖 30+ 主流模型,后续可批量补到 176。
 */
import 'dotenv/config'
import { db } from '../src/db/index.js'
import { aiPricing } from '@ihui/database'
import { eq } from 'drizzle-orm'

interface SeedPricing {
  modelId: string
  inputTokenPrice: number // 分/千 token
  outputTokenPrice: number
  regionPricing: { cn: number; us: number; eu: number }
  currency: 'CNY' | 'USD'
}

// 价格行情(2025-2026 公开报价,人民币模型 cn=1.0,海外模型 us=1.0/cn=1.0/0.85 折扣)
const SEED_PRICING: SeedPricing[] = [
  // ===== OpenAI(USD * 0.6 → 分/千 token)=====
  {
    modelId: 'gpt-4o',
    inputTokenPrice: 15,
    outputTokenPrice: 60,
    regionPricing: { cn: 1.0, us: 1.0, eu: 1.0 },
    currency: 'CNY',
  },
  {
    modelId: 'gpt-4o-mini',
    inputTokenPrice: 1,
    outputTokenPrice: 4,
    regionPricing: { cn: 1.0, us: 1.0, eu: 1.0 },
    currency: 'CNY',
  },
  {
    modelId: 'gpt-4-turbo',
    inputTokenPrice: 60,
    outputTokenPrice: 120,
    regionPricing: { cn: 1.0, us: 1.0, eu: 1.0 },
    currency: 'CNY',
  },
  {
    modelId: 'gpt-4.1',
    inputTokenPrice: 15,
    outputTokenPrice: 60,
    regionPricing: { cn: 1.0, us: 1.0, eu: 1.0 },
    currency: 'CNY',
  },
  {
    modelId: 'gpt-4.1-mini',
    inputTokenPrice: 2,
    outputTokenPrice: 8,
    regionPricing: { cn: 1.0, us: 1.0, eu: 1.0 },
    currency: 'CNY',
  },
  {
    modelId: 'o1',
    inputTokenPrice: 90,
    outputTokenPrice: 360,
    regionPricing: { cn: 1.0, us: 1.0, eu: 1.0 },
    currency: 'CNY',
  },
  {
    modelId: 'o1-mini',
    inputTokenPrice: 18,
    outputTokenPrice: 72,
    regionPricing: { cn: 1.0, us: 1.0, eu: 1.0 },
    currency: 'CNY',
  },
  {
    modelId: 'o3-mini',
    inputTokenPrice: 9,
    outputTokenPrice: 36,
    regionPricing: { cn: 1.0, us: 1.0, eu: 1.0 },
    currency: 'CNY',
  },

  // ===== Anthropic =====
  {
    modelId: 'claude-3.5-sonnet',
    inputTokenPrice: 18,
    outputTokenPrice: 90,
    regionPricing: { cn: 1.0, us: 1.0, eu: 1.0 },
    currency: 'CNY',
  },
  {
    modelId: 'claude-3.5-haiku',
    inputTokenPrice: 5,
    outputTokenPrice: 25,
    regionPricing: { cn: 1.0, us: 1.0, eu: 1.0 },
    currency: 'CNY',
  },
  {
    modelId: 'claude-3-opus',
    inputTokenPrice: 90,
    outputTokenPrice: 270,
    regionPricing: { cn: 1.0, us: 1.0, eu: 1.0 },
    currency: 'CNY',
  },
  {
    modelId: 'claude-3-sonnet',
    inputTokenPrice: 18,
    outputTokenPrice: 90,
    regionPricing: { cn: 1.0, us: 1.0, eu: 1.0 },
    currency: 'CNY',
  },
  {
    modelId: 'claude-3-haiku',
    inputTokenPrice: 2,
    outputTokenPrice: 8,
    regionPricing: { cn: 1.0, us: 1.0, eu: 1.0 },
    currency: 'CNY',
  },

  // ===== Google Gemini =====
  {
    modelId: 'gemini-2.0-flash',
    inputTokenPrice: 6,
    outputTokenPrice: 24,
    regionPricing: { cn: 1.0, us: 1.0, eu: 1.0 },
    currency: 'CNY',
  },
  {
    modelId: 'gemini-2.0-flash-lite',
    inputTokenPrice: 1,
    outputTokenPrice: 4,
    regionPricing: { cn: 1.0, us: 1.0, eu: 1.0 },
    currency: 'CNY',
  },
  {
    modelId: 'gemini-1.5-pro',
    inputTokenPrice: 75,
    outputTokenPrice: 180,
    regionPricing: { cn: 1.0, us: 1.0, eu: 1.0 },
    currency: 'CNY',
  },
  {
    modelId: 'gemini-1.5-flash',
    inputTokenPrice: 5,
    outputTokenPrice: 15,
    regionPricing: { cn: 1.0, us: 1.0, eu: 1.0 },
    currency: 'CNY',
  },

  // ===== DeepSeek(国内,CNY,¥/1M → 分/千 = ÷10)=====
  {
    modelId: 'deepseek-chat',
    inputTokenPrice: 1,
    outputTokenPrice: 8,
    regionPricing: { cn: 1.0, us: 1.1, eu: 1.1 },
    currency: 'CNY',
  },
  {
    modelId: 'deepseek-reasoner',
    inputTokenPrice: 4,
    outputTokenPrice: 16,
    regionPricing: { cn: 1.0, us: 1.1, eu: 1.1 },
    currency: 'CNY',
  },
  {
    modelId: 'deepseek-coder',
    inputTokenPrice: 1,
    outputTokenPrice: 8,
    regionPricing: { cn: 1.0, us: 1.1, eu: 1.1 },
    currency: 'CNY',
  },

  // ===== 阿里 Qwen(¥/1M → 分/千 = ÷10)=====
  {
    modelId: 'qwen-max',
    inputTokenPrice: 24,
    outputTokenPrice: 96,
    regionPricing: { cn: 1.0, us: 1.1, eu: 1.1 },
    currency: 'CNY',
  },
  {
    modelId: 'qwen-plus',
    inputTokenPrice: 4,
    outputTokenPrice: 12,
    regionPricing: { cn: 1.0, us: 1.1, eu: 1.1 },
    currency: 'CNY',
  },
  {
    modelId: 'qwen-turbo',
    inputTokenPrice: 2,
    outputTokenPrice: 6,
    regionPricing: { cn: 1.0, us: 1.1, eu: 1.1 },
    currency: 'CNY',
  },
  {
    modelId: 'qwen2.5-72b-instruct',
    inputTokenPrice: 4,
    outputTokenPrice: 12,
    regionPricing: { cn: 1.0, us: 1.1, eu: 1.1 },
    currency: 'CNY',
  },
  {
    modelId: 'qwen2.5-coder-32b-instruct',
    inputTokenPrice: 4,
    outputTokenPrice: 12,
    regionPricing: { cn: 1.0, us: 1.1, eu: 1.1 },
    currency: 'CNY',
  },
  {
    modelId: 'qwen-vl-max',
    inputTokenPrice: 20,
    outputTokenPrice: 60,
    regionPricing: { cn: 1.0, us: 1.1, eu: 1.1 },
    currency: 'CNY',
  },

  // ===== 字节 Doubao =====
  {
    modelId: 'doubao-pro-32k',
    inputTokenPrice: 4,
    outputTokenPrice: 8,
    regionPricing: { cn: 1.0, us: 1.1, eu: 1.1 },
    currency: 'CNY',
  },
  {
    modelId: 'doubao-pro-128k',
    inputTokenPrice: 8,
    outputTokenPrice: 16,
    regionPricing: { cn: 1.0, us: 1.1, eu: 1.1 },
    currency: 'CNY',
  },
  {
    modelId: 'doubao-lite-32k',
    inputTokenPrice: 2,
    outputTokenPrice: 4,
    regionPricing: { cn: 1.0, us: 1.1, eu: 1.1 },
    currency: 'CNY',
  },
  {
    modelId: 'doubao-vision-pro-32k',
    inputTokenPrice: 6,
    outputTokenPrice: 12,
    regionPricing: { cn: 1.0, us: 1.1, eu: 1.1 },
    currency: 'CNY',
  },

  // ===== 月之暗面 Kimi =====
  {
    modelId: 'moonshot-v1-8k',
    inputTokenPrice: 8,
    outputTokenPrice: 24,
    regionPricing: { cn: 1.0, us: 1.1, eu: 1.1 },
    currency: 'CNY',
  },
  {
    modelId: 'moonshot-v1-32k',
    inputTokenPrice: 16,
    outputTokenPrice: 48,
    regionPricing: { cn: 1.0, us: 1.1, eu: 1.1 },
    currency: 'CNY',
  },
  {
    modelId: 'moonshot-v1-128k',
    inputTokenPrice: 50,
    outputTokenPrice: 120,
    regionPricing: { cn: 1.0, us: 1.1, eu: 1.1 },
    currency: 'CNY',
  },
  {
    modelId: 'kimi-latest',
    inputTokenPrice: 8,
    outputTokenPrice: 24,
    regionPricing: { cn: 1.0, us: 1.1, eu: 1.1 },
    currency: 'CNY',
  },

  // ===== 智谱 Zhipu =====
  {
    modelId: 'glm-4-plus',
    inputTokenPrice: 50,
    outputTokenPrice: 50,
    regionPricing: { cn: 1.0, us: 1.1, eu: 1.1 },
    currency: 'CNY',
  },
  {
    modelId: 'glm-4-air',
    inputTokenPrice: 1,
    outputTokenPrice: 1,
    regionPricing: { cn: 1.0, us: 1.1, eu: 1.1 },
    currency: 'CNY',
  },
  {
    modelId: 'glm-4-flash',
    inputTokenPrice: 0,
    outputTokenPrice: 0,
    regionPricing: { cn: 1.0, us: 1.0, eu: 1.0 },
    currency: 'CNY',
  },
  {
    modelId: 'glm-4v',
    inputTokenPrice: 50,
    outputTokenPrice: 50,
    regionPricing: { cn: 1.0, us: 1.1, eu: 1.1 },
    currency: 'CNY',
  },

  // ===== MiniMax =====
  {
    modelId: 'abab6.5s-chat',
    inputTokenPrice: 5,
    outputTokenPrice: 5,
    regionPricing: { cn: 1.0, us: 1.1, eu: 1.1 },
    currency: 'CNY',
  },
  {
    modelId: 'abab6.5g-chat',
    inputTokenPrice: 30,
    outputTokenPrice: 30,
    regionPricing: { cn: 1.0, us: 1.1, eu: 1.1 },
    currency: 'CNY',
  },
]

async function main() {
  console.info(`[seed-ai-pricing] 开始 seed ${SEED_PRICING.length} 个模型定价...`)
  let inserted = 0
  let updated = 0

  for (const p of SEED_PRICING) {
    const [existing] = await db
      .select({ id: aiPricing.id })
      .from(aiPricing)
      .where(eq(aiPricing.modelId, p.modelId))
      .limit(1)

    const now = new Date()

    if (existing) {
      await db
        .update(aiPricing)
        .set({
          inputTokenPrice: p.inputTokenPrice,
          outputTokenPrice: p.outputTokenPrice,
          regionPricing: p.regionPricing,
          currency: p.currency,
          updatedAt: now,
        })
        .where(eq(aiPricing.id, existing.id))
      updated++
    } else {
      await db.insert(aiPricing).values({
        modelId: p.modelId,
        inputTokenPrice: p.inputTokenPrice,
        outputTokenPrice: p.outputTokenPrice,
        regionPricing: p.regionPricing,
        currency: p.currency,
        effectiveAt: now,
      })
      inserted++
    }
    console.info(
      `  ${p.modelId}: input=${p.inputTokenPrice}分/千 token, output=${p.outputTokenPrice}分/千 token, ${p.currency}`,
    )
  }

  console.info(`[seed-ai-pricing] 完成:新增 ${inserted} 个,更新 ${updated} 个`)
  process.exit(0)
}

main().catch((err) => {
  console.error('[seed-ai-pricing] 失败:', err)
  process.exit(1)
})
