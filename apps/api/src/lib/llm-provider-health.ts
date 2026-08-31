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
 *   - health 拉取失败返回空 Map            → 全部视为可用(lenient,不因瞬时抖动清空列表)
 */
import { config } from '../config/index.js'

export interface ProviderHealth {
  status: string
  error_type: string
}

/** provider_code -> {status, error_type};空 Map = 健康度获取失败(宽松,视为全部可用) */
export type HealthMap = Map<string, ProviderHealth>

/**
 * 拉取 ai-service provider 可用性。
 * GET ${config.AI_SERVICE_URL}/llm/providers/availability
 * 响应形如 { providers: [{ provider_code, status, error_type }] } 或 { code, data, message } 包裹。
 * 任何失败返回空 Map(宽松:不因此清空列表)。
 */
export async function fetchProviderHealth(): Promise<HealthMap> {
  const map: HealthMap = new Map()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  try {
    const resp = await fetch(`${config.AI_SERVICE_URL}/llm/providers/availability`, {
      method: 'GET',
      signal: controller.signal,
    })
    if (!resp.ok) return map
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
  } catch {
    // 网络/超时/解析失败:返回空 Map(全部视为可用)
  } finally {
    clearTimeout(timer)
  }
  return map
}

/** 硬不可用判定(与 ai-service model_availability.is_model_available 对齐) */
export function isProviderHardUnavailable(
  code: string | undefined,
  health: HealthMap,
): boolean {
  if (!code || !health.has(code)) return false // 未知/未上报 → 宽松(PENDING)
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
