// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​​​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​​‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍‌​​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​​‌‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​‌​‌‍‍​​‌​​‌‌​‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 配置级 LLM 连通测试(单一出口)。
 *
 * 关键口径(2026-11-27):
 *  - 必须使用**目标配置行自己的** baseUrl / apiKey / apiFormat / model,不能走
 *    ai-service 的系统身份或按 provider_code 取第一行配置。否则 admin 批量测试
 *    会拿 A 配置的结果写进 B 配置的 lastTestStatus。
 *  - 只做一次最小请求(OpenAI chat / Responses / Anthropic messages),不写业务额度。
 *  - 配置缺失返回明确 code,由路由层决定 4xx/状态回写,不伪装成上游故障。
 */
import { safeFetch } from '../utils/ssrf-guard.js'
import { decryptJSON, isEncryptedPayload } from '../utils/crypto.js'
import { ProxyAgent } from 'undici'

/** 连接上游测试的超时(与 llm-verify-key 的上游探测同档) */
const CONNECTIVITY_TIMEOUT_MS = 10_000

let llmProxyAgent: ProxyAgent | null | undefined

/**
 * LLM 出站代理(2026-11-27):境外 provider 直连超时,但配置自己的 Key 已可用。
 * 只对非回环目标生效;未配置 LLM_PROXY_URL 时回退 SYNC_PROXY_URL,再回退直连。
 */
function getLlmProxyDispatcher(url: string): ProxyAgent | undefined {
  const proxyUrl = (process.env.LLM_PROXY_URL || process.env.SYNC_PROXY_URL || '').trim()
  if (!proxyUrl) return undefined
  try {
    const host = new URL(url).hostname
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return undefined
  } catch {
    return undefined
  }
  if (llmProxyAgent === undefined) {
    try {
      llmProxyAgent = new ProxyAgent(proxyUrl)
    } catch {
      llmProxyAgent = null
    }
  }
  return llmProxyAgent ?? undefined
}

export interface LlmConnectivityTarget {
  baseUrl: string
  apiKeyEnc: string | null
  providerCode: string
  apiFormat: string | null
  /** 首选测试模型(通常 modelIdForTest);为空时回退 fallbackModelId */
  modelId: string | null
  fallbackModelId?: string | null
}

export interface LlmConnectivityResult {
  ok: boolean
  status: 'success' | 'failed'
  responseMs?: number
  error?: string
  /** 配置缺失(非上游故障):路由层据此回 4xx,而不是把配置问题报成 502 */
  code?: 'MISSING_API_KEY' | 'MISSING_BASE_URL' | 'MISSING_MODEL'
  modelEcho?: string
}

interface ConnectivityProbe {
  url: string
  headers: Record<string, string>
  body: Record<string, unknown>
}

/** 加密载荷解密;历史明文行原样返回(与 user-llm-configs-v2 同口径)。 */
export function getDecryptedApiKey(row: { apiKeyEnc: string | null }): string | null {
  if (!row.apiKeyEnc) return null
  try {
    const payload = JSON.parse(row.apiKeyEnc) as unknown
    if (isEncryptedPayload(payload)) {
      return String(decryptJSON(payload))
    }
    return row.apiKeyEnc
  } catch {
    return row.apiKeyEnc
  }
}

/** 上游 4xx/5xx → 用户可读原因(不回显响应体,避免把上游回显内容带到前端) */
export function describeUpstreamFailure(status: number): string {
  switch (status) {
    case 401:
      return 'API Key 无效或已过期'
    case 403:
      return '权限不足,该 Key 无访问权限'
    case 404:
      return '端点不存在,请检查 Base URL 与模型 ID'
    case 429:
      return '请求过于频繁,请稍后再试'
    default:
      return `上游服务异常 (HTTP ${status})`
  }
}

export function buildConnectivityProbe(params: {
  baseUrl: string
  apiKey: string
  apiFormat: string | null
  modelId: string
}): ConnectivityProbe {
  const base = params.baseUrl.replace(/\/+$/, '')
  if (params.apiFormat === 'anthropic_messages') {
    // Anthropic 的 base_url 常写成 .../v1,不能再拼一次 /v1。
    const v1Base = /\/v1$/i.test(base) ? base : `${base}/v1`
    return {
      url: `${v1Base}/messages`,
      headers: {
        'content-type': 'application/json',
        'x-api-key': params.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: { model: params.modelId, max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] },
    }
  }
  if (params.apiFormat === 'openai_responses') {
    return {
      url: `${base}/responses`,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${params.apiKey}`,
      },
      body: { model: params.modelId, max_output_tokens: 16, input: 'ping' },
    }
  }
  return {
    url: `${base}/chat/completions`,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${params.apiKey}`,
    },
    body: { model: params.modelId, max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] },
  }
}

/**
 * 用目标配置自己的 Key/BaseUrl 向上游发一次最小对话,记录耗时。
 */
export async function testLlmConnectivity(
  target: LlmConnectivityTarget,
): Promise<LlmConnectivityResult> {
  const apiKey = getDecryptedApiKey({ apiKeyEnc: target.apiKeyEnc })
  if (!apiKey) {
    return {
      ok: false,
      status: 'failed',
      code: 'MISSING_API_KEY',
      error: 'API Key 未配置或解密失败,无法使用该配置做连通性测试',
    }
  }
  if (!target.baseUrl) {
    return { ok: false, status: 'failed', code: 'MISSING_BASE_URL', error: 'Base URL 未配置' }
  }
  const modelId = target.modelId || target.fallbackModelId || ''
  if (!modelId) {
    return {
      ok: false,
      status: 'failed',
      code: 'MISSING_MODEL',
      error: '未指定测试模型 ID,无法进行连通性测试',
    }
  }
  const start = Date.now()
  try {
    const probe = buildConnectivityProbe({
      baseUrl: target.baseUrl,
      apiKey,
      apiFormat: target.apiFormat,
      modelId,
    })
    const resp = await safeFetch(
      probe.url,
      {
        method: 'POST',
        headers: probe.headers,
        body: JSON.stringify(probe.body),
        signal: AbortSignal.timeout(CONNECTIVITY_TIMEOUT_MS),
      },
      { dispatcher: getLlmProxyDispatcher(probe.url) },
    )
    const elapsed = Date.now() - start
    if (!resp.ok) {
      return {
        ok: false,
        status: 'failed',
        responseMs: elapsed,
        error: describeUpstreamFailure(resp.status),
      }
    }
    const json = (await resp.json().catch(() => ({}))) as Record<string, unknown>
    return {
      ok: true,
      status: 'success',
      responseMs: elapsed,
      modelEcho: String(json.model ?? modelId),
    }
  } catch (e) {
    const err = e as Error
    const timedOut = err.name === 'AbortError' || err.name === 'TimeoutError'
    return {
      ok: false,
      status: 'failed',
      responseMs: Date.now() - start,
      error: timedOut ? '连通测试超时,请检查 Base URL 或网络' : err.message,
    }
  }
}
