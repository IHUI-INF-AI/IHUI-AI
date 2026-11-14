// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 统一定价解析器(2026-11-13 立)。
 *
 * 问题:平台模型可来自 20+ 聚合渠道,模型名五花八门,单一价表(LiteLLM)只能覆盖约 40%,
 * 剩下的大量模型「无价 = 调用不扣费 = 白送上游额度」。此前靠一次性脚本补价,渠道一同步
 * 又冒出新的零价行,属于反复回潮。
 *
 * 本模块是**唯一价格解析出口**:多源价表 → 多级键归一 → 家族插值 → 渠道兜底,
 * 每一档都返回可追溯的 `tier/source`,由调用方写入 `ai_model_config_models.metadata.priceSource`,
 * 保证「所有模型都有价、每笔价都能说出出处」。计费侧不感知本模块,只在落库时使用。
 *
 * 单位:全部统一为 **分/千 token(成本价)**。用户实付 = 成本 × PROFIT_FACTOR(由调用方乘)。
 * 汇率:`AI_PRICE_USD_TO_CNY`(默认 7.2),与 litellm-price-sync 同源。
 */
import { sql } from 'drizzle-orm'
import { logger } from '../utils/logger.js'
import {
  lookupOfficialPrice,
  type OfficialPriceEntry,
} from './pricing/official-price-catalog.js'

/** 成本 → 用户实付的统一利润系数(机主 2026-11-13 拍板:×3) */
export const PROFIT_FACTOR = 3

/** 解析档位:越靠前越可信,兜底档必须在 metadata 里留痕供运营复核 */
export type PriceTier = 'exact' | 'alias' | 'family' | 'provider-fallback' | 'global-fallback'

export interface ResolvedPrice {
  /** 分/千 token(成本价,未乘利润系数) */
  inputPer1k: number
  outputPer1k: number
  tier: PriceTier
  /** 价表来源:litellm | openrouter | models-dev | provider-median | global-median */
  source: string
  /** 兜底时作为参照的模型 id(审计用) */
  refModel?: string
}

/** 模型类型:决定兜底价取哪个池子的中位数 */
export type ModelKind =
  'chat' | 'embedding' | 'rerank' | 'tts' | 'asr' | 'image' | 'video' | 'other'

const usdToCny = (): number => {
  const raw = Number(process.env['AI_PRICE_USD_TO_CNY'])
  return Number.isFinite(raw) && raw > 0 ? raw : 7.2
}
/** USD/token → 分/1k token */
const perTokenToCents1k = (usdPerToken: number, fx: number): number => usdPerToken * 1000 * 100 * fx
/** USD/1M token → 分/1k token */
const perMillionToCents1k = (usdPer1M: number, fx: number): number => (usdPer1M * fx * 100) / 1000

// =============================================================================
// 键归一(多级候选,按可信度从高到低)
// =============================================================================

const QUANT_SUFFIX =
  /(?:[-_](?:awq|gptq|gguf|fp8|fp16|bf16|int4|int8|4bit|8bit|quantized|mlx|onnx))+$/i
const DATE_SUFFIX = /(?:[-_]?\d{4}[-_]?\d{2}[-_]?\d{2}|\d{8})$/i
const NOISE_SUFFIX =
  /[:-](?:free|preview|latest|beta|alpha|exp|experimental|instruct|chat|it|v\d+)$/i

/** 生成候选匹配键(去重保序);先精确,再逐级剥离噪音 */
export function candidateKeys(modelId: string): string[] {
  const base = modelId.toLowerCase().trim().replace(/\s+/g, '-')
  const out: string[] = []
  const push = (s: string) => {
    const v = s.trim()
    if (v && !out.includes(v)) out.push(v)
  }
  push(base)
  if (base.includes('/')) push(base.slice(base.lastIndexOf('/') + 1))
  let stripped = base
  for (let i = 0; i < 3; i++) {
    const next = stripped
      .replace(QUANT_SUFFIX, '')
      .replace(DATE_SUFFIX, '')
      .replace(NOISE_SUFFIX, '')
    if (next === stripped) break
    stripped = next
    push(stripped)
    if (stripped.includes('/')) push(stripped.slice(stripped.lastIndexOf('/') + 1))
  }
  // 聚合前缀剥离(openrouter/Fireworks/accounts/... 常见形态)
  for (const p of ['accounts/fireworks/models/', 'accounts/', 'openrouter/', 'models/']) {
    if (base.includes(p)) push(base.slice(base.indexOf(p) + p.length))
  }
  for (const p of [
    'openai/',
    'anthropic/',
    'google/',
    'meta-llama/',
    'mistralai/',
    'qwen/',
    'deepseek/',
    'zhipu/',
    'moonshotai/',
    'x-ai/',
  ]) {
    if (stripped.startsWith(p)) push(stripped.slice(p.length))
  }
  return out
}

