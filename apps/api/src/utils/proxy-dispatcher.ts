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

/** 有界链的末跳事实(G-750):同样不可枚举,挂在**最终**响应对象上。*/
const EGRESS_HOPS_PROP = 'egressHops'

/** 一趟有界链走完后的末跳事实(`readEgressHops` 的读面)。*/
export interface EgressHops {
  /** 末跳 hostname(小写,不含端口/路径/userinfo);末跳 URL 解析失败为 null。*/
  readonly finalHostname: string | null
  /** 实际发生的重定向跳数(0 = 一跳未跟)。*/
  readonly redirectCount: number
}

/** 把末跳事实挂到响应上(G-750):有界主循环的**唯一**两个落点都经这里,不散抄。*/
function attachEgressHops<T extends object>(response: T, hops: EgressHops): T {
  Object.defineProperty(response, EGRESS_HOPS_PROP, {
    value: Object.freeze({ ...hops }),
    enumerable: false,
    configurable: true,
    writable: false,
  })
  return response
}

/** 读回一趟响应的末跳事实;没经历过有界链 → null(调用方不得把 null 读成 0 跳)。*/
export function readEgressHops(response: unknown): EgressHops | null {
  if (typeof response !== 'object' || response === null) return null
  const value = (response as Record<string, unknown>)[EGRESS_HOPS_PROP]
  return typeof value === 'object' && value !== null ? (value as EgressHops) : null
}

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
 * ── 有界重定向 / 响应字节上限 / 超时(G-736,2026-09-27)─────────────────────────
 *
 * 机制出处:上游 ZCode v3.14.3 `marketplace.ts:447-494` —— 它**手动**跟随重定向,并在
 * `redirectUrl.origin !== currentUrl.origin` 时把 header 整份置 undefined,注释(:476-480)写着
 * 理由:市场自定义 header 可能含凭据,绝不能经重定向转交给第三方 CDN。
 *
 * 为什么我方需要同一件事:改造前本模块把重定向整个交给 undici 的 `redirect:'follow'` 默认档 ——
 * 上游 20 跳上限、`Authorization` 与调用方自定义头**逐跳原样带过去**(undici 只按 fetch 标准剥
 * `Cookie`/`Authorization` 中跨 origin 的一部分,自定义头如 `x-goog-api-key`、厂商 key header
 * 一律照发)。于是"厂商域名 302 到某个 CDN"这条链上,凭据是被我们的出口主动送出去的。
 *
 * 三条上限全部**默认有界、构造参数可覆盖、覆盖本身也有界**(见 resolveLimit 的 ceiling):
 * 一个能传 `Infinity` 的"上限"不是限制,而是把这道防线交回调用方手里。
 */

/** 默认跳数上限(上游取 5,保守档照抄)。*/
export const EGRESS_MAX_REDIRECTS = 5
/** 默认响应字节上限(上游 10MB)。*/
export const EGRESS_MAX_RESPONSE_BYTES = 10 * 1024 * 1024
/**
 * 默认超时(上游 180s)。语义:**整条重定向链共用一份预算**,不是逐跳重置 ——
 * 逐跳重置等于让"跳数上限 × 超时"成为最坏挂起时长,那已不是超时而是建议。
 */
export const EGRESS_TIMEOUT_MS = 180_000

/** 覆盖档的天花板:超过它一律拒(见文件上方说明)。*/
const REDIRECTS_CEILING = 20
const RESPONSE_BYTES_CEILING = 512 * 1024 * 1024
const TIMEOUT_CEILING_MS = 15 * 60_000

/** 按 fetch 标准需要跟随的重定向状态(304/305/306 刻意不在内:前者的 Location 是缓存语义,后两方已废弃)。*/
const REDIRECT_STATUSES: ReadonlySet<number> = new Set([301, 302, 303, 307, 308])

/** 三条上限的类别:错误必须自述"撞的是哪一道",不得只写"超限"。*/
export type EgressLimitKind = 'redirects' | 'bytes' | 'timeout'

/**
 * 触限错误(稳定类型,不是文案)。
 *
 * 为什么不用裸 Error:本仓规矩「不依赖错误文本做流程判断」—— 调用方要区分"这次是跳数打满"
 * 与"上游真挂了",得读 `kind` 而不是 match 字符串。
 */
