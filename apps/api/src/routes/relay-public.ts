// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /api/relay/* 公开端点(P0-5g,2026-07-29 立;2026-09-16 扩充价格对比维度)。
 *
 * 无需鉴权(公开),用于前端模型市场展示中转站已上架模型清单 + 定价倍率。
 *
 * 端点清单:
 * 1. GET /api/relay/models/public — 中转站已上架模型清单(isRelayPublic=true AND enabled=true)
 *    基础字段:modelId / displayName / providerCode / contextLength /
 *             inputPricePer1k / outputPricePer1k(基础价)/ relayPriceMultiplier /
 *             relayInputPricePer1k / relayOutputPricePer1k(中转站定价 = 基础价 × 倍率)
 *    2026-09-16 扩充(对外售卖产品化,补齐价格透明度):
 *    - official*PricePer1k:官方/上游参考价(即基础价),供前端做"官方价 vs 实付价"对比锚点
 *    - relayCacheRead/WritePricePer1k:缓存读/写实付价,系数与计费完全一致
 *      (读 ×0.1、写 ×1.25,见 relay-billing-service 的 prompt cache 折扣计费)
 *    - peakMultiplier / effective*PricePer1k:当前生效的分时倍率及其换算后的实付价
 *    - subscriptionPlans:包含本模型的订阅套餐名(空数组 = 非订阅专享)
 *    响应体另有 peakWindows:分时(高峰/低谷)时段规则,供前端展示时段提示。
 *
 * 前端模型市场消费此端点,展示"中转站可用"徽章 + 官方价/实付价/倍率对比 +
 * 缓存价 + 高峰时段提示 + "获取 API Key"快捷入口。
 */
import type { FastifyPluginAsync } from 'fastify'
import { eq, and, sql, desc } from 'drizzle-orm'
import { dbRead } from '../db/index.js'
import { aiModelConfigModels, aiModelConfig, aiPricing, plans } from '@ihui/database'
import { normalizeModelId } from '@ihui/shared'
import { success } from '../utils/response.js'
import { resolvePeakMultiplier, listPublicPeakWindows } from '../services/peak-pricing-service.js'

/** prompt cache 折扣系数(与 relay-billing-service 计费保持一致,勿单独调整) */
const CACHE_READ_FACTOR = 0.1
const CACHE_WRITE_FACTOR = 1.25

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
  /** 官方/上游参考输入价(分/千 token,与 inputPricePer1k 同值,语义化为对比锚点) */
  officialInputPricePer1k: number
  /** 官方/上游参考输出价(分/千 token) */
  officialOutputPricePer1k: number
  /** 中转站定价倍率(1.0=原价,1.2=加价 20%) */
  relayPriceMultiplier: number
  /** 中转站输入价(分/千 token,= 基础价 × 倍率) */
  relayInputPricePer1k: number
  /** 中转站输出价(分/千 token) */
  relayOutputPricePer1k: number
  /** 缓存读实付价(分/千 token,= 基础输入价 × 0.1 × 倍率) */
  relayCacheReadPricePer1k: number
  /** 缓存写实付价(分/千 token,= 基础输入价 × 1.25 × 倍率) */
  relayCacheWritePricePer1k: number
  /** 当前生效的分时(高峰/低谷)倍率,无规则或未命中为 1 */
  peakMultiplier: number
  /** 含分时倍率的输入实付价(分/千 token,= relayInputPricePer1k × peakMultiplier) */
  effectiveInputPricePer1k: number
  /** 含分时倍率的输出实付价(分/千 token) */
  effectiveOutputPricePer1k: number
  /** 包含本模型的订阅套餐名(空数组 = 不属任何订阅专享) */
  subscriptionPlans: string[]
  /** 中转站展示排序(越小越靠前) */
  relaySortOrder: number
  /** 长上下文加价倍率(promptTokens 超阈值时乘);null = 未启用(2026-09-16 立) */
  longContextMultiplier: number | null
  /** 长上下文判定阈值(promptTokens);null = 未配置(默认按 200K) */
  longContextThresholdTokens: number | null
  /** 推理输出倍率(仅 completionTokens 分量);null = 未配置(= 同价) */
  reasoningOutputMultiplier: number | null
  /** 计费模式(2026-09-13):token(默认)| per_call(按次三档)| per_image(按张)| per_video(按次/按秒) */
  billingMode: 'token' | 'per_call' | 'per_image' | 'per_video'
  /** 单位售价(分):per_image=分/张;per_video=分/次或分/秒(videoUnit);其余 0 */
  relayPerUnitPriceCents: number
  /** per_video 计价单位:'call'(按次)|'second'(按秒);非 per_video 为 null */
  videoUnit: 'call' | 'second' | null
  /** per_call 三档售价(分/次,已乘倍率);非 per_call 为 null */
  relayTieredCallPricesCents: { le256k: number; mid: number; gt512k: number } | null
}

