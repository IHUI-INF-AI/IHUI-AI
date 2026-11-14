// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 实时汇率服务(2026-11-14 立)。
 *
 * 背景:模型价格同时存在 USD(模型市场 `$`)与 CNY(中转站 `¥`)两套口径,前端还硬编码
 * USD→CNY=7.2 做展示换算,与真实汇率(实测 ~6.67)偏差近 8%。机主要求:
 * 「美元 人民币 USDT 一键切换,按即时汇率比例计算」。
 *
 * 本模块是**展示换算的唯一汇率出口**:
 *  - USD→CNY:open.er-api.com → frankfurter.app → zhs_exchange_rate → AI_PRICE_USD_TO_CNY
 *  - USDT→CNY:CoinGecko(tether/cny) → zhs_exchange_rate(USDT/CNY) → 按 USDT≈USD
 *  - 内存 TTL 缓存(默认 300s)+ single-flight;上游全挂时复用 last-good 并标 stale,
 *    再不行用 DB/env 兜底 —— 接口永不 500,前端也不会拿到假数字。
 *
 * 纪律:本模块**只服务展示**。扣费/动态成本仍走 model-price-resolver.usdToCny()
 * (环境变量口径),不得让实时汇率波动影响账单。
 */
import { logger } from '../utils/logger.js'
import { usdToCny } from './model-price-resolver.js'

export interface FxSnapshot {
  /** 基准币种:接口返回的是「1 外币 = 多少 CNY」 */
  base: 'CNY'
  /** 1 USD / 1 USDT 分别等于多少 CNY */
  cnyPer: { USD: number; USDT: number }
  /** 1 CNY 分别等于多少 USD / USDT */
  perCny: { USD: number; USDT: number }
  /** 每个货币对的取值来源(审计用) */
  sources: { usdCny: string; usdtCny: string }
  /** 本轮快照生成时刻(ISO) */
  fetchedAt: string
  /** true = 上游不可用,复用了 last-good 或兜底值 */
  stale: boolean
  /** 缓存时长(秒),前端可据此决定刷新频率 */
  ttlSeconds: number
}

interface FxDeps {
  fetchJson: (url: string) => Promise<unknown>
  findRate: (from: string, to: string) => Promise<{ rate: number } | null>
  envUsdCny: () => number
  now: () => number
}

const DEFAULT_TTL_SECONDS = 300

function ttlMs(): number {
  const raw = Number(process.env['FX_RATE_TTL_SECONDS'])
  return Number.isFinite(raw) && raw > 0 ? raw * 1000 : DEFAULT_TTL_SECONDS * 1000
}

/** 合法汇率区间:防止上游返回 0/负数/离谱值把整站价格带偏 */
function isValidRate(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0.5 && v <= 20
}

async function defaultFetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

const deps: FxDeps = {
  fetchJson: defaultFetchJson,
  findRate: async (from, to) => {
    const mod = await import('../db/exchange-rate-queries.js')
    return mod.findRate(from, to)
  },
  envUsdCny: usdToCny,
  now: Date.now,
}

let lastGood: FxSnapshot | null = null
let lastGoodAt = 0
let inflight: Promise<FxSnapshot> | null = null

/** USD→CNY:优先实时源,失败逐级降级,最终 env 口径兜底 */
async function resolveUsdCny(): Promise<{ rate: number; source: string }> {
  try {
    const body = (await deps.fetchJson('https://open.er-api.com/v6/latest/USD')) as {
      result?: string
      rates?: Record<string, unknown>
    }
    const rate = Number(body?.rates?.['CNY'])
    if (body?.result === 'success' && isValidRate(rate)) {
      return { rate, source: 'open.er-api.com' }
    }
  } catch (e) {
    logger.warn(`[fx-rate] open.er-api 不可用,尝试 frankfurter: ${String(e).slice(0, 120)}`)
  }
  try {
    const body = (await deps.fetchJson(
      'https://api.frankfurter.app/latest?from=USD&to=CNY',
    )) as { rates?: Record<string, unknown> }
    const rate = Number(body?.rates?.['CNY'])
    if (isValidRate(rate)) return { rate, source: 'frankfurter.app' }
  } catch (e) {
    logger.warn(`[fx-rate] frankfurter 不可用,回退数据库: ${String(e).slice(0, 120)}`)
  }
  try {
    const row = await deps.findRate('USD', 'CNY')
    const rate = Number(row?.rate)
    if (isValidRate(rate)) return { rate, source: 'db:zhs_exchange_rate' }
  } catch (e) {
    logger.warn(`[fx-rate] DB 汇率读取失败,回退环境变量: ${String(e).slice(0, 120)}`)
  }
  return { rate: deps.envUsdCny(), source: 'env:AI_PRICE_USD_TO_CNY' }
}