export class EgressLimitError extends Error {
  readonly kind: EgressLimitKind
  /** 触发的上限值(点名进错误对象,免得只有 message 可读)。*/
  readonly limit: number
  /** 触发时的观测值(跳数 / 已收字节 / 已等毫秒)。*/
  readonly observed: number
  /** 目标 hostname(只带 host,不带路径/query —— 凭据卫生同 `EgressFacts`)。*/
  readonly hostname: string

  constructor(init: {
    kind: EgressLimitKind
    limit: number
    observed: number
    hostname: string
    message: string
  }) {
    super(init.message)
    this.name = 'EgressLimitError'
    this.kind = init.kind
    this.limit = init.limit
    this.observed = init.observed
    this.hostname = init.hostname
  }
}

/** 取 hostname(解析不到返回 `'<unparseable>'`,不抛 —— 抛在这里会把一个判据问题伪装成网络错)。*/
function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return '<unparseable>'
  }
}

/** 取 origin(解析不到返回 null)。用 `URL.origin` 而不是字符串前缀匹配:端口/协议/大小写都在 origin 的语义里。*/
function originOf(url: string): string | null {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

/**
 * 跨 origin 判据(**剥头**这一维的唯一实现)。
 *
 * 解析不出来的 URL 一律判 true(失败闭合):判不出"是不是同一个 origin"时,
 * 保守动作是**不发凭据**,而不是"大概同源吧"照发。
 */
export function crossesEgressOrigin(fromUrl: string, toUrl: string): boolean {
  const from = originOf(fromUrl)
  const to = originOf(toUrl)
  if (from === null || to === null) return true
  return from !== to
}

/**
 * 上限解析:undefined → 默认档;其余必须是 `[min, ceiling] 内的有限整数**。
 * 非法值直接 RangeError(而不是静默取默认):静默兜底会让人以为自己的覆盖生效了。
 */
function resolveLimit(
  raw: number | undefined,
  fallback: number,
  min: number,
  ceiling: number,
  name: string,
): number {
  const value = raw === undefined ? fallback : raw
  if (!Number.isInteger(value) || value < min || value > ceiling) {
    throw new RangeError(
      `出口限制参数 ${name} 非法:${String(value)}(须为 ${min}..${ceiling} 之间的有限整数;NaN/负数/Infinity 不接受 —— 那不是"更严",而是取消这道防线)`,
    )
  }
  return value
}

/** 交给传输层的单次请求描述(`redirect` 恒为 manual —— 跟随由本模块做,不由传输层做)。*/
export interface EgressRequestInit {
  readonly method: string
  /** undefined = 本跳不携带任何自定义头(跨 origin 剥头的落点)。*/
  readonly headers?: Record<string, string>
  readonly body?: string
  readonly redirect: 'manual'
  readonly signal?: AbortSignal
}

/**
 * 传输层注入缝。生产传的是"undici fetch + 代理 dispatcher"(见 `proxiedFetch`);
 * 测试传假实现以逐跳断言 header 集合。
 *
 * 它**不是**第二条 fetch 分支:重定向环、剥头判据、三条上限都在 `boundedEgressFetch` 里,
 * 测试跑的就是生产那一遍判据 —— 换的只是"把字节发出去"那一步。
 */
export type EgressTransport = (url: string, init: EgressRequestInit) => Promise<Response>

export interface BoundedEgressOptions {
  method?: string
  headers?: Record<string, string>
  body?: string
  signal?: AbortSignal
  maxRedirects?: number
  maxResponseBytes?: number
  timeoutMs?: number
  transport: EgressTransport
}

/** SSE 流式响应不套字节上限的理由写在函数里;判据只认 content-type 的 event-stream 段。*/
function isEventStreamResponse(res: Response): boolean {
  return (res.headers.get('content-type') ?? '').includes('text/event-stream')
}

/**
 * 响应字节上限:先读 `Content-Length` 早拒(不必把整个响应拖到对端发完),
 * 没有可信长度时**包一层计数流**,超限即 error 该流 —— 绝不静默截断成短响应
 * (本仓最高频失效型是"把没做完写成做完了",截断正是它的形态)。
 *
 * 刻意放过 `text/event-stream`:厂商流式对话(proxy-tools 等)走同一个出口,SSE 会话累积
 * 可以远超 10MB;对这种响应套硬上限会把在跑的长对话掐断,那是功能事故而不是防线。
 * 剩余敞口如实登记:上游自称 event-stream 即可绕开字节上限(此时仍有跳数与超时两档兜着)。
 */
function enforceResponseByteCap(res: Response, cap: number, url: string): Response {
  const hostname = hostnameOf(url)
  if (isEventStreamResponse(res)) return res

  const declared = Number(res.headers.get('content-length') ?? '')
  if (Number.isFinite(declared) && declared > cap) {
    throw new EgressLimitError({
      kind: 'bytes',
      limit: cap,
      observed: declared,
      hostname,
      message: `响应字节上限 maxResponseBytes=${cap} 被 Content-Length=${declared} 直接超出,目标 ${hostname}`,
    })
  }

  const body = res.body
  if (!body) return res

  let received = 0
  const reader = body.getReader()
  const counted = new ReadableStream<Uint8Array>({
    async pull(stream) {
      const chunk = await reader.read()
      if (chunk.done) {
        stream.close()
        return
      }
      received += chunk.value.byteLength
      if (received > cap) {
        await reader.cancel().catch(() => {})
        stream.error(
          new EgressLimitError({
            kind: 'bytes',
            limit: cap,
            observed: received,
            hostname,
            message: `响应字节上限 maxResponseBytes=${cap} 超出(已收 ${received} B),目标 ${hostname}`,
          }),
        )
        return
      }
      stream.enqueue(chunk.value)
    },
    async cancel(reason) {
      await reader.cancel(reason).catch(() => {})
    },
  })
  return new Response(counted, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  })
}

