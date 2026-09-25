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
import {
  createEgressFacts,
  type EgressCaState,
  type EgressFacts,
  type EgressNoProxyVarName,
  type EgressPolicyDeclineReason,
  EGRESS_ENV_PROXY_VAR_NAMES,
  EGRESS_NO_PROXY_VAR_NAMES,
} from '@ihui/types'

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

/** 配置的代理地址(只看有没有配、配得对不对,**永不**把值带进返回值)。*/
function proxyUrlConfigured(): boolean {
  const raw = (process.env.PROXY_URL ?? '').trim()
  return raw.startsWith('http://') || raw.startsWith('https://')
}

/** 内网/本机地址永不走代理(与 `collectEgressFacts` 共用,免得两处判据漂移)。*/
function isInternalHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.local') ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  )
}

/** 取代理 Agent 单例(未配置 PROXY_URL 返回 null) */
function getProxyAgent(): ProxyAgent | null {
  const url = (process.env.PROXY_URL ?? '').trim()
  if (!proxyUrlConfigured()) return null
  if (!cachedAgent || cachedAgentUrl !== url) {
    cachedAgent?.close().catch(() => {})
    cachedAgent = new ProxyAgent(url)
    cachedAgentUrl = url
  }
  return cachedAgent
}

/**
 * NO_PROXY 命中判定:`*` 全匹配,其余按后缀匹配(与白名单同一套形状,不引入第三种语义)。
 * 只读"存在哪个变量名 + 是否命中",取值不外带。
 */
function readNoProxy(hostname: string): { matched: boolean; varName: EgressNoProxyVarName | null } {
  for (const name of EGRESS_NO_PROXY_VAR_NAMES) {
    const raw = process.env[name]
    if (raw === undefined || raw.trim() === '') continue
    const entries = raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
    if (entries.includes('*')) return { matched: true, varName: name }
    if (entries.some((d) => hostname === d || hostname.endsWith(`.${d.replace(/^\./, '')}`)))
      return { matched: true, varName: name }
    // 配了 NO_PROXY 但没命中:名字仍是事实,继续找另一个大小写档位
    return { matched: false, varName: name }
  }
  return { matched: false, varName: null }
}

function readCustomCa(): EgressCaState {
  if ((process.env.NODE_EXTRA_CA_CERTS ?? '').trim()) return 'node-extra-ca-certs'
  if ((process.env.NODE_TLS_CA_CERTS ?? '').trim()) return 'node-tls-ca-certs'
  return 'none'
}

/**
 * **这一趟请求实际生效的出口配置** —— 从实际生效的配置读,不从日志读。
 *
 * 为什么在这里算而不是在调用方算:代理走不走由本模块的白名单/内网判据决定,别处再算一遍
 * 就是第二份真相(两判据必须同形的教训见守门 96/修复器)。
 *
 * 与 `isProxiedUrl` 的关系:本函数是**唯一的判据实现**,`isProxiedUrl` 只是它的一个投影
 * (取 `.proxied`)。改动判据只需改这一处,决策与事实不可能漂移。
 */
