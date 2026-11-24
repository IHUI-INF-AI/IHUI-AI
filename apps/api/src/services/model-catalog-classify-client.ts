// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池模型代次判定客户端(2026-11-20 立)。
 *
 * 背景:平台目录(/llm/models)在 ai-service 出口已有代次维度(annotate_models 打
 * category/model_tier / filter_frontier 摘过时清单),但「我的号池」那条腿
 * (/api/account-pool/models)由本服务自己拼装(ai_model_config 预置行 + 上游 listModels
 * 现拉),只过「上游清单交集 + down」—— 平台上还挂着的 kimi-k2.5 / glm-4.7 会原样出现在
 * 选择器默认区,两条腿口径不一致。
 *
 * 判据单一真相源在 ai-service(app/services/model_catalog.py + model_catalog_policy.py),
 * apps/api 跑在 Node 侧不能直接 import,故经内部端点 POST /internal/model-catalog/classify
 * 拿结论;本文件只做传输、缓存与结果装配,不重复实现任何代次规则。
 *
 * 失效方向(fail-open):票签不出 / 超时 / 非 2xx / 响应坏 ⇒ 返回 null,调用方照常出清单
 * (不隐藏、不标代次)。绝不把"没判定"写成"旧代",那会把用户自己的号池打空。
 */

import { aiServiceFetch } from '../utils/ai-service-fetch.js'
import { buildInternalCallHeaders } from '../utils/internal-call-headers.js'
import { logger } from '../utils/logger.js'

/** 一条待判定模型:provider 与 id 成对(id 可能是 `<平台>/<上游名>` 形态) */
export interface PoolModelRef {
  id: string
  provider: string
}

/** 判定结论(与 ai-service 端点出参同口径) */
export interface PoolModelClass {
  category: string
  /** latest / standard / legacy */
  modelTier: string
  /** 命中 ai-service 的过时清单(与平台目录 filter_frontier 同一份判据) */
  hidden: boolean
}

const CACHE_TTL_MS = 10 * 60 * 1000
/** 缓存键帽:号池模型集合是用户维度,不封顶就是内存泄漏 */
const CACHE_MAX = 2000
const CALL_TIMEOUT_MS = 5_000
/** 与 ai-service 端点 MAX_BATCH 同值;超出部分本轮不判(照常显示) */
const MAX_BATCH = 500

interface CacheEntry {
  expiresAt: number
  value: PoolModelClass
}

const cache = new Map<string, CacheEntry>()

/** 缓存/回填同用一个键:provider 与 id 必须成对(裸名可能在不同平台重名) */
export function poolModelClassKey(provider: string, id: string): string {
  return `${provider}\u0000${id}`
}

/** 测试注入点:清空进程内缓存,避免用例之间互相污染 */
export function resetPoolModelClassifyCacheForTests(): void {
  cache.clear()
}

function readCache(key: string): PoolModelClass | null {
  const hit = cache.get(key)
  if (!hit) return null
  if (hit.expiresAt <= Date.now()) {
    cache.delete(key)
    return null
  }
  return hit.value
}

function writeCache(key: string, value: PoolModelClass): void {
  if (cache.size >= CACHE_MAX && !cache.has(key)) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value })
}

interface ClassifyResponseItem {
  id?: unknown
  provider?: unknown
  category?: unknown
  model_tier?: unknown
  hidden?: unknown
}

function toClass(item: ClassifyResponseItem): PoolModelClass {
  return {
    category: typeof item.category === 'string' && item.category ? item.category : 'chat',
    modelTier:
      typeof item.model_tier === 'string' && item.model_tier ? item.model_tier : 'standard',
    hidden: item.hidden === true,
  }
}

/**
 * 批量判定号池模型。
 *
 * - 返回 Map 的键是 {@link poolModelClassKey} 的形态;命中缓存的条目直接复用。
 * - 返回 `null` 表示"本轮没判定"(票签不出 / 调用失败 / 响应坏)——调用方必须 fail-open。
 * - 空的 refs 返回空 Map(不是 null):"没有模型可判"与"判不了"是两件事。
 */
export async function classifyPoolModels(
  refs: PoolModelRef[],
): Promise<Map<string, PoolModelClass> | null> {
  if (refs.length === 0) return new Map()

  const out = new Map<string, PoolModelClass>()
  const missing: PoolModelRef[] = []
  const seen = new Set<string>()
  for (const ref of refs) {
    const key = poolModelClassKey(ref.provider, ref.id)
    if (seen.has(key)) continue
    seen.add(key)
    const cached = readCache(key)
    if (cached) out.set(key, cached)
    else missing.push(ref)
  }
  if (missing.length === 0) return out

  const batch = missing.slice(0, MAX_BATCH)
  if (missing.length > batch.length) {
    // 超出部分不判 ⇒ 调用方按"未判定"照常显示,失效方向恒为多显示
    logger.warn(
      `[account-pool] 待判定模型 ${missing.length} 条超过单批上限 ${MAX_BATCH},` +
        `${missing.length - batch.length} 条本轮按未判定处理`,
    )
  }

  try {
    const headers = await buildInternalCallHeaders({
      scope: 'model-catalog',
      extra: { 'Content-Type': 'application/json' },
    })
    if (!headers) {
      logger.warn('[account-pool] 模型代次判定跳过:内部票签发失败(号池照常显示)')
      return null
    }
    const res = await aiServiceFetch(null, '/internal/model-catalog/classify', {
      method: 'POST',
      headers,
      body: JSON.stringify({ models: batch }),
      timeoutMs: CALL_TIMEOUT_MS,
    })
    if (!res.ok) {
      logger.warn(`[account-pool] 模型代次判定失败 HTTP ${res.status}(号池照常显示)`)
      return null
    }
    const body = (await res.json()) as { items?: unknown }
    if (!Array.isArray(body.items)) {
      logger.warn('[account-pool] 模型代次判定响应缺 items(号池照常显示)')
      return null
    }
    for (const raw of body.items as ClassifyResponseItem[]) {
      if (!raw || typeof raw !== 'object') continue
      if (typeof raw.id !== 'string' || !raw.id) continue
      // provider 缺失时退回空串:仅当调用方传的就是空 provider 时能命中,
      // 其余按未判定(不猜归属,避免把一个平台的结论套到另一个平台)
      const provider = typeof raw.provider === 'string' ? raw.provider : ''
      const key = poolModelClassKey(provider, raw.id)
      // 只回填本轮真正问过的键:响应里出现陌生 id 时不写缓存
      if (!seen.has(key)) continue
      const value = toClass(raw)
      out.set(key, value)
      writeCache(key, value)
    }
    return out
  } catch (err) {
    logger.warn(
      `[account-pool] 模型代次判定异常(${err instanceof Error ? err.message : String(err)}),号池照常显示`,
    )
    return null
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