/** 中间跳的响应体必须排空/取消,否则连接不归还,链一长就堆 socket。*/
async function discardBody(res: Response): Promise<void> {
  try {
    await res.body?.cancel()
  } catch {
    // 取消失败不影响下一步判定(连接已由对端关闭时这里会抛)
  }
}

/** 按 fetch 标准做重定向的方法/正文降级:303 与 301|302 的 POST 转 GET 且不带正文。*/
function downgradeForRedirect(
  status: number,
  method: string,
): { method: string; dropBody: boolean } {
  if (status === 303) return { method: 'GET', dropBody: true }
  if ((status === 301 || status === 302) && method === 'POST') return { method: 'GET', dropBody: true }
  return { method, dropBody: false }
}

/**
 * 有界重定向主循环:**唯一**实现"跳数上限 + 跨 origin 剥自定义头 + 响应字节上限 + 超时"的地方。
 *
 * `proxiedFetch` 用它并接代理 dispatcher;直连分支若将来也要这一层,必须调**这同一个函数**
 * (换 transport 即可),不得再抄一遍循环 —— 两处循环必然在剥头判据上漂移。
 */
export async function boundedEgressFetch(url: string, options: BoundedEgressOptions): Promise<Response> {
  const maxRedirects = resolveLimit(options.maxRedirects, EGRESS_MAX_REDIRECTS, 0, REDIRECTS_CEILING, 'maxRedirects')
  const maxResponseBytes = resolveLimit(
    options.maxResponseBytes,
    EGRESS_MAX_RESPONSE_BYTES,
    1,
    RESPONSE_BYTES_CEILING,
    'maxResponseBytes',
  )
  const timeoutMs = resolveLimit(options.timeoutMs, EGRESS_TIMEOUT_MS, 1, TIMEOUT_CEILING_MS, 'timeoutMs')

  // 本模块自己的 controller:超时由它触发;调用方的 signal(若有)转发进来。
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const callerSignal = options.signal
  const forwardCallerAbort = () => controller.abort(callerSignal?.reason)
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort(callerSignal.reason)
    else callerSignal.addEventListener('abort', forwardCallerAbort, { once: true })
  }

  try {
    let currentUrl = url
    // 自定义头只在**同 origin 的跳**上存活;跨 origin 一律整份丢弃(见 crossesEgressOrigin)。
    let currentHeaders: Record<string, string> | undefined = options.headers
      ? { ...options.headers }
      : undefined
    let method = (options.method ?? 'GET').toUpperCase()
    let body: string | undefined = options.body
    let hops = 0

    for (;;) {
      const res = await options.transport(currentUrl, {
        method,
        headers: currentHeaders,
        body,
        redirect: 'manual',
        signal: controller.signal,
      })

      const location = REDIRECT_STATUSES.has(res.status) ? res.headers.get('location') : null
      if (location === null || location === '') {
        // 不是重定向,或 3xx 却给不出 Location:后者**不猜**(不自己拼、不当成已跟随),
        // 原样把这一跳交给调用方,由它按状态码判失败。
        return attachEgressHops(enforceResponseByteCap(res, maxResponseBytes, currentUrl), {
          finalHostname: hostnameOf(currentUrl),
          redirectCount: hops,
        })
      }

      let nextUrl: string
      try {
        nextUrl = new URL(location, currentUrl).toString()
      } catch {
        return attachEgressHops(enforceResponseByteCap(res, maxResponseBytes, currentUrl), {
          finalHostname: hostnameOf(currentUrl),
          redirectCount: hops,
        })
      }

      await discardBody(res)
      hops += 1
      if (hops > maxRedirects) {
        throw new EgressLimitError({
          kind: 'redirects',
          limit: maxRedirects,
          observed: hops,
          hostname: hostnameOf(nextUrl),
          message: `重定向跳数上限 maxRedirects=${maxRedirects} 超出(第 ${hops} 跳指向 ${hostnameOf(nextUrl)}),起始 ${hostnameOf(url)}`,
        })
      }

      if (crossesEgressOrigin(currentUrl, nextUrl)) {
        // 跨 origin:**整份**丢弃自定义头(Authorization、厂商 key header、调用方塞的任何头),
        // 只保留下面重定向必需的 method/body 转发 —— 凭据不过境给第三方域。
        currentHeaders = undefined
      }
      const downgraded = downgradeForRedirect(res.status, method)
      method = downgraded.method
      if (downgraded.dropBody) body = undefined
      currentUrl = nextUrl
    }
  } catch (e) {
    // 只有"我们的计时器已触发"才把 abort 归因成超时;调用方主动取消不得被说成我们的超时。
    if (timedOut && isAbortLike(e)) {
      throw new EgressLimitError({
        kind: 'timeout',
        limit: timeoutMs,
        observed: timeoutMs,
        hostname: hostnameOf(url),
        message: `出站超时上限 timeoutMs=${timeoutMs} 触发(整条重定向链共用该预算),起始 ${hostnameOf(url)}`,
      })
    }
    throw e
  } finally {
    clearTimeout(timer)
    // G-749(2026-10-03):caller abort 的转发**刻意不**随 promise settle 摘除。
    // 本函数的 promise 在"末跳响应头到达"即 settle,而 fetch-deadline(G-814420)的
    // deadline 罩到**响应体消费结束** —— 它的 abort 发生在 headers 之后;若在此摘除,
    // 传输层 body 流与 caller signal 断链,deadline abort 传不进 undici,body 停滞
    // 路径会永久挂起(fetch-deadline-covers-body ①④ 端到端实测抓出)。监听器为
    // { once:true },且现有全部调用方的 signal 都是每请求新建的 controller,不构成
    // 跨请求悬挂;caller abort 本就是单向且无害的动作(取消就该取消)。
  }
}

