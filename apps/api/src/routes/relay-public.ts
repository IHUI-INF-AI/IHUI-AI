// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /api/relay/* 公开端点(P0-5g,2026-07-29 立)。
 *
 * 无需鉴权(公开),用于前端模型市场展示中转站已上架模型清单 + 定价倍率。
 *
 * 端点清单:
 * 1. GET /api/relay/models/public — 中转站已上架模型清单(isRelayPublic=true AND enabled=true)
 *    返回字段:modelId / displayName / providerCode / contextLength /
 *            inputPricePer1k / outputPricePer1k(基础价)/ relayPriceMultiplier /
 *            relayInputPricePer1k / relayOutputPricePer1k(中转站定价 = 基础价 × 倍率)
 *
 * 前端模型市场消费此端点,在 Model 卡片上展示"中转站可用"徽章 +
 * 中转站定价(基础价 × 倍率)+ "获取 API Key"快捷入口。
 */
import type { FastifyPluginAsync } from 'fastify'
import { eq, and, sql, desc } from 'drizzle-orm'
import { dbRead } from '../db/index.js'
import { aiModelConfigModels, aiModelConfig, aiPricing } from '@ihui/database'
import { success } from '../utils/response.js'

/** 公开返回的模型条目结构(前端 Model 类型扩展用) */
interface PublicRelayModelItem {
  /** 模型 id(与 /v1/chat/completions 的 model 参数一致) */
  modelId: string
  /** 中转站展示名(relayDisplayName > displayName > modelId) */
  displayName: string
  /** 厂商 provider code(openai / anthropic / stepfun / ...) */
  providerCode: string
  /** 上下文长度 */
  contextLength: number
  /** 基础输入价(分/千 token,来自 aiModelConfigModels.inputPricePer1k) */
  inputPricePer1k: number
  /** 基础输出价(分/千 token) */
  outputPricePer1k: number
  /** 中转站定价倍率(1.0=原价,1.2=加价 20%) */
  relayPriceMultiplier: number
  /** 中转站输入价(分/千 token,= inputPricePer1k × relayPriceMultiplier) */
  relayInputPricePer1k: number
  /** 中转站输出价(分/千 token,= outputPricePer1k × relayPriceMultiplier) */
  relayOutputPricePer1k: number
  /** 中转站展示排序(越小越靠前) */
  relaySortOrder: number
  /** 计费模式(2026-09-13):token(默认)| per_call(按次三档)| per_image(按张)| per_video(按次/按秒) */
  billingMode: 'token' | 'per_call' | 'per_image' | 'per_video'
  /** 单位售价(分):per_image=分/张;per_video=分/次或分/秒(videoUnit);其余 0 */
  relayPerUnitPriceCents: number
  /** per_video 计价单位:'call'(按次)|'second'(按秒);非 per_video 为 null */
  videoUnit: 'call' | 'second' | null
  /** per_call 三档售价(分/次,已乘倍率);非 per_call 为 null */
  relayTieredCallPricesCents: { le256k: number; mid: number; gt512k: number } | null
}

/** 数字字符串 → number,容错 */
function toNumber(v: unknown, fallback = 0): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
}