/** USDT→CNY:CoinGecko 实时价 → DB → 按 USDT≈USD 锚定 */
async function resolveUsdtCny(usdCny: number): Promise<{ rate: number; source: string }> {
  try {
    const body = (await deps.fetchJson(
      'https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=cny',
    )) as { tether?: { cny?: unknown } }
    const rate = Number(body?.tether?.cny)
    if (isValidRate(rate)) return { rate, source: 'coingecko:tether/cny' }
  } catch (e) {
    logger.warn(`[fx-rate] CoinGecko 不可用,回退数据库: ${String(e).slice(0, 120)}`)
  }
  try {
    const row = await deps.findRate('USDT', 'CNY')
    const rate = Number(row?.rate)
    if (isValidRate(rate)) return { rate, source: 'db:zhs_exchange_rate' }
  } catch (e) {
    logger.warn(`[fx-rate] USDT DB 汇率读取失败,按 USD 锚定: ${String(e).slice(0, 120)}`)
  }
  return { rate: usdCny, source: 'usdt-peg:USD' }
}

function round6(v: number): number {
  return Math.round(v * 1e6) / 1e6
}

function snapshotOf(
  usd: { rate: number; source: string },
  usdt: { rate: number; source: string },
  stale: boolean,
): FxSnapshot {
  return {
    base: 'CNY',
    cnyPer: { USD: round6(usd.rate), USDT: round6(usdt.rate) },
    perCny: { USD: round6(1 / usd.rate), USDT: round6(1 / usdt.rate) },
    sources: { usdCny: usd.source, usdtCny: usdt.source },
    fetchedAt: new Date(deps.now()).toISOString(),
    stale,
    ttlSeconds: Math.round(ttlMs() / 1000),
  }
}

function isFallbackSource(source: string): boolean {
  return source.startsWith('env:') || source.startsWith('db:') || source.startsWith('usdt-peg:')
}

async function buildSnapshot(): Promise<FxSnapshot> {
  const usd = await resolveUsdCny()
  const usdt = await resolveUsdtCny(usd.rate)
  const snap = snapshotOf(usd, usdt, isFallbackSource(usd.source) || isFallbackSource(usdt.source))
  lastGood = snap
  lastGoodAt = deps.now()
  return snap
}

/** 取当前汇率快照(带 TTL 缓存与 single-flight);永不抛错 */
export async function getFxSnapshot(): Promise<FxSnapshot> {
  const now = deps.now()
  if (lastGood && now - lastGoodAt < ttlMs()) return lastGood
  if (inflight) return inflight
  inflight = buildSnapshot()
    .catch((e) => {
      logger.warn(`[fx-rate] 汇率刷新失败: ${String(e).slice(0, 160)}`)
      if (lastGood) return { ...lastGood, stale: true, fetchedAt: new Date(now).toISOString() }
      const env = deps.envUsdCny()
      return snapshotOf(
        { rate: env, source: 'env:AI_PRICE_USD_TO_CNY' },
        { rate: env, source: 'usdt-peg:USD' },
        true,
      )
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

// =============================================================================
// 测试钩子(仅供单测替换依赖/清缓存;业务代码不得调用)
// =============================================================================

export function __setFxDepsForTest(next: Partial<FxDeps>): void {
  Object.assign(deps, next)
  lastGood = null
  lastGoodAt = 0
  inflight = null
}

export function __resetFxCacheForTest(): void {
  lastGood = null
  lastGoodAt = 0
  inflight = null
}
