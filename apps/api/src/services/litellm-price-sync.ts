// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * LiteLLM 真网 AI 价表同步(GAP-PLAN P3-9"成本真网计价")。
 *
 * 数据源:LiteLLM 公开价表(免密钥)
 *   https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json
 *   顶层键 = 模型 id,值含 input_cost_per_token / output_cost_per_token(USD/token)。
 *
 * 单位换算(与消费端 pricing-service.ts calculateCost 对齐):
 *   ai_pricing.input/output_token_price 为 numeric(18,6),单位"分/千 token"(CNY),
 *   保留 6 位小数——极廉价模型(gpt-4o-mini $0.15/1M ≈ 0.108 分/千 token)不再归 0。
 *   消费公式: cost(分) = (tokens / 1000) * price  → price 必须是"分/千 token"。
 *   LiteLLM 给 USD/token,故:
 *     price(分/千 token) = round6(usd_per_token × 1000(千token) × 100(元→分) × rate)
 *                        = round6(usd_per_token × rate × 100_000)
 *   rate 优先 frankfurter.app 实时汇率(ECB,24h 缓存,失败回退),env AI_PRICE_USD_TO_CNY 覆盖,静态默认 7.2。
 *
 * modelId 匹配策略:保留 LiteLLM 原键(trim 后入库,超 128 字符丢弃),
 * 不做去前缀别名(azure/gpt-4o 等带前缀键与裸键互不冲突,原样入库即可);
 * ai-cost-tracker 的 model 名('gpt-4o' 等裸键)可直接命中 LiteLLM 原键。
 *
 * 调度:启动 30s 后首跑一次,之后每 24h 一次;
 * env AI_LITELLM_PRICE_SYNC_ENABLED(默认 'true')总开关。
 * 所有异常只 log.warn,不影响启动。
 */
import { and, desc, eq, isNull } from 'drizzle-orm'
import { db } from '../db/index.js'
import { aiPricing } from '@ihui/database'
import { logger } from '../utils/logger.js'

const LITELLM_PRICE_URL =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json'

const DEFAULT_USD_TO_CNY = 7.2

/** USD/token → 分/千 token 的乘数(1000 token × 100 分/CNY),汇率另乘 */
const USD_PER_TOKEN_TO_CENTS_PER_1K = 100_000

/** 入库精度:6 位小数(与 numeric(18,6) 对齐),避免浮点尾差 */
const PRICE_SCALE = 1_000_000

/** modelId 列最大长度(与 schema varchar(128) 对齐) */
const MAX_MODEL_ID_LENGTH = 128

export interface SyncStats {
  fetched: number
  inserted: number
  updated: number
  skipped: number
  error?: string
}

/** 读取 USD→CNY 汇率(env AI_PRICE_USD_TO_CNY,非法或缺省回退 7.2) */
export function getUsdToCnyRate(): number {
  const raw = process.env.AI_PRICE_USD_TO_CNY
  if (!raw) return DEFAULT_USD_TO_CNY
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_USD_TO_CNY
}

// ===== 实时汇率(frankfurter.app,ECB 官方数据,免密钥;24h 缓存,失败回退 env/静态值) =====

const FX_RATE_URL = 'https://api.frankfurter.app/latest?from=USD&to=CNY'
const FX_RATE_TTL_MS = 24 * 60 * 60 * 1000

let fxRateCache: { rate: number; fetchedAt: number } | null = null

/** 仅供单测重置汇率缓存(正常代码勿调) */
export function resetFxRateCacheForTests(): void {
  fxRateCache = null
}

/**
 * 解析当前 USD→CNY 汇率:优先 frankfurter.app 实时汇率(5s 超时),
 * 失败或缓存未过期则用上次成功值,再回退 env/静态默认。网络异常只 log.warn 不 throw。
 */
export async function resolveUsdToCnyRate(): Promise<number> {
  const now = Date.now()
  if (fxRateCache && now - fxRateCache.fetchedAt < FX_RATE_TTL_MS) {
    return fxRateCache.rate
  }
  try {
    const res = await fetch(FX_RATE_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      const payload: unknown = await res.json()
      const cny =
        typeof payload === 'object' && payload !== null
          ? (payload as Record<string, unknown>).rates
          : undefined
      const rate =
        typeof cny === 'object' && cny !== null
          ? (cny as Record<string, unknown>).CNY
          : undefined
      if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
        fxRateCache = { rate, fetchedAt: now }
        logger.info(`[litellm-price-sync] live USD/CNY rate: ${rate}`)
        return rate
      }
      logger.warn('[litellm-price-sync] 汇率响应格式异常,回退静态值')
    } else {
      logger.warn(`[litellm-price-sync] 汇率接口 HTTP ${res.status},回退静态值`)
    }
  } catch (err) {
    logger.warn('[litellm-price-sync] 实时汇率获取失败,回退静态值:', {
      error: err instanceof Error ? err.message : err,
    })
  }
  const fallback = fxRateCache?.rate ?? getUsdToCnyRate()
  if (fxRateCache) fxRateCache.fetchedAt = now // 拉取失败顺延缓存,避免每次同步都打超时
  return fallback
}

/**
 * 纯函数:把 LiteLLM 单个价表条目映射为 ai_pricing 单位(分/千 token, CNY)。
 * rate 不传时回退 env/静态默认(便于单测);syncLiteLLMPricing 传实时解析的汇率。
 * 返回 null 表示跳过:非对象条目 / sample_spec / 缺任一价格 / 价格非法 / modelId 非法。
 */