/** abort 形状判据(DOMException 'AbortError' / undici 的 ABORT_ERR code)。*/
function isAbortLike(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false
  const err = e as { name?: string; code?: string }
  return err.name === 'AbortError' || err.code === 'ABORT_ERR'
}

/** RequestInit → 有界出口入参的唯一适配(G-749)。body 只支持字符串形态:
 * 本仓四处出站站点(ai-vendors/_shared、ai-image-edit、ai-world-sync、ai-audio)的 body
 * 全部是 `JSON.stringify` 产物或空;非字符串 BodyInit 会按 `String()` 归一 —— 与
 * `_shared.fetchWithTimeout` 代理分支的既有语义逐字相同,不新增第三种归一。 */
export function boundedOptionsFromRequestInit(init: RequestInit): {
  method?: string
  headers?: Record<string, string>
  body?: string
  signal?: AbortSignal
} {
  let headers: Record<string, string> | undefined
  const h = init.headers
  if (h !== null && h !== undefined) {
    if (h instanceof Headers) headers = Object.fromEntries(h.entries())
    else if (Array.isArray(h)) headers = Object.fromEntries(h as [string, string][])
    else headers = { ...(h as Record<string, string>) }
  }
  return {
    method: init.method,
    headers,
    body: init.body === null || init.body === undefined ? undefined : String(init.body),
    signal: (init.signal as AbortSignal | null | undefined) ?? undefined,
  }
}

/** 直连传输(G-749):与 `proxiedFetch` 的代理传输同一条 `EgressRequestInit` 契约,
 * 差异只有两处 —— 不带 dispatcher,`redirect:'manual'`(跟随由主循环做,不由 undici 做)。*/
export const directEgressTransport: EgressTransport = (targetUrl, init) =>
  fetch(targetUrl, {
    method: init.method,
    headers: init.headers,
    body: init.body,
    redirect: 'manual',
    signal: init.signal,
  })

