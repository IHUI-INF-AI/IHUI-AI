// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 厂商出站 HTTP 代理调度(2026-09-20)。
 *
 * 背景:OpenAI/Gemini/Groq 等官方域名在国内网络直连被墙,
 * 本模块让 fetchWithTimeout 对命中白名单的域名走 HTTP 代理,其余请求保持直连。
 *
 * 环境变量(.env):
 *   PROXY_URL      代理地址,如 http://127.0.0.1:7897(Clash Verge 混合端口);留空 = 不启用
 *   PROXY_DOMAINS  走代理的域名白名单(逗号分隔);未配置时用内置默认表
 *
 * 注意:仅支持 HTTP/HTTPS 代理(undici ProxyAgent CONNECT 隧道),
 *       SOCKS 代理地址(socks://)不支持,请用代理软件的 HTTP 混合端口。
 */
import { ProxyAgent, fetch as undiciFetch } from 'undici'

/** 内置默认白名单:被墙的 AI 厂商官方域名(可经 PROXY_DOMAINS 覆盖) */
const DEFAULT_PROXY_DOMAINS = [
  'api.openai.com',
  'generativelanguage.googleapis.com',
  'api.groq.com',
  'api.anthropic.com',
  'api.x.ai',
  'api.mistral.ai',
  'api.cohere.com',
  'api.together.xyz',
  'api.fireworks.ai',
  'api.perplexity.ai',
  'integrate.api.nvidia.com',
  'openrouter.ai',
]

let cachedAgent: ProxyAgent | null = null
let cachedAgentUrl = ''

/** 域名是否命中代理白名单(后缀匹配,如 googleapis.com 覆盖其子域) */
function matchProxyDomains(hostname: string, domains: string[]): boolean {
  return domains.some((d) => hostname === d || hostname.endsWith(`.${d}`))
}

/** 取代理 Agent 单例(未配置 PROXY_URL 返回 null) */
function getProxyAgent(): ProxyAgent | null {
  const url = (process.env.PROXY_URL ?? '').trim()
  if (!url || !(url.startsWith('http://') || url.startsWith('https://'))) return null
  if (!cachedAgent || cachedAgentUrl !== url) {
    cachedAgent?.close().catch(() => {})
    cachedAgent = new ProxyAgent(url)
    cachedAgentUrl = url
  }
  return cachedAgent
}

/**
 * 按 URL 判定是否走代理:命中白名单且已配置代理 → true。
 * 内网/本机地址永不走代理。
 */
export function isProxiedUrl(url: string): boolean {
  if (!getProxyAgent()) return false
  let hostname = ''
  try {
    hostname = new URL(url).hostname
  } catch {
    return false
  }
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.local') ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  )
    return false
  const raw = (process.env.PROXY_DOMAINS ?? '').trim()
  const domains = raw ? raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) : DEFAULT_PROXY_DOMAINS
  return matchProxyDomains(hostname, domains)
}

/**
 * 走代理的 fetch(必须用 npm undici 包自身的 fetch,不能用 Node 内置全局 fetch——
 * 内置 fetch 是 Node 自带 undici 的独立实例,与 npm undici 的 ProxyAgent
 * Dispatcher 实例不互通,传入会被静默忽略导致直连)。
 */
export async function proxiedFetch(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal },
): Promise<Response> {
  const agent = getProxyAgent()
  if (!agent) throw new Error('代理未配置(PROXY_URL)')
  const resp = await undiciFetch(url, {
    method: options.method ?? 'GET',
    headers: options.headers as Record<string, string> | undefined,
    body: (options.body ?? undefined) as string | undefined,
    signal: options.signal,
    dispatcher: agent,
  } as never)
  return resp as unknown as Response
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