/** 模型类型识别(名字约定,不碰上游)。注意顺序:rerank 必须先于 embedding 判定
 *  (`bge-reranker-base` 同时含 bge- 与 rerank,前者是 embedding 家族前缀,实际是重排序模型) */
export function detectModelKind(modelId: string): ModelKind {
  const n = modelId.toLowerCase()
  if (/rerank|re-rank|cross-encoder/.test(n)) return 'rerank'
  if (/tts|text-to-speech|speech-synth|cosyvoice|sambert/.test(n)) return 'tts'
  if (/whisper|asr|speech-to-text|transcribe|paraformer|sensevoice/.test(n)) return 'asr'
  if (/image|dall-e|flux|stable-diffusion|sdxl|midjourney|seedream|kolors|wanx/.test(n))
    return 'image'
  if (/video|sora|kling|seedance|hunyuan-video|veo-/.test(n)) return 'video'
  if (/embed|bge-|gte-|e5-|m3e|text-embedding/.test(n)) return 'embedding'
  if (/moderation|guard/.test(n)) return 'other'
  return 'chat'
}

// =============================================================================
// 参数规模解析(家族插值用)
// =============================================================================

/** 从模型名提取参数规模(B);提不到返回 null */
export function parseParamScale(modelId: string): number | null {
  const n = modelId.toLowerCase()
  const m = n.match(/(?:^|[-_/])(\d+(?:\.\d+)?)\s*b(?![a-z0-9])/)
  if (!m) return null
  const v = Number(m[1])
  return Number.isFinite(v) && v > 0 && v <= 1000 ? v : null
}

/** 家族词根:去掉规模/版本/量化/日期后的主名(如 qwen2.5-7b-instruct → qwen) */
export function familyRoot(modelId: string): string {
  let n = modelId.toLowerCase().split('/').pop() ?? modelId.toLowerCase()
  n = n
    .replace(QUANT_SUFFIX, '')
    .replace(DATE_SUFFIX, '')
    .replace(NOISE_SUFFIX, '')
    .replace(/(?:^|[-_])\d+(?:\.\d+)?b(?![a-z0-9])/g, '-')
    .replace(/[-_]?v?\d+(?:\.\d+)*/g, '-')
    .replace(/[-_]{2,}/g, '-')
    .replace(/^[-_]|[-_]$/g, '')
  return n.split(/[-_]/)[0] ?? n
}

// =============================================================================
// 多源价表装载
// =============================================================================

interface RawPrice {
  inC: number
  outC: number
}

export interface PriceSources {
  /** 归一键 → 成本价(分/1k) */
  index: Map<string, RawPrice>
  /** 家族 → [{scale, inC, outC, id}] 供插值 */
  families: Map<string, Array<{ scale: number | null; inC: number; outC: number; id: string }>>
  /** provider → 已定价模型成本价列表(兜底中位数) */
  byProvider: Map<string, RawPrice[]>
  /** 全局按类型的中位数池 */
  byKind: Map<ModelKind, RawPrice[]>
  /** 加载统计 */
  stats: { litellm: number; openrouter: number; modelsDev: number }
}

const LITELLM_URL =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json'
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/models'
const MODELS_DEV_URL = 'https://models.dev/api.json'

