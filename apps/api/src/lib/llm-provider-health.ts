// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ai-service provider 健康度共享判定(2026-08-27 立,AGENTS.md §3 共享层优先)。
 *
 * 用途:所有"模型列表"端点(relay /v1/models、模型广场 /list、模型集市 /models、
 * 模型市场 /models/market 等)统一用本模块判定"硬不可用"模型,保证
 * 「模型列表只显示可用且有配额」铁律在 api 侧行为一致。
 *
 * 铁律判定(镜像 ai-service model_availability.is_model_available):
 *   - status = down / not_configured        → 硬不可用
 *   - status = degraded + error_type ∈ {payment_required, invalid_key, forbidden, rate_limited}
 *                                          → 硬不可用(明确错误)
 *   - 其他(healthy / degraded 无明确错误 / local / zero_cost / pending / 未知 / 未上报)
 *                                          → 可用(lenient)
 *   - health 拉取失败                    → 本轮未取到(known:false),不表态也不剔除
 *                                          (G-726 改:此前塌缩成"全部视为可用")
 */
import { aiServiceSystemFetch } from '../utils/ai-service-fetch.js'

export interface ProviderHealth {
  status: string
  error_type: string
}

/** provider_code -> {status, error_type} */
export type HealthMap = Map<string, ProviderHealth>

/**
 * 一轮健康度取数的结果(G-726 立,2026-09-29)。
 *
 * 立因:旧实现把三种完全不同的事实压成同一个值(空 Map)——
 *   ① 查询返回非 2xx        ② 网络/超时/解析失败        ③ 查询成功且确实有上报
 * ① 与 ② 落到空 Map,消费面按"空 Map = 宽松 = 可用"处理,于是"本轮根本没问到"
 * 与"这个 provider 是健康的"在数据面上同形(ProviderCardV2 那类把状态直出徽章的
 * 消费面就会显示"健康"而实际是查询失败)。
 *
 * 现在 `known` 是一个显式事实,与 `providers` 的内容无关:
 *   - `known: false` ⇒ 本轮未取到(可重试)。消费面**既不得显示健康、也不得判不可用**,
 *     只能显式"本轮未取到";列表剔除同样不生效(维持改动前的宽松行为,见下)。
 *   - `known: true`  且该 code 不在 `providers` 里 ⇒ 该 provider 未上报 ⇒ **维持改动前
 *     的宽松语义不变**(isProviderHardUnavailable 的 PENDING 分支),本票刻意不改严
 *     (改它会改变现网放行行为,属另票)。
 */
export interface ProviderHealthSnapshot {
  /** provider_code -> 健康度;`known:false` 时恒为空 Map */
  providers: HealthMap
  /** 本轮是否真的取到了健康数据(false = 查询本身失败:非 2xx / 网络 / 超时 / 解析失败) */
  known: boolean
}

/**
 * 消费面的三态判定(G-726):把"可用 / 不可用 / 本轮未取到"分开展达。
 * 不得再被折叠成 boolean —— 折叠正是本票要修的那一型。
 */
export type ProviderAvailability = 'available' | 'unavailable' | 'unknown'

/**
 * 拉取 ai-service provider 可用性。
 * GET ${config.AI_SERVICE_URL}/llm/providers/availability
 * 响应形如 { providers: [{ provider_code, status, error_type }] } 或 { code, data, message } 包裹。
 *
 * 失败(非 2xx / 网络 / 超时 / 解析失败)返回 `known:false` 的空快照:
 * 宽松保留全部列表项的行为与改动前一致,但消费面从此拿不到"可用"这个结论。
 */
