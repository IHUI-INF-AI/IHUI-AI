// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 中转站上游模型自动同步(2026-10-09 立)。
 *
 * 数据源:极速 API(new.x5m5x.com)/v1/models(按量 key,X5M5X_BASE_URL 可覆盖)。
 * 行为:定时拉取上游全量模型清单,与 ai_model_config_models 中 swiftapi /v1 config
 *   的 relay-public 上架清单 diff——上游新增自动上架,上游下架自动摘除。
 * 结果落 ai_model_sync_log(providerCode='swiftapi'),供 admin 同步历史查询。
 *
 * 调度:启动 30s 后首跑,之后每 6h 一次;RELAY_MODEL_SYNC_ENABLED=false 禁用。
 * 所有异常只 log.warn,不影响启动。
 */
import { and, desc, eq, like, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { aiModelConfig, aiModelConfigModels, aiModelSyncLog, aiPricing } from '@ihui/database'
import { logger } from '../utils/logger.js'

const DEFAULT_BASE_URL = 'https://new.x5m5x.com/v1'
const SIX_HOURS_MS = 6 * 60 * 60 * 1000
const FIRST_RUN_DELAY_MS = 30_000
const MAX_MODEL_ID_LENGTH = 128

export interface RelaySyncStats {
  fetched: number
  added: number
  retired: number
  priced: number
  error?: string
}

/**
 * 上游 New API 定价换算(用库内两个真实计费验证锚点校准:
 * glm-5.3 = 0.04/0.14、deepseek-v4-flash-0731 = 0.005/0.02,分/千 token):
 * 输入成本 = model_ratio × min(group_ratio) × 0.2;输出成本 = 输入 × completion_ratio。
 * 中转售价 = 成本 × RELAY_PRICE_MULTIPLIER(默认 1.2,与既有商业口径一致)。
 */
const PRICE_RATIO_FACTOR = 0.2
const RELAY_PRICE_MULTIPLIER = '1.2'

interface UpstreamPricingRow {
  model_name: string
  model_ratio: number
  completion_ratio: number
  enable_groups: string[]
}

/** 拉上游定价 JSON(与 /pricing 同源),失败抛错由调用方兜底 */
async function fetchUpstreamPricing(): Promise<Map<string, { inCost: number; outCost: number }>> {
  const origin = new URL(DEFAULT_BASE_URL).origin
  const key = process.env.X5M5X_API_KEY
  if (!key) throw new Error('X5M5X_API_KEY 未配置')
  const res = await fetch(`${origin}/api/pricing`, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`upstream /api/pricing ${res.status}`)
  const body: unknown = await res.json()
  const obj = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
  const groupRatio = (obj.group_ratio ?? {}) as Record<string, number>
  const rows = Array.isArray(obj.data) ? (obj.data as UpstreamPricingRow[]) : []
  const out = new Map<string, { inCost: number; outCost: number }>()
  for (const r of rows) {
    const name = typeof r.model_name === 'string' ? r.model_name.trim() : ''
    const ratio = typeof r.model_ratio === 'number' && r.model_ratio > 0 ? r.model_ratio : 0
    if (!name || name.length > MAX_MODEL_ID_LENGTH || ratio === 0) continue
    const groups = Array.isArray(r.enable_groups) ? r.enable_groups : []
    let minGroup = Number.POSITIVE_INFINITY
    for (const g of groups) {
      const v = groupRatio[g]
      if (typeof v === 'number' && v > 0 && v < minGroup) minGroup = v
    }
    if (!Number.isFinite(minGroup)) continue
    const inCost = ratio * minGroup * PRICE_RATIO_FACTOR
    const comp =
      typeof r.completion_ratio === 'number' && r.completion_ratio > 0 ? r.completion_ratio : 1
    out.set(name.toLowerCase(), { inCost, outCost: inCost * comp })
  }
  return out
}

/** 解析上游 /v1/models 响应里的非空模型 id(5s 超时,响应异常抛错) */
async function fetchUpstreamModelIds(): Promise<string[]> {
  const baseUrl = (process.env.X5M5X_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '')
  const key = process.env.X5M5X_API_KEY
  if (!key) throw new Error('X5M5X_API_KEY 未配置')
  const res = await fetch(`${baseUrl}/models`, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) throw new Error(`upstream /models ${res.status}`)
  const body: unknown = await res.json()
  const list =
    typeof body === 'object' && body !== null && Array.isArray((body as { data?: unknown }).data)
      ? ((body as { data: unknown[] }).data as { id?: unknown }[])
      : []
  const seen = new Set<string>()
  const ids: string[] = []
  for (const item of list) {
    const id = typeof item.id === 'string' ? item.id.trim() : ''
    if (!id || id.length > MAX_MODEL_ID_LENGTH) continue
    const k = id.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    ids.push(id)
  }
  return ids
}

/** 单次同步:diff 上游清单与 config 31 上架清单,新增上架 / 消失下架 */
export async function syncSwiftapiModels(): Promise<RelaySyncStats> {
  const startedAt = new Date()
  const empty: RelaySyncStats = { fetched: 0, added: 0, retired: 0, priced: 0 }
  try {
    const upstream = await fetchUpstreamModelIds()
    const configRows = await db
      .select({ id: aiModelConfig.id })
      .from(aiModelConfig)
      .where(
        and(
          eq(aiModelConfig.providerCode, 'swiftapi'),
          like(aiModelConfig.baseUrl, '%/v1'),
          eq(aiModelConfig.enabled, true),
        ),
      )
      .limit(1)
    if (configRows.length === 0) throw new Error('swiftapi /v1 config 不存在')
    const configRow = configRows[0]
    if (!configRow) throw new Error('swiftapi /v1 config 不存在')
    const configId = configRow.id

    const existing = await db
      .select({ id: aiModelConfigModels.id, modelId: aiModelConfigModels.modelId })
      .from(aiModelConfigModels)
      .where(
        and(
          eq(aiModelConfigModels.configId, configId),
          eq(aiModelConfigModels.isRelayPublic, true),
        ),
      )
    const upstreamSet = new Set(upstream.map((m) => m.toLowerCase()))
    const existingLower = new Map(existing.map((r) => [r.modelId.toLowerCase(), r.id]))

    // 定价:上游 /api/pricing 全量换算;失败不阻塞模型 diff(价格保持原值)
    let pricing: Map<string, { inCost: number; outCost: number }> = new Map()
    try {
      pricing = await fetchUpstreamPricing()
    } catch (pricingErr) {
      logger.warn('[relay-model-sync] 定价拉取失败(沿用原价):', {
        error: pricingErr instanceof Error ? pricingErr.message : String(pricingErr),
      })
    }

    const toAdd = upstream.filter((m) => !existingLower.has(m.toLowerCase()))
    const toRetire = existing.filter((r) => !upstreamSet.has(r.modelId.toLowerCase()))

    let added = 0
    await db.transaction(async (tx) => {
      let nextSort = 200 + upstream.length
      for (const m of toAdd) {
        const r = await tx
          .select({ id: aiModelConfigModels.id })
          .from(aiModelConfigModels)
          .where(
            and(
              eq(aiModelConfigModels.configId, configId),
              sql`lower(${aiModelConfigModels.modelId}) = ${m.toLowerCase()}`,
            ),
          )
          .limit(1)
        const found = r[0]
        if (found) {
          await tx
            .update(aiModelConfigModels)
            .set({ enabled: true, isRelayPublic: true })
            .where(eq(aiModelConfigModels.id, found.id))
        } else {
          await tx.insert(aiModelConfigModels).values({
            configId,
            modelId: m,
            displayName: m,
            enabled: true,
            isRelayPublic: true,
            relayPriceMultiplier: RELAY_PRICE_MULTIPLIER,
            inputPricePer1k: pricing.get(m.toLowerCase())?.inCost ?? 0,
            outputPricePer1k: pricing.get(m.toLowerCase())?.outCost ?? 0,
            relaySortOrder: nextSort,
            supportsStreaming: true,
          })
          nextSort += 1
        }
        added += 1
      }
      for (const r of toRetire) {
        await tx
          .update(aiModelConfigModels)
          .set({ enabled: false, isRelayPublic: false })
          .where(eq(aiModelConfigModels.id, r.id))
      }
    })

    // 已上架模型回填成本价 + 中转倍率(仅 swiftapi config;定价表空则跳过)
    let priced = 0
    for (const r of existing) {
      const p = pricing.get(r.modelId.toLowerCase())
      if (!p) continue
      await db
        .update(aiModelConfigModels)
        .set({
          inputPricePer1k: p.inCost,
          outputPricePer1k: p.outCost,
          relayPriceMultiplier: RELAY_PRICE_MULTIPLIER,
          updatedAt: new Date(),
        })
        .where(eq(aiModelConfigModels.id, r.id))
      priced += 1
    }

    // 计费成本价落 ai_pricing(billing 链路读这张;售价 = 成本 × config 行 relayPriceMultiplier)
    // 策略:关闭该模型全部未过期旧行 + 插入唯一新生效行 —— 计费读"最新生效行",
    // 旧行(expiresAt IS NULL 的历史版本,含错误价)若不关闭会继续被选中。
    // 幂等:最新未过期行价格已一致时跳过,避免每次同步都新增一行。
    for (const r of existing) {
      const p = pricing.get(r.modelId.toLowerCase())
      if (!p) continue
      const now = new Date()
      const latest = await db
        .select({
          id: aiPricing.id,
          inputTokenPrice: aiPricing.inputTokenPrice,
          outputTokenPrice: aiPricing.outputTokenPrice,
        })
        .from(aiPricing)
        .where(and(eq(aiPricing.modelId, r.modelId), sql`${aiPricing.expiresAt} IS NULL`))
        .orderBy(desc(aiPricing.effectiveAt))
        .limit(1)
      const cur = latest[0]
      if (
        cur &&
        Number(cur.inputTokenPrice) === p.inCost &&
        Number(cur.outputTokenPrice) === p.outCost
      ) {
        continue
      }
      await db
        .update(aiPricing)
        .set({ expiresAt: now, updatedAt: now })
        .where(and(eq(aiPricing.modelId, r.modelId), sql`${aiPricing.expiresAt} IS NULL`))
      await db.insert(aiPricing).values({
        modelId: r.modelId,
        inputTokenPrice: p.inCost,
        outputTokenPrice: p.outCost,
        currency: 'CNY',
        effectiveAt: now,
        expiresAt: null,
      })
    }

    const finishedAt = new Date()
    await db.insert(aiModelSyncLog).values({
      providerCode: 'swiftapi',
      syncStartedAt: startedAt,
      syncFinishedAt: finishedAt,
      success: true,
      totalModels: upstream.length,
      newModels: added,
      removedModels: toRetire.length,
      error: '',
      latencyMs: finishedAt.getTime() - startedAt.getTime(),
      syncType: 'single',
    })
    if (added > 0 || toRetire.length > 0 || priced > 0) {
      logger.info(
        `[relay-model-sync] done: fetched=${upstream.length} added=${added} retired=${toRetire.length} priced=${priced}`,
      )
    }
    return { fetched: upstream.length, added, retired: toRetire.length, priced }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.warn('[relay-model-sync] 同步失败:', { error: message })
    const finishedAt = new Date()
    try {
      await db.insert(aiModelSyncLog).values({
        providerCode: 'swiftapi',
        syncStartedAt: startedAt,
        syncFinishedAt: finishedAt,
        success: false,
        totalModels: 0,
        newModels: 0,
        removedModels: 0,
        error: message,
        latencyMs: finishedAt.getTime() - startedAt.getTime(),
        syncType: 'single',
      })
    } catch {
      // 日志表写失败不影响主流程
    }
    return { ...empty, error: message }
  }
}

// ===== 调度器(启动 30s 首跑 + 每 6h 一次) =====

let intervalTimer: ReturnType<typeof setInterval> | null = null
let firstRunTimer: ReturnType<typeof setTimeout> | null = null

/** 启动定时同步(index.ts 注册;RELAY_MODEL_SYNC_ENABLED=false 禁用) */
export function startRelayModelSyncScheduler(): void {
  if (intervalTimer) return
  const run = async (): Promise<void> => {
    await syncSwiftapiModels()
  }
  firstRunTimer = setTimeout(() => {
    void run()
  }, FIRST_RUN_DELAY_MS)
  intervalTimer = setInterval(() => {
    void run()
  }, SIX_HOURS_MS)
  logger.info('[relay-model-sync] scheduler started (first run in 30s, then every 6h)')
}

/** 停止定时同步(进程关闭时调用) */
export function stopRelayModelSyncScheduler(): void {
  if (firstRunTimer) {
    clearTimeout(firstRunTimer)
    firstRunTimer = null
  }
  if (intervalTimer) {
    clearInterval(intervalTimer)
    intervalTimer = null
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