/** 装载三源价表(任一源失败只记日志,不阻断其余源) */
export async function loadPriceSources(): Promise<PriceSources> {
  const fx = usdToCny()
  const index = new Map<string, RawPrice>()
  const families = new Map<
    string,
    Array<{ scale: number | null; inC: number; outC: number; id: string }>
  >()
  const byProvider = new Map<string, RawPrice[]>()
  const byKind = new Map<ModelKind, RawPrice[]>()
  const stats = { litellm: 0, openrouter: 0, modelsDev: 0 }

  const put = (id: string, inC: number, outC: number, providerHint?: string) => {
    if (!(inC > 0) && !(outC > 0)) return
    const inP = inC > 0 ? inC : outC
    const outP = outC > 0 ? outC : inC
    const v = { inC: inP, outC: outP }
    for (const k of candidateKeys(id)) if (!index.has(k)) index.set(k, v)
    const root = familyRoot(id)
    if (root.length >= 2) {
      const list = families.get(root) ?? []
      if (list.length < 200) list.push({ scale: parseParamScale(id), inC: inP, outC: outP, id })
      families.set(root, list)
    }
    if (providerHint) {
      const arr = byProvider.get(providerHint) ?? []
      arr.push(v)
      byProvider.set(providerHint, arr)
    }
    const kind = detectModelKind(id)
    const karr = byKind.get(kind) ?? []
    karr.push(v)
    byKind.set(kind, karr)
  }

  // 1) LiteLLM:USD/token
  try {
    const res = await fetch(LITELLM_URL, { signal: AbortSignal.timeout(120_000) })
    const table = (await res.json()) as Record<string, unknown>
    for (const [key, entry] of Object.entries(table)) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
      const rec = entry as Record<string, unknown>
      const i = rec['input_cost_per_token']
      const o = rec['output_cost_per_token']
      if (typeof i !== 'number' || !Number.isFinite(i) || !(i > 0)) continue
      if (typeof o !== 'number' || !Number.isFinite(o) || !(o > 0)) continue
      const prov = key.includes('/') ? key.slice(0, key.indexOf('/')) : undefined
      put(key, perTokenToCents1k(i, fx), perTokenToCents1k(o, fx), prov)
      stats.litellm++
    }
  } catch (e) {
    logger.warn(`[price-resolver] LiteLLM 价表拉取失败,跳过该源: ${String(e).slice(0, 120)}`)
  }

  // 2) OpenRouter:USD/token(字符串)
  try {
    const res = await fetch(OPENROUTER_URL, { signal: AbortSignal.timeout(120_000) })
    const body = (await res.json()) as {
      data?: Array<{ id?: string; pricing?: Record<string, string> }>
    }
    for (const m of body.data ?? []) {
      const id = m.id
      if (!id) continue
      const i = Number(m.pricing?.['prompt'] ?? 0)
      const o = Number(m.pricing?.['completion'] ?? 0)
      if (!(i > 0) || !(o > 0)) continue
      put(id, perTokenToCents1k(i, fx), perTokenToCents1k(o, fx), 'openrouter')
      stats.openrouter++
    }
  } catch (e) {
    logger.warn(`[price-resolver] OpenRouter 价表拉取失败,跳过该源: ${String(e).slice(0, 120)}`)
  }

  // 3) models.dev:USD/1M token(覆盖最广)
  try {
    const res = await fetch(MODELS_DEV_URL, { signal: AbortSignal.timeout(180_000) })
    const body = (await res.json()) as Record<
      string,
      { models?: Record<string, { cost?: { input?: number; output?: number } }> }
    >
    for (const [prov, entry] of Object.entries(body)) {
      for (const [mid, model] of Object.entries(entry?.models ?? {})) {
        const i = Number(model?.cost?.input ?? 0)
        const o = Number(model?.cost?.output ?? 0)
        if (!(i > 0) && !(o > 0)) continue
        put(mid, perMillionToCents1k(i, fx), perMillionToCents1k(o, fx), prov)
        stats.modelsDev++
      }
    }
  } catch (e) {
    logger.warn(`[price-resolver] models.dev 价表拉取失败,跳过该源: ${String(e).slice(0, 120)}`)
  }

  logger.info(
    `[price-resolver] 价表装载完成 litellm=${stats.litellm} openrouter=${stats.openrouter} modelsDev=${stats.modelsDev}`,
  )
  return { index, families, byProvider, byKind, stats }
}

// =============================================================================
// 解析
// =============================================================================