export async function fetchProviderHealth(): Promise<ProviderHealthSnapshot> {
  const map: HealthMap = new Map()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  try {
    const resp = await aiServiceSystemFetch('/llm/providers/availability', {
      method: 'GET',
      signal: controller.signal,
    })
    // G-726① :非 2xx 是"没问到",不是"没问题"
    if (!resp.ok) return { providers: new Map(), known: false }
    const raw = (await resp.json()) as unknown
    let providers: Array<{ provider_code: string; status: string; error_type: string }> = []
    if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>
      const inner = obj.data && typeof obj.data === 'object' ? obj.data : obj
      const p = (inner as Record<string, unknown>).providers
      if (Array.isArray(p)) providers = p as typeof providers
    }
    for (const p of providers) {
      if (typeof p.provider_code === 'string') {
        map.set(p.provider_code, {
          status: typeof p.status === 'string' ? p.status : '',
          error_type: typeof p.error_type === 'string' ? p.error_type : '',
        })
      }
    }
    // 走到这里 = 2xx 且 JSON 解析成功 ⇒ 本轮确实取到了数据(哪怕 providers 是空数组,
    // 那也是"上游说没有任何 provider 上报",属 known 事实,不是查询失败)
    return { providers: map, known: true }
  } catch {
    // G-726② :网络/超时/解析失败 = 本轮未取到,不得读成"全部可用"
    return { providers: new Map(), known: false }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 硬不可用判定(与 ai-service model_availability.is_model_available 对齐)。
 *
 * ⚠️ 参数是 `HealthMap` 而不是快照,这是刻意的:本函数**只回答"上报数据里这个 code
 * 是不是硬不可用"**,它不知道本轮有没有取到数据。要拿"可用性结论"请用
 * {@link resolveProviderAvailability}(它会先问 `known`)。
 */
export function isProviderHardUnavailable(code: string | undefined, health: HealthMap): boolean {
  if (!code || !health.has(code)) return false // G-726③ :未上报 → 宽松(PENDING,行为保持不变)
  const h = health.get(code)!
  if (h.status === 'down' || h.status === 'not_configured') return true
  if (
    h.status === 'degraded' &&
    ['payment_required', 'invalid_key', 'forbidden', 'rate_limited'].includes(h.error_type)
  ) {
    return true
  }
  return false
}

/**
 * 消费面唯一的可用性判定出口(G-726 立)。
 *
 * 三态,不是 boolean:
 *   - `'unknown'`     —— 本轮未取到健康数据(`snapshot.known === false`)。
 *                        消费面**不得**据此显示健康,也不得据此判不可用,
 *                        只能显式"本轮未取到(可重试)";列表剔除同样不生效。
 *   - `'unavailable'` —— 本轮取到了,且该 code 上报为硬不可用。
 *   - `'available'`   —— 本轮取到了,且该 code 未被判硬不可用。
 *                        含"取到了但该 code 没上报"这一档:维持 isProviderHardUnavailable
 *                        的既有宽松语义(注释里的 PENDING),本票刻意不改严。
 *
 * 旧消费面拿不到第一档 —— 那正是"查不到被当成可用"的成因,所以判定住在这里,
 * 不在各调用点重写一遍(两处算同一件事必漂移)。
 */
export function resolveProviderAvailability(
  code: string | undefined,
  snapshot: ProviderHealthSnapshot,
): ProviderAvailability {
  if (!snapshot.known) return 'unknown'
  return isProviderHardUnavailable(code, snapshot.providers) ? 'unavailable' : 'available'
}

/** 由 modelCode/code/name 推断 provider_code(best-effort 前缀/关键词映射) */
export const PROVIDER_PREFIX_MAP: Array<[string, string]> = [
  ['stepfun/', 'stepfun'],
  ['agnes/', 'agnes'],
  ['openrouter/', 'openrouter'],
  ['anthropic/', 'anthropic'],
  ['openai/', 'openai'],
  ['groq/', 'groq'],
  ['nvidia/', 'nvidia_nim'],
  ['siliconcloud/', 'siliconflow'],
  ['siliconflow/', 'siliconflow'],
  ['bailian/', 'bailian'],
  ['gpt-', 'openai'],
  ['claude-', 'anthropic'],
  ['gemini-', 'gemini'],
  ['glm-', 'zhipu'],
  ['deepseek', 'deepseek'],
  ['qwen', 'qwen'],
  ['kimi', 'kimi'],
  ['doubao', 'doubao'],
  ['hunyuan', 'hunyuan'],
  ['moonshot', 'moonshot'],
  ['zhipu', 'zhipu'],
]

export function inferProviderCode(
  modelCode: string | null,
  code: string | null,
  name: string,
): string | undefined {
  const id = (modelCode ?? code ?? name ?? '').toLowerCase()
  if (!id) return undefined
  for (const [prefix, provider] of PROVIDER_PREFIX_MAP) {
    if (id.startsWith(prefix) || id.includes(prefix.replace('/', ''))) return provider
  }
  return undefined
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