export function mapLiteLLMEntry(
  modelId: string,
  entry: unknown,
  rate: number = getUsdToCnyRate(),
): { modelId: string; inputTokenPrice: number; outputTokenPrice: number } | null {
  const id = modelId.trim()
  if (!id || id.length > MAX_MODEL_ID_LENGTH || id === 'sample_spec') return null
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null
  const rec = entry as Record<string, unknown>
  if (rec.sample_spec === true) return null
  const input = rec.input_cost_per_token
  const output = rec.output_cost_per_token
  if (typeof input !== 'number' || !Number.isFinite(input) || input < 0) return null
  if (typeof output !== 'number' || !Number.isFinite(output) || output < 0) return null
  return {
    modelId: id,
    inputTokenPrice: Math.round(input * rate * USD_PER_TOKEN_TO_CENTS_PER_1K * PRICE_SCALE) / PRICE_SCALE,
    outputTokenPrice: Math.round(output * rate * USD_PER_TOKEN_TO_CENTS_PER_1K * PRICE_SCALE) / PRICE_SCALE,
  }
}

/**
 * 同步 LiteLLM 价表进 ai_pricing。
 * 事务内对每个 modelId 查最新生效行(expiresAt 为空且 effectiveAt 最新):
 * 有则 update(价格 + updatedAt),无则 insert;不删旧行(保留历史价)。
 * 网络失败/解析失败不 throw,返回带 error 字段的统计。
 */
export async function syncLiteLLMPricing(): Promise<SyncStats> {
  const empty: SyncStats = { fetched: 0, inserted: 0, updated: 0, skipped: 0 }
  try {
    const res = await fetch(LITELLM_PRICE_URL, {
      headers: {
        'User-Agent': 'IHUI-AI/1.0 LiteLLM-Price-Sync',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) {
      return { ...empty, error: `LiteLLM 价表 HTTP ${res.status}` }
    }
    const payload: unknown = await res.json()
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return { ...empty, error: 'LiteLLM 价表格式异常(顶层非对象)' }
    }

    const entries = payload as Record<string, unknown>
    const rate = await resolveUsdToCnyRate()
    const mapped: Array<{ modelId: string; inputTokenPrice: number; outputTokenPrice: number }> = []
    let fetched = 0
    let skipped = 0
    for (const [key, entry] of Object.entries(entries)) {
      fetched++
      const m = mapLiteLLMEntry(key, entry, rate)
      if (m) mapped.push(m)
      else skipped++
    }

    let inserted = 0
    let updated = 0
    const now = new Date()
    await db.transaction(async (tx) => {
      for (const m of mapped) {
        const [existing] = await tx
          .select({ id: aiPricing.id })
          .from(aiPricing)
          .where(and(eq(aiPricing.modelId, m.modelId), isNull(aiPricing.expiresAt)))
          .orderBy(desc(aiPricing.effectiveAt))
          .limit(1)
        if (existing) {
          await tx
            .update(aiPricing)
            .set({
              inputTokenPrice: m.inputTokenPrice,
              outputTokenPrice: m.outputTokenPrice,
              updatedAt: now,
            })
            .where(eq(aiPricing.id, existing.id))
          updated++
        } else {
          await tx.insert(aiPricing).values({
            modelId: m.modelId,
            inputTokenPrice: m.inputTokenPrice,
            outputTokenPrice: m.outputTokenPrice,
            currency: 'CNY',
            effectiveAt: now,
            expiresAt: null,
          })
          inserted++
        }
      }
    })

    logger.info(
      `[litellm-price-sync] done: fetched=${fetched} inserted=${inserted} updated=${updated} skipped=${skipped}`,
    )
    return { fetched, inserted, updated, skipped }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.warn('[litellm-price-sync] 同步失败:', { error: message })
    return { ...empty, error: message }
  }
}

// ===== 调度器(启动 30s 首跑 + 每 24h 一次) =====

const DAY_MS = 24 * 60 * 60 * 1000
const FIRST_RUN_DELAY_MS = 30_000

let dailyTimer: ReturnType<typeof setInterval> | null = null
let firstRunTimer: ReturnType<typeof setTimeout> | null = null

/** 启动定时同步(在 index.ts 注册;AI_LITELLM_PRICE_SYNC_ENABLED=false 可禁用) */
export function startLiteLLMPriceSyncScheduler(): void {
  if (dailyTimer) return
  const run = async (): Promise<void> => {
    try {
      const stats = await syncLiteLLMPricing()
      if (stats.error) {
        logger.warn('[litellm-price-sync] 定时同步失败:', { error: stats.error })
      }
    } catch (err) {
      logger.warn('[litellm-price-sync] 定时同步异常:', {
        error: err instanceof Error ? err.message : err,
      })
    }
  }
  firstRunTimer = setTimeout(() => {
    void run()
  }, FIRST_RUN_DELAY_MS)
  dailyTimer = setInterval(() => {
    void run()
  }, DAY_MS)
  logger.info('[litellm-price-sync] scheduler started (first run in 30s, then every 24h)')
}

/** 停止定时同步(进程关闭时调用) */
export function stopLiteLLMPriceSyncScheduler(): void {
  if (firstRunTimer) {
    clearTimeout(firstRunTimer)
    firstRunTimer = null
  }
  if (dailyTimer) {
    clearInterval(dailyTimer)
    dailyTimer = null
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