const median = (arr: number[]): number => {
  if (arr.length === 0) return 0
  const s = [...arr].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

/**
 * 解析单个模型的成本价。返回 null 表示**连兜底都拿不到**(调用方应保持下架并告警,
 * 绝不允许零价上架 —— 那等于白送上游额度)。
 *
 * 优先级:
 *   exact   = 任一源精确命中
 *   alias   = 剥离量化/日期/噪音/聚合前缀后命中
 *   family  = 同家族按参数规模 log 插值
 *   provider-fallback = 同渠道已定价中位数
 *   global-fallback   = 同类型全局中位数
 */
export function resolveModelPrice(
  modelId: string,
  sources: PriceSources,
  providerHint?: string,
): ResolvedPrice | null {
  const keys = candidateKeys(modelId)

  // exact / alias:第一键是原名,其余键是归一后的别名
  for (let i = 0; i < keys.length; i++) {
    const hit = sources.index.get(keys[i]!)
    if (hit) {
      return {
        inputPer1k: hit.inC,
        outputPer1k: hit.outC,
        tier: i === 0 ? 'exact' : 'alias',
        source: 'multi-source',
      }
    }
  }

  // family:同家族 + 参数规模 log 插值;提不到规模时退到家族中位价(仍是同族实证,优于全局中位)
  const root = familyRoot(modelId)
  const fam = sources.families.get(root)
  const scale = parseParamScale(modelId)
  if (fam && fam.length >= 2) {
    const usable = fam.filter((x) => x.scale !== null && x.scale > 0)
    if (usable.length >= 2 && scale !== null) {
      const sorted = [...usable].sort((a, b) => a.scale! - b.scale!)
      let lo = sorted[0]!
      let hi = sorted[sorted.length - 1]!
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i]!.scale! <= scale && scale <= sorted[i + 1]!.scale!) {
          lo = sorted[i]!
          hi = sorted[i + 1]!
          break
        }
      }
      const lx = Math.log(lo.scale!)
      const hx = Math.log(hi.scale!)
      const tx = Math.log(scale)
      const w = hx === lx ? 0 : Math.min(1, Math.max(0, (tx - lx) / (hx - lx)))
      return {
        inputPer1k: lo.inC * (1 - w) + hi.inC * w,
        outputPer1k: lo.outC * (1 - w) + hi.outC * w,
        tier: 'family',
        source: 'family-extrapolation',
        refModel: `${lo.id} ~ ${hi.id}`,
      }
    }
    // 同族但规模不可比(或本模型无规模参数)⇒ 家族中位价
    return {
      inputPer1k: median(fam.map((x) => x.inC)),
      outputPer1k: median(fam.map((x) => x.outC)),
      tier: 'family',
      source: 'family-median',
      refModel: `${root}×${fam.length}`,
    }
  }

  // provider-fallback:同渠道已定价中位数
  if (providerHint) {
    const pool = sources.byProvider.get(providerHint)
    if (pool && pool.length >= 3) {
      return {
        inputPer1k: median(pool.map((x) => x.inC)),
        outputPer1k: median(pool.map((x) => x.outC)),
        tier: 'provider-fallback',
        source: 'provider-median',
      }
    }
  }

  // global-fallback:同类型全局中位数
  const kind = detectModelKind(modelId)
  const pool = sources.byKind.get(kind)
  if (pool && pool.length >= 3) {
    return {
      inputPer1k: median(pool.map((x) => x.inC)),
      outputPer1k: median(pool.map((x) => x.outC)),
      tier: 'global-fallback',
      source: 'global-median',
    }
  }

  return null
}

// =============================================================================
// 统一出口:巡检 + 单模型定价(接入审批/导入链路,杜绝零价回潮)
// =============================================================================

/** 价表缓存:三源合计约 1.2 万条,每次拉取要数秒,进程内缓存 30 分钟 */
let cachedSources: { at: number; data: PriceSources } | null = null
const SOURCES_TTL_MS = 30 * 60 * 1000

/** 取价表(带进程内缓存;失败时回落到上一次成功结果) */
export async function getPriceSources(): Promise<PriceSources> {
  const now = Date.now()
  if (cachedSources && now - cachedSources.at < SOURCES_TTL_MS) return cachedSources.data
  try {
    const data = await loadPriceSources()
    cachedSources = { at: now, data }
    return data
  } catch (e) {
    if (cachedSources) {
      logger.warn(`[price-resolver] 价表刷新失败,沿用上次缓存: ${String(e).slice(0, 120)}`)
      return cachedSources.data
    }
    throw e
  }
}

/**
 * 动态路由/聚合模型判定(2026-11-14 立)。
 *
 * 这类模型(openrouter/auto、bodybuilder、fusion、switchyard…)上游按**实际路由到的模型**
 * 逐次计费,不存在固定单位价。价表里若出现数字(常见 -1 或占位 1/2)都不是可售单价,
 * 拿它当价就是"瞎定"。因此它们**永不自动定价**,只能下架。
 *
 * 判据用整段匹配(不是子串),避免误伤 `xxx-auto-glm` 这类真实模型名。
 */
