import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { lookup } from 'node:dns/promises'
import { checkAuth } from '../plugins/auth.js'
import { success, parseOrThrow } from '../utils/response.js'

/**
 * BYOK 一键配置向导步骤 3:验证用户填的 API Key 是否有效。
 *
 * 调用上游厂商 API(OpenAI 兼容 / Anthropic Messages 格式)发轻量 ping 消息,
 * 根据 HTTP 状态码判断 Key 有效性。安全约束:不记录/不回显 apiKey。
 *
 * 响应始终 200 + { valid, message?, latencyMs? },Key 无效时 valid=false,
 * 让前端区分"Key 填错"(failed)与"端点故障"(unavailable)。
 */

type ApiFormat = 'openai_chat' | 'anthropic_messages'

interface ProviderConfig {
  baseUrl: string
  defaultModel: string
  apiFormat: ApiFormat
}

/** 厂商配置(与前端 byok-wizard.tsx PROVIDERS 对齐) */
const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    apiFormat: 'openai_chat',
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-3-5-sonnet-20241022',
    apiFormat: 'anthropic_messages',
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    apiFormat: 'openai_chat',
  },
  zhipu: {
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-flash',
    apiFormat: 'openai_chat',
  },
  stepfun: {
    baseUrl: 'https://api.stepfun.com/v1',
    defaultModel: 'step-1-flash',
    apiFormat: 'openai_chat',
  },
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.1-8b-instant',
    apiFormat: 'openai_chat',
  },
  siliconflow: {
    baseUrl: 'https://api.siliconflow.cn/v1',
    defaultModel: 'Qwen/Qwen2.5-7B-Instruct',
    apiFormat: 'openai_chat',
  },
  agnes: {
    baseUrl: 'https://api.agnes.ai/v1',
    defaultModel: 'agnes-chat',
    apiFormat: 'openai_chat',
  },
  cloudflare: {
    baseUrl: 'https://api.cloudflare.com/client/v4/accounts',
    defaultModel: '@cf/meta/llama-3.1-8b-instruct',
    apiFormat: 'openai_chat',
  },
  github: {
    baseUrl: 'https://models.inference.ai.azure.com',
    defaultModel: 'gpt-4o-mini',
    apiFormat: 'openai_chat',
  },
}

const UPSTREAM_TIMEOUT_MS = 10_000

const verifyKeySchema = z.object({
  providerCode: z.string().min(1, 'providerCode 不能为空'),
  apiKey: z.string().min(1, 'apiKey 不能为空'),
  apiBase: z.url().optional(),
  model: z.string().optional(),
})

interface VerifyResult {
  valid: boolean
  message?: string
  latencyMs?: number
  models?: string[]
}

function mapUpstreamError(status: number): string {
  switch (status) {
    case 401:
      return 'API Key 无效或已过期'
    case 403:
      return '权限不足,该 Key 无访问权限'
    case 404:
      return '端点不存在,请检查 apiBase 配置'
    case 429:
      return '请求过于频繁,请稍后再试'
    default:
      return `上游服务异常 (HTTP ${status})`
  }
}