const relayPublicRoutes: FastifyPluginAsync = async (server) => {
  /**
   * GET /models/public — 中转站已上架模型清单
   *
   * 公开访问(无 auth),5min 服务端缓存建议(由前端 next.revalidate 实现)。
   * 返回结构:{ items: PublicRelayModelItem[] }
   */
  server.get('/models/public', async (_request, reply) => {
    try {
      const rows = await dbRead
        .select({
          modelId: aiModelConfigModels.modelId,
          displayName: aiModelConfigModels.displayName,
          relayDisplayName: aiModelConfigModels.relayDisplayName,
          contextLength: aiModelConfigModels.contextLength,
          inputPricePer1k: aiModelConfigModels.inputPricePer1k,
          outputPricePer1k: aiModelConfigModels.outputPricePer1k,
          relayPriceMultiplier: aiModelConfigModels.relayPriceMultiplier,
          relaySortOrder: aiModelConfigModels.relaySortOrder,
          providerCode: aiModelConfig.providerCode,
          configName: aiModelConfig.name,
        })
        .from(aiModelConfigModels)
        .innerJoin(aiModelConfig, eq(aiModelConfigModels.configId, aiModelConfig.id))
        .where(
          and(
            eq(aiModelConfigModels.isRelayPublic, true),
            eq(aiModelConfigModels.enabled, true),
            eq(aiModelConfig.enabled, true),
          ),
        )
        .orderBy(aiModelConfigModels.relaySortOrder, aiModelConfigModels.modelId)

      // 跨上游去重(2026-09-13):同一 modelId 可在多个 provider/config 上架
      // (如 token6688 与 swiftapi 同时供同一模型),对外目录只展示一条——
      // 保留排序最靠前(relaySortOrder 升序)的首个条目。
      // 官方名归一兜底(2026-09-13 立):键用小写,防 DB 存量大小写重复导致目录双条目。
      // 多模态计费(2026-09-13):一次性读 ai_pricing 生效行,取 billingMode/单位价/三档价。
      const pricingRows = await dbRead
        .select({
          modelId: aiPricing.modelId,
          billingMode: aiPricing.billingMode,
          perUnitPrice: aiPricing.perUnitPrice,
          tieredCallPrices: aiPricing.tieredCallPrices,
          videoUnit: aiPricing.videoUnit,
        })
        .from(aiPricing)
        .where(
          and(
            sql`${aiPricing.effectiveAt} <= now()`,
            sql`(${aiPricing.expiresAt} IS NULL OR ${aiPricing.expiresAt} > now())`,
          ),
        )
        .orderBy(desc(aiPricing.effectiveAt))
      const pricingMap = new Map<string, (typeof pricingRows)[number]>()
      for (const p of pricingRows) {
        const k = p.modelId.toLowerCase()
        if (!pricingMap.has(k)) pricingMap.set(k, p)
      }

      const seenModelIds = new Set<string>()
      const items: PublicRelayModelItem[] = []
      for (const r of rows) {
        const key = r.modelId.toLowerCase()
        if (seenModelIds.has(key)) continue
        seenModelIds.add(key)
        const multiplier = Math.max(0, toNumber(r.relayPriceMultiplier, 1))
        const inputBase = toNumber(r.inputPricePer1k, 0)
        const outputBase = toNumber(r.outputPricePer1k, 0)
        const p = pricingMap.get(key)
        const billingMode = (p?.billingMode as PublicRelayModelItem['billingMode']) ?? 'token'
        const perUnit = toNumber(p?.perUnitPrice, 0)
        const tiered = p?.tieredCallPrices as
          | { le256k?: unknown; mid?: unknown; gt512k?: unknown }
          | null
        const tierPrice = (v: unknown): number =>
          billingMode === 'per_call' && typeof v === 'number' && v > 0 ? v * multiplier : 0
        items.push({
          modelId: r.modelId,
          displayName: r.relayDisplayName ?? r.displayName ?? r.modelId,
          providerCode: r.providerCode ?? r.configName ?? 'unknown',
          contextLength: toNumber(r.contextLength, 0),
          inputPricePer1k: inputBase,
          outputPricePer1k: outputBase,
          relayPriceMultiplier: multiplier,
          // 2026-09-13: 价格列已 numeric,小数分价是常态;Math.round 会把 0.0126 抹成 0
          relayInputPricePer1k: inputBase * multiplier,
          relayOutputPricePer1k: outputBase * multiplier,
          relaySortOrder: toNumber(r.relaySortOrder, 0),
          billingMode,
          relayPerUnitPriceCents:
            (billingMode === 'per_image' || billingMode === 'per_video') && perUnit > 0
              ? perUnit * multiplier
              : 0,
          videoUnit: billingMode === 'per_video' ? (p?.videoUnit === 'second' ? 'second' : 'call') : null,
          relayTieredCallPricesCents:
            billingMode === 'per_call' && tiered
              ? {
                  le256k: tierPrice(tiered.le256k),
                  mid: tierPrice(tiered.mid),
                  gt512k: tierPrice(tiered.gt512k),
                }
              : null,
        })
      }

      return reply.send(success({ items }))
    } catch {
      // 失败时返回空清单(前端降级到无徽章状态)
      return reply.send(success({ items: [] }))
    }
  })
}

export { relayPublicRoutes }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