export function collectEgressFacts(url: string): EgressFacts {
  let hostname = ''
  try {
    hostname = new URL(url).hostname.toLowerCase()
  } catch {
    hostname = ''
  }
  const parseable = hostname !== ''
  const configured = proxyUrlConfigured()
  const internal = parseable && isInternalHostname(hostname)
  const raw = (process.env.PROXY_DOMAINS ?? '').trim()
  const tableOrigin = raw ? ('env-override' as const) : ('builtin-default' as const)
  const domains = raw
    ? raw
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    : DEFAULT_PROXY_DOMAINS
  const allowlisted = parseable && matchProxyDomains(hostname, domains)
  const noProxy = parseable ? readNoProxy(hostname) : { matched: false, varName: null }
  // 判据与改造前的 isProxiedUrl 逐条件等值:**不**把 NO_PROXY 纳进决策。
  // 现状是"NO_PROXY 在本模块无人读取、配了也不生效",本票只负责把这个事实**带回来**
  // (proxied=true ∧ noProxyMatched=true 是合法且高度可诊断的一对),不负责改路由 ——
  // 改路由会动所有厂商调用的出口路径,属另一张票(见文件末 EGRESS-NO-PROXY-GAP 登记)。
  const proxied = configured && parseable && !internal && allowlisted

  let policyDeclined: EgressPolicyDeclineReason | null = null
  if (!proxied) {
    if (!parseable) policyDeclined = 'url-unparseable'
    else if (!configured) policyDeclined = 'proxy-unconfigured'
    else if (internal) policyDeclined = 'internal-host'
    else policyDeclined = 'domain-not-in-table'
  }

  const envProxyVars = EGRESS_ENV_PROXY_VAR_NAMES.filter((name) => {
    const v = process.env[name]
    return v !== undefined && v.trim() !== ''
  })

  return createEgressFacts({
    targetHostname: parseable ? hostname : null,
    urlParseable: parseable,
    proxied,
    proxySource: configured ? 'app-env-var' : 'none',
    proxyConfigVar: configured ? 'PROXY_URL' : null,
    proxyDomainTable: parseable ? tableOrigin : 'not-evaluated',
    proxyAppliedVia: proxied ? 'proxy-agent' : 'no-explicit-dispatcher',
    envProxyVars,
    noProxyMatched: noProxy.matched,
    noProxyVar: noProxy.varName,
    customCa: readCustomCa(),
    policyDeclined,
  })
}

/**
 * 按 URL 判定是否走代理:命中白名单且已配置代理 → true。
 * 内网/本机地址永不走代理。
 *
 * 2026-09-26 起本函数是 `collectEgressFacts().proxied` 的投影 —— 决策与事实共用一份判据,
 * 不可能漂移。判据本身**逐条等值于改造前**(见 collectEgressFacts 内的注释)。
 */
export function isProxiedUrl(url: string): boolean {
  return collectEgressFacts(url).proxied
}

/** `egress` 挂成**不可枚举**属性:不进 `Object.keys` / JSON,免得被顺带序列化出去。*/
const EGRESS_PROP = 'egress'

/**
 * 把出口事实挂到响应对象上(吸收来的形状:事实挂在响应上,不是挂在日志里)。
 *
 * 只做一件事:定义一个不可枚举、可 configurable 的属性。**不**包装响应、**不**改状态码、
 * **不**新增失败模式 —— 取不到事实的调用方按 `readEgressFacts` 返回 null 处理,不影响响应本身。
 * 副作用:`res.clone()` 出来的副本不带该属性(它是对象上的附加字段,不是 HTTP 语义的一部分)。
 */
export function attachEgressFacts<T extends object>(response: T, facts: EgressFacts): T {
  Object.defineProperty(response, EGRESS_PROP, {
    value: facts,
    enumerable: false,
    configurable: true,
    writable: false,
  })
  return response
}

/** 读回一趟响应的出口事实;没有挂过 → null(调用方据此判"未知",不得当成"没走代理")。*/
export function readEgressFacts(response: unknown): EgressFacts | null {
  if (typeof response !== 'object' || response === null) return null
  const value = (response as Record<string, unknown>)[EGRESS_PROP]
  return typeof value === 'object' && value !== null ? (value as EgressFacts) : null
}

/**
 * 走代理的 fetch(必须用 npm undici 包自身的 fetch,不能用 Node 内置全局 fetch——
 * 内置 fetch 是 Node 自带 undici 的独立实例,与 npm undici 的 ProxyAgent
 * Dispatcher 实例不互通,传入会被静默忽略导致直连)。
 */
export async function proxiedFetch(
  url: string,
  options: {
    method?: string
    headers?: Record<string, string>
    body?: string
    signal?: AbortSignal
  },
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