const ROUTER_SEGMENTS = new Set([
  'auto',
  'auto-beta',
  'auto-code',
  'bodybuilder',
  'fusion',
  'pareto-code',
  'switchyard',
  'jev-router',
  'router',
  'routing',
  'free',
])

export function isDynamicRouterModel(modelId: string): boolean {
  const n = modelId.toLowerCase().trim()
  if (ROUTER_SEGMENTS.has(n)) return true
  return n.split('/').some((seg) => ROUTER_SEGMENTS.has(seg))
}

/**
 * 只接受「权威命中」的解析(2026-11-14 立)。
 *
 * 与 resolveModelPrice 的区别:**只保留 exact / alias 两档**,其余三档
 * (family 插值 / provider 中位数 / global 中位数)全部视为"瞎定",返回 null。
 * 另外动态路由模型直接返回 null —— 它们没有固定单价。
 *
 * alias 档还会拦一次"过度泛化"的键:命中键不能短于原主段的 60%,
 * 防止 `openrouter/auto` 靠 `auto` 这种通用词命中别的模型价。
 */
export function resolveAuthoritativePrice(
  modelId: string,
  sources: PriceSources,
  providerHint?: string,
): ResolvedPrice | null {
  void providerHint
  if (isDynamicRouterModel(modelId)) return null
  const keys = candidateKeys(modelId)
  const primary = keys[0] ?? ''
  const primarySeg = primary.slice(primary.lastIndexOf('/') + 1)
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!
    if (i > 0 && primarySeg.length > 0 && key.length < primarySeg.length * 0.6) continue
    const hit = sources.index.get(key)
    if (hit) {
      return {
        inputPer1k: hit.inC,
        outputPer1k: hit.outC,
        tier: i === 0 ? 'exact' : 'alias',
        source: 'multi-source',
      }
    }
  }
  return null
}

export interface SweepResult {
  scanned: number
  resolved: number
  unresolved: string[]
  byTier: Record<string, number>
}

/**
 * 巡检并补齐零价模型(2026-11-13 立)。**这是唯一允许「让模型从零价变成有价」的批量出口**,
 * 由定时任务与运维脚本共用。
 *
 * 语义:
 * - 只处理「启用但零价」的行;解析失败的一律**下架**(不能定价就不能卖,绝不白送上游额度);
 * - 价格 = 成本 × PROFIT_FACTOR,并把 tier/source 写进 metadata.priceSource 留痕;
 * - 不碰任何已有定价的行(手工价永不覆盖)。
 *
 * @returns 巡检统计;unresolved 列出连兜底都拿不到的模型(调用方应告警)
 */