/**
 * 直连出站出口(G-749,2026-10-03):调 `boundedEgressFetch` **同一个函数**、只换 transport
 * (直连侧不传 dispatcher)。此前直连侧是裸 `fetch(url)`(`redirect:'follow'` 默认 20 跳、
 * 无跨 origin 剥头纪律、无响应字节上限)—— 代理白名单外的域被 302 到第三方域时,
 * 自定义头里的凭据是出口主动送出去的,与 G-736 修掉的代理侧是同一型。
 * G-750(2026-10-03)起事实挂载收进本函数(与 proxiedFetch 同形):起始配置事实 + 末跳事实
 * 合成完整事实面;`_shared.fetchWithTimeout` 只用 `collectEgressFacts` 做路由决策,不再自行挂载。
 */
export async function directEgressFetch(
  url: string,
  options: {
    method?: string
    headers?: Record<string, string>
    body?: string
    signal?: AbortSignal
    maxRedirects?: number
    maxResponseBytes?: number
    timeoutMs?: number
    /** 测试缝;生产不传 = Node 内置 fetch 直连(无 dispatcher)。 */
    transport?: EgressTransport
  } = {},
): Promise<Response> {
  const res = await boundedEgressFetch(url, {
    ...options,
    transport: options.transport ?? directEgressTransport,
  })
  return attachEgressFacts(res, enrichedEgressFacts(url, res))
}

/** 起始配置事实 + 末跳事实(G-750)合成一趟的完整事实面:
 * 经历过有界链 ⇒ finalHostname/redirectCount 取链上真值;未经历(hops = null)⇒ 两字段
 * 保持缺省(undefined)—— "缺省不进 JSON 以保持旧形状"是本票对类型面的承诺,不用 null 冒充。
 * 事实的装配走 `createEgressFacts` 唯一出口,白名单外照样进不来。*/
function enrichedEgressFacts(url: string, res: Response): EgressFacts {
  const hops = readEgressHops(res)
  return createEgressFacts({
    ...collectEgressFacts(url),
    ...(hops
      ? { finalHostname: hops.finalHostname, redirectCount: hops.redirectCount }
      : {}),
  })
}

/**
 * 走代理的 fetch(必须用 npm undici 包自身的 fetch,不能用 Node 内置全局 fetch——
 * 内置 fetch 是 Node 自带 undici 的独立实例,与 npm undici 的 ProxyAgent
 * Dispatcher 实例不互通,传入会被静默忽略导致直连)。
 *
 * 2026-09-27(G-736)起本函数把重定向交给 `boundedEgressFetch`:≤5 跳、跨 origin 剥全部自定义头、
 * 响应 10MB 上限、180s 超时(三档均可经构造参数覆盖,覆盖本身有天花板)。
 * 出口事实的挂载点仍在这里(整条链算**一趟**,事实按起始 URL 算,与改造前 `_shared.fetchWithTimeout`
 * 挂在响应上的那份逐字同形 —— `EgressFacts` 是 `@ihui/types` 的闭集,本票不得往它塞"末跳 host"
 * 这种第四字段;因此重定向链的末跳 hostname 目前**不**进事实面,已如实登记)。
 */
export async function proxiedFetch(
  url: string,
  options: {
    method?: string
    headers?: Record<string, string>
    body?: string
    signal?: AbortSignal
    maxRedirects?: number
    maxResponseBytes?: number
    timeoutMs?: number
    /** 测试缝;生产不传 = undici fetch + 代理 dispatcher。 */
    transport?: EgressTransport
  } = {},
): Promise<Response> {
  const agent = getProxyAgent()
  if (!agent) throw new Error('代理未配置(PROXY_URL)')
  const transport: EgressTransport =
    options.transport ??
    ((targetUrl, init) =>
      undiciFetch(targetUrl, {
        method: init.method,
        headers: init.headers,
        body: init.body,
        redirect: 'manual',
        signal: init.signal,
        dispatcher: agent,
      } as never).then((r) => r as unknown as Response))
  const res = await boundedEgressFetch(url, {
    method: options.method,
    headers: options.headers,
    body: options.body,
    signal: options.signal,
    maxRedirects: options.maxRedirects,
    maxResponseBytes: options.maxResponseBytes,
    timeoutMs: options.timeoutMs,
    transport,
  })
  return attachEgressFacts(res, enrichedEgressFacts(url, res))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