/** 公开返回的分时时段规则(展示用)。 */
interface PublicPeakWindow {
  ruleName: string
  modelId: string | null
  daysOfWeek: number[]
  startMinute: number
  endMinute: number
  multiplier: number
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
   * 返回结构:{ items: PublicRelayModelItem[], peakWindows: PublicPeakWindow[] }
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
      // 官方名归一兜底(2026-09-13 立):去重键走共享 normalizeModelId,
      // 与 /v1/models(v1-public.ts)同一口径,防 DB 存量大小写/前缀差异导致目录双条目。
      // 多模态计费(2026-09-13):一次性读 ai_pricing 生效行,取 billingMode/单位价/三档价。
      const pricingRows = await dbRead
        .select({
          modelId: aiPricing.modelId,
          billingMode: aiPricing.billingMode,
          perUnitPrice: aiPricing.perUnitPrice,
          tieredCallPrices: aiPricing.tieredCallPrices,
          videoUnit: aiPricing.videoUnit,
          // 长上下文加价 + 推理输出倍率(G,2026-09-16):公示用,未配置为 null(不加价)
          longContextMultiplier: aiPricing.longContextMultiplier,
          longContextThresholdTokens: aiPricing.longContextThresholdTokens,
          reasoningOutputMultiplier: aiPricing.reasoningOutputMultiplier,
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
        const k = normalizeModelId(p.modelId)
        if (!pricingMap.has(k)) pricingMap.set(k, p)
      }

      // 订阅专享映射(2026-09-16 立):套餐 modelWhitelist 非空时,白名单内模型
      // 标记为"该套餐专享",前端据此展示订阅徽章。白名单为空 = 全模型可用,不产生标记。
      const subscriptionPlanMap = new Map<string, string[]>()
      try {
        const planRows = await dbRead
          .select({ name: plans.name, modelWhitelist: plans.modelWhitelist })
          .from(plans)
          .where(and(eq(plans.isActive, true), eq(plans.isForSale, true)))
        for (const p of planRows) {
          const list = Array.isArray(p.modelWhitelist) ? (p.modelWhitelist as unknown[]) : []
          for (const raw of list) {
            if (typeof raw !== 'string' || raw.length === 0) continue
            const key = normalizeModelId(raw)
            const bucket = subscriptionPlanMap.get(key) ?? []
            if (!bucket.includes(p.name)) bucket.push(p.name)
            subscriptionPlanMap.set(key, bucket)
          }
        }
      } catch {
        // 套餐表异常不影响公开目录(降级为无订阅标记)
      }

      const seenModelIds = new Set<string>()
      const items: PublicRelayModelItem[] = []
      for (const r of rows) {
        const key = normalizeModelId(r.modelId)
        if (seenModelIds.has(key)) continue
        seenModelIds.add(key)
        const multiplier = Math.max(0, toNumber(r.relayPriceMultiplier, 1))
        const inputBase = toNumber(r.inputPricePer1k, 0)
        const outputBase = toNumber(r.outputPricePer1k, 0)
        const p = pricingMap.get(key)
        const billingMode = (p?.billingMode as PublicRelayModelItem['billingMode']) ?? 'token'
        const perUnit = toNumber(p?.perUnitPrice, 0)
        const tiered = p?.tieredCallPrices as {
          le256k?: unknown
          mid?: unknown
          gt512k?: unknown
        } | null
        const tierPrice = (v: unknown): number =>
          billingMode === 'per_call' && typeof v === 'number' && v > 0 ? v * multiplier : 0

        // 分时倍率(2026-09-16):逐模型解析当前生效值;无规则 = 1,不影响原有展示与计费。
        const peak = await resolvePeakMultiplier(r.modelId)
        const peakMultiplier = peak.multiplier

        items.push({
          modelId: r.modelId,
          displayName: r.relayDisplayName ?? r.displayName ?? r.modelId,
          providerCode: r.providerCode ?? r.configName ?? 'unknown',
          contextLength: toNumber(r.contextLength, 0),
          inputPricePer1k: inputBase,
          outputPricePer1k: outputBase,
          officialInputPricePer1k: inputBase,
          officialOutputPricePer1k: outputBase,
          relayPriceMultiplier: multiplier,
          // 2026-09-13: 价格列已 numeric,小数分价是常态;Math.round 会把 0.0126 抹成 0
          relayInputPricePer1k: inputBase * multiplier,
          relayOutputPricePer1k: outputBase * multiplier,
          relayCacheReadPricePer1k: inputBase * CACHE_READ_FACTOR * multiplier,
          relayCacheWritePricePer1k: inputBase * CACHE_WRITE_FACTOR * multiplier,
          peakMultiplier,
          effectiveInputPricePer1k: inputBase * multiplier * peakMultiplier,
          effectiveOutputPricePer1k: outputBase * multiplier * peakMultiplier,
          subscriptionPlans: subscriptionPlanMap.get(key) ?? [],
          relaySortOrder: toNumber(r.relaySortOrder, 0),
          // 长上下文加价与推理输出倍率公示(G,2026-09-16):未配置为 null(= 不加价)
          longContextMultiplier:
            p?.longContextMultiplier !== null && p?.longContextMultiplier !== undefined
              ? Number(p.longContextMultiplier)
              : null,
          longContextThresholdTokens:
            p?.longContextThresholdTokens !== null && p?.longContextThresholdTokens !== undefined
              ? Number(p.longContextThresholdTokens)
              : null,
          reasoningOutputMultiplier:
            p?.reasoningOutputMultiplier !== null && p?.reasoningOutputMultiplier !== undefined
              ? Number(p.reasoningOutputMultiplier)
              : null,
          billingMode,
          relayPerUnitPriceCents:
            (billingMode === 'per_image' || billingMode === 'per_video') && perUnit > 0
              ? perUnit * multiplier
              : 0,
          videoUnit:
            billingMode === 'per_video' ? (p?.videoUnit === 'second' ? 'second' : 'call') : null,
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

      const peakWindows: PublicPeakWindow[] = await listPublicPeakWindows()

      return reply.send(success({ items, peakWindows }))
    } catch {
      // 失败时返回空清单(前端降级到无徽章状态)
      return reply.send(success({ items: [], peakWindows: [] }))
    }
  })
  /**
   * GET /channels/public — 可用渠道公示(2026-09-16 立)
   *
   * 用户侧透明化:展示平台在售的每个上游渠道(按 provider_code 聚合)及其
   * 已上架模型数量、模型清单(截断)、价格区间与倍率区间。
   * 只暴露聚合信息,不泄漏上游 Key、账号池与内部选路细节。
   */
  server.get('/channels/public', async (_request, reply) => {
    try {
      const rows = await dbRead
        .select({
          providerCode: aiModelConfig.providerCode,
          configName: aiModelConfig.name,
          modelId: aiModelConfigModels.modelId,
          relayPriceMultiplier: aiModelConfigModels.relayPriceMultiplier,
          inputPricePer1k: aiModelConfigModels.inputPricePer1k,
          outputPricePer1k: aiModelConfigModels.outputPricePer1k,
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

      interface ChannelAcc {
        providerCode: string
        channelName: string
        models: string[]
        minInput: number
        maxInput: number
        minOutput: number
        maxOutput: number
        minMultiplier: number
        maxMultiplier: number
      }

      const map = new Map<string, ChannelAcc>()
      for (const r of rows) {
        const code = r.providerCode ?? r.configName ?? 'unknown'
        let e = map.get(code)
        if (!e) {
          e = {
            providerCode: code,
            channelName: r.configName ?? code,
            models: [],
            minInput: Number.POSITIVE_INFINITY,
            maxInput: 0,
            minOutput: Number.POSITIVE_INFINITY,
            maxOutput: 0,
            minMultiplier: Number.POSITIVE_INFINITY,
            maxMultiplier: 0,
          }
          map.set(code, e)
        }
        const key = normalizeModelId(r.modelId)
        if (!e.models.includes(key)) e.models.push(key)
        const inp = toNumber(r.inputPricePer1k, 0)
        const out = toNumber(r.outputPricePer1k, 0)
        const mul = Math.max(0, toNumber(r.relayPriceMultiplier, 1))
        e.minInput = Math.min(e.minInput, inp)
        e.maxInput = Math.max(e.maxInput, inp)
        e.minOutput = Math.min(e.minOutput, out)
        e.maxOutput = Math.max(e.maxOutput, out)
        e.minMultiplier = Math.min(e.minMultiplier, mul)
        e.maxMultiplier = Math.max(e.maxMultiplier, mul)
      }

      // 单个渠道最多公示 50 个模型名,避免响应体过大(计数仍为全量)
      const MAX_MODELS = 50
      const channels = [...map.values()]
        .map((c) => ({
          providerCode: c.providerCode,
          channelName: c.channelName,
          modelCount: c.models.length,
          models: c.models.slice(0, MAX_MODELS),
          modelsTruncated: c.models.length > MAX_MODELS,
          minInputPricePer1k: Number.isFinite(c.minInput) ? c.minInput : 0,
          maxInputPricePer1k: c.maxInput,
          minOutputPricePer1k: Number.isFinite(c.minOutput) ? c.minOutput : 0,
          maxOutputPricePer1k: c.maxOutput,
          minMultiplier: Number.isFinite(c.minMultiplier) ? c.minMultiplier : 1,
          maxMultiplier: c.maxMultiplier,
          /** 可见性:public = 对所有用户开放 */
          visibility: 'public' as const,
        }))
        .sort((a, b) => b.modelCount - a.modelCount || a.providerCode.localeCompare(b.providerCode))

      return reply.send(success({ channels }))
    } catch {
      // 失败降级为空清单,前端展示空状态
      return reply.send(success({ channels: [] }))
    }
  })
}

export { relayPublicRoutes }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