export async function sweepUnpricedModels(
  db: {
    execute: (q: unknown) => Promise<unknown>
  },
  applyPricing: (args: {
    modelId: string
    inputTokenPrice: number
    outputTokenPrice: number
    billingMode: 'token'
  }) => Promise<unknown>,
  opts: { dryRun?: boolean } = {},
): Promise<SweepResult> {
  const sources = await getPriceSources()
  const rows = (await db.execute(sql`
    select m.id, m.config_id, m.model_id, c.provider_code
    from ai_model_config_models m
    join ai_model_config c on c.id = m.config_id
    where m.enabled = true
      and coalesce(m.input_price_per_1k, 0) = 0
      and coalesce(m.output_price_per_1k, 0) = 0
      and not exists (
        select 1 from ai_pricing p
        where p.model_id = lower(m.model_id)
          and (p.input_token_price > 0 or p.output_token_price > 0)
      )
  `)) as unknown as Array<{
    id: number
    config_id: number
    model_id: string
    provider_code: string
  }>
  const list = (Array.isArray(rows) ? rows : ((rows as { rows?: unknown[] }).rows ?? [])) as Array<{
    id: number
    config_id: number
    model_id: string
    provider_code: string
  }>

  const byTier: Record<string, number> = {}
  const unresolved: string[] = []
  let resolved = 0

  for (const r of list) {
    const price = resolveModelPrice(r.model_id, sources, r.provider_code)
    if (!price) {
      unresolved.push(r.model_id)
      if (!opts.dryRun) {
        await db.execute(
          sql`update ai_model_config_models set enabled = false, updated_at = now() where id = ${Number(r.id)} and config_id = ${Number(r.config_id)}`,
        )
      }
      continue
    }
    byTier[price.tier] = (byTier[price.tier] ?? 0) + 1
    resolved++
    if (opts.dryRun) continue

    const inP = Math.round(price.inputPer1k * PROFIT_FACTOR * 1e6) / 1e6
    const outP = Math.round(price.outputPer1k * PROFIT_FACTOR * 1e6) / 1e6
    await applyPricing({
      modelId: r.model_id.toLowerCase(),
      inputTokenPrice: inP,
      outputTokenPrice: outP,
      billingMode: 'token',
    })
    await db.execute(
      sql`update ai_model_config_models set input_price_per_1k = ${String(inP)}, output_price_per_1k = ${String(outP)}, cost_input_price_per_1k = ${String(price.inputPer1k)}, cost_output_price_per_1k = ${String(price.outputPer1k)}, updated_at = now() where id = ${Number(r.id)} and config_id = ${Number(r.config_id)}`,
    )
    const meta = JSON.stringify({
      priceSource: {
        tier: price.tier,
        source: price.source,
        refModel: price.refModel ?? null,
        profitFactor: PROFIT_FACTOR,
        resolvedAt: new Date().toISOString(),
      },
    }).replace(/'/g, "''")
    await db.execute(
      sql.raw(
        `update ai_model_config_models set metadata = coalesce(metadata, '{}'::jsonb) || '${meta}'::jsonb where id = ${Number(r.id)} and config_id = ${Number(r.config_id)}`,
      ),
    )
  }

  logger.info(
    `[price-resolver] 零价巡检完成 scanned=${list.length} resolved=${resolved} unresolved=${unresolved.length}`,
  )
  return { scanned: list.length, resolved, unresolved, byTier }
}

// =============================================================================
// 占位价重定价(2026-11-14 立)
// =============================================================================

export interface RepriceResult {
  /** 命中的模型数(按 model_id 去重) */
  scanned: number
  /** 写入权威价的模型数 */
  repriced: number
  /** 无权威价、已下架(或 dryRun 下"将下架")的模型 */
  delisted: string[]
  byTier: Record<string, number>
  dryRun: boolean
  /** 非空表示本次未执行(价表源不足等),值为原因 */
  skipped?: string
}

/** 写入 ai_pricing 的入参(与 pricing-service.upsertPricing 对齐,覆盖四种计费模式) */
export interface ApplyPricingArgs {
  modelId: string
  inputTokenPrice: number
  outputTokenPrice: number
  billingMode: 'token' | 'per_image' | 'per_video' | 'per_call'
  perUnitPrice?: number | null
  videoUnit?: 'call' | 'second' | null
  tieredCallPrices?: { le256k: number; mid: number; gt512k: number } | null
}

/**
 * 价表源完整性门禁(2026-11-14 立,事故驱动)。
 *
 * 生产曾出现 LiteLLM + models.dev 同时拉取失败、只剩 OpenRouter 444 条的情况,
 * 若此时继续重定价,命中率骤降会把大批本可定价的模型误判成"无权威价"并下架。
 * 因此:成功源 < 2 或总条目 < 1000 时**整体跳过**,不动任何数据(fail-closed)。
 */
const MIN_PRICE_SOURCES = 2
const MIN_PRICE_ENTRIES = 1000

export function priceSourcesSufficient(sources: PriceSources): {
  ok: boolean
  reason?: string
} {
  const counts = [sources.stats.litellm, sources.stats.openrouter, sources.stats.modelsDev]
  const sourceCount = counts.filter((n) => n > 0).length
  const total = counts.reduce((a, b) => a + b, 0)
  if (sourceCount < MIN_PRICE_SOURCES || total < MIN_PRICE_ENTRIES) {
    return {
      ok: false,
      reason: `价表源不足(litellm=${sources.stats.litellm} openrouter=${sources.stats.openrouter} modelsDev=${sources.stats.modelsDev}),拒绝重定价与下架`,
    }
  }
  return { ok: true }
}

/**
 * 修复「占位价」模型(2026-11-14 立)。
 *
 * 背景:ai_pricing 里有 219 个模型是 2026-07-30 批量写入的 `1.000000/2.000000`
 * 占位价(跨 qwen/openai/google 全同价,不可能是真实价),另有 8 个动态路由模型
 * 是 -100000 哨兵。这些价会被计费当真,属于"瞎定"。
 *
 * 处理原则(用户 2026-11-14 裁定「所有模型都要有价格 并且不能瞎定」):
 * - 只有在三源价表里 **exact / alias 权威命中** 的模型才写入价格(成本 × PROFIT_FACTOR);
 * - 动态路由模型、以及拿不到权威价的模型:一律**下架**(is_relay_public=false),
 *   绝不插值、绝不取中位数、绝不猜;
 * - 下架同时删除其 ai_pricing 占位行,防止再次被当权威价回填。
 *
 * @returns 统计;delisted 列出被下架的模型(调用方应告警复核)
 */
export async function repricePlaceholderModels(
  db: {
    execute: (q: unknown) => Promise<unknown>
  },
  applyPricing: (args: ApplyPricingArgs) => Promise<unknown>,
  opts: { dryRun?: boolean } = {},
): Promise<RepriceResult> {
  const dryRun = opts.dryRun === true
  const sources = await getPriceSources()
  const gate = priceSourcesSufficient(sources)
  if (!gate.ok) {
    logger.warn(`[price-resolver] 占位价重定价跳过:${gate.reason}`)
    return {
      scanned: 0,
      repriced: 0,
      delisted: [],
      byTier: {},
      dryRun,
      skipped: gate.reason,
    }
  }
  const rows = (await db.execute(sql`
    select lower(m.model_id) as model_id,
           min(c.provider_code) as provider_code,
           count(*)::int as config_rows
    from ai_model_config_models m
    join ai_model_config c on c.id = m.config_id
    where lower(m.model_id) not like '%:free'
      and (
        coalesce(m.input_price_per_1k, 0) <= 0
        or coalesce(m.output_price_per_1k, 0) <= 0
        -- config 自身就是 1分/2分 占位价(2026-07-30 批量写入,跨厂商全同价)
        or (coalesce(m.input_price_per_1k, 0) = 1 and coalesce(m.output_price_per_1k, 0) = 2)
        or exists (
          select 1 from ai_pricing p
          where p.model_id = lower(m.model_id)
            and (
              p.input_token_price <= 0
              or p.output_token_price <= 0
              or (p.input_token_price = 1 and p.output_token_price = 2)
            )
        )
      )
    group by lower(m.model_id)
    order by lower(m.model_id)
  `)) as unknown as Array<{ model_id: string; provider_code: string }>
  const list = (Array.isArray(rows) ? rows : ((rows as { rows?: unknown[] }).rows ?? [])) as Array<{
    model_id: string
    provider_code: string
  }>

  const byTier: Record<string, number> = {}
  const delisted: string[] = []
  let repriced = 0

  for (const r of list) {
    const modelId = String(r.model_id ?? '').toLowerCase()
    if (!modelId) continue
    const providerCode = String(r.provider_code ?? '').toLowerCase()

    // ① 厂商官方价目优先 —— 「不能瞎定」的最高档依据(2026-11-14 立)
    const official = lookupOfficialPrice(providerCode, modelId)
    if (official) {
      const tier = official.billingMode === 'free' ? 'official-free' : 'official'
      byTier[tier] = (byTier[tier] ?? 0) + 1
      repriced++
      if (!dryRun) await applyOfficialEntry(db, applyPricing, official, modelId)
      continue
    }

    // ② 三源价表 exact / alias
    const price = resolveAuthoritativePrice(modelId, sources, providerCode)
    if (!price) {
      delisted.push(modelId)
      if (!dryRun) {
        // 下架:只关对外售卖,不动 enabled(内部链路仍可用,但不卖就不能有价)
        await db.execute(
          sql`update ai_model_config_models set is_relay_public = false, metadata = coalesce(metadata, '{}'::jsonb) || '{"placeholderDelisted":true}'::jsonb, updated_at = now() where lower(model_id) = ${modelId}`,
        )
        // 删除占位/哨兵定价行,防止下次被 syncConfigPricesFromPricing 当权威价回填
        await db.execute(sql`delete from ai_pricing where model_id = ${modelId}`)
      }
      continue
    }
    byTier[price.tier] = (byTier[price.tier] ?? 0) + 1
    repriced++
    if (dryRun) continue

    const inP = Math.round(price.inputPer1k * PROFIT_FACTOR * 1e6) / 1e6
    const outP = Math.round(price.outputPer1k * PROFIT_FACTOR * 1e6) / 1e6
    await applyPricing({
      modelId,
      inputTokenPrice: inP,
      outputTokenPrice: outP,
      billingMode: 'token',
    })
    const meta = JSON.stringify({
      priceSource: {
        tier: price.tier,
        source: price.source,
        refModel: price.refModel ?? null,
        profitFactor: PROFIT_FACTOR,
        resolvedAt: new Date().toISOString(),
        reason: 'placeholder-reprice',
      },
    }).replace(/'/g, "''")
    await db.execute(
      sql.raw(
        `update ai_model_config_models
            set input_price_per_1k = '${inP}',
                output_price_per_1k = '${outP}',
                cost_input_price_per_1k = '${price.inputPer1k}',
                cost_output_price_per_1k = '${price.outputPer1k}',
                metadata = coalesce(metadata, '{}'::jsonb) || '${meta}'::jsonb,
                updated_at = now()
          where lower(model_id) = '${modelId.replace(/'/g, "''")}'`,
      ),
    )
  }

  logger.info(
    `[price-resolver] 占位价重定价完成 dryRun=${dryRun} scanned=${list.length} repriced=${repriced} delisted=${delisted.length}`,
  )
  return { scanned: list.length, repriced, delisted, byTier, dryRun }
}

const round6 = (v: number): number => Math.round(v * 1e6) / 1e6

/**
 * 写入「厂商官方价目」价:按 billingMode 落到 ai_pricing 对应列,
 * 并把参考依据写进 metadata.priceSource 供运营复核;同时恢复上架
 * (只恢复 enabled=true 的行 —— 官方价到位即应可售,这是机主 2026-11-14 的要求)。
 */
async function applyOfficialEntry(
  db: { execute: (q: unknown) => Promise<unknown> },
  applyPricing: (args: ApplyPricingArgs) => Promise<unknown>,
  entry: OfficialPriceEntry,
  modelId: string,
): Promise<void> {
  const isFree = entry.billingMode === 'free'
  const isToken = entry.billingMode === 'token'
  const profit = PROFIT_FACTOR
  const inP = isToken ? round6((entry.inputPer1k ?? 0) * profit) : 0
  const outP = isToken ? round6((entry.outputPer1k ?? 0) * profit) : 0
  const unit = isToken || isFree ? null : round6((entry.unitPriceCents ?? 0) * profit)

  if (isFree) {
    await applyPricing({ modelId, inputTokenPrice: 0, outputTokenPrice: 0, billingMode: 'token' })
  } else if (isToken) {
    await applyPricing({
      modelId,
      inputTokenPrice: inP,
      outputTokenPrice: outP,
      billingMode: 'token',
    })
  } else {
    await applyPricing({
      modelId,
      inputTokenPrice: 0,
      outputTokenPrice: 0,
      billingMode: entry.billingMode as 'per_image' | 'per_video' | 'per_call',
      perUnitPrice: unit,
      videoUnit: entry.billingMode === 'per_video' ? (entry.videoUnit ?? 'second') : null,
      tieredCallPrices:
        entry.billingMode === 'per_call' && unit !== null
          ? { le256k: unit, mid: unit, gt512k: unit }
          : null,
    })
  }

  const meta = JSON.stringify({
    priceSource: {
      tier: isFree ? 'official-free' : 'official',
      source: entry.source,
      billingMode: entry.billingMode === 'free' ? 'token' : entry.billingMode,
      perUnitPrice: unit,
      unitBasis: entry.unitBasis ?? null,
      outputNotApplicable: entry.outputNotApplicable === true,
      note: entry.note ?? null,
      profitFactor: profit,
      retrievedAt: entry.retrievedAt,
      resolvedAt: new Date().toISOString(),
      reason: 'official-catalog',
    },
  }).replace(/'/g, "''")

  const priceCols = isToken || isFree ? `input_price_per_1k = '${inP}', output_price_per_1k = '${outP}',` : ''
  const costCols =
    isToken
      ? `cost_input_price_per_1k = '${entry.inputPer1k ?? 0}', cost_output_price_per_1k = '${entry.outputPer1k ?? 0}',`
      : ''
  await db.execute(
    sql.raw(
      `update ai_model_config_models
          set ${priceCols}
              ${costCols}
              metadata = coalesce(metadata, '{}'::jsonb) || '${meta}'::jsonb,
              is_relay_public = case when enabled then true else is_relay_public end,
              updated_at = now()
        where lower(model_id) = '${modelId.replace(/'/g, "''")}'`,
    ),
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