/** 调用上游验证 apiKey(不记录 apiKey,只返回验证结果) */
async function verifyUpstream(params: {
  providerCode: string
  apiKey: string
  apiBase?: string
  model?: string
}): Promise<VerifyResult> {
  const cfg = PROVIDER_CONFIGS[params.providerCode]
  if (!cfg) {
    return { valid: false, message: `不支持的厂商: ${params.providerCode}` }
  }
  const baseUrl = params.apiBase ?? cfg.baseUrl
  // P1-9 SSRF 防护:用户可控 apiBase 必须 https + 纯 origin + DNS 解析后全部公网 IP
  // 仅对用户自定义 apiBase 做 SSRF 校验(默认 baseUrl 在 PROVIDER_CONFIGS 硬编码,受信任)
  if (params.apiBase) {
    try {
      await assertSafeApiBase(baseUrl)
    } catch (e) {
      return { valid: false, message: (e as Error).message }
    }
  }
  const testModel = params.model ?? cfg.defaultModel
  const start = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  try {
    const isAnthropic = cfg.apiFormat === 'anthropic_messages'
    const url = isAnthropic ? `${baseUrl}/v1/messages` : `${baseUrl}/chat/completions`
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (isAnthropic) {
      headers['x-api-key'] = params.apiKey
      headers['anthropic-version'] = '2023-06-01'
    } else {
      headers.authorization = `Bearer ${params.apiKey}`
    }
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: testModel,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
      signal: controller.signal,
      // P1-9 禁止跟随重定向(重定向目标未经过 SSRF 校验,可能指向内网)
      redirect: 'error',
    })
    const latencyMs = Date.now() - start
    if (res.ok) return { valid: true, latencyMs }
    return { valid: false, latencyMs, message: mapUpstreamError(res.status) }
  } catch (e) {
    const latencyMs = Date.now() - start
    if ((e as Error).name === 'AbortError') {
      return { valid: false, latencyMs, message: '验证超时,请检查网络或 apiBase 配置' }
    }
    return { valid: false, latencyMs, message: `验证失败: ${(e as Error).message}` }
  } finally {
    clearTimeout(timer)
  }
}

// =============================================================================
// P1-9 SSRF 防护:apiBase 校验(DNS 解析后全部公网 IP 才允许)
// =============================================================================

/** 判断 IPv4 是否为私网/保留地址(10/8、172.16/12、192.168/16、127/8、0/8、169.254/16、组播等) */
function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return true
  const a = parts[0]!
  const b = parts[1]!
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 169 && b === 254) return true // 含云元数据 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a >= 224) return true // 组播 224/4 + 保留
  return false
}

/**
 * 校验 apiBase 安全性:
 * 1. 必须是合法 URL;
 * 2. 必须 https;
 * 3. 必须纯 origin(无 path/query/hash/userinfo);
 * 4. 域名 DNS 解析后所有 A 记录必须为公网 IP(任一私网即拒绝)。
 *
 * @throws {Error} 任一条件不满足
 */
async function assertSafeApiBase(apiBase: string): Promise<void> {
  let u: URL
  try {
    u = new URL(apiBase)
  } catch {
    throw new Error('apiBase 不是合法 URL')
  }
  if (u.protocol !== 'https:') throw new Error('apiBase 必须使用 https 协议')
  if (u.username || u.password) throw new Error('apiBase 不能包含认证信息')
  if (u.pathname !== '' && u.pathname !== '/')
    throw new Error('apiBase 仅允许纯 origin,不能包含路径')
  if (u.search || u.hash) throw new Error('apiBase 不能包含 query 或 hash')
  const host = u.hostname
  if (host.includes(':')) throw new Error('apiBase 不支持 IPv6 目标')

  // IP 字面量:直接校验
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    if (isPrivateIpv4(host)) throw new Error('apiBase 不允许指向内网/保留地址')
    return
  }
  // 域名:DNS 解析全部 A 记录,任一为私网即拒绝(防 DNS rebinding / 内网探测)
  let addresses: { address: string }[]
  try {
    addresses = await lookup(host, { all: true })
  } catch {
    throw new Error('apiBase 域名无法解析')
  }
  if (addresses.length === 0) throw new Error('apiBase 域名无解析记录')
  for (const { address } of addresses) {
    if (isPrivateIpv4(address)) throw new Error('apiBase 解析到内网/保留地址,已拒绝')
  }
}

export const llmVerifyKeyRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
  })

  /** POST /verify-key — 验证用户填的 API Key 是否有效 */
  server.post('/verify-key', async (request, reply) => {
    const body = parseOrThrow(verifyKeySchema, request.body)
    const result = await verifyUpstream(body)
    return reply.send(success(result))
  })

  /** GET /verify-key/providers — 返回可验证的 provider 清单(前端展示用) */
  server.get('/verify-key/providers', async (_request, reply) => {
    const providers = Object.entries(PROVIDER_CONFIGS).map(([code, cfg]) => ({
      code,
      defaultModel: cfg.defaultModel,
      apiFormat: cfg.apiFormat,
    }))
    return reply.send(success({ providers }))
  })
}
