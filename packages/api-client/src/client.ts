// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type {
  ApiResult,
  ApiResponse,
  PlanUpdateEvent,
  TerminalStartEvent,
  TerminalEndEvent,
  CitationsEvent,
} from '@ihui/types'
// #11 Citations 全链路(2026-09-13 立):类型已迁至 @ihui/types(与 PlanUpdateEvent 等一致),
// 本地不再重复定义,消除 import 与本地声明的 TS2440 冲突。
export type { CitationsEvent }
import { type CircuitBreaker, CircuitOpenError } from './circuit-breaker.js'
import { getTransport, type TransportInit } from './transport.js'
import type { DeviceFingerprintCollector } from '@ihui/types'

/**
 * 默认空采集器(发布物自包含,2026-09-26 立)。
 *
 * 原先这里是 @ihui/types 的一个**具名值**导入(nullDeviceFingerprintCollector)—— 那是
 * `@ihui/api-client` 唯一的运行时跨包依赖,而 `@ihui/types` 仍是 private 且 exports 指向
 * `./src/*.ts`(实测 `node scripts/check-pkg-installable.mjs packages/types` 有 6 条 blocker),
 * 所以只要这行在,本包的 `dependencies` 就摘不掉 `workspace:` 协议 —— 发出去即 ERR_MODULE_NOT_FOUND。
 * 改成包内常量后,`@ihui/types` 降级为纯类型面(devDependency),tsc 把 `import type` 整条抹掉,
 * dist 里不再有任何 `@ihui/types` 运行时引用;这与 `@ihui/sdk` 的既有形态同形
 * (实测 `packages/sdk/dist/*.js` 对 `@ihui/types` 零命中,而它是本仓唯一已通过可安装自检的包)。
 *
 * 为什么这不构成"第二份真相":契约仍然只有 `DeviceFingerprintCollector` 一个来源(上一行按名导入)。
 * 共享接口一旦新增必填成员,这个字面量就地 typecheck 失败 —— 漂移会响,不会静默。
 */
const nullDeviceFingerprintCollector: DeviceFingerprintCollector = {
  async get() {
    return { fingerprint: '', source: {}, collectedAt: 0 }
  },
  async refresh() {
    return { fingerprint: '', source: {}, collectedAt: 0 }
  },
}

export interface TokenProvider {
  getToken(): string | null
  /**
   * 401 自动续期(2026-08-06 立):access token 过期时调用,用 refresh token 换取
   * 新的 access token。返回新 token(内部自行持久化),失败返回 null。
   * 各端注入自己的刷新实现(web 调 POST /auth/refresh,httpOnly cookie 自动附带)。
   */
  refreshAccessToken?: () => Promise<string | null>
}

/**
 * 设备指纹 Provider 接口(2026-08-02 立,设备维度风控契约)。
 * 各端通过 setDeviceFingerprintProvider 注入自己的采集器,
 * fetchApi 自动把指纹塞进 x-device-fingerprint header。
 * 未注入时降级为 nullDeviceFingerprintCollector(空指纹,不发 header)。
 */
export type DeviceFingerprintProvider = DeviceFingerprintCollector

/** fetchApi 扩展选项:在 RequestInit 基础上追加 `params`(自动拼 query string) */
export type FetchApiOptions = RequestInit & {
  params?: Record<string, string | number | boolean | undefined | null>
  /**
   * 自定义请求超时(毫秒)。默认 30_000。
   * 用于同步阻塞、耗时可达分钟级的端点(如 agent plan 的批准执行 decision),
   * 调用方按需调大(建议 >=120_000)。<=0 时回退到默认 30s。
   */
  timeoutMs?: number
}

let tokenProvider: TokenProvider = { getToken: () => null }
// 401 自动续期的并发去重:多个请求同时 401 时只刷新一次,共享同一 promise
let refreshInFlight: Promise<string | null> | null = null
// 2026-09-04 根治刷新风暴:刷新失败后的冷却窗口(毫秒)。
// refresh token 已失效时,每次 401 都会触发一次 refresh(后端单次轮转 + RFC 6749 §10.4
// family 吊销),并发业务请求各 401 → 各触发一次 → 形成 6+ 次串行 /auth/refresh 风暴,
// 且反复用已吊销 token 重放会加剧 family 吊销。失败后进入冷却,窗口内直接返回 null,
// 由调用方按"登录过期"处理,不再空转重复刷新。
const REFRESH_FAIL_COOLDOWN_MS = 5000
// 冷却期内共享的失败结果 promise(避免多个等待方各拿一份 null 后立即重试)
let refreshFailCooldown: Promise<string | null> | null = null
let refreshFailCooldownTimer: ReturnType<typeof setTimeout> | null = null
// 2026-08-02 设备维度风控:默认空采集器,各端启动时注入实现
let deviceFingerprintProvider: DeviceFingerprintProvider = nullDeviceFingerprintCollector
let baseUrl: string = ''
/**
 * 首方客户端标识(2026-09-24 立)。RN 的 fetch 由 okhttp 实现、CLI 由 node-fetch/undici
 * 实现,两者都命中后端 bot-detection 的 CURL_LIKE_KEYWORDS,导致自家 App 的每个请求被
 * 当成爬虫。空串 = 不注入(浏览器端 UA 是 forbidden header,且浏览器本就不会被误判)。
 */
let userAgentHeader = ''
// SSE 流式请求专用 baseUrl(2026-07-27 立):
// Next.js dev proxy 对 SSE 流有超时/缓冲问题,导致流式响应被中断(net::ERR_ABORTED)。
// streamChat 用 streamBaseUrl 直连 API 服务器,绕过 Next.js dev proxy。
// 未设置时降级到 baseUrl,保持向后兼容。
let streamBaseUrl: string = ''
let circuitBreaker: CircuitBreaker | null = null

export function setTokenProvider(provider: TokenProvider): void {
  tokenProvider = provider
}

/**
 * 注入设备指纹采集器(2026-08-02 立,设备维度风控契约)。
 * 各端在启动时调用,传入 createDeviceFingerprintCollector(impl) 返回的实例。
 * fetchApi 会异步获取指纹并注入到 x-device-fingerprint header。
 *
 * 注意:指纹采集是异步的,首次调用会有微小延迟(后续走 1 分钟缓存)。
 * 为避免阻塞请求,采集失败时静默降级(不发 header),不抛错。
 */
export function setDeviceFingerprintProvider(provider: DeviceFingerprintProvider): void {
  deviceFingerprintProvider = provider
}

/** 读取当前注入的设备指纹采集器(测试与诊断用) */
export function getDeviceFingerprintProvider(): DeviceFingerprintProvider {
  return deviceFingerprintProvider
}

/**
 * 把设备指纹注入到 headers 对象(2026-08-02 立,设备维度风控契约)。
 * 供 fetchApi / fetchText / fetchRaw / streamChat 共用,避免重复代码。
 *
 * 采集失败时静默降级(不修改 headers),不阻塞业务(fail-open)。
 * 调用方显式传入 x-device-fingerprint 时优先用调用方值(不覆盖)。
 *
 * 2026-08-17 P2 优化:并行化指纹采集与 abort 信号监听。
 * 原实现串行 `await provider.get()` 后才检查 signal.aborted,
 * 首次冷启动时指纹采集可能要几十 ms,这期间用户主动取消的 signal 不会被响应。
 * 改用 Promise.race([fingerprint, abort]) 后:
 * - 指纹 resolve 正常写入 headers
 * - signal abort 立即抛 AbortError,fetchApi 短路返回(不再发起 fetch)
 * - 采集失败静默降级,与原行为一致
 */
async function injectDeviceFingerprintHeader(
  headers: Record<string, string>,
  externalSignal?: AbortSignal | null,
): Promise<void> {
  if (headers['x-device-fingerprint']) return

  // 快速路径:signal 已 aborted → 直接抛 AbortError,跳过指纹采集(节省时间)
  if (externalSignal?.aborted) throw createAbortError()

  const fingerprintPromise = deviceFingerprintProvider.get()
  let abortHandler: (() => void) | undefined
  const abortPromise = externalSignal
    ? new Promise<never>((_, reject) => {
        abortHandler = () => reject(createAbortError())
        externalSignal.addEventListener('abort', abortHandler, { once: true })
      })
    : null

  try {
    const fp = await (abortPromise
      ? Promise.race([fingerprintPromise, abortPromise])
      : fingerprintPromise)
    if (fp?.fingerprint) {
      headers['x-device-fingerprint'] = fp.fingerprint
    }
  } catch (err) {
    // AbortError:传递到调用方,由 fetchApi 的 finally / 错误处理统一返回"请求已取消"
    if (isAbortError(err)) throw err
    // 指纹采集失败,静默降级
  } finally {
    if (abortHandler && externalSignal) {
      externalSignal.removeEventListener('abort', abortHandler)
    }
  }
}

export function setBaseUrl(url: string): void {
  baseUrl = url.replace(/\/$/, '')
}

/**
 * 注入首方 User-Agent(非浏览器端必须调,否则被风控当爬虫)。
 * 传空串恢复不注入。浏览器端调用无效 —— User-Agent 是 forbidden header name,
 * fetch 会静默丢弃,所以 web/extension 不需要也不应调用。
 */
export function setUserAgent(ua: string): void {
  userAgentHeader = ua.trim()
}

/** 读取当前注入的首方 User-Agent(测试与诊断用) */
export function getUserAgent(): string {
  return userAgentHeader
}

export function setStreamBaseUrl(url: string): void {
  streamBaseUrl = url.replace(/\/$/, '')
}

/** 读取当前 streamBaseUrl */
export function getStreamBaseUrl(): string {
  return streamBaseUrl
}

/** 注入全局熔断器(null 表示禁用,所有请求直连) */
export function setCircuitBreaker(cb: CircuitBreaker | null): void {
  circuitBreaker = cb
}

/** 读取当前注入的熔断器实例(测试与诊断用) */
export function getCircuitBreaker(): CircuitBreaker | null {
  return circuitBreaker
}

/**
 * 401 且确实拿不到有效凭据时,交给端内处理器的上下文(2026-09-25 立)。
 *
 * 刻意只带"路由这一层能确定的事实",不带任何平台对象:
 * - url:归一化后的请求 URL(已拼 baseUrl 与 query),端内要按端点白名单过滤时有依据
 * - method:大写 HTTP 方法。**弹窗策略属平台/产品决策**,所以这里把方法透出去,
 *   由各端自己决定"GET 的 401 不弹、非 GET 才弹"(web 端既有语义),共享层不写死。
 */
export interface UnauthorizedContext {
  url: string
  method: string
}

/** 端内注册的 401 处理器。返回值被忽略;抛错由 {@link notifyUnauthorized} 兜住。 */
export type UnauthorizedHandler = (ctx: UnauthorizedContext) => void

let unauthorizedHandler: UnauthorizedHandler | null = null

/**
 * 注入 401 处理器(传 null 取消注入)。
 *
 * 为什么需要它(2026-09-25):"非 GET 请求遇 401 自动弹登录框"这件事此前**只存在于**
 * `apps/web/src/lib/api.ts` 的包装层。端内一旦改走本包的端点函数(直接调 fetchApi),
 * 就绕过了那层包装 —— 对那些没有 onError 分支的 mutation 来说,反馈从"能弹窗"变成
 * "点了没反应"。把决策点上收到本包,端内注册一次即可,迁移才可能做到不改行为。
 *
 * 形状沿用本包既有的可注册单例约定(setTokenProvider / setDeviceFingerprintProvider /
 * setCircuitBreaker):一个模块级变量 + setXxx + getXxx,不另造事件总线。
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler
}

/** 读取当前注入的 401 处理器(测试与诊断用) */
export function getUnauthorizedHandler(): UnauthorizedHandler | null {
  return unauthorizedHandler
}

/**
 * 在「收到 401 且续期后仍未拿到有效 token」这一出口通知端内(2026-09-25 立)。
 *
 * 三条不变量,对应本票的三条要求:
 * 1. **未注册即零副作用** —— 第一行就 return,不产生任何对象/微任务/日志,
 *    保证"没注册钩子时行为与改动前逐字节一致"(有 fetch-api-baseline.test.ts 的逐字对账钉死)。
 * 2. **绝不在"续期成功"路径上被调用** —— 调用点在 `refreshAccessTokenOnce()` 返回 falsy
 *    的分支里;续期拿到 token 后走重试,不进本函数(误弹会打断 bootstrap 静默刷新)。
 *    认证端点(isAuthEndpoint)的 401 是它自己的最终结果,同理不通知。
 * 3. **处理器抛错不得影响 fetchApi 的返回,但也不得静默吞** —— try/catch 包住后
 *    走本包既有的 console 约定(该包没有独立 logger,唯一先例是 streamChat 的
 *    `console.info('[SSE-DEBUG] …')`,故这里用 `console.error('[api-client] …')`)。
 */
function notifyUnauthorized(url: string, method: string | undefined): void {
  const handler = unauthorizedHandler
  if (!handler) return
  try {
    handler({ url, method: (method ?? 'GET').toUpperCase() })
  } catch (err) {
    console.error('[api-client] 401 处理器抛错(不影响本次请求返回)', err)
  }
}

/** 读取当前 token(供需要原生 fetch 的场景使用,如 SSE 流式) */
export function getToken(): string | null {
  return tokenProvider.getToken()
}

/**
 * 401 自动续期核心(2026-08-06 立)。
 * 并发去重:多个请求同时 401 时共享同一个刷新 promise,只调用一次 refreshAccessToken。
 * 刷新失败返回 null,由调用方决定是否走登出/错误流程。
 *
 * 2026-08-14 导出:useAuthBootstrap(web)复用本单例做启动期静默刷新,
 * 使 bootstrap 与 401 拦截器共享同一 in-flight 请求 —— 后端 refresh token 单次轮转,
 * 若两者并发各发一次,后者必 401 且触发 RFC 6749 §10.4 family 吊销,自动登录在刷新后丢失。
 *
 * 2026-09-04 失败冷却(根治刷新风暴):refresh 失败(refresh token 已失效)后,
 * REFRESH_FAIL_COOLDOWN_MS 窗口内后续调用直接复用同一个失败 promise,不再重复发起
 * /auth/refresh。此前失败后 refreshInFlight 立即清空,并发 401 的业务请求会串行
 * 各触发一次 refresh,形成 6+ 次重复请求风暴(见内存日志 3004/3017/3089/3214/3227/3242ms)。
 */
export async function refreshAccessTokenOnce(): Promise<string | null> {
  if (!tokenProvider.refreshAccessToken) return null
  // 失败冷却期内:直接返回共享的失败 promise,不重复发起 refresh
  if (refreshFailCooldown) return refreshFailCooldown
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = Promise.resolve()
    .then(() => tokenProvider.refreshAccessToken!())
    .then((t) => {
      // 刷新成功:清空冷却态(如有),返回新 token
      clearRefreshFailCooldown()
      return t ?? null
    })
    .catch(() => {
      // 刷新失败:进入冷却窗口,阻止后续 401 在窗口内重复刷新
      startRefreshFailCooldown()
      return null
    })
    .finally(() => {
      refreshInFlight = null
    })
  return refreshInFlight
}

/** 启动失败冷却窗口:窗口内 refreshAccessTokenOnce 直接返回共享失败 promise */
function startRefreshFailCooldown(): void {
  if (refreshFailCooldown) return
  refreshFailCooldown = Promise.resolve(null)
  refreshFailCooldownTimer = setTimeout(() => {
    refreshFailCooldown = null
    refreshFailCooldownTimer = null
  }, REFRESH_FAIL_COOLDOWN_MS)
}

/** 清空失败冷却态(刷新成功时调用,避免成功后仍被冷却窗口短暂拦截) */
function clearRefreshFailCooldown(): void {
  if (refreshFailCooldownTimer) {
    clearTimeout(refreshFailCooldownTimer)
    refreshFailCooldownTimer = null
  }
  refreshFailCooldown = null
}

/**
 * 重置刷新相关模块级状态(仅供测试用)。
 * 暴露此函数是因为 refreshInFlight / refreshFailCooldown 是模块级单例,
 * 测试间需要隔离,避免失败冷却态跨用例泄漏导致后续用例的 refresh mock 不被调用。
 */
export function __resetRefreshStateForTest(): void {
  refreshInFlight = null
  clearRefreshFailCooldown()
}

/**
 * 认证/会话端点不做 401 续期(避免死循环):
 * login/refresh/logout/register/2fa/callback/oauth 等端点自身 401 就是最终结果,
 * 不能触发 refresh 重试。
 */
const AUTH_ENDPOINT_RE =
  /\/auth\/(login|refresh|logout|register|2fa|callback|forgot|reset|verify|google|apple|wechat|wecom|dingtalk|oauth)|\/oauth\//i
function isAuthEndpoint(url: string): boolean {
  const path = (url.replace(/^https?:\/\/[^/]+/, '').split('?')[0] ?? '').toLowerCase()
  return AUTH_ENDPOINT_RE.test(path)
}

/** 规范化 URL(供需要原生 fetch 的场景使用) */
export function normalizeUrlPublic(url: string): string {
  return normalizeUrl(url)
}

/**
 * 合并多个 AbortSignal 为一个(ES2022+ 兼容 polyfill)。
 * AbortSignal.any() 需要 ES2024 lib,mobile-rn(ES2023)不可用。
 * 任一 signal abort 时,合并 signal 也 abort。
 * 保留:供未来需要多 signal 合并的调用方使用(如 SSE + 用户取消)。
 * 导出:避免 noUnusedLocals 报错,同时让调用方可直接 import 使用。
 */
export function mergeAbortSignals(signals: (AbortSignal | null | undefined)[]): AbortSignal {
  const controller = new AbortController()
  const onAbort = () => {
    cleanup()
    controller.abort()
  }
  const sources: AbortSignal[] = []
  for (const sig of signals) {
    if (!sig) continue
    if (sig.aborted) {
      controller.abort()
      return controller.signal
    }
    sources.push(sig)
    sig.addEventListener('abort', onAbort, { once: true })
  }
  // 2026-08-06 修复:合并 signal 被 abort 后清理所有源 signal 的监听器,
  // 防止 listener 泄漏(源 signal 生命周期更长时,重复调用会造成内存增长)。
  const cleanup = () => {
    for (const sig of sources) sig.removeEventListener('abort', onAbort)
  }
  controller.signal.addEventListener('abort', cleanup, { once: true })
  return controller.signal
}

function resolveBody(body: RequestInit['body']): TransportInit['body'] {
  if (body === null) return undefined
  return body as TransportInit['body']
}
function normalizeUrl(url: string, useStreamBase = false): string {
  if (/^https?:\/\//i.test(url)) return url
  const normalized = (() => {
    if (url.startsWith('/api/') || url.startsWith('/uploads/') || url.startsWith('/ws/')) return url
    if (url.startsWith('/cozeZhsApi')) {
      return url.replace(/^\/cozeZhsApi/, '/api')
    }
    if (url.startsWith('/')) return `/api${url}`
    return `/api/${url}`
  })()
  const base = useStreamBase && streamBaseUrl ? streamBaseUrl : baseUrl
  return base ? `${base}${normalized}` : normalized
}

/**
 * 内部:执行一次 fetch 并解析为 ApiResult。
 *
 * 失败语义(供 CircuitBreaker 计样本):
 *   - 5xx 响应:抛 HttpError(带 status / errorCode / retryAfter),由外层转 ApiResult
 *   - 网络异常:抛原始 Error
 *   - 4xx 响应:返回 ApiResult(success=false),不抛错(业务错误不算服务不可用)
 *   - 2xx 但 code !== 0:返回 ApiResult(success=false),不抛错
 *   - 2xx 且 code === 0:返回 ApiResult(success=true)
 *
 * AbortError:抛回给外层统一处理(无论是否有 breaker)。
 */
async function fetchOnce<T>(
  normalizedUrl: string,
  options: RequestInit,
  headers: Record<string, string>,
): Promise<ApiResult<T>> {
  // 2026-08-17 修复:移除 signal?.aborted 早返回,改为让 fetch 真实被调用。
  // 原早返回导致 AbortSignal 测试期望 fetch 被调用 1 次时,实际 0 次。
  // fetch 自身支持 aborted signal(立即 reject AbortError),由调用方统一 catch 后归一化为 '请求已取消'。
  const response = await getTransport()(normalizedUrl, {
    method: options.method,
    headers,
    body: resolveBody(options.body),
    signal: options.signal ?? undefined,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    let errorCode: string | undefined
    let message = text || `请求失败（${response.status}）`
    try {
      const parsed = JSON.parse(text)
      if (parsed && typeof parsed.message === 'string') message = parsed.message
      // FastAPI 的错误体是 {detail:"..."}(api 原样透传 ai-service 的 4xx 全属此类);
      // 只认 message 会让调用方 toast 直接显示整段原始 JSON 文本。
      else if (parsed && typeof parsed.detail === 'string') message = parsed.detail
      if (parsed && typeof parsed.errorCode === 'string') errorCode = parsed.errorCode
    } catch {
      // 非 JSON 响应,保留 text 作为 message
    }
    const retryAfterHeader = response.headers.get('retry-after')
    const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : undefined
    const retryAfterValue = retryAfter && Number.isFinite(retryAfter) ? retryAfter : undefined

    // 5xx 视为服务不可用:有 breaker 时抛错让熔断器计失败样本;无 breaker 时也抛,由外层统一处理
    if (response.status >= 500) {
      const err = new Error(message) as Error & {
        status: number
        errorCode?: string
        retryAfter?: number
      }
      err.status = response.status
      if (errorCode) err.errorCode = errorCode
      if (retryAfterValue !== undefined) err.retryAfter = retryAfterValue
      throw err
    }

    // 4xx:业务错误,返回 ApiResult,不计 breaker 失败样本
    return {
      success: false,
      error: message,
      status: response.status,
      errorCode,
      retryAfter: retryAfterValue,
    }
  }

  const json = (await response.json()) as ApiResponse<T>

  // 2026-08-12 修复:ai-service 端点(如 /api/admin/news/status)返回裸 JSON 对象,
  // 没有 {code, message, data} 包装。code===undefined 时视整个响应为 data 返回。
  if (json.code === undefined) {
    // 2026-09-09 0-5 迁移:成功分支携带 HTTP status(upsert 场景需区分 200/201)
    return { success: true, data: json as unknown as T, status: response.status }
  }

  if (json.code !== 0) {
    return {
      success: false,
      error: json.message || '请求失败',
      status: response.status,
      errorCode: json.errorCode,
    }
  }

  return { success: true, data: json.data, status: response.status }
}

/** ApiResult 失败分支类型(用于错误归一化) */
type ApiFailure = Extract<ApiResult<unknown>, { success: false }>

/**
 * 2026-08-06 修复:安全地判断 AbortError。
 * 原实现直接 `err instanceof DOMException`,在微信小程序(weapp)等
 * 无 DOMException 全局对象的运行环境下会抛 ReferenceError,导致
 * 网络失败路径崩溃。改为特性检测:DOMException 存在时才用 instanceof,
 * 否则回退为检查 err.name === 'AbortError'。
 */
export function isAbortError(err: unknown): boolean {
  const name = (err as { name?: unknown } | null)?.name
  if (name !== 'AbortError') return false
  if (typeof DOMException !== 'undefined') {
    return err instanceof DOMException
  }
  return true
}

/** 把内部抛出的错误归一化为 ApiFailure(CircuitOpenError 由调用方处理) */
function normalizeErrorToResult(err: unknown): ApiFailure {
  if (isAbortError(err)) {
    return { success: false, error: '请求已取消' }
  }
  const errAny = err as Error & { status?: number; errorCode?: string; retryAfter?: number }
  if (typeof errAny.status === 'number') {
    return {
      success: false,
      error: errAny.message,
      status: errAny.status,
      errorCode: errAny.errorCode,
      retryAfter: errAny.retryAfter,
    }
  }
  return {
    success: false,
    error: err instanceof Error ? err.message : '网络异常',
  }
}

export async function fetchApi<T>(
  url: string,
  options: FetchApiOptions = {},
): Promise<ApiResult<T>> {
  const token = tokenProvider.getToken()
  const { params, ...restOptions } = options
  let normalizedUrl = normalizeUrl(url)
  if (params) {
    const qs = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        qs.append(key, String(value))
      }
    }
    const qsString = qs.toString()
    if (qsString) {
      normalizedUrl += (normalizedUrl.includes('?') ? '&' : '?') + qsString
    }
  }

  const isFormData = typeof FormData !== 'undefined' && restOptions.body instanceof FormData
  // 2026-07-30 修复:无 body 的请求(DELETE/GET 等)不再强制带 Content-Type: application/json。
  // 原因:Fastify 5 对带 Content-Type 但空 body 的 DELETE 返回 400(空 body 解析失败),
  // 导致删除对话等无 body 写操作全部失败。Content-Type 应描述 body 媒体类型,无 body 不应带。
  const hasBody = restOptions.body !== undefined && restOptions.body !== null
  const headers: Record<string, string> = {
    ...(hasBody && !isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(restOptions.headers as Record<string, string> | undefined),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  // 2026-08-02 修复:所有请求加 X-Requested-With header,配合后端 CSRF 防护
  // (auth.ts Cookie 认证路径要求 X-Requested-With: XMLHttpRequest)
  // 攻击者从跨域恶意网站发起的请求无法伪造此 header(受 CORS 预检限制)
  if (!headers['X-Requested-With']) {
    headers['X-Requested-With'] = 'XMLHttpRequest'
  }
  if (userAgentHeader && !headers['User-Agent']) {
    headers['User-Agent'] = userAgentHeader
  }

  // 2026-08-02 设备维度风控:注入 x-device-fingerprint header
  // 后端 audit-logger / anomaly-detector / threat-detector 读取此 header 做设备维度风控。
  await injectDeviceFingerprintHeader(headers)

  // 2026-07-22 P0 Round 4 鲁棒性加固:默认 30s 超时,防止请求无限挂起
  // 调用方传入的 signal 与超时 signal 合并(AbortSignal.any),任一触发都中止
  // streamChat SSE 流场景不经过 fetchApi(走独立 streamText),不受此超时影响
  const DEFAULT_TIMEOUT_MS = options.timeoutMs && options.timeoutMs > 0 ? options.timeoutMs : 30_000
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => timeoutController.abort(), DEFAULT_TIMEOUT_MS)
  const userSignal = restOptions.signal
  const mergedSignal = userSignal
    ? mergeAbortSignals([userSignal, timeoutController.signal])
    : timeoutController.signal
  const optionsWithTimeout = { ...restOptions, signal: mergedSignal }

  try {
    // 无 breaker:保留原始重试策略(maxRetries=1)
    if (!circuitBreaker) {
      const maxRetries = 1
      let lastError = '网络异常'
      let authRetried = false

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const result = await fetchOnce<T>(normalizedUrl, optionsWithTimeout, headers)
          // 401 自动续期(2026-08-06):access token 过期 → 静默刷新 → 重试一次
          if (
            'status' in result &&
            result.status === 401 &&
            !authRetried &&
            !isAuthEndpoint(normalizedUrl)
          ) {
            const newToken = await refreshAccessTokenOnce()
            if (newToken) {
              headers['Authorization'] = `Bearer ${newToken}`
              authRetried = true
              continue
            }
            // 401 且续期没拿到 token(未注入续期实现 / 续期失败)→ 通知端内(2026-09-25)
            notifyUnauthorized(normalizedUrl, restOptions.method)
          }
          return result as ApiResult<T>
        } catch (err) {
          // AbortError:用户主动取消或超时,直接返回,不重试
          if (isAbortError(err)) {
            // 区分用户取消 vs 超时:timeoutController 已 abort 说明是超时
            return {
              success: false,
              error: timeoutController.signal.aborted ? '请求超时(30s)' : '请求已取消',
            }
          }
          const result = normalizeErrorToResult(err)
          // 5xx / 4xx(已带 status):直接返回,不重试
          if (result.status !== undefined) {
            return result as ApiResult<T>
          }
          // 网络异常:重试或返回 lastError
          lastError = result.error
          if (attempt < maxRetries) continue
        }
      }

      return { success: false, error: lastError }
    }

    // 有 breaker:每次 fetchApi 计 1 个 breaker 样本(不内部重试,避免重复计样本)
    try {
      let result = await circuitBreaker.execute(async () => {
        return await fetchOnce<T>(normalizedUrl, optionsWithTimeout, headers)
      })
      // 401 自动续期(2026-08-06):access token 过期 → 静默刷新 → 重试一次
      if ('status' in result && result.status === 401 && !isAuthEndpoint(normalizedUrl)) {
        const newToken = await refreshAccessTokenOnce()
        if (newToken) {
          headers['Authorization'] = `Bearer ${newToken}`
          result = await circuitBreaker.execute(async () => {
            return await fetchOnce<T>(normalizedUrl, optionsWithTimeout, headers)
          })
        } else {
          // 401 且续期没拿到 token → 通知端内(与上方无熔断分支同一出口,2026-09-25)
          notifyUnauthorized(normalizedUrl, restOptions.method)
        }
      }
      return result as ApiResult<T>
    } catch (err) {
      if (err instanceof CircuitOpenError) throw err
      if (isAbortError(err)) {
        return {
          success: false,
          error: timeoutController.signal.aborted ? '请求超时(30s)' : '请求已取消',
        }
      }
      return normalizeErrorToResult(err) as ApiResult<T>
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * 给 HTTP 失败补上 `status` / `errorCode` 元信息(2026-09-24 立)。
 *
 * 起因:`fetchText` / `fetchRaw` 此前只 `throw new Error("<status>: <raw body>")`,
 * 既没 status 属性也没结构化的 errorCode。调用方一旦把 `e.message` 交给
 * `toUserFriendlyMessage` 进 toast,该函数在 errorCode / status 两步都取不到值,
 * 会走到"已是中文就原样返回 / 英文关键词匹配"那一步 —— 于是 nginx 429 的整页
 * HTML 或上游 JSON 正文有机会原样出现在用户界面上。
 * 补上 status 之后,`toUserFriendlyMessage` 在第 2 步就命中状态码表,拿到安全的
 * 通用文案,不再回落到"把正文念给用户"。
 *
 * `message` 保持既有形态不变(`${status}: ${text}`),纯增量,不破坏任何按字符串
 * 解析的旧调用方。
 */
function attachHttpErrorMeta(error: Error, status: number, bodyText: string): Error {
  const meta = error as Error & { status?: number; errorCode?: string }
  meta.status = status
  try {
    const parsed: unknown = JSON.parse(bodyText)
    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>
      for (const key of ['errorCode', 'error_code', 'code'] as const) {
        const value = record[key]
        if (typeof value === 'string' && value.length > 0) {
          meta.errorCode = value
          break
        }
      }
    }
  } catch {
    // 正文不是 JSON(典型:nginx 错误页):只带 status,调用方仍可靠它映射文案。
  }
  return error
}

export async function fetchText(url: string, options: RequestInit = {}): Promise<string> {
  const token = tokenProvider.getToken()
  const normalizedUrl = normalizeUrl(url)
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  // 2026-08-02 修复:配合后端 CSRF 防护
  if (!headers['X-Requested-With']) headers['X-Requested-With'] = 'XMLHttpRequest'
  if (userAgentHeader && !headers['User-Agent']) headers['User-Agent'] = userAgentHeader
  // 2026-08-02 设备维度风控(2026-08-17 P2:传递 signal 让 abort 短路)
  await injectDeviceFingerprintHeader(headers, options.signal)
  // 2026-08-06 修复:补充请求超时(30s),原实现无超时,网络挂起时调用方永久等待。
  // 调用方已传 signal 时不覆盖(尊重外部取消)。
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => timeoutController.abort(), 30_000)
  try {
    const response = await getTransport()(normalizedUrl, {
      method: options.method,
      headers,
      body: resolveBody(options.body),
      signal: options.signal ?? timeoutController.signal,
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw attachHttpErrorMeta(new Error(`${response.status}: ${text}`), response.status, text)
    }
    return response.text()
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * 专为 ai-service 设计的 JSON fetch(2026-07-31 立,IDE MCP/Agent 面板使用)。
 *
 * 与 fetchApi 的差异:ai-service 大部分端点返回**非标准格式**(无 `{code, data}` 包装),
 * 例如 `GET /mcp/tools` 直接返回 `{"tools": [...], "count": N}`,
 * `POST /mcp/tools/call` 直接返回 result 对象。
 * fetchApi 会因 `json.code !== 0` 判定业务失败,故此函数直接把 response body 当作 data 返回。
 *
 * 语义:
 *   - 2xx:返回 `ApiResult<T>` 的 success 分支,data = response.json()
 *   - 4xx/5xx:返回 error 分支(5xx 不抛错,统一返回 ApiResult,简化调用方)
 *   - 网络异常:返回 error 分支
 *
 * @example
 * const res = await fetchAiServiceJson<McpToolList>('/mcp/tools')
 * if (res.success) console.log(res.data.tools)
 */
export async function fetchAiServiceJson<T>(
  url: string,
  options: FetchApiOptions = {},
): Promise<ApiResult<T>> {
  const token = tokenProvider.getToken()
  const { params, ...restOptions } = options
  let normalizedUrl = normalizeUrl(url)
  if (params) {
    const qs = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        qs.append(key, String(value))
      }
    }
    const qsString = qs.toString()
    if (qsString) {
      normalizedUrl += (normalizedUrl.includes('?') ? '&' : '?') + qsString
    }
  }

  const isFormData = typeof FormData !== 'undefined' && restOptions.body instanceof FormData
  const hasBody = restOptions.body !== undefined && restOptions.body !== null
  const headers: Record<string, string> = {
    ...(hasBody && !isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(restOptions.headers as Record<string, string> | undefined),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  // 2026-08-02 修复:配合后端 CSRF 防护
  if (!headers['X-Requested-With']) headers['X-Requested-With'] = 'XMLHttpRequest'
  if (userAgentHeader && !headers['User-Agent']) headers['User-Agent'] = userAgentHeader
  // 2026-08-02 设备维度风控:注入 x-device-fingerprint header
  // 后端 audit-logger / anomaly-detector / threat-detector 读取此 header 做设备维度风控。
  // 2026-08-17 P2:传入 restOptions.signal,让 injectDeviceFingerprintHeader 内部做
  // Promise.race([fingerprint, abort]),用户取消时不必等指纹完成即可短路返回。
  try {
    await injectDeviceFingerprintHeader(headers, restOptions.signal)
  } catch (err) {
    if (isAbortError(err)) {
      return { success: false, error: '请求已取消' }
    }
    // 指纹采集失败(非 abort):静默降级继续
  }

  const DEFAULT_TIMEOUT_MS = options.timeoutMs && options.timeoutMs > 0 ? options.timeoutMs : 30_000
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => timeoutController.abort(), DEFAULT_TIMEOUT_MS)
  const userSignal = restOptions.signal
  const mergedSignal = userSignal
    ? mergeAbortSignals([userSignal, timeoutController.signal])
    : timeoutController.signal

  try {
    const response = await getTransport()(normalizedUrl, {
      method: restOptions.method,
      headers,
      body: resolveBody(restOptions.body),
      signal: mergedSignal,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      let message = text || `请求失败(${response.status})`
      let errorCode: string | undefined
      try {
        const parsed = JSON.parse(text)
        if (parsed && typeof parsed.message === 'string') message = parsed.message
        if (parsed && typeof parsed.detail === 'string') message = parsed.detail
        if (parsed && typeof parsed.errorCode === 'string') errorCode = parsed.errorCode
      } catch {
        // 非 JSON 响应,保留 text 作为 message
      }
      return {
        success: false,
        error: message,
        status: response.status,
        errorCode,
      }
    }

    // ai-service 直接返回 JSON,无 {code, data} 包装,整体作为 data
    const json = (await response.json()) as T
    // 2026-09-09 0-5 迁移:成功分支携带 HTTP status(与 fetchOnce 对齐)
    return { success: true, data: json, status: response.status }
  } catch (err) {
    if (isAbortError(err)) {
      return {
        success: false,
        error: timeoutController.signal.aborted ? '请求超时(30s)' : '请求已取消',
      }
    }
    return normalizeErrorToResult(err) as ApiResult<T>
  } finally {
    clearTimeout(timeoutId)
  }
}

/** 拉取原始二进制响应(如 PNG 截图),自动加 Authorization 头。 */
export async function fetchRaw(url: string, options: RequestInit = {}): Promise<Blob> {
  const token = tokenProvider.getToken()
  const normalizedUrl = normalizeUrl(url)
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  // 2026-08-02 修复:配合后端 CSRF 防护
  if (!headers['X-Requested-With']) headers['X-Requested-With'] = 'XMLHttpRequest'
  if (userAgentHeader && !headers['User-Agent']) headers['User-Agent'] = userAgentHeader
  // 2026-08-02 设备维度风控
  await injectDeviceFingerprintHeader(headers)
  // 2026-08-06 修复:补充请求超时(30s),原实现无超时,网络挂起时调用方永久等待。
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => timeoutController.abort(), 30_000)
  try {
    const response = await getTransport()(normalizedUrl, {
      method: options.method,
      headers,
      body: resolveBody(options.body),
      signal: options.signal ?? timeoutController.signal,
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw attachHttpErrorMeta(new Error(`${response.status}: ${text}`), response.status, text)
    }
    if (!response.blob) {
      throw new Error('当前 transport 不支持 blob 下载(小程序环境请用 native downloadFile)')
    }
    return response.blob()
  } finally {
    clearTimeout(timeoutId)
  }
}

// ==================== SSE 流式对话 ====================

/** P1 #27(2026-09-16 立):记忆更新事件(已记住提示条数据源)。 */
export interface MemoryUpdatesEvent {
  /** 本轮新增写入长期记忆(LTM)的条目摘要文本;空数组表示本轮无新记忆 */
  items: string[]
  /** 关联的 assistant messageId;缺省时前端回退到本流 assistantId */
  messageId?: string
}

/** 终端命令执行期间的实时输出增量事件(2026-09-18 立,消息级 terminal inline 实时回显)。
 *  后端在命令执行期间逐块下发 `event: terminal_delta` + `data: {"type":"terminal_delta",...}`,
 *  前端按 terminalId 累加到 store.terminalOutputs,供 TerminalSection 实时回显 stdout/stderr。 */
export interface TerminalDeltaEvent {
  /** 与 terminal_start 的 terminalId 一致,用于关联同一终端任务 */
  terminalId: string
  /** 原命令(与 terminal_start 的 command 一致,便于无 start 事件时兜底关联) */
  command: string
  /** 输出流类型:stdout / stderr */
  stream: 'stdout' | 'stderr'
  /** 增量文本 */
  text: string
  /** 当前迭代轮次 */
  iteration: number
  /** 关联 assistant 消息 ID(可选) */
  messageId?: string
}

/** 消息级 token 用量计量事件(D1,2026-09-19 立)。
 *
 * 后端在每条回复流收尾处发出命名帧 `event: usage` / `type:'usage'`,
 * 携带本条消息的 token 用量、首 token 与总耗时、模型与(可选)成本。
 * 同时向后兼容 OpenAI 协议:`json.usage` 字段(prompt_tokens/completion_tokens/total_tokens)。
 * reasoningTokens / timing / model / messageId / costUsd 为新增字段,可选以兼容旧链路。 */
export interface UsageEvent {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  /** 推理 token 数(部分模型/思考模式,缺失为 null) */
  reasoningTokens?: number | null
  /** 关联 assistant 消息 ID(取不到为 null) */
  messageId?: string | null
  /** 耗时:{ firstTokenMs: 首个正文增量耗时(ms,缺失为 null); durationMs: 总耗时(ms) } */
  timing?: { firstTokenMs: number | null; durationMs: number } | null
  /** 实际模型 id */
  model?: string | null
  /** 本次调用估算成本(USD,暂未计费为 null) */
  costUsd?: number | null
}

export interface StreamChatOptions {
  model: string
  // role 含 'tool':与 @ihui/context-compaction 的 ChatMessage 及 OpenAI 兼容协议对齐
  messages: Array<{ role: 'user' | 'assistant' | 'system' | 'tool'; content: string }>
  signal?: AbortSignal
  onDelta: (delta: string) => void
  onError?: (error: string, info?: SSEErrorInfo) => void
  onDone?: () => void
  onReasoning?: (delta: string) => void
  /** 后端自动压缩上下文(88% 阈值触发)时回调,前端可 toast 提示用户 */
  onCompaction?: (info: {
    tokensBefore: number
    tokensAfter: number
    removedCount: number
    /** A10B-8(2026-09-26):本轮被**内容级截断**的消息条数(与 removedCount 不同维:
     *  后者是被折进摘要移出上下文的整条消息数)。可选 ⇒ 旧帧缺席读作"未知",不读作 0。 */
    truncatedCount?: number
    usageRatio: number
    /** 压缩触发方式:ratio/absolute(常规摘要压缩)/truncated(超长单条消息截断降级)/incompressible */
    trigger?: string
    compressedMessages?: Array<{ role: string; content: string }>
  }) => void
  /** AI 主动提问回调:LLM 在流中输出 [[ASK_USER:JSON]] 标记时触发,前端弹窗让用户回答 */
  onQuestion?: (question: {
    questionId: string
    prompt: string
    options: Array<{ id: string; label: string }>
    allowCustom: boolean
    allowMultiple: boolean
  }) => void
  /** P4-2: 后端 fallback 触发回调(主模型失败 + 切换到备用模型时触发,前端展示横幅提示) */
  onFallback?: (event: FallbackEvent) => void
  metadata?: { conversationId?: string; userId?: string; messageId?: string }
  temperature?: number
  topP?: number
  topK?: number
  maxTokens?: number
  stop?: string[]
  /** 当前绑定的本地工作区路径(从 useAiPanelStore.activeWorkspace.path 取)。
   * 透传到后端用于注入 CLAUDE.md/AGENTS.md 项目记忆作为 system prompt。
   * 无绑定时为 undefined,后端使用默认 system prompt。 */
  workspacePath?: string
  /** P1 #26(2026-09-16 立):知识库默认注入开关(对标 Qoder Knowledge Engine)。
   *  默认 true(后端默认 top-3 知识检索注入 system_prompt,命中下发 citations 事件);
   *  仅显式 false 时写入 body(关闭知识检索,降级纯对话),undefined 不传走后端默认开。 */
  knowledgeContext?: boolean
  /** 浏览器端预加载的工作区文件内容(2026-08-02 立,阶段 1)。
   * web 非 Tauri 环境下,前端用 FileSystemDirectoryHandle 遍历读取工作区关键文件,
   * 把内容通过此字段传给后端,后端直接注入 system prompt(跳过从文件系统读取)。
   * Tauri 桌面端为 undefined,走 workspacePath 逻辑。 */
  workspaceContext?: string
  /** 阶段 2:工具委托执行回调(浏览器端收到 tool-delegate SSE 事件时触发)
   * 前端用 FileSystemDirectoryHandle 执行 fs 类工具,通过 postToolResult 回传结果 */
  onToolDelegate?: (event: ToolDelegateEvent) => void | Promise<void>
  /** V3 #58(2026-09-26 立):主对话流工具审批回调 —— ai-service tool loop 在
   *  高危工具执行前发 tool-approval 帧,前端弹窗请求用户批准/拒绝,决策经
   *  postToolApprovalResponse 回传。未注册回调时不解析;等待方按 120s 超时兜底
   *  (工具不执行,回填 TOOL_APPROVAL_TIMEOUT)。 */
  onToolApproval?: (event: ToolApprovalEvent) => void | Promise<void>
  /** V3 #58(2026-09-26 立):工作区权限模式档位,经网关透传为 ai-service 的
   *  permission_mode,工具审批门据此决定高危工具是否弹审批
   *  (bypass-permissions 不拦截;accept-edits 放行文件编辑类)。 */
  permissionMode?: string
  /** 模型上下文窗口大小(tokens),达 88% 阈值自动压缩(跨端统一)。
   * 由 use-chat.ts 调 getModelContextCapacity(model) 取得,后端不传则不压缩。 */
  contextLimit?: number
  /** SSE 端点路径(默认 /ai/chat/stream)。
   * 用户回答 AI 主动提问后续流走 /ai/chat/answer,需配合 extraBody 传 questionId + answer。 */
  path?: string
  /** 透传到请求 body 的额外字段(如 /chat/answer 的 questionId / answer)。 */
  extraBody?: Record<string, unknown>
  /** 绑定的 agent ID:透传到后端,后端在 SSE chunk 顶层注入 agentId。
   * 前端 onAgentDelta 据此分流到 subagent 卡片;缺失时降级为单 agent 模式。 */
  agentId?: string
  /** 多 agent 多路复用回调:chunk 带 agentId 时触发,与 onDelta 互斥(有 agentId 走此回调,无则走 onDelta)。 */
  onAgentDelta?: (agentId: string, delta: string) => void
  /** Agent 工具名列表(2026-07-22 立,AI 浏览器/电脑控制):
   *  传入工具名列表后,后端走 tool loop(complete→tool_calls→execute→astream)。
   *  如 ["browser_screenshot", "computer_mouse_click"] */
  agentTools?: string[]
  /** AI 工具调用回调(2026-07-22 立,P2 联动 WorkPanel):
   *  - toolCallStart:Vercel AI SDK 协议 type 9(tool-call-streaming-start)或 type 8(tool-call)
   *  - toolCallResult:type 7(tool-result)或自定义 tool_result 事件
   *  触发 WorkPanel.openPanel({ url, source: 'ai-tool' }) */
  onToolCall?: (event: ToolCallEvent) => void
  /** 工具调用汇总回调(2026-07-31 立,AI 对话可视化深度接入):
   *  后端在 SSE 流末尾发出 `type: 'tool-summary'` 聚合事件时触发,前端写入 message.toolCallSummary。
   *  缺失时前端可降级从 onToolCall 累加的 toolCalls 数组本地聚合。
   *  注意:本回调仅扩展类型签名,streamChat 实现解析逻辑由 A2/A3 任务补齐。 */
  onToolSummary?: (summary: ToolSummaryEvent) => void
  /** Subagent 自动派发回调(2026-07-28 立, Work):
   *  主 agent 在对话流中调用 dispatch_subagent 工具时,后端发 subagent_spawn/end SSE 事件,
   *  前端进度面板自动展示 subagent 生命周期(spawned → running → done/failed)。 */
  onSubagentSpawn?: (event: SubagentSpawnEvent) => void
  onSubagentEnd?: (event: SubagentEndEvent) => void
  /** Subagent 执行进度回调(2026-07-28 立):
   *  subagent 执行期间后端实时发 subagent_progress SSE 事件(thinking/tool_call/tool_result/output_ready),
   *  前端进度面板据此实时更新 subagent 状态,消除 spawn→end 之间的"黑盒等待"。 */
  onSubagentProgress?: (event: SubagentProgressEvent) => void
  /** Plan 更新回调(2026-08-01 Phase 4a:消息级 plan steps inline 展示) */
  onPlanUpdate?: (event: PlanUpdateEvent) => void
  /** 终端任务开始回调(2026-08-01 Phase 4a:消息级 terminal tasks inline 展示) */
  onTerminalStart?: (event: TerminalStartEvent) => void
  /** 终端任务结束回调(2026-08-01 Phase 4a:消息级 terminal tasks inline 展示) */
  onTerminalEnd?: (event: TerminalEndEvent) => void
  /** 终端实时输出增量回调(2026-09-18 立,消息级 terminal inline 实时回显)。
   *  命令执行期间后端逐块下发 terminal_delta SSE 事件,前端按 terminalId 累加到 store.terminalOutputs,
   *  与 onTerminalStart/End(任务级生命周期)互补:本回调负责命令执行中的流式文本。 */
  onTerminalDelta?: (event: TerminalDeltaEvent) => void
  /** 自动重连最大次数(默认 3)。网络错误指数退避重连,业务错误(401/403/429)不重连 */
  maxRetries?: number
  /** 自动重连前回调(前端可显示"网络波动,正在重连…") */
  onReconnect?: (attempt: number, delayMs: number) => void
  /** 2026-07-27 立:fetch 成功(response.ok)后立即触发,早于 onDelta/onReasoning。
   *  用途:前端收到 response 即清除"完全冷启动"超时(timeout15s),
   *  避免"response 已到达但首个 token 未到达"时误 abort。 */
  onResponse?: () => void
  /** 2026-09-13 立,#11 Citations 全链路:knowledge_lookup 工具执行后,
   *  后端在 done 前下发 `event: citations` SSE 事件,前端据此写入 message.citations,
   *  MessageItem 渲染 CitationBar(来源标签 + 可点击 URL)。 */
  onCitations?: (event: CitationsEvent) => void
  /** P1 #27(2026-09-16 立):记忆更新可视化「已记住」提示条数据源。
   *  ai-service 在 done 事件 payload 携带 memoryUpdates: string[](本轮 LTM 新增条目摘要),
   *  前端据此在对应助手消息下方渲染「已记住:N 条」提示条。空数组表示本轮无新记忆。 */
  onMemoryUpdates?: (event: MemoryUpdatesEvent) => void
  /** Token 用量回调:后端在 SSE 流末尾发送 usage 事件时触发,
   *  前端据此更新消息 meta.usage(UI 展示 token 数 / 耗时 / 模型)。
   *
   *  D1(2026-09-19 立)升级:事件契约从「OpenAI 协议 usage chunk」扩展为
   *  「命名帧 event: usage / type:'usage'」,新增 reasoningTokens / 耗时 / 模型 /
   *  消息 id / 成本字段。旧 OpenAI 协议(json.usage 字段)仍兼容(见 tryParseUsage)。 */
  onUsage?: (usage: UsageEvent) => void
  /** Steer(中途引导,2026-09-19 立):流式对话期间用户提交的引导文本被 tool loop
   *  注入 messages 时触发(每条引导一次)。前端据此把消息 badge 从「排队中」换成
   *  「引导已生效」,用户确认引导已被 AI 下一轮看到。 */
  onSteer?: (event: SteerEvent) => void
  /** Budget 用量分档提醒(2026-09-19 立,网关发):流首网关按用户当日 AI 用量分档
   *  下发 warning(80%~95%)/critical(95%~100%)提醒帧,前端 toast 提示用量进度;
   *  ≥100% 为 HTTP 429 硬中断(errorCode 'BUDGET_EXHAUSTED'),走 onError 路径。 */
  onBudget?: (event: BudgetEvent) => void
  /** D34 运行环境交代(2026-09-22 立):后端在**真正生效**的上下文注入之后、任何增量之前
   *  下发本帧,前端据此显示"本轮回答带了哪些注入"(自定义指令 / 工作区记忆 / Repo Wiki /
   *  检索上下文)。此前该帧只被"不喷进正文"地丢弃,等于生产了却没人看。 */
  onInjectionApplied?: (event: InjectionAppliedEvent) => void
  /** D39 重试交代(2026-09-22 立):网关要换 key / 退避重试时下发,前端显示"第 N/M 次重试,
   *  Xs 后继续"。没有它,用户在流上看到的只是"卡住"。 */
  onRetryScheduled?: (event: RetryScheduledEvent) => void
  /** D77 对话流业务表单(2026-09-25 立,G-106):后端请在消息流内让用户填一张业务表单
   *  (邮件撰写 / 日历创建·更新)时下发本帧。前端把请求挂到对应 assistant 消息并渲染
   *  BusinessFormCard,用户的批准/拒绝经 `postFormResponse` 走**同一条会话通道**回传
   *  (形态与 tool-delegate → postToolResult 完全同族)。
   *  成对动作是协议要求:`actions` 必同时含 approve 与 reject,缺一条的帧在解析层即被丢弃。 */
  onFormRequest?: (event: FormRequestEvent) => void
  /** 2026-08-15 立:显式声明流式模式,默认 true。
   *  后端 detectStreamUsage 依赖 request.stream===true 才启用 usage chunk 注入,
   *  不传或传 false 会导致 usage 缺失,token 显示为 0。 */
  stream?: boolean
}

/** Subagent 派发生成事件(2026-07-28 立,ai-service tool loop 中 dispatch_subagent 工具执行前发出) */
export interface SubagentSpawnEvent {
  id: string
  role: string
  task: string
  timestamp: string
  /** 关联到触发该 subagent 的 assistant 消息 ID(2026-07-31 Phase 2) */
  messageId?: string
}

/** Subagent 派发结束事件(dispatch_subagent 工具执行后发出) */
export interface SubagentEndEvent {
  id: string
  status: 'done' | 'failed'
  failureReason?: string
  timestamp: string
  /** 关联到触发该 subagent 的 assistant 消息 ID(2026-07-31 Phase 2) */
  messageId?: string
}

/** Subagent 执行进度事件(2026-07-28 立,subagent 执行期间实时发出):
 *  - phase='thinking': subagent 开始 LLM 调用(含 iteration)
 *  - phase='tool_call': subagent 开始调用工具(含 tool name + iteration)
 *  - phase='tool_result': subagent 工具返回(含 tool name + ok + iteration)
 *  - phase='output_ready': subagent 最终输出就绪(含 output_preview)
 *  前端进度面板据此实时更新 subagent 状态,消除 spawn→end 之间的"黑盒等待"。 */
export interface SubagentProgressEvent {
  id: string
  phase: 'thinking' | 'tool_call' | 'tool_result' | 'output_ready'
  timestamp: string
  /** 当前迭代轮次(phase=thinking/tool_call/tool_result 时存在) */
  iteration?: number
  /** 工具名(phase=tool_call/tool_result 时存在) */
  tool?: string
  /** 工具是否成功(phase=tool_result 时存在) */
  ok?: boolean
  /** 输出预览(phase=output_ready 时存在,截断 200 字符) */
  outputPreview?: string
  /** agent 名称(并行模式下标识哪个 agent) */
  agentName?: string
  /** 关联到触发该 subagent 的 assistant 消息 ID(2026-07-31 Phase 2) */
  messageId?: string
}

/** AI 工具调用 SSE 事件(跨端共享) */
export type ToolCallEvent =
  | {
      type: 'tool-call-start'
      toolCallId: string
      toolName: string
      args?: Record<string, unknown>
      /** 工具来源(2026-07-31 立,ToolCallCard 区分原生/MCP 工具):builtin=内置 / plugin=插件市场 / mcp=MCP server */
      serverSource?: 'builtin' | 'plugin' | 'mcp'
      /** MCP server ID(serverSource='mcp' 时由后端透传,如 'context7' / 'filesystem' / 'github') */
      serverId?: string
      /** MCP server 显示名(serverSource='mcp' 时由后端透传,如 'Context7 MCP' / 'Filesystem MCP') */
      serverName?: string
    }
  | {
      type: 'tool-result'
      toolCallId: string
      toolName: string
      args?: Record<string, unknown>
      result?: unknown
      isError?: boolean
      /** 工具来源(2026-07-31 立,与 tool-call-start 一致;tool-result 事件可复用同一标识) */
      serverSource?: 'builtin' | 'plugin' | 'mcp'
      serverId?: string
      serverName?: string
      /**
       * 媒体产物顶层扁平化(2026-09-09 立,与后端 llm.py tool-result 事件对齐):
       * 媒体工具(图/视频/音乐/改图/TTS)产物 URL 与异步任务 ID 提到事件顶层,
       * 前端无需深挖 result 嵌套即可渲染;超长 data URI 后端已过滤不推送。
       */
      image_url?: string
      audio_url?: string
      video_url?: string
      task_id?: string
    }

/**
 * 工具调用汇总 SSE 事件(2026-07-31 立,AI 对话可视化深度接入)。
 * 在 SSE 流末尾由后端聚合发出(`type: 'tool-summary'`),前端收到后直接写入 message.toolCallSummary。
 * 字段与 @ihui/types/ai 的 ToolCallSummary 对齐,但此处作为 SSE 线上传输契约独立定义。
 * 未收到时前端可降级从 toolCalls 数组本地聚合。
 */
export interface ToolSummaryEvent {
  filesSearched: number
  webSearched: number
  filesModified: number
  linesAdded: number
  linesDeleted: number
  toolsByCategory: Record<string, number>
  totalCalls: number
  totalDurationMs?: number
}

export function parseStreamLine(line: string): string | null {
  if (!line || line.startsWith(':')) return null
  let data = line
  if (line.startsWith('data:')) {
    data = line.slice(5).replace(/^\s/, '')
  } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
    return null
  }
  if (data === '[DONE]') return null
  // Vercel AI SDK data-stream protocol: `TYPE:JSON`（type 0 = 文本 token，其他类型目前忽略）
  const proto = data.match(/^(\d+):(.*)$/s)
  if (proto?.[1] !== undefined) {
    if (proto[1] === '0') {
      try {
        const parsed = JSON.parse(proto[2]!)
        if (typeof parsed === 'string') return parsed
      } catch {
        /* fallthrough */
      }
    }
    return null
  }
  try {
    const json = JSON.parse(data)
    if (json?.type === 'error' && typeof json?.message === 'string') {
      throw attachErrorMeta(new Error(json.message), json)
    }
    if (json?.error === true && typeof json?.error_message === 'string') {
      throw attachErrorMeta(new Error(json.error_message), json)
    }
    if (json?.error && typeof json?.error === 'string') {
      // OpenAI 错误格式:{ "error": { "message": "...", "code": "..." } } / { "error": "rate limit", "code": 429 }
      const e = new Error(
        typeof json.error === 'string' ? json.error : (json.error.message ?? 'AI 服务异常'),
      )
      throw attachErrorMeta(e, json)
    }
    // P3-4: 识别 {code:"RATE_LIMIT", retryAfter:N, message:"..."} 格式(无 type/error 字段)
    // 该格式由后端限流中间件发出,无 type/error 字段时上方 3 个分支均不命中,retryAfter 会被丢弃
    if (typeof json?.code === 'string' && typeof json?.message === 'string') {
      const e = new Error(json.message)
      throw attachErrorMeta(e, json)
    }
    if (json?.type === 'reasoning') return null
    // 2026-09-18 立:thinking / terminal_delta / compaction 走专用通道,
    // 绝不能回落成正文增量(parseStreamLine 对每行都会调用,必须在兜底抽取前拦截)。
    if (json?.type === 'thinking') return null
    if (json?.type === 'terminal_delta') return null
    if (json?.type === 'compaction') return null
    // D1(2026-09-19 立):usage 命名帧走专用通道(tryParseUsage),
    // 同样不可回落成正文增量(历史坑:带 content 的未知帧曾喷进正文;
    // 本帧不含 content,但仍显式分流,绝不落入 onDelta)。
    if (json?.type === 'usage') return null
    // Steer(2026-09-19 立):中途引导注入确认帧走专用通道(tryParseSteer)。
    // 本帧带 text 字段,不拦截会被下方兜底抽取链(json?.text)喷进正文增量
    // (与上方 usage 帧同一坑位,必须在兜底抽取前拦截)。
    if (json?.type === 'steer') return null
    // Budget(2026-09-19 立):网关用量分档提醒帧走专用通道(tryParseBudget)。
    // 不拦截同样会被下方兜底抽取链喷进正文增量(与 steer 同一坑位,必须在兜底前拦截)
    if (json?.type === 'budget') return null
    // D34(2026-09-22 立):运行环境交代帧必须显式分流。injection_applied 带 collapsed/fullText、
    // retry_scheduled 带 message —— 不拦截会被下方兜底抽取链喷进正文增量,
    // 历史坑位与 usage/steer/budget 同一处。
    // (settings_applied 与 terminal_output 两帧已于第 36 轮从契约收回,见 sse_contract.py)
    if (json?.type === 'injection_applied') return null
    if (json?.type === 'retry_scheduled') return null
    const choice = json?.choices?.[0]
    const delta =
      choice?.delta?.content ??
      choice?.message?.content ??
      json?.content ??
      json?.delta ??
      json?.text
    return typeof delta === 'string' ? delta : null
  } catch (e) {
    if (e instanceof SyntaxError) return data
    throw e
  }
}

function attachErrorMeta(err: Error, json: Record<string, unknown>): Error {
  err.name = 'SSEError'
  const code =
    typeof json.code === 'number'
      ? json.code
      : typeof json.statusCode === 'number'
        ? json.statusCode
        : typeof json.status === 'number'
          ? json.status
          : undefined
  if (code !== undefined) (err as Error & { code: number }).code = code
  if (typeof json.errorCode === 'string') {
    ;(err as Error & { errorCode: string }).errorCode = json.errorCode
  }
  if (typeof json.retryAfter === 'number') {
    ;(err as Error & { retryAfter: number }).retryAfter = json.retryAfter
  }
  return err
}

/**
 * 从 SSE data: 行提取顶层 agentId 字段。
 * 仅 JSON 对象格式支持(`data: {"choices":[...],"agentId":"..."}`);
 * Vercel AI SDK `0:"token"` / 纯文本 / 非 JSON → undefined。
 */
export function extractAgentId(line: string): string | undefined {
  if (!line || line.startsWith(':')) return undefined
  let data = line
  if (line.startsWith('data:')) {
    data = line.slice(5).replace(/^\s/, '')
  } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
    return undefined
  }
  if (!data || data === '[DONE]') return undefined
  // Vercel AI SDK 协议 `0:"..."` → 无 agentId
  if (/^\d+:/.test(data)) return undefined
  if (!data.startsWith('{')) return undefined
  try {
    const json = JSON.parse(data) as Record<string, unknown>
    if (typeof json?.agentId === 'string') return json.agentId
  } catch {
    /* 非 JSON */
  }
  return undefined
}

/** P4-2: 后端 fallback 事件 — 主模型失败切换到备用模型时,后端在 chunk 产出前发送此事件 */
export interface FallbackEvent {
  /** 原模型(失败的主模型) */
  primaryModel: string
  /** 备用模型(切换到的) */
  backupModel: string
  /** 切换原因(timeout/rate_limit/api_error/unknown) */
  reason: string
}

/**
 * Steer(中途引导,2026-09-19 立):流式对话期间用户经 steer 端点提交引导文本,
 * ai-service tool loop 每轮 LLM 调用前 drain 注入 messages 时下发注入确认事件。
 *
 * SSE 事件格式(契约见 packages/shared/src/sse/contract.ts):
 *   event: steer
 *   data: {"type":"steer","phase":"injected","text":"用户引导文本",
 *          "timestamp":"ISO(入队时间)","messageId":"assistant 消息 ID"}
 *
 * 前端 onSteer 据此把消息从「排队中」换成「引导已生效」badge。
 */
export interface SteerEvent {
  /** 当前仅 "injected"(已注入 messages);预留扩展 */
  phase: 'injected'
  /** 用户引导文本(注入 messages 的原文,≤4000 字符) */
  text: string
  /** 入队时间(ISO,来自 steer 端点) */
  timestamp?: string
  /** 所属 assistant 消息 ID(流启动即确定,便于前端挂 badge) */
  messageId?: string
}

/**
 * Budget 用量分档提醒事件(2026-09-19 立,网关发):流开始前网关按用户当日 AI 用量
 * 三态分档,80%~95% 发 level:'warning'(软提醒)、95%~100% 发 level:'critical'(硬预警),
 * 均为流首命名帧不中断流(≥100% 为 HTTP 429 硬中断,不走本事件,走 onError +
 * errorCode 'BUDGET_EXHAUSTED')。前端 onBudget 据此 toast 提示用量进度。
 *
 * wire 格式(命名帧):
 *   event: budget
 *   data: {"type":"budget","level":"warning","percent":85.3,"usedTokens":85300,
 *          "limitTokens":100000,"tier":"个人版","resetAt":"2026-09-20T16:00:00.000Z"}
 */
export interface BudgetEvent {
  /** 档位:warning(80%~95%)| critical(95%~100%) */
  level: 'warning' | 'critical'
  /** 当日已用占限额百分比(0~100) */
  percent?: number
  /** 当日已用 tokens */
  usedTokens?: number
  /** 当日限额 tokens */
  limitTokens?: number
  /** 用户预算档位名(如 VIP 等级名,可选) */
  tier?: string
  /** 限额重置时间(ISO,东八区次日 0 点,可选) */
  resetAt?: string
}

/**
 * D34 上下文注入交代帧(2026-09-22 立)。
 *
 * SSE 事件格式:
 *   event: injection_applied
 *   data: {"type":"injection_applied","kind":"workspace_memory","collapsed":"AGENTS.md · 3 条",
 *          "fullText":"…","messageId":"m-1"}
 *
 * kind 由后端定义(与 sse_contract.py 的 terminal_end/injection_applied 同一族);
 * collapsed 是行内展示用的短标签,fullText 是展开后的全文(可缺省)。
 */
export interface InjectionAppliedEvent {
  kind: string
  /** 行内短标签(必填:没有它界面就无处可显示) */
  collapsed: string
  /** 展开全文;后端超出可携带上限时整字段省略(不给假的"展开"入口) */
  fullText?: string
  /** auto_context 场景的上下文段数(界面按 ICU plural 出措辞) */
  count?: number
  messageId?: string
}

/**
 * D39 重试交代帧(2026-09-22 立)。attempt 从 1 起;retryInMs=0 表示立即重试
 * (如号池换 key),>0 表示退避等待。
 */
export interface RetryScheduledEvent {
  attempt: number
  maxRetries: number
  retryInMs: number
  httpStatus?: number
  messageId?: string
}

/**
 * D77 对话流业务表单请求帧(2026-09-25 立,G-106)。
 *
 * SSE 事件格式(与 packages/shared/src/sse/contract.ts 的 form_request 成员逐字段同形):
 *   event: form_request
 *   data: {"type":"form_request","requestId":"frm-1","sessionId":"s-1",
 *          "kind":"email","fields":[{"key":"to","type":"email","required":true}],
 *          "actions":["approve","reject"],"messageId":"m-1"}
 *
 * fields / actions 的形状**不在本文件重定义**:判定层
 * packages/shared/src/chat/business-forms.ts 的 BUSINESS_FORM_FIELDS 是唯一字段表,
 * 本端只做"字段名照抄、类型收窄"的 wire 镜像;校验/状态机全在那一侧。
 * 缺 requestId 或 actions 不成对(必须 approve+reject 两条)即视为畸形帧,不发回调。
 */
export interface FormRequestEvent {
  /** 应答锚点:提交 form_response 时原样带回 */
  requestId: string
  /** 上行回传通道会话 ID(与 tool-delegate 的 session_id 同族);缺省时端内不得自造 */
  sessionId?: string
  /** 'email' | 'calendarEvent'(判定层 BUSINESS_FORM_KINDS) */
  kind: string
  /** 字段集(key/type/required;type 取值见 FORM_FIELD_TYPES) */
  fields: Array<{ key: string; type: string; required: boolean; placeholderKey?: string }>
  /** 成对动作,恒为 ['approve','reject'] */
  actions: string[]
  messageId?: string
}

/**
 * D77 业务表单应答帧(**上行**)。
 *
 * 由 `buildFormResponseEvent()` 产出、`postFormResponse()` 发出,与 contract.ts 的
 * form_response 成员逐字段同形。成对判据:
 *   · action='approve' → 必带 values,不带 rejectReason
 *   · action='reject'  → 必带 rejectReason,**整字段省略 values**(拒绝零副作用:
 *     空对象会诱导后端建一条空记录)
 */
export interface FormResponseEvent {
  requestId: string
  kind: string
  action: 'approve' | 'reject'
  /** 仅 approve 携带 */
  values?: Record<string, string | readonly string[]>
  /** 仅 reject 携带 */
  rejectReason?: string
  messageId?: string
}

/** 业务表单成对动作(与判定层 FORM_ACTIONS 同取值;本包不依赖 @ihui/shared,故本地收窄) */
export const FORM_RESPONSE_ACTIONS = ['approve', 'reject'] as const

/** V3 #58(2026-09-26 立):主对话流工具审批请求事件。
 *  ai-service tool loop 在高危工具执行前发 `event: tool-approval` 命名帧,
 *  payload 与 agent 任务流 tool-approval 事件同形(snake_case wire 形态),
 *  本接口为 streamChat 回调消费形态(camelCase)。决策经 postToolApprovalResponse
 *  回传 ai-service 流级审批端点(与 postToolResult 同族,不经网关)。 */
export interface ToolApprovalEvent {
  type: 'tool-approval'
  /** 审批请求唯一 id(决策回传时随响应带回) */
  approvalId: string
  /** 目标工具名(如 run_command / write_file) */
  toolName: string
  /** 工具调用 id */
  toolCallId: string
  /** 参数预览(后端截断 200 字符) */
  argsPreview: string
  /** 危险等级 */
  dangerLevel: 'high' | 'medium' | 'low'
  /** 发起审批的流会话 id(回传端点寻址用) */
  sessionId?: string
}

/**
 * 阶段 2:工具委托执行事件(2026-08-02 立,浏览器端工具执行代理)。
 *
 * ai-service 在远程服务器无法访问用户本地文件,当 LLM 调用 fs 类工具
 * (read_file/search_codebase/file_edit 等)时,ai-service 通过 SSE
 * `tool-delegate` 事件委托前端执行,前端用 FileSystemDirectoryHandle 读取/写入文件,
 * 通过 postToolResult POST API 回传结果,唤醒 tool loop 中等待的 asyncio.Event。
 *
 * SSE 事件格式:
 *   event: tool-delegate
 *   data: {"session_id":"<uuid>","tool_call_id":"<tc_id>","tool_name":"read_file","args":{"path":"src/index.ts"},"iteration":1,"type":"tool-delegate"}
 */
export interface ToolDelegateEvent {
  session_id: string
  tool_call_id: string
  tool_name: string
  args: Record<string, unknown>
  iteration: number
  type: string
}

/**
 * P4-2: 从 SSE data: 行解析 fallback 事件。
 *
 * 后端 llm_gateway.py astream fallback 分支在 chunk 产出前 yield:
 *   {type:"fallback", primary_model, backup_model, reason}
 * api 端 streamToClient 自动透传为 SSE `data: {...}` 行。
 *
 * 与 parseStreamLine 并列:use-chat.ts 在调 parseStreamLine 之前先调本函数,
 * 命中即触发 onFallback 回调展示"已切换到备用模型"横幅,不再走 parseStreamLine。
 *
 * @returns 解析成功返回 FallbackEvent,非 fallback 事件或解析失败返回 null
 */
export function parseFallbackEvent(line: string): FallbackEvent | null {
  if (!line || line.startsWith(':')) return null
  let data = line
  if (line.startsWith('data:')) {
    data = line.slice(5).replace(/^\s/, '')
  } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
    return null
  }
  if (!data || data === '[DONE]') return null
  // Vercel AI SDK 协议 `0:"..."` → 非 fallback 事件
  if (/^\d+:/.test(data)) return null
  if (!data.startsWith('{')) return null
  try {
    const json = JSON.parse(data) as Record<string, unknown>
    if (json?.type === 'fallback' && typeof json?.primary_model === 'string') {
      return {
        primaryModel: json.primary_model,
        backupModel: typeof json.backup_model === 'string' ? json.backup_model : 'unknown',
        reason: typeof json.reason === 'string' ? json.reason : 'unknown',
      }
    }
  } catch {
    /* 非 JSON 或格式不符,返回 null */
  }
  return null
}

export function parseStreamLineReasoning(line: string): string | null {
  if (!line || line.startsWith(':')) return null
  let data = line
  if (line.startsWith('data:')) {
    data = line.slice(5).replace(/^\s/, '')
  } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
    return null
  }
  if (data === '[DONE]') return null
  try {
    const json = JSON.parse(data)
    if (json?.type === 'error' && typeof json?.message === 'string') {
      const e = new Error(json.message)
      e.name = 'SSEError'
      throw e
    }
    if (json?.error === true && typeof json?.error_message === 'string') {
      const e = new Error(json.error_message)
      e.name = 'SSEError'
      throw e
    }
    if (json?.type === 'reasoning' && typeof json?.content === 'string') return json.content
    const choice = json?.choices?.[0]
    const reasoning =
      choice?.delta?.reasoning_content ?? choice?.message?.reasoning_content ?? json?.reasoning
    return typeof reasoning === 'string' ? reasoning : null
  } catch (e) {
    if (e instanceof SyntaxError) return null
    throw e
  }
}

/**
 * 厂商账号额度耗尽(2026-09-22 批次 60 立,与 ai-service `llm_gateway.PROVIDER_QUOTA_EXHAUSTED` 同名)。
 * 仅在"判定为账号额度/欠费且全部候选通道都失败"时出现;ai-service 未登记该码的 HTTP 状态,
 * 实际仍是默认 502,因此**只能靠 errorCode 判定,不能靠 HTTP 码**。
 */
export const PROVIDER_QUOTA_EXHAUSTED = 'PROVIDER_QUOTA_EXHAUSTED' as const

/** 同族等效替换的 fallback 事件 reason(与 ai-service `FALLBACK_REASON_QUOTA_EQUIVALENT` 对齐)。 */
export const FALLBACK_REASON_QUOTA_EQUIVALENT = 'quota_equivalent' as const

/**
 * 非 i18n 端(extension / mobile-rn / cli / miniapp-taro)的兜底文案。
 * web 端不使用此处常量,而走 i18n key `chat.quotaExhaustedTitle` / `chat.quotaExhaustedNotice`,
 * 避免在共享层维护第二套错误表 —— 共享层只负责"分类 + 默认可读文案"。
 */
const QUOTA_EXHAUSTED_ZH = {
  title: '厂商账号额度已用尽',
  message:
    '该模型所属厂商的账号额度已用完(不是你的账户问题),平台已自动尝试改道其他通道仍未成功。请稍后再试,或改选带「免费」标识的模型。',
}

/**
 * 错误码元信息 — 从 Error 对象 / 错误 JSON / 状态码中提取的结构化字段。
 *
 * 跨端使用:`web` / `mobile-rn` / `desktop` / `extension` / `CLI` / `miniapp-taro`
 * 都通过 `getSSEErrorInfo` 统一提取,再用 `formatSSEError` 渲染为用户可见文本。
 */
export interface SSEErrorInfo {
  code?: number
  errorCode?: string
  retryAfter?: number
  /** 可恢复标记:true 表示网络错误但已耗尽自动重连次数,前端可显示"网络不稳定,可手动重试" */
  recoverable?: boolean
}

/**
 * 错误严重等级 — 用于决定不同 UI 交互:
 * - `auth`     → 跳登录弹窗
 * - `forbidden`→ Toast 提示权限不足
 * - `ratelimit`→ Toast 提示稍后重试(可能附带 retryAfter)
 * - `safety`   → Toast 提示内容被 AI 厂商安全策略拦截(非项目违规判定)
 * - `server`   → Toast 提示服务异常,可重试
 * - `network`  → Toast 提示网络问题
 * - `unknown`  → 兜底 Toast
 */
export type SSEErrorSeverity =
  'auth' | 'forbidden' | 'ratelimit' | 'safety' | 'server' | 'network' | 'unknown'

export interface FormattedSSEError {
  code?: number
  errorCode?: string
  retryAfter?: number
  severity: SSEErrorSeverity
  title: string
  message: string
  rawMessage: string
  requireReauth: boolean
  /**
   * 重试是否可能改变结果。`false` = 重试必然再撞同一堵墙(如厂商账号额度耗尽),
   * 各端据此隐藏"立即重试"按钮 / 跳过自动退避重试。`undefined` 按可重试处理(向后兼容)。
   */
  retryable?: boolean
}

function asString(v: unknown): string | undefined {
  if (typeof v === 'string' && v.length > 0) return v
  return undefined
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

/**
 * 从错误对象 / 字符串 / 任意异常中提取 SSE 错误元信息。
 *
 * 兼容多种数据源:
 * 1. `Error` 对象挂载的 `code` / `errorCode` / `retryAfter` 字段(由各端 SSE 解析器填充)
 * 2. 错误消息文本中的"请求失败(401)"格式回退
 * 3. 字符串中嵌入的 `code=XXX` / `errorCode=XXX` 模式
 */
export function getSSEErrorInfo(err: unknown): SSEErrorInfo | undefined {
  if (!err) return undefined
  const out: SSEErrorInfo = {}
  const sources: unknown[] = []
  if (err instanceof Error) {
    sources.push(err)
    if (err.message) sources.push(err.message)
    const anyErr = err as Error & Record<string, unknown>
    if (anyErr.code !== undefined) sources.push({ code: anyErr.code })
    if (anyErr.statusCode !== undefined) sources.push({ statusCode: anyErr.statusCode })
    if (anyErr.errorCode !== undefined) sources.push({ errorCode: anyErr.errorCode })
    if (anyErr.retryAfter !== undefined) sources.push({ retryAfter: anyErr.retryAfter })
  } else if (typeof err === 'string') {
    sources.push(err)
  } else {
    sources.push(err)
  }

  for (const src of sources) {
    if (typeof src === 'string') {
      const m = src.match(/[（(](\d{3})[)）]/)
      if (m && out.code === undefined) {
        const n = Number(m[1])
        if (Number.isFinite(n)) out.code = n
      }
      const codeMatch = src.match(/code=([0-9]{3})/)
      if (codeMatch && out.code === undefined) {
        const n = Number(codeMatch[1])
        if (Number.isFinite(n)) out.code = n
      }
      const errCodeMatch = src.match(/errorCode=([A-Z0-9_]+)/)
      if (errCodeMatch && out.errorCode === undefined) {
        out.errorCode = errCodeMatch[1]
      }
      continue
    }
    if (typeof src !== 'object' || src === null) continue
    const obj = src as Record<string, unknown>
    if (out.code === undefined) {
      const c = asNumber(obj.code) ?? asNumber(obj.statusCode) ?? asNumber(obj.status)
      if (c !== undefined) out.code = c
    }
    if (out.errorCode === undefined) {
      const ec = asString(obj.errorCode) ?? asString(obj.error_code)
      if (ec) out.errorCode = ec
    }
    if (out.retryAfter === undefined) {
      const r = asNumber(obj.retryAfter) ?? asNumber(obj.retry_after)
      if (r !== undefined) out.retryAfter = r
    }
  }

  if (out.code === undefined && out.errorCode === undefined && out.retryAfter === undefined) {
    return undefined
  }
  return out
}

/**
 * 把任意异常/错误消息规范化为用户可见的格式化错误。
 *
 * 用法:
 * ```ts
 * try {
 *   await streamChat(...)
 * } catch (err) {
 *   const f = formatSSEError(err)
 *   if (f.severity === 'auth') openLoginDialog()
 *   toast.error(f.title, { description: f.message })
 * }
 * ```
 */
export function formatSSEError(
  err: unknown,
  fallbackMessageOrInfo: string | SSEErrorInfo = 'AI 服务异常',
): FormattedSSEError {
  // P3-4: 第二参数兼容两种形态 — 字符串(fallbackMessage,旧调用方)或 SSEErrorInfo(onError 透传 info)
  // onError 回调只拿到 errMsg 字符串 + info 对象,字符串本身不带 retryAfter,需通过 info 注入
  let fallbackMessage = 'AI 服务异常'
  let extraInfo: SSEErrorInfo | undefined
  if (typeof fallbackMessageOrInfo === 'string') {
    fallbackMessage = fallbackMessageOrInfo
  } else {
    extraInfo = fallbackMessageOrInfo
  }

  let rawMessage: string
  if (err instanceof Error) {
    rawMessage = err.message || fallbackMessage
  } else if (typeof err === 'string' && err.length > 0) {
    rawMessage = err
  } else if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message
    rawMessage = typeof m === 'string' && m.length > 0 ? m : fallbackMessage
  } else {
    rawMessage = fallbackMessage
  }

  // P3-4: extraInfo(onError 路径透传)优先于 getSSEErrorInfo(err)(catch 路径从 Error 对象提取)
  // onError 路径 err 是纯字符串,不含 retryAfter,必须靠 extraInfo 补全
  const extractedInfo = getSSEErrorInfo(err)
  const code = extraInfo?.code ?? extractedInfo?.code
  const errorCode = extraInfo?.errorCode ?? extractedInfo?.errorCode
  const retryAfter = extraInfo?.retryAfter ?? extractedInfo?.retryAfter

  // 厂商账号额度耗尽:必须在 detectSafetyViolation / HTTP 状态码分支之前判定。
  // ai-service 的 status_map 未登记该码,实际仍回落默认 502 → 若先走 code>=500 分支会被误判成
  // "AI 服务暂时不可用,请稍后重试",而重试必然再撞同一堵墙(所有候选通道都已因欠费失败)。
  // rawMessage 保留后端点名归因("所有通道均因账号额度耗尽失败: qwen-plus[qwen]=..."),
  // 各端 toast 继续以 [PROVIDER_QUOTA_EXHAUSTED] 前缀透出以便排障。
  if (errorCode === PROVIDER_QUOTA_EXHAUSTED) {
    return {
      code,
      errorCode,
      retryAfter,
      severity: 'server',
      title: QUOTA_EXHAUSTED_ZH.title,
      message: QUOTA_EXHAUSTED_ZH.message,
      rawMessage,
      requireReauth: false,
      retryable: false,
    }
  }

  // 优先识别 LLM 厂商内容安全策略拦截关键词
  // 这些错误来自上游 LLM(Gemini/OpenAI/Anthropic),不是项目本身的违规判定
  // 识别后给出清晰提示,避免用户误以为是项目违规判定导致对话被自动结束
  const safetyHit = detectSafetyViolation(rawMessage, errorCode)
  if (safetyHit) {
    return {
      code,
      errorCode,
      retryAfter,
      severity: 'safety',
      title: '内容被 AI 厂商安全策略拦截',
      message: safetyHit,
      rawMessage,
      requireReauth: false,
    }
  }

  if (code === 401) {
    return {
      code,
      errorCode,
      retryAfter,
      severity: 'auth',
      title: '登录已过期',
      message: '登录已过期,请重新登录',
      rawMessage,
      requireReauth: true,
    }
  }
  if (code === 403) {
    return {
      code,
      errorCode,
      retryAfter,
      severity: 'forbidden',
      title: '访问被拒绝',
      message: '当前账户没有使用该 AI 模型的权限',
      rawMessage,
      requireReauth: false,
    }
  }
  if (code === 429) {
    const waitHint = retryAfter ? `${retryAfter} 秒后重试` : '请稍候再试'
    return {
      code,
      errorCode,
      retryAfter,
      severity: 'ratelimit',
      title: '请求过于频繁',
      message: `AI 服务请求频率超限,${waitHint}`,
      rawMessage,
      requireReauth: false,
    }
  }
  if (code !== undefined && code >= 500) {
    return {
      code,
      errorCode,
      retryAfter,
      severity: 'server',
      title: 'AI 服务异常',
      message: 'AI 服务暂时不可用,请稍后重试',
      rawMessage,
      requireReauth: false,
    }
  }
  if (code !== undefined && code >= 400) {
    return {
      code,
      errorCode,
      retryAfter,
      severity: 'server',
      title: '请求失败',
      message: rawMessage,
      rawMessage,
      requireReauth: false,
    }
  }
  if (isAbortError(err)) {
    return {
      code,
      errorCode,
      retryAfter,
      severity: 'network',
      title: '请求已取消',
      message: '请求已取消',
      rawMessage,
      requireReauth: false,
    }
  }
  // P3-4: 非 4xx/5xx 但带 retryAfter(如 SSE error {code:"RATE_LIMIT", retryAfter:N} 或
  // {type:"error", message:"...", retryAfter:N} 无 code 字段)→ 视为限流,追加倒计时到 message,
  // severity = ratelimit(触发 warning toast,非致命,与 429 一致不加 retry 按钮)
  // 429 已在上方分支处理(含 "N 秒后重试"),此处不重复,仅覆盖 code 缺失的限流场景
  if (retryAfter !== undefined && retryAfter >= 1) {
    return {
      code,
      errorCode,
      retryAfter,
      severity: 'ratelimit',
      title: '请求过于频繁',
      message: `${rawMessage}(${retryAfter} 秒后重试)`,
      rawMessage,
      requireReauth: false,
    }
  }
  const isNetwork = /network|fetch|timeout|abort|failed to fetch|err_network/i.test(rawMessage)
  return {
    code,
    errorCode,
    retryAfter,
    severity: isNetwork ? 'network' : 'unknown',
    title: isNetwork ? '网络异常' : 'AI 服务异常',
    message: isNetwork ? '网络连接失败,请检查网络后重试' : rawMessage,
    rawMessage,
    requireReauth: false,
  }
}

/**
 * 识别 LLM 厂商内容安全策略拦截关键词。
 *
 * 主流 LLM 厂商在内容被判定违规时会返回特定错误码/消息:
 * - OpenAI:    `content_policy_violation` / `content_policy` / 400 + "Your request was rejected as a result of our safety system"
 * - Anthropic: `output_length_stop` + "content filter" / 400 + "content that is unsafe"
 * - Gemini:    `SAFETY` / `RECITATION` / `BLOCKLIST` finishReason
 * - 通用:      "safety" / "policy" / "filtered" / "blocked" / "审查" / "违规"
 *
 * 命中返回清晰提示文案,未命中返回 null。
 * 该识别只针对上游 LLM 厂商的安全策略拦截,不是项目本身的违规判定。
 */
function detectSafetyViolation(message: string, errorCode?: string): string | null {
  const text = message.toLowerCase()
  const ec = (errorCode ?? '').toLowerCase()

  // Gemini finishReason
  if (/finishreason\s*=\s*safety/i.test(message)) {
    return '内容被 Gemini 安全策略拦截(SAFETY),请调整提问方式后重试'
  }
  if (/finishreason\s*=\s*recitation/i.test(message)) {
    return '内容被 Gemini 引用安全策略拦截(RECITATION),请减少大段引用后重试'
  }
  // OpenAI content_policy_violation
  if (ec === 'content_policy_violation' || text.includes('content_policy_violation')) {
    return '内容被 OpenAI 内容策略拦截,请调整提问方式后重试'
  }
  // Anthropic safety
  if (ec === 'safety_block' || (text.includes('"type":"error"') && text.includes('"safety"'))) {
    return '内容被 Anthropic 安全策略拦截,请调整提问方式后重试'
  }
  // 通用关键词兜底(需组合出现,避免误判普通错误)
  const safetyKeywords = [
    'safety',
    'content policy',
    'content filter',
    'safety system',
    'safety filter',
  ]
  const blockedKeywords = ['blocked', 'rejected', 'filtered']
  for (const sk of safetyKeywords) {
    if (text.includes(sk)) {
      for (const bk of blockedKeywords) {
        if (text.includes(bk)) {
          return '内容被 AI 厂商安全策略拦截,请调整提问方式后重试'
        }
      }
    }
  }
  return null
}

const STREAM_MAX_RETRIES = 3
const STREAM_INITIAL_RETRY_DELAY = 1000
const STREAM_MAX_RETRY_DELAY = 30_000

/**
 * 2026-08-06 修复:创建 AbortError 的安全工厂。
 * 微信小程序(weapp)等运行环境无 DOMException 全局对象,
 * `new DOMException(...)` 会抛 ReferenceError。回退到普通 Error。
 */
function createAbortError(message = 'Aborted'): Error {
  if (typeof DOMException !== 'undefined') {
    return new DOMException(message, 'AbortError')
  }
  const err = new Error(message)
  err.name = 'AbortError'
  return err
}

/** 指数退避等待,支持 AbortSignal 中断(用户主动取消重连) */
function sleepWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError())
      return
    }
    const onAbort = () => {
      clearTimeout(timer)
      reject(createAbortError())
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

export async function streamChat(opts: StreamChatOptions): Promise<void> {
  const maxRetries = opts.maxRetries ?? STREAM_MAX_RETRIES
  // 跨重连尝试共享的状态:Last-Event-ID(断点续传)+ 已接收内容(dedupe)
  const lastEventIdRef = { current: '' }
  const receivedContentRef = { current: '' }
  const receivedAgentRef = { current: new Map<string, string>() }
  let attempt = 0

  const token = tokenProvider.getToken()
  // 2026-07-27 修复 SSE 流被 Next.js dev proxy 中断:
  // streamChat 用 streamBaseUrl(直连 API 服务器),绕过 Next.js dev proxy 的超时/缓冲。
  // 普通请求仍用 baseUrl(走同源代理,cookie SSR 正常)。
  const url = normalizeUrl(opts.path ?? '/ai/chat/stream', true)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  // 2026-08-02 P2 修复：与 fetchApi/postApi/putApi/patchApi/deleteApi 保持一致，
  // 注入 X-Requested-With 配合后端 CSRF 防护(无 Bearer token 时走 cookie 兜底路径)
  if (!headers['X-Requested-With']) headers['X-Requested-With'] = 'XMLHttpRequest'
  if (userAgentHeader && !headers['User-Agent']) headers['User-Agent'] = userAgentHeader
  // 2026-08-02 设备维度风控
  await injectDeviceFingerprintHeader(headers)

  const body: Record<string, unknown> = { model: opts.model, messages: opts.messages }
  if (opts.metadata) body.metadata = opts.metadata
  if (opts.temperature !== undefined) body.temperature = opts.temperature
  if (opts.topP !== undefined) body.topP = opts.topP
  if (opts.topK !== undefined) body.topK = opts.topK
  if (opts.maxTokens !== undefined) body.maxTokens = opts.maxTokens
  if (opts.stop !== undefined) body.stop = opts.stop
  if (opts.workspacePath) body.workspacePath = opts.workspacePath
  if (opts.workspaceContext) body.workspaceContext = opts.workspaceContext
  // P1 #26:仅显式关闭时传 false(undefined/true 走后端默认开,不注入该 key 减小请求体积)
  if (opts.knowledgeContext === false) body.knowledgeContext = false
  if (opts.contextLimit !== undefined) body.contextLimit = opts.contextLimit
  if (opts.agentId) body.agentId = opts.agentId
  if (opts.agentTools && opts.agentTools.length > 0) body.agentTools = opts.agentTools
  // V3 #58(2026-09-26 立):权限模式档位透传。api-client 仅在字段存在时写入 body;
  // 网关 schema 已声明 permissionMode(否则 zod strip 静默丢弃,链路掐断),
  // 网关再以 permission_mode(snake_case)透传到 ai-service 审批门。
  if (opts.permissionMode) body.permissionMode = opts.permissionMode
  if (opts.extraBody) Object.assign(body, opts.extraBody)
  // 2026-08-15 立:streamChat 默认流式,后端 detectStreamUsage 依赖 request.stream===true 才启用 usage chunk。
  // 默认 true,允许 extraBody 或显式 opts.stream 覆盖为 false。
  body.stream = opts.stream ?? true

  while (true) {
    const isRetry = attempt > 0
    try {
      // 断点续传:每次尝试携带 Last-Event-ID(SSE 标准 resume 头),服务端支持则跳过已发送事件
      if (lastEventIdRef.current) headers['Last-Event-ID'] = lastEventIdRef.current

      if (opts.signal?.aborted) {
        opts.onDone?.()
        return
      }

      const resp = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: opts.signal,
        // 2026-07-27 跨域 SSE 直连:携带 credentials 让 CORS 允许凭证,
        // Bearer token 在 Authorization header 中不受影响。
        credentials: 'include',
      })
      if (!resp.ok || !resp.body) {
        const text = await resp.text().catch(() => '')
        let parsedBody: Record<string, unknown> | undefined
        try {
          if (text) parsedBody = JSON.parse(text) as Record<string, unknown>
        } catch {
          /* 非 JSON 响应忽略 */
        }
        const err = new Error(text || `请求失败（${resp.status}）`)
        ;(err as Error & { name: string }).name = 'SSEError'
        ;(err as Error & { code: number }).code = resp.status
        if (parsedBody) {
          const ec = parsedBody.errorCode
          if (typeof ec === 'string') {
            ;(err as Error & { errorCode: string }).errorCode = ec
          }
          const msg = parsedBody.message
          if (typeof msg === 'string' && msg) {
            err.message = `${msg}（${resp.status}）`
          }
        }
        const retryAfterHeader = resp.headers.get('retry-after')
        if (retryAfterHeader) {
          const n = Number(retryAfterHeader)
          if (Number.isFinite(n)) {
            ;(err as Error & { retryAfter: number }).retryAfter = n
          }
        }
        throw err
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      // 2026-07-27 立:response 已到达,立即触发 onResponse 回调,
      // 让前端清除"完全冷启动"超时(timeout15s),避免"response 到达但首 token 未到达"时误 abort。
      opts.onResponse?.()
      const hasReasoning = typeof opts.onReasoning === 'function'
      const hasCompaction = typeof opts.onCompaction === 'function'
      const hasQuestion = typeof opts.onQuestion === 'function'
      const hasAgentDelta = typeof opts.onAgentDelta === 'function'
      const hasToolCall = typeof opts.onToolCall === 'function'
      // P4-2: fallback 事件回调存在时启用解析
      const hasFallback = typeof opts.onFallback === 'function'
      // Subagent 自动派发(2026-07-28 立):任一回调存在时启用解析
      const hasSubagent =
        typeof opts.onSubagentSpawn === 'function' ||
        typeof opts.onSubagentEnd === 'function' ||
        typeof opts.onSubagentProgress === 'function'
      // 工具调用汇总(2026-07-31 立,AI 对话可视化):SSE 流末尾发出 type='tool-summary' 事件
      const hasToolSummary = typeof opts.onToolSummary === 'function'
      // 阶段 2:工具委托执行(浏览器端 fs 工具执行代理,2026-08-02 立)
      const hasToolDelegate = typeof opts.onToolDelegate === 'function'
      // V3 #58(2026-09-26 立):主对话流工具审批请求解析开关(onToolApproval 注册才解析)
      const hasToolApproval = typeof opts.onToolApproval === 'function'
      // W1(2026-09-12 立):plan / terminal SSE 事件能力检测
      const hasPlanUpdate = typeof opts.onPlanUpdate === 'function'
      const hasTerminal =
        typeof opts.onTerminalStart === 'function' && typeof opts.onTerminalEnd === 'function'
      // 终端实时输出增量(2026-09-18 立):onTerminalDelta 存在时启用解析
      const hasTerminalDelta = typeof opts.onTerminalDelta === 'function'
      // #11 Citations 全链路(2026-09-13 立):knowledge_lookup 工具执行后下发引用溯源
      const hasCitations = typeof opts.onCitations === 'function'
      // P1 #27(2026-09-16 立):done 事件携带 memoryUpdates(已记住提示条数据源)
      const hasMemoryUpdates = typeof opts.onMemoryUpdates === 'function'
      const hasUsage = typeof opts.onUsage === 'function'
      // Steer(中途引导,2026-09-19 立):onSteer 存在时启用解析
      const hasSteer = typeof opts.onSteer === 'function'
      // Budget(用量分档提醒,2026-09-19 立):onBudget 存在时启用解析
      const hasBudget = typeof opts.onBudget === 'function'
      const hasInjection = typeof opts.onInjectionApplied === 'function'
      const hasRetryScheduled = typeof opts.onRetryScheduled === 'function'
      // D77(2026-09-25 立):业务表单请求帧;帧带 fields/actions 结构化字段,
      // 未注册回调时不解析(与 injection 同口径)。
      const hasFormRequest = typeof opts.onFormRequest === 'function'
      // hasCitations 被 tryParseCitations 的守护读取(消除 TS6133:声明未使用)
      void hasCitations

      // 2026-08-15 修复:reader.read() 在 fetch 完成后无法被 AbortController 中断,
      // 若后端返回 200 但不发送数据,流会永久挂起,导致前端 isStreaming/sendInFlightRef 卡死。
      // 为 reader.read() 添加 30s 超时保护,超时后 cancel reader 并抛出错误,由外层 catch 块处理重试/报错。
      const readWithTimeout = async (): Promise<{ done: boolean; value?: Uint8Array }> => {
        let timer: ReturnType<typeof setTimeout> | undefined
        const readPromise = reader.read().catch(() => {
          // reader.cancel() 导致的 reject 会被 Promise.race 忽略,避免未处理 rejection
          return { done: true, value: new Uint8Array() }
        })
        const timeoutPromise = new Promise<{ done: boolean; value?: Uint8Array }>((_, reject) => {
          timer = setTimeout(() => {
            reader.cancel().catch(() => {})
            reject(new Error('SSE read timeout'))
          }, 30000)
        })
        try {
          return await Promise.race([readPromise, timeoutPromise])
        } finally {
          if (timer) clearTimeout(timer)
        }
      }

      // ===== Dedupe 机制(isRetry 时启用) =====
      // 重连后若服务端不支持 Last-Event-ID 续传会从头重发,前端用 receivedContent 前缀匹配
      // 跳过已接收内容,仅追加新增部分;若服务端发送不同内容则放弃 dedupe 全量追加
      let dedupeBuffer = ''
      let dedupeActive = isRetry && receivedContentRef.current.length > 0
      const agentDedupeBuffer = new Map<string, string>()

      const emitDelta = (delta: string): void => {
        if (!dedupeActive) {
          opts.onDelta?.(delta)
          receivedContentRef.current += delta
          return
        }
        dedupeBuffer += delta
        const received = receivedContentRef.current
        if (dedupeBuffer.length < received.length) {
          if (received.startsWith(dedupeBuffer)) return
          opts.onDelta?.(dedupeBuffer)
          receivedContentRef.current += dedupeBuffer
          dedupeBuffer = ''
          dedupeActive = false
          return
        }
        const tail = dedupeBuffer.slice(received.length)
        if (dedupeBuffer.slice(0, received.length) === received) {
          if (tail) opts.onDelta?.(tail)
          receivedContentRef.current += tail
        } else {
          opts.onDelta?.(dedupeBuffer)
          receivedContentRef.current += dedupeBuffer
        }
        dedupeBuffer = ''
        dedupeActive = false
      }

      const emitAgentDelta = (agentId: string, delta: string): void => {
        const received = receivedAgentRef.current.get(agentId) ?? ''
        if (!isRetry || received.length === 0) {
          opts.onAgentDelta!(agentId, delta)
          receivedAgentRef.current.set(agentId, received + delta)
          return
        }
        const buf = (agentDedupeBuffer.get(agentId) ?? '') + delta
        if (buf.length < received.length) {
          if (received.startsWith(buf)) {
            agentDedupeBuffer.set(agentId, buf)
            return
          }
          opts.onAgentDelta!(agentId, buf)
          receivedAgentRef.current.set(agentId, received + buf)
          agentDedupeBuffer.delete(agentId)
          return
        }
        const tail = buf.slice(received.length)
        if (buf.slice(0, received.length) === received) {
          if (tail) opts.onAgentDelta!(agentId, tail)
          receivedAgentRef.current.set(agentId, received + tail)
        } else {
          opts.onAgentDelta!(agentId, buf)
          receivedAgentRef.current.set(agentId, received + buf)
        }
        agentDedupeBuffer.delete(agentId)
      }

      const tryParseCompaction = (line: string): void => {
        if (!hasCompaction) return
        if (!line || line.startsWith(':')) return
        let data = line
        if (line.startsWith('data:')) {
          data = line.slice(5).replace(/^\s/, '')
        } else if (
          line.startsWith('event:') ||
          line.startsWith('id:') ||
          line.startsWith('retry:')
        ) {
          return
        }
        if (!data || data === '[DONE]') return
        try {
          const json = JSON.parse(data)
          if (json?.compaction?.triggered === true) {
            opts.onCompaction!({
              tokensBefore: Number(json.compaction.tokensBefore ?? 0),
              tokensAfter: Number(json.compaction.tokensAfter ?? 0),
              removedCount: Number(json.compaction.removedCount ?? 0),
              // A10B-8:截断量是披露判据的事实来源。**刻意不写 `?? 0` 归一** ——
              // 旧帧(生产者尚未带该字段)缺席必须原样传成 undefined,归零等于把
              // "没被告知"改写成"确实没截断",消费侧就退回"该说不说"的沉默那一型。
              truncatedCount:
                typeof json.compaction.truncatedCount === 'number' &&
                Number.isFinite(json.compaction.truncatedCount)
                  ? json.compaction.truncatedCount
                  : undefined,
              usageRatio: Number(json.compaction.usageRatio ?? 0),
              trigger:
                typeof json.compaction.trigger === 'string' ? json.compaction.trigger : undefined,
              compressedMessages: json.compaction.compressedMessages,
            })
          }
        } catch {
          /* 非 JSON 或非 compaction 事件忽略 */
        }
      }

      const tryParseQuestion = (line: string): void => {
        if (!hasQuestion) return
        if (!line || line.startsWith(':')) return
        let data = line
        if (line.startsWith('data:')) {
          data = line.slice(5).replace(/^\s/, '')
        } else if (
          line.startsWith('event:') ||
          line.startsWith('id:') ||
          line.startsWith('retry:')
        ) {
          return
        }
        if (!data || data === '[DONE]') return
        try {
          const json = JSON.parse(data)
          if (json?.type === 'question' && json?.question?.questionId) {
            const q = json.question
            opts.onQuestion!({
              questionId: String(q.questionId),
              prompt: String(q.prompt ?? ''),
              options: Array.isArray(q.options)
                ? q.options
                    .filter((o: unknown) => o && typeof o === 'object' && 'id' in o && 'label' in o)
                    .map((o: { id: unknown; label: unknown }) => ({
                      id: String(o.id),
                      label: String(o.label),
                    }))
                : [],
              allowCustom: q.allowCustom !== false,
              allowMultiple: q.allowMultiple === true,
            })
          }
        } catch {
          /* 非 JSON 或非 question 事件忽略 */
        }
      }

      /** 解析 Vercel AI SDK 协议 tool_call 事件:
       *  - type 2(tool-call):{ toolCallId, toolName, args }
       *  - type 7(tool-result):{ toolCallId, result, isError }
       *  - 自定义 tool_result JSON:{ type:'tool_result', toolCallId, toolName, args, result }
       * 触发 onToolCall 回调,前端据 args.result 中的 url 自动打开 WorkPanel */
      const tryParseToolCall = (line: string): void => {
        if (!hasToolCall) return
        if (!line || line.startsWith(':')) return
        let data = line
        if (line.startsWith('data:')) {
          data = line.slice(5).replace(/^\s/, '')
        } else if (
          line.startsWith('event:') ||
          line.startsWith('id:') ||
          line.startsWith('retry:')
        ) {
          return
        }
        if (!data || data === '[DONE]') return

        // Vercel AI SDK 协议 TYPE:JSON
        const proto = data.match(/^(\d+):(.*)$/s)
        if (proto?.[1] !== undefined) {
          const t = proto[1]
          try {
            const parsed = JSON.parse(proto[2]!)
            if (t === '2' && parsed?.toolCallId && parsed?.toolName) {
              opts.onToolCall!({
                type: 'tool-call-start',
                toolCallId: String(parsed.toolCallId),
                toolName: String(parsed.toolName),
                args: parsed.args,
              })
            } else if (t === '7' && parsed?.toolCallId) {
              opts.onToolCall!({
                type: 'tool-result',
                toolCallId: String(parsed.toolCallId),
                toolName: typeof parsed.toolName === 'string' ? parsed.toolName : '',
                result: parsed.result,
                isError: parsed.isError === true,
                // 2026-09-09 媒体产物顶层扁平化透传(与自定义 tool-result 分支一致)
                image_url: typeof parsed.image_url === 'string' ? parsed.image_url : undefined,
                audio_url: typeof parsed.audio_url === 'string' ? parsed.audio_url : undefined,
                video_url: typeof parsed.video_url === 'string' ? parsed.video_url : undefined,
                task_id: typeof parsed.task_id === 'string' ? parsed.task_id : undefined,
              })
            }
          } catch {
            /* JSON 解析失败忽略 */
          }
          return
        }

        // 自定义 JSON 事件(支持 ai-service agent tool loop 推送的 tool-call-start / tool-result)
        if (data.startsWith('{')) {
          try {
            const json = JSON.parse(data) as Record<string, unknown>
            // 2026-07-31 立,提取工具来源字段(兼容 snake_case / camelCase)
            const serverSource = (json.serverSource ?? json.server_source ?? '') as string
            const validServerSource =
              serverSource === 'builtin' || serverSource === 'plugin' || serverSource === 'mcp'
                ? serverSource
                : undefined
            const serverId =
              typeof json.serverId === 'string'
                ? json.serverId
                : typeof json.server_id === 'string'
                  ? json.server_id
                  : undefined
            const serverName =
              typeof json.serverName === 'string'
                ? json.serverName
                : typeof json.server_name === 'string'
                  ? json.server_name
                  : undefined
            // 优化(问题 4-5):合并 tool_result / tool-result 重复分支,
            // 后端 snake_case(tool_result)与 kebab-case(tool-result)走同一逻辑
            if (
              (json?.type === 'tool_result' || json?.type === 'tool-result') &&
              json?.toolCallId
            ) {
              opts.onToolCall!({
                type: 'tool-result',
                toolCallId: String(json.toolCallId),
                toolName: typeof json.toolName === 'string' ? json.toolName : '',
                args: json.args as Record<string, unknown> | undefined,
                result: json.result,
                isError: json.isError === true,
                serverSource: validServerSource,
                serverId,
                serverName,
                // 2026-09-09 媒体产物顶层扁平化透传:image_url/audio_url/video_url/task_id
                image_url: typeof json.image_url === 'string' ? json.image_url : undefined,
                audio_url: typeof json.audio_url === 'string' ? json.audio_url : undefined,
                video_url: typeof json.video_url === 'string' ? json.video_url : undefined,
                task_id: typeof json.task_id === 'string' ? json.task_id : undefined,
              })
            } else if (json?.type === 'tool-call-start' && json?.toolCallId) {
              opts.onToolCall!({
                type: 'tool-call-start',
                toolCallId: String(json.toolCallId),
                toolName: typeof json.toolName === 'string' ? json.toolName : '',
                args: json.args as Record<string, unknown> | undefined,
                serverSource: validServerSource,
                serverId,
                serverName,
              })
            }
          } catch {
            /* 非 JSON 忽略 */
          }
        }
      }

      /** 解析 Subagent 派发事件(2026-07-28 立):
       *  - subagent_spawn:主 agent 调用 dispatch_subagent 工具执行前发出
       *  - subagent_progress:执行期间实时发出(thinking/tool_call/tool_result/output_ready)
       *  - subagent_end:执行后发出(带 status: done/failed)
       *  触发 onSubagentSpawn/onSubagentProgress/onSubagentEnd 回调,前端进度面板自动展示。 */
      const tryParseSubagent = (line: string): void => {
        if (!hasSubagent) return
        if (!line || line.startsWith(':')) return
        let data = line
        if (line.startsWith('data:')) {
          data = line.slice(5).replace(/^\s/, '')
        } else if (
          line.startsWith('event:') ||
          line.startsWith('id:') ||
          line.startsWith('retry:')
        ) {
          return
        }
        if (!data || data === '[DONE]') return
        try {
          const json = JSON.parse(data) as Record<string, unknown>
          if (json?.type === 'subagent_spawn' && json?.id) {
            opts.onSubagentSpawn!({
              id: String(json.id),
              role: typeof json.role === 'string' ? json.role : '',
              task: typeof json.task === 'string' ? json.task : '',
              timestamp:
                typeof json.timestamp === 'string' ? json.timestamp : new Date().toISOString(),
            })
          } else if (json?.type === 'subagent_progress' && json?.id) {
            const phase = json.phase
            if (
              phase === 'thinking' ||
              phase === 'tool_call' ||
              phase === 'tool_result' ||
              phase === 'output_ready'
            ) {
              opts.onSubagentProgress!({
                id: String(json.id),
                phase,
                timestamp:
                  typeof json.timestamp === 'string' ? json.timestamp : new Date().toISOString(),
                iteration: typeof json.iteration === 'number' ? json.iteration : undefined,
                tool: typeof json.tool === 'string' ? json.tool : undefined,
                ok: typeof json.ok === 'boolean' ? json.ok : undefined,
                outputPreview:
                  typeof json.output_preview === 'string' ? json.output_preview : undefined,
                agentName: typeof json.agentName === 'string' ? json.agentName : undefined,
              })
            }
          } else if (json?.type === 'subagent_end' && json?.id) {
            opts.onSubagentEnd!({
              id: String(json.id),
              status: json.status === 'failed' ? 'failed' : 'done',
              failureReason:
                typeof json.failureReason === 'string' ? json.failureReason : undefined,
              timestamp:
                typeof json.timestamp === 'string' ? json.timestamp : new Date().toISOString(),
            })
          }
        } catch {
          /* 非 JSON 或非 subagent 事件忽略 */
        }
      }

      /** 解析工具调用汇总事件(2026-07-31 立,AI 对话可视化深度接入):
       *  - 后端在 SSE 流末尾(done 之前)发出 type='tool-summary' 事件
       *  - 聚合本轮所有工具调用统计(搜索文件次数/网页次数/修改文件数/行数变更/工具分类)
       *  - 前端收到后直接写入 message.toolCallSummary,无需本地重复聚合
       *  - 兼容后端 snake_case 字段(server_source/server_id/server_name)与 camelCase */
      const tryParseToolSummary = (line: string): void => {
        if (!hasToolSummary) return
        if (!line || line.startsWith(':')) return
        let data = line
        if (line.startsWith('data:')) {
          data = line.slice(5).replace(/^\s/, '')
        } else if (
          line.startsWith('event:') ||
          line.startsWith('id:') ||
          line.startsWith('retry:')
        ) {
          return
        }
        if (!data || data === '[DONE]') return
        try {
          const json = JSON.parse(data) as Record<string, unknown>
          if (json?.type !== 'tool-summary') return
          // 兼容 snake_case / camelCase 字段(后端 SSE 序列化策略)
          const numOr = (v: unknown): number =>
            typeof v === 'number' && Number.isFinite(v) ? v : 0
          const toolsByCategory = json.toolsByCategory ?? json.tools_by_category
          const safeToolsByCategory =
            toolsByCategory && typeof toolsByCategory === 'object'
              ? (toolsByCategory as Record<string, number>)
              : {}
          const totalDurationMsRaw = json.totalDurationMs ?? json.total_duration_ms
          opts.onToolSummary!({
            filesSearched: numOr(json.filesSearched ?? json.files_searched),
            webSearched: numOr(json.webSearched ?? json.web_searched),
            filesModified: numOr(json.filesModified ?? json.files_modified),
            linesAdded: numOr(json.linesAdded ?? json.lines_added),
            linesDeleted: numOr(json.linesDeleted ?? json.lines_deleted),
            toolsByCategory: safeToolsByCategory,
            totalCalls: numOr(json.totalCalls ?? json.total_calls),
            totalDurationMs:
              typeof totalDurationMsRaw === 'number' && Number.isFinite(totalDurationMsRaw)
                ? totalDurationMsRaw
                : undefined,
          })
        } catch {
          /* 非 JSON 或非 tool-summary 事件忽略 */
        }
      }

      /** 阶段 2:解析工具委托执行事件(2026-08-02 立,浏览器端 fs 工具执行代理):
       *  - ai-service 在远程服务器无法访问用户本地文件,LLM 调用 fs 类工具时
       *    通过 SSE `tool-delegate` 事件委托前端执行
       *  - 前端收到事件后用 FileSystemDirectoryHandle 执行工具,通过 postToolResult
       *    POST API 回传结果,唤醒 ai-service tool loop 中等待的 asyncio.Event
       *  - onToolDelegate 是 async 回调,await 等待执行完成后再继续读 SSE 流
       *    (ai-service 在等待结果期间不会发新事件,阻塞读流是符合期望的)
       *  - 工具执行失败不中断流,错误通过 postToolResult 回传给 ai-service */
      const tryParseToolDelegate = async (line: string): Promise<void> => {
        if (!hasToolDelegate) return
        if (!line || line.startsWith(':')) return
        let data = line
        if (line.startsWith('data:')) {
          data = line.slice(5).replace(/^\s/, '')
        } else if (
          line.startsWith('event:') ||
          line.startsWith('id:') ||
          line.startsWith('retry:')
        ) {
          return
        }
        if (!data || data === '[DONE]') return
        try {
          const json = JSON.parse(data) as Record<string, unknown>
          if (json?.type !== 'tool-delegate') return
          if (typeof json.session_id !== 'string' || typeof json.tool_call_id !== 'string') return
          await opts.onToolDelegate!({
            session_id: json.session_id,
            tool_call_id: json.tool_call_id,
            tool_name: typeof json.tool_name === 'string' ? json.tool_name : '',
            args:
              json.args && typeof json.args === 'object'
                ? (json.args as Record<string, unknown>)
                : {},
            iteration: typeof json.iteration === 'number' ? json.iteration : 0,
            type: 'tool-delegate',
          })
        } catch {
          /* 非 JSON 或非 tool-delegate 事件忽略;工具执行错误已通过 postToolResult 回传 */
        }
      }

      /** V3 #58(2026-09-26 立):解析 tool-approval SSE 帧(主对话流工具审批门)。
       *  - ai-service 在高危工具执行前发 `event: tool-approval` + data {type:'tool-approval',...}
       *  - wire payload 与 agent 任务流 tool-approval 同形(snake_case),此处收窄为 camelCase
       *  - 畸形帧(缺 approval_id)一律不发回调 —— 回调方没有 id 就无法回传决策,
       *    弹了窗也只会让后端 120s 超时,等于欺骗用户
       *  - 决策回传走 postToolApprovalResponse(直连 ai-service 流级端点,与
       *    postToolResult 同族;不经网关 /agent/approval-response —— 两套审批注册表独立) */
      const tryParseToolApproval = (line: string): void => {
        if (!hasToolApproval) return
        if (!line || line.startsWith(':')) return
        let data = line
        if (line.startsWith('data:')) {
          data = line.slice(5).replace(/^\s/, '')
        } else if (
          line.startsWith('event:') ||
          line.startsWith('id:') ||
          line.startsWith('retry:')
        ) {
          return
        }
        if (!data || data === '[DONE]') return
        try {
          const json = JSON.parse(data) as Record<string, unknown>
          if (json?.type !== 'tool-approval') return
          const approvalId = json.approval_id
          if (typeof approvalId !== 'string' || approvalId === '') return
          opts.onToolApproval!({
            type: 'tool-approval',
            approvalId,
            toolName: typeof json.tool_name === 'string' ? json.tool_name : '',
            toolCallId: typeof json.tool_call_id === 'string' ? json.tool_call_id : '',
            argsPreview: typeof json.args_preview === 'string' ? json.args_preview : '',
            // danger_level 缺省 high(保守 UI 展示;后端仅在收录工具上发帧)
            dangerLevel:
              json.danger_level === 'medium'
                ? 'medium'
                : json.danger_level === 'low'
                  ? 'low'
                  : 'high',
            ...(typeof json.session_id === 'string' && json.session_id !== ''
              ? { sessionId: json.session_id }
              : {}),
          })
        } catch {
          /* 非 JSON 或非 tool-approval 事件忽略 */
        }
      }

      /** W1(2026-09-12 立):解析 plan_updated SSE 事件(消息级 plan steps 快照)。
       *  - ai-service 在 plan 更新时发送 `event: plan_updated` + `data: {"type":"plan_updated",...}`
       *  - 前端按 messageId 整体替换 message.planSteps(权威快照)
       *  - plan 数组每项保留实际存在的 step / status / startedAt / endedAt / durationMs / tokenUsage */
      const tryParsePlanUpdate = (line: string): void => {
        if (!hasPlanUpdate) return
        if (!line || line.startsWith(':')) return
        let data = line
        if (line.startsWith('data:')) {
          data = line.slice(5).replace(/^\s/, '')
        } else if (
          line.startsWith('event:') ||
          line.startsWith('id:') ||
          line.startsWith('retry:')
        ) {
          return
        }
        if (!data || data === '[DONE]') return
        try {
          const json = JSON.parse(data) as Record<string, unknown>
          if (
            (json?.type !== 'plan_updated' && json?.type !== 'plan') ||
            !Array.isArray(json.plan)
          ) {
            return
          }
          type PlanStep = PlanUpdateEvent['plan'][number]
          const plan: PlanStep[] = (json.plan as Array<Record<string, unknown>>)
            .filter((p) => Boolean(p) && typeof p === 'object' && typeof p.step === 'string')
            .map((p) => ({
              step: p.step as string,
              status: p.status as PlanStep['status'],
              // 2026-09-18 v2:透传步骤 id(= toolCallId)与 toolCallIds(步骤↔工具卡精确关联)
              ...(typeof p.id === 'string' ? { id: p.id } : {}),
              ...(Array.isArray(p.toolCallIds) ? { toolCallIds: p.toolCallIds as string[] } : {}),
              ...(p.error === true ? { error: true } : {}),
              ...(typeof p.startedAt === 'string' ? { startedAt: p.startedAt } : {}),
              ...(typeof p.endedAt === 'string' ? { endedAt: p.endedAt } : {}),
              ...(typeof p.durationMs === 'number' ? { durationMs: p.durationMs } : {}),
              ...(typeof p.tokenUsage === 'number' ? { tokenUsage: p.tokenUsage } : {}),
            }))
          const evt: PlanUpdateEvent = {
            plan,
            ...(typeof json.explanation === 'string' ? { explanation: json.explanation } : {}),
            ...(typeof json.timestamp === 'string' ? { timestamp: json.timestamp } : {}),
            ...(typeof json.messageId === 'string' ? { messageId: json.messageId } : {}),
          }
          opts.onPlanUpdate!(evt)
        } catch {
          /* 非 JSON 或非 plan 事件忽略 */
        }
      }

      /** W1(2026-09-12 立):解析 terminal_start / terminal_end SSE 事件(消息级终端任务)。
       *  - terminal_start:构造 TerminalStartEvent(status 固定 'running')并触发 onTerminalStart
       *  - terminal_end:构造 TerminalEndEvent 并触发 onTerminalEnd
       *  - 契约字段名为 terminalId(不是 id) */
      const tryParseTerminal = (line: string): void => {
        if (!hasTerminal) return
        if (!line || line.startsWith(':')) return
        let data = line
        if (line.startsWith('data:')) {
          data = line.slice(5).replace(/^\s/, '')
        } else if (
          line.startsWith('event:') ||
          line.startsWith('id:') ||
          line.startsWith('retry:')
        ) {
          return
        }
        if (!data || data === '[DONE]') return
        try {
          const json = JSON.parse(data) as Record<string, unknown>
          if (json?.type === 'terminal_start') {
            if (typeof json.terminalId !== 'string') return
            const evt: TerminalStartEvent = {
              terminalId: json.terminalId,
              command: typeof json.command === 'string' ? json.command : '',
              status: 'running',
              ...(typeof json.startedAt === 'string' ? { startedAt: json.startedAt } : {}),
              ...(typeof json.messageId === 'string' ? { messageId: json.messageId } : {}),
            }
            opts.onTerminalStart!(evt)
            return
          }
          if (json?.type === 'terminal_end') {
            if (typeof json.terminalId !== 'string') return
            if (json.status !== 'completed' && json.status !== 'failed') return
            const evt: TerminalEndEvent = {
              terminalId: json.terminalId,
              status: json.status,
              ...(typeof json.output === 'string' ? { output: json.output } : {}),
              ...(typeof json.exitCode === 'number' ? { exitCode: json.exitCode } : {}),
              ...(typeof json.endedAt === 'string' ? { endedAt: json.endedAt } : {}),
              ...(typeof json.durationMs === 'number' ? { durationMs: json.durationMs } : {}),
              ...(typeof json.messageId === 'string' ? { messageId: json.messageId } : {}),
            }
            opts.onTerminalEnd!(evt)
          }
        } catch {
          /* 非 JSON 或非 terminal 事件忽略 */
        }
      }

      /** 2026-09-18 立:解析 terminal_delta SSE 事件(命令执行期间 stdout/stderr 实时增量)。
       *  - 后端逐块下发 `event: terminal_delta` + `data: {"type":"terminal_delta",...}`
       *  - 按 terminalId 累加到 store.terminalOutputs(TerminalSection 实时回显),不落正文。
       *  - 与 tryParseTerminal(任务级 start/end)互补:本函数只处理执行中的流式文本。 */
      const tryParseTerminalDelta = (line: string): void => {
        if (!hasTerminalDelta) return
        if (!line || line.startsWith(':')) return
        let data = line
        if (line.startsWith('data:')) {
          data = line.slice(5).replace(/^\s/, '')
        } else if (
          line.startsWith('event:') ||
          line.startsWith('id:') ||
          line.startsWith('retry:')
        ) {
          return
        }
        if (!data || data === '[DONE]') return
        try {
          const json = JSON.parse(data) as Record<string, unknown>
          if (json?.type !== 'terminal_delta') return
          if (typeof json.terminalId !== 'string') return
          const stream = json.stream === 'stderr' ? 'stderr' : 'stdout'
          opts.onTerminalDelta!({
            terminalId: json.terminalId,
            command: typeof json.command === 'string' ? json.command : '',
            stream,
            text: typeof json.text === 'string' ? json.text : '',
            iteration: typeof json.iteration === 'number' ? json.iteration : 0,
            ...(typeof json.messageId === 'string' ? { messageId: json.messageId } : {}),
          })
        } catch {
          /* 非 JSON 或非 terminal_delta 事件忽略 */
        }
      }

      /** 2026-09-18 立:解析 thinking SSE 事件(agent 通道的 hook thinking.delta 映射)。
       *  - 后端发 `event: thinking` + `data: {"type":"thinking","content":"..."}`
       *  - 两种(reasoning / thinking)都走 reasoning 通道:本函数把 content 投递给 onReasoning。
       *  - 若 onReasoning 未传则直接丢弃,绝不回落成正文(parseStreamLine 已有 type 拦截兜底)。 */
      const tryParseThinking = (line: string): void => {
        if (!hasReasoning) return
        if (!line || line.startsWith(':')) return
        let data = line
        if (line.startsWith('data:')) {
          data = line.slice(5).replace(/^\s/, '')
        } else if (
          line.startsWith('event:') ||
          line.startsWith('id:') ||
          line.startsWith('retry:')
        ) {
          return
        }
        if (!data || data === '[DONE]') return
        try {
          const json = JSON.parse(data) as Record<string, unknown>
          if (json?.type !== 'thinking') return
          if (typeof json.content !== 'string') return
          opts.onReasoning!(json.content)
        } catch {
          /* 非 JSON 或非 thinking 事件忽略 */
        }
      }

      /** #11(2026-09-13):解析 citations SSE 事件(knowledge_lookup 工具执行后下发的引用溯源)。 */
      const tryParseCitations = (line: string): void => {
        if (!hasCitations) return
        if (!line || line.startsWith(':')) return
        let data = line
        if (line.startsWith('data:')) {
          data = line.slice(5).replace(/^\s/, '')
        } else if (
          line.startsWith('event:') ||
          line.startsWith('id:') ||
          line.startsWith('retry:')
        ) {
          return
        }
        if (!data || data === '[DONE]') return
        try {
          const json = JSON.parse(data) as Record<string, unknown>
          if (json?.type !== 'citations' || !Array.isArray(json.citations)) return
          opts.onCitations!({
            messageId: typeof json.messageId === 'string' ? json.messageId : undefined,
            citations: json.citations as CitationsEvent['citations'],
          })
        } catch {
          /* 非 JSON 或非 citations 事件忽略 */
        }
      }

      /** P1 #27(2026-09-16 立):解析 done 事件携带的 memoryUpdates(已记住提示条数据源)。
       *  ai-service 在 done 事件 payload 写入 memoryUpdates: string[](本轮 LTM 新增条目摘要),
       *  前端据此在对应助手消息下方渲染「已记住:N 条」提示条。空数组表示本轮无新记忆。 */
      const tryParseMemoryUpdates = (line: string): void => {
        if (!hasMemoryUpdates) return
        if (!line || line.startsWith(':')) return
        let data = line
        if (line.startsWith('data:')) {
          data = line.slice(5).replace(/^\s/, '')
        } else if (
          line.startsWith('event:') ||
          line.startsWith('id:') ||
          line.startsWith('retry:')
        ) {
          return
        }
        if (!data || data === '[DONE]') return
        try {
          const json = JSON.parse(data) as Record<string, unknown>
          if (json?.type !== 'done' || !Array.isArray(json.memoryUpdates)) return
          const items = (json.memoryUpdates as unknown[]).filter(
            (v): v is string => typeof v === 'string' && v.length > 0,
          )
          // 仅在有内容时回调(空数组不触发提示条)
          if (items.length > 0) opts.onMemoryUpdates!({ items })
        } catch {
          /* 非 JSON 或非 done 事件忽略 */
        }
      }

      /** 解析 usage 帧(D1,2026-09-19 升级):
       *  ① 命名帧 event: usage → data: { type:'usage', messageId, usage:{promptTokens,...},
       *     timing:{firstTokenMs,durationMs}, model, costUsd }(ai-service 流收尾下发);
       *  ② 旧 OpenAI 协议 usage chunk(stream_options.include_usage=true):
       *     data: {..., usage: { prompt_tokens, completion_tokens, total_tokens }}。
       *  两路统一触发 onUsage 回调;命名帧额外携带计时/模型/成本字段(缺失为 null)。 */
      const tryParseUsage = (line: string): void => {
        if (!hasUsage) return
        if (!line || line.startsWith(':')) return
        let data = line
        if (line.startsWith('data:')) {
          data = line.slice(5).replace(/^\s/, '')
        } else if (
          line.startsWith('event:') ||
          line.startsWith('id:') ||
          line.startsWith('retry:')
        ) {
          return
        }
        if (!data || data === '[DONE]') return
        try {
          const json = JSON.parse(data) as Record<string, unknown>
          const usage = json?.usage as Record<string, unknown> | undefined
          if (!usage || typeof usage !== 'object') return
          const promptTokens = Number(usage.prompt_tokens ?? usage.promptTokens ?? 0)
          const completionTokens = Number(usage.completion_tokens ?? usage.completionTokens ?? 0)
          const totalTokens = Number(usage.total_tokens ?? usage.totalTokens ?? 0)
          if (promptTokens <= 0 && completionTokens <= 0 && totalTokens <= 0) return
          // D1:命名帧(type:'usage')透传扩展字段;旧 OpenAI 协议路径置 null(前端徽章相应分段不渲染)
          const isNamedFrame = json?.type === 'usage'
          const rawTiming = isNamedFrame
            ? (json?.timing as Record<string, unknown> | null | undefined)
            : undefined
          const reasoningRaw = isNamedFrame
            ? (usage.reasoning_tokens ?? usage.reasoningTokens)
            : undefined
          opts.onUsage!({
            promptTokens: Number.isFinite(promptTokens) ? promptTokens : 0,
            completionTokens: Number.isFinite(completionTokens) ? completionTokens : 0,
            totalTokens: Number.isFinite(totalTokens) ? totalTokens : 0,
            reasoningTokens:
              typeof reasoningRaw === 'number' && Number.isFinite(reasoningRaw)
                ? reasoningRaw
                : null,
            messageId: isNamedFrame && typeof json.messageId === 'string' ? json.messageId : null,
            timing:
              rawTiming && typeof rawTiming === 'object'
                ? {
                    firstTokenMs:
                      typeof rawTiming.firstTokenMs === 'number' &&
                      Number.isFinite(rawTiming.firstTokenMs)
                        ? rawTiming.firstTokenMs
                        : null,
                    durationMs:
                      typeof rawTiming.durationMs === 'number' &&
                      Number.isFinite(rawTiming.durationMs)
                        ? rawTiming.durationMs
                        : 0,
                  }
                : null,
            model: isNamedFrame && typeof json.model === 'string' ? json.model : null,
            costUsd:
              isNamedFrame && typeof json.costUsd === 'number' && Number.isFinite(json.costUsd)
                ? json.costUsd
                : null,
          })
        } catch {
          /* 非 JSON 或非 usage 事件忽略 */
        }
      }

      /**
       * Steer(中途引导,2026-09-19 立):流式对话期间用户经 steer 端点提交引导文本,
       * ai-service tool loop 每轮 LLM 调用前 drain 注入 messages 时下发注入确认:
       *   event: steer → data: { type:'steer', phase:'injected', text, timestamp?, messageId? }
       * 前端 onSteer 据此把消息 badge 从「排队中」换成「引导已生效」。 */
      const tryParseSteer = (line: string): void => {
        if (!hasSteer) return
        if (!line || line.startsWith(':')) return
        let data = line
        if (line.startsWith('data:')) {
          data = line.slice(5).replace(/^\s/, '')
        } else if (
          line.startsWith('event:') ||
          line.startsWith('id:') ||
          line.startsWith('retry:')
        ) {
          return
        }
        if (!data || data === '[DONE]') return
        try {
          const json = JSON.parse(data) as Record<string, unknown>
          if (json?.type !== 'steer' || typeof json?.text !== 'string') return
          opts.onSteer!({
            phase: 'injected',
            text: json.text,
            timestamp: typeof json.timestamp === 'string' ? json.timestamp : undefined,
            messageId: typeof json.messageId === 'string' ? json.messageId : undefined,
          })
        } catch {
          /* 非 JSON 或非 steer 事件忽略 */
        }
      }

      /**
       * Budget(用量分档提醒,2026-09-19 立,网关发):流首网关按用户当日 AI 用量
       * 三态分档下发提醒帧(80%~95% warning / 95%~100% critical,均放行不中断流):
       *   event: budget → data: { type:'budget', level:'warning'|'critical', percent?,
       *                            usedTokens?, limitTokens?, tier?, resetAt? }
       * 前端 onBudget 据此 toast 提示用量进度。 */
      const tryParseBudget = (line: string): void => {
        if (!hasBudget) return
        if (!line || line.startsWith(':')) return
        let data = line
        if (line.startsWith('data:')) {
          data = line.slice(5).replace(/^\s/, '')
        } else if (
          line.startsWith('event:') ||
          line.startsWith('id:') ||
          line.startsWith('retry:')
        ) {
          return
        }
        if (!data || data === '[DONE]') return
        try {
          const json = JSON.parse(data) as Record<string, unknown>
          if (json?.type !== 'budget') return
          if (json?.level !== 'warning' && json?.level !== 'critical') return
          opts.onBudget!({
            level: json.level,
            percent: typeof json.percent === 'number' ? json.percent : undefined,
            usedTokens: typeof json.usedTokens === 'number' ? json.usedTokens : undefined,
            limitTokens: typeof json.limitTokens === 'number' ? json.limitTokens : undefined,
            tier: typeof json.tier === 'string' ? json.tier : undefined,
            resetAt: typeof json.resetAt === 'string' ? json.resetAt : undefined,
          })
        } catch {
          /* 非 JSON 或非 budget 事件忽略 */
        }
      }

      /**
       * 优化(问题 4-4):基于 SSE 行的 type 字段快速路由到对应 tryParse,
       * 避免每行最多 6 次 tryParse 全量 JSON.parse 尝试。
       *
       * 已知 type → 路由到单一 tryParse(从 6 次 JSON.parse 降至 1 次);
       * 未知/无 type / 注释行 / event:/id:/retry: 行 / 非 JSON token 行 → 返回 null,
       * 由主循环走 fallback 全量调用(保留原有行为,因每个 tryParse 内部有快速 return 守护,
       * 对非 JSON 行几乎零成本;注释/event/id/retry 行也立即 return)。
       *
       * 覆盖 type 清单(与各 tryParse 内部判断逐一对齐):
       *  - compaction:tryParseCompaction 不基于 type,基于 json.compaction 字段
       *  - question:tryParseQuestion
       *  - tool_result / tool-result / tool-call-start:tryParseToolCall(JSON 形式)
       *  - Vercel AI SDK 数字协议(^\d+:):仅 tryParseToolCall 内部 proto 分支能处理
       *  - subagent_spawn / subagent_progress / subagent_end:tryParseSubagent
       *  - tool-summary:tryParseToolSummary
       *  - tool-delegate:tryParseToolDelegate
       *  - tool-approval:tryParseToolApproval(V3 #58 2026-09-26 立,主对话流审批门)
       *  - plan_updated / plan:tryParsePlanUpdate(W1 2026-09-12 立)
       *  - terminal_start / terminal_end:tryParseTerminal(W1 2026-09-12 立)
       *  - usage:tryParseUsage(OpenAI 协议 usage chunk,基于 json.usage 字段,非 type)
       *  - steer:tryParseSteer(Steer 2026-09-19 立)
       *  - budget:tryParseBudget(Budget 用量分档提醒 2026-09-19 立,网关发)
       *  - injection_applied / retry_scheduled:tryParseInjection / tryParseRetryScheduled
       *    (D34/D39 2026-09-22 立;两帧都带文本字段,漏分流会喷进正文增量)
       *  - form_request:tryParseFormRequest(D77 2026-09-25 立;对话流业务表单请求帧,
       *    带结构化 fields/actions;批准与拒绝不成对的帧在解析层即丢弃)
       */
      /** D34/D39:上下文注入交代帧与重试交代帧(两帧都带文本字段,绝不能进兜底抽取链)。 */
      const tryParseInjection = (line: string): void => {
        if (!hasInjection) return
        if (!line || line.startsWith(':')) return
        let data = line
        if (line.startsWith('data:')) {
          data = line.slice(5).replace(/^\s/, '')
        } else if (
          line.startsWith('event:') ||
          line.startsWith('id:') ||
          line.startsWith('retry:')
        ) {
          return
        }
        if (!data || data === '[DONE]') return
        try {
          const json = JSON.parse(data) as Record<string, unknown>
          if (json?.type !== 'injection_applied') return
          const collapsed = json.collapsed
          const kind = json.kind
          // 没有短标签就没有可显示的东西 ⇒ 不发回调(而不是发一条空行)
          if (typeof collapsed !== 'string' || collapsed === '') return
          if (typeof kind !== 'string' || kind === '') return
          opts.onInjectionApplied!({
            kind,
            collapsed,
            ...(typeof json.fullText === 'string' ? { fullText: json.fullText } : {}),
            ...(typeof json.count === 'number' ? { count: json.count } : {}),
            ...(typeof json.messageId === 'string' ? { messageId: json.messageId } : {}),
          })
        } catch {
          /* 非 JSON 或非 injection_applied 事件忽略 */
        }
      }

      const tryParseRetryScheduled = (line: string): void => {
        if (!hasRetryScheduled) return
        if (!line || line.startsWith(':')) return
        let data = line
        if (line.startsWith('data:')) {
          data = line.slice(5).replace(/^\s/, '')
        } else if (
          line.startsWith('event:') ||
          line.startsWith('id:') ||
          line.startsWith('retry:')
        ) {
          return
        }
        if (!data || data === '[DONE]') return
        try {
          const json = JSON.parse(data) as Record<string, unknown>
          if (json?.type !== 'retry_scheduled') return
          const attempt = json.attempt
          const maxRetries = json.maxRetries
          if (typeof attempt !== 'number' || typeof maxRetries !== 'number') return
          opts.onRetryScheduled!({
            attempt,
            maxRetries,
            retryInMs: typeof json.retryInMs === 'number' ? json.retryInMs : 0,
            ...(typeof json.httpStatus === 'number' ? { httpStatus: json.httpStatus } : {}),
            ...(typeof json.messageId === 'string' ? { messageId: json.messageId } : {}),
          })
        } catch {
          /* 非 JSON 或非 retry_scheduled 事件忽略 */
        }
      }

      /**
       * D77 业务表单请求帧(2026-09-25 立,G-106)。
       * 畸形帧一律**不发回调**,而不是发一张填不了/无法应答的表单:
       *  · 缺 requestId → 应答无处带回
       *  · actions 不成对(approve 与 reject 缺一)→ 违背本票硬约束,不给渲染
       *  · fields 为空/非数组 → 渲染不出任何输入位
       * fields/actions 的形状权威在 packages/shared/src/chat/business-forms.ts,本处只做 wire 收窄。
       */
      const tryParseFormRequest = (line: string): void => {
        if (!hasFormRequest) return
        if (!line || line.startsWith(':')) return
        let data = line
        if (line.startsWith('data:')) {
          data = line.slice(5).replace(/^\s/, '')
        } else if (
          line.startsWith('event:') ||
          line.startsWith('id:') ||
          line.startsWith('retry:')
        ) {
          return
        }
        if (!data || data === '[DONE]') return
        try {
          const json = JSON.parse(data) as Record<string, unknown>
          if (json?.type !== 'form_request') return
          const requestId = json.requestId
          const kind = json.kind
          if (typeof requestId !== 'string' || requestId === '') return
          if (typeof kind !== 'string' || kind === '') return
          const rawFields = json.fields
          if (!Array.isArray(rawFields) || rawFields.length === 0) return
          const fields: FormRequestEvent['fields'] = []
          for (const raw of rawFields) {
            if (typeof raw !== 'object' || raw === null) continue
            const f = raw as Record<string, unknown>
            if (typeof f.key !== 'string' || f.key === '') continue
            fields.push({
              key: f.key,
              type: typeof f.type === 'string' ? f.type : 'text',
              required: f.required === true,
              ...(typeof f.placeholderKey === 'string' ? { placeholderKey: f.placeholderKey } : {}),
            })
          }
          if (fields.length === 0) return
          const actions = Array.isArray(json.actions)
            ? json.actions.filter((a): a is string => typeof a === 'string')
            : []
          // 成对判据:批准与拒绝必须同时在,缺一即畸形帧
          // (只给"批准"的表单等于替用户做完决定,只给"拒绝"的表单等于什么都不做)。
          if (!actions.includes('approve') || !actions.includes('reject')) return
          opts.onFormRequest!({
            requestId,
            kind,
            fields,
            actions,
            ...(typeof json.sessionId === 'string' ? { sessionId: json.sessionId } : {}),
            ...(typeof json.messageId === 'string' ? { messageId: json.messageId } : {}),
          })
        } catch {
          /* 非 JSON 或非 form_request 事件忽略 */
        }
      }

      const routeLineByType = (line: string): string | null => {
        if (!line || line.startsWith(':')) return null
        if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
          return null
        }
        let data = line
        if (line.startsWith('data:')) {
          data = line.slice(5).replace(/^\s/, '')
        }
        if (!data || data === '[DONE]') return null
        // Vercel AI SDK 协议(数字前缀,如 "2:{...}" / "7:{...}"),
        // 仅 tryParseToolCall 内部 proto 分支能处理
        if (/^\d+:/.test(data)) return 'tool_call'
        if (!data.startsWith('{')) return null
        try {
          const json = JSON.parse(data) as Record<string, unknown>
          // compaction 事件不基于 type 字段,基于 json.compaction.triggered
          if (json.compaction && typeof json.compaction === 'object') return 'compaction'
          // usage 事件(OpenAI 协议)不基于 type 字段,基于 json.usage
          if (json.usage && typeof json.usage === 'object') return 'usage'
          const t = json.type
          if (typeof t !== 'string') return null
          switch (t) {
            case 'question':
              return 'question'
            case 'tool_result':
            case 'tool-result':
            case 'tool-call-start':
              return 'tool_call'
            case 'subagent_spawn':
            case 'subagent_progress':
            case 'subagent_end':
              return 'subagent'
            case 'tool-summary':
              return 'tool_summary'
            case 'tool-delegate':
              return 'tool_delegate'
            // V3 #58(2026-09-26 立):主对话流工具审批请求帧
            case 'tool-approval':
              return 'tool_approval'
            case 'plan_updated':
            case 'plan':
              return 'plan'
            case 'terminal_start':
            case 'terminal_end':
              return 'terminal'
            case 'citations':
              return 'citations'
            // 2026-09-18 立:terminal_delta / thinking 走专用通道(与 reasoning 同理不落正文)
            case 'terminal_delta':
              return 'terminal_delta'
            case 'thinking':
              return 'thinking'
            // 2026-09-18 立:补 type==='compaction' 这一路(原仅认 json.compaction 字段形态)
            case 'compaction':
              return 'compaction'
            // Steer(2026-09-19 立):中途引导注入确认帧
            case 'steer':
              return 'steer'
            // Budget(2026-09-19 立):网关用量分档提醒帧
            case 'budget':
              return 'budget'
            // D34/D39(2026-09-22 立):运行环境交代与重试交代帧
            case 'injection_applied':
              return 'injection_applied'
            case 'retry_scheduled':
              return 'retry_scheduled'
            // D77(2026-09-25 立):对话流业务表单请求帧
            case 'form_request':
              return 'form_request'
            default:
              return null
          }
        } catch {
          return null
        }
      }

      // 优化(问题 4-4):基于 type 路由调用单一 tryParse;未知 type 走 fallback 全量调用,
      // 保留原有行为(parseStreamLine 等后续逻辑不变)
      const dispatchTryParse = async (line: string): Promise<void> => {
        const route = routeLineByType(line)
        if (route === 'compaction') {
          tryParseCompaction(line)
        } else if (route === 'question') {
          tryParseQuestion(line)
        } else if (route === 'tool_call') {
          tryParseToolCall(line)
        } else if (route === 'subagent') {
          tryParseSubagent(line)
        } else if (route === 'tool_summary') {
          tryParseToolSummary(line)
        } else if (route === 'tool_delegate') {
          await tryParseToolDelegate(line)
        } else if (route === 'tool_approval') {
          tryParseToolApproval(line)
        } else if (route === 'plan') {
          tryParsePlanUpdate(line)
        } else if (route === 'terminal') {
          tryParseTerminal(line)
        } else if (route === 'citations') {
          tryParseCitations(line)
        } else if (route === 'terminal_delta') {
          tryParseTerminalDelta(line)
        } else if (route === 'thinking') {
          tryParseThinking(line)
        } else if (route === 'usage') {
          tryParseUsage(line)
        } else if (route === 'steer') {
          tryParseSteer(line)
        } else if (route === 'budget') {
          tryParseBudget(line)
        } else if (route === 'injection_applied') {
          tryParseInjection(line)
        } else if (route === 'retry_scheduled') {
          tryParseRetryScheduled(line)
        } else if (route === 'form_request') {
          tryParseFormRequest(line)
        } else {
          // fallback:无 type / 未知 type / 注释 / event:/id:/retry: / 非 JSON token 行。
          // 各 tryParse 内部第一道守护(`if (!hasXxx) return` + line 前缀检查)对非匹配行立即 return,
          // 对 token 行(非 JSON)无 JSON.parse 开销,保持原有行为
          tryParseCompaction(line)
          tryParseQuestion(line)
          tryParseToolCall(line)
          tryParseSubagent(line)
          tryParseToolSummary(line)
          tryParsePlanUpdate(line)
          tryParseTerminal(line)
          await tryParseToolDelegate(line)
          tryParseToolApproval(line)
          tryParseCitations(line)
          tryParseUsage(line)
          tryParseMemoryUpdates(line)
          tryParseTerminalDelta(line)
          tryParseThinking(line)
          tryParseSteer(line)
          tryParseBudget(line)
          tryParseInjection(line)
          tryParseRetryScheduled(line)
          tryParseFormRequest(line)
        }
      }

      // ===== 流式调试:测量 chunk 到达间隔(仅开发期启用) =====
      // 在控制台输出每个 SSE data: 行的时间戳/长度/内容摘要,
      // 用于判断是"后端攒批"还是"前端解析/渲染批量处理"导致非逐字显示。
      const enableStreamDebug =
        typeof process !== 'undefined' &&
        (process.env.NEXT_PUBLIC_DEBUG_SSE === 'true' || process.env.NODE_ENV?.includes('dev'))
      const debugChunkTimer = enableStreamDebug
        ? (() => {
            let lastTime = performance.now()
            let count = 0
            return {
              mark: (label: string, delta: string, line: string) => {
                const now = performance.now()
                const interval = now - lastTime
                lastTime = now
                count++
                console.info(
                  `[SSE-DEBUG] #${String(count).padStart(4, '0')} ${label} interval=${interval.toFixed(1)}ms deltaLen=${delta.length} chunkLen=${line.length} delta=${JSON.stringify(delta)}`,
                )
              },
              reset: () => {
                lastTime = performance.now()
                count = 0
              },
            }
          })()
        : null

      for (;;) {
        const { done, value } = await readWithTimeout()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let nl: number
        while ((nl = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, nl).replace(/\r$/, '')
          buffer = buffer.slice(nl + 1)
          // 捕获 SSE id: 行(用于 Last-Event-ID 断点续传)
          if (line.startsWith('id:')) lastEventIdRef.current = line.slice(3).trim()
          await dispatchTryParse(line)
          // P4-2: 优先检查 fallback 事件,命中即触发回调跳过 parseStreamLine
          if (hasFallback) {
            const fbEvt = parseFallbackEvent(line)
            if (fbEvt) {
              opts.onFallback!(fbEvt)
              continue
            }
          }
          const delta = parseStreamLine(line)
          if (delta) {
            const agentId = hasAgentDelta ? extractAgentId(line) : undefined
            if (agentId) emitAgentDelta(agentId, delta)
            else emitDelta(delta)
            debugChunkTimer?.mark('delta', delta, line)
          }
          if (hasReasoning) {
            const r = parseStreamLineReasoning(line)
            if (r) {
              opts.onReasoning!(r)
              debugChunkTimer?.mark('reasoning', r, line)
            }
          }
        }
      }
      if (buffer.trim()) {
        if (buffer.startsWith('id:')) lastEventIdRef.current = buffer.slice(3).trim()
        // 阶段 2:尾部 buffer 残留,与主循环对称
        await dispatchTryParse(buffer)
        // P4-2: 优先检查 fallback 事件(尾部 buffer 残留);parseStreamLine 对 fallback 事件返回 null,无需跳过
        if (hasFallback) {
          const fbEvt = parseFallbackEvent(buffer)
          if (fbEvt) opts.onFallback!(fbEvt)
        }
        const delta = parseStreamLine(buffer)
        if (delta) {
          const agentId = hasAgentDelta ? extractAgentId(buffer) : undefined
          if (agentId) emitAgentDelta(agentId, delta)
          else emitDelta(delta)
        }
        if (hasReasoning) {
          const r = parseStreamLineReasoning(buffer)
          if (r) opts.onReasoning!(r)
        }
      }
      opts.onDone?.()
      return
    } catch (err) {
      if (isAbortError(err)) {
        opts.onDone?.()
        return
      }
      const info = getSSEErrorInfo(err)
      const code = info?.code
      // P2-2 retry-after 协商:429 + retryAfter 视为可重试(走网络重试路径,按 retryAfter 等待);
      // 429 无 retryAfter 仍视为业务错误(不重连);401/403 永远是业务错误
      const isBusinessError =
        code === 401 || code === 403 || (code === 429 && info?.retryAfter === undefined)
      const canRetry = !isBusinessError && attempt < maxRetries
      if (!canRetry) {
        const message = err instanceof Error ? err.message : '网络异常'
        // 2026-09-04 吞错修复(Fix B):流内 SSE error 事件(如 provider 402 配额耗尽, errorCode: LLM_ERROR)
        // 耗尽内部重试后,若调用方传了 onError 则保持原行为(回调后 return);
        // 若未传 onError 则必须 throw err(reject),否则 Promise 会正常 resolve,
        // 不传 onError 的调用方会把失败当成功(拿到空补全),错误被静默吞掉。
        if (opts.onError) {
          // recoverable=true 标记"网络可重试但已耗尽自动重连次数",前端可显示"网络不稳定,可手动重试"
          opts.onError(message, { ...info, recoverable: !isBusinessError })
          return
        }
        throw err
      }
      // P2-2 优先消费 Retry-After(秒转毫秒,上限 STREAM_MAX_RETRY_DELAY);
      // 无 retryAfter 时走指数退避:1s, 2s, 4s, 8s... 上限 30s(与 useAgentSSE 重连模式一致)
      const delay =
        info?.retryAfter !== undefined
          ? Math.min(info.retryAfter * 1000, STREAM_MAX_RETRY_DELAY)
          : Math.min(STREAM_INITIAL_RETRY_DELAY * 2 ** attempt, STREAM_MAX_RETRY_DELAY)
      attempt++
      opts.onReconnect?.(attempt, delay)
      await sleepWithAbort(delay, opts.signal)
    }
  }
}

/**
 * 阶段 2:前端工具执行代理结果回传(2026-08-02 立)
 * 前端收到 SSE tool-delegate 事件后,用 FileSystemDirectoryHandle 执行工具,
 * 通过此方法回传结果给 ai-service,唤醒 tool loop 中等待的 asyncio.Event。
 *
 * POST /llm/complete/stream/{session_id}/tool-result
 * Body: { tool_call_id, result, error }
 *
 * ai-service base URL 通过 import.meta.env.NEXT_PUBLIC_AI_SERVICE_URL 获取,
 * 默认 http://localhost:8803。非 Vite 环境(无 import.meta.env)走默认值。
 */
/**
 * ai-service base URL 解析(2026-09-25 抽出;原文抄自 postToolResult,行为逐字不变)。
 *
 * 注意:webpack 只对 `process.env.NEXT_PUBLIC_X` **直接点号访问**做构建期内联,
 * 把 process.env 赋给变量再取属性不会被替换;import.meta.env 保留给 Vite 系构建(Taro/extension)。
 * 上行回传帧(tool-result / form-response)共用这一处,不得各抄一份默认值。
 */
function aiServiceBaseUrl(): string {
  const viteEnv = (import.meta as unknown as { env?: Record<string, unknown> }).env
  const nextUrl =
    typeof process !== 'undefined' && process.env
      ? process.env.NEXT_PUBLIC_AI_SERVICE_URL
      : undefined
  const rawUrl = viteEnv?.NEXT_PUBLIC_AI_SERVICE_URL ?? nextUrl
  const baseUrl = typeof rawUrl === 'string' && rawUrl ? rawUrl : undefined
  return baseUrl || 'http://localhost:8803'
}

export async function postToolResult(
  sessionId: string,
  toolCallId: string,
  result: string | null,
  error: string | null,
): Promise<void> {
  // 2026-09-04 修复:Next.js(webpack)不注入 import.meta.env,原实现恒回落
  // localhost:8803,桌面端/生产 web 的工具结果回传全部打不到 ai-service。
  // 解析口径已抽到 aiServiceBaseUrl()(D77 起两条上行通道共用)。
  // 2026-08-06 修复:原实现忽略 fetch 结果,失败时既不抛错也不重试,
  // ai-service 工具循环等待的 asyncio.Event 永远不唤醒 → 前端工具代理流程挂死。
  // 现在检查 resp.ok,失败抛错让调用方重试(调用方已有重试/降级策略)。
  const aiServiceUrl = aiServiceBaseUrl()
  let resp: Response
  try {
    resp = await fetch(`${aiServiceUrl}/llm/complete/stream/${sessionId}/tool-result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool_call_id: toolCallId, result, error }),
    })
  } catch (e) {
    throw new Error(
      `postToolResult network error (session=${sessionId}, tool=${toolCallId}): ${(e as Error).message}`,
    )
  }
  if (!resp.ok) {
    let detail = ''
    try {
      detail = (await resp.text()).slice(0, 200)
    } catch {
      // 忽略 body 读取失败,只保留 status
    }
    throw new Error(
      `postToolResult failed: HTTP ${resp.status} (session=${sessionId}, tool=${toolCallId})${detail ? `: ${detail}` : ''}`,
    )
  }
}

/**
 * V3 #58(2026-09-26 立):主对话流工具审批决策回传。
 *
 * 与 postToolResult 同族:直连 ai-service `/llm/complete/stream/{sessionId}/approval-response`,
 * 唤醒 llm.py tool loop 中等待审批的协程(approve → 工具继续执行;reject/超时 → 不执行,
 * 回填 errorCode=TOOL_APPROVAL_DENIED / TOOL_APPROVAL_TIMEOUT 的失败 tool-result)。
 * 不走网关 /agent/approval-response —— 那条通道指向 agent_loop_v2 的审批注册表,
 * 与主对话流的 llm.py _approval_sessions 是两套独立 session 域,互相寻址不到。
 */
export async function postToolApprovalResponse(input: {
  /** 发起审批的流会话 id(tool-approval 帧的 session_id) */
  sessionId: string
  /** 审批请求唯一 id */
  approvalId: string
  /** 用户决策 */
  decision: 'approve' | 'reject'
  /** 审批作用域(仅 approve 时有意义;缺省由后端按 once 处理,最小特权) */
  scope?: 'once' | 'session' | 'always'
  /** 用户附带原因(可选,拒绝理由为主) */
  reason?: string
}): Promise<void> {
  const aiServiceUrl = aiServiceBaseUrl()
  let resp: Response
  try {
    resp = await fetch(`${aiServiceUrl}/llm/complete/stream/${input.sessionId}/approval-response`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approval_id: input.approvalId,
        decision: input.decision,
        ...(input.scope !== undefined ? { scope: input.scope } : {}),
        // 空原因不携带(与"用户没说原因"区分于"说了个空原因")
        ...(input.reason !== undefined && input.reason !== '' ? { reason: input.reason } : {}),
      }),
    })
  } catch (e) {
    throw new Error(
      `postToolApprovalResponse network error (session=${input.sessionId}, approval=${input.approvalId}): ${(e as Error).message}`,
    )
  }
  if (!resp.ok) {
    let detail = ''
    try {
      detail = (await resp.text()).slice(0, 200)
    } catch {
      // 忽略 body 读取失败,只保留 status
    }
    throw new Error(
      `postToolApprovalResponse failed: HTTP ${resp.status} (session=${input.sessionId}, approval=${input.approvalId})${detail ? `: ${detail}` : ''}`,
    )
  }
}

/**
 * D77(2026-09-25 立,G-106):把用户的批准/拒绝组装成 **form_response** 帧(纯函数,零副作用)。
 *
 * 成对判据钉在这里,而不是散在各端的点击回调里:
 *  · approve → 带 values(判定层校验通过后的表单值),**不写 rejectReason**
 *  · reject  → 带 rejectReason(用户填的拒绝理由),**整字段省略 values**
 *    —— 这是判定层 `rejectNoSideEffect`("拒绝路径不得触发任何提交动作")在协议形状上的落点。
 *    给个空对象 `{}` 会诱导后端建一条空草稿/空日程,所以是"没有这个字段",不是"字段为空"。
 *  同理:拒绝时若用户没填理由,**省略 rejectReason 而不是写空串** ——
 *  空串等于声称"用户说了个空原因",与"无处可载"是两回事,后端不该收到假信息。
 */
export function buildFormResponseEvent(input: {
  requestId: string
  kind: string
  action: 'approve' | 'reject'
  values?: Record<string, string | readonly string[]>
  reason?: string
  messageId?: string
}): FormResponseEvent {
  const trimmedReason = typeof input.reason === 'string' ? input.reason.trim() : ''
  const event: FormResponseEvent = {
    requestId: input.requestId,
    kind: input.kind,
    action: input.action,
  }
  if (input.action === 'approve') {
    if (input.values) event.values = input.values
  } else if (trimmedReason) {
    // reject-only:绝不带 values(见上,零副作用的形状)
    event.rejectReason = trimmedReason
  }
  if (typeof input.messageId === 'string' && input.messageId) event.messageId = input.messageId
  return event
}

/**
 * form_response 上行回传(与 postToolResult 同一条 ai-service 会话通道,2026-09-25 立)。
 *
 * POST /llm/complete/stream/{session_id}/form-response
 * Body: { request_id, kind, action, values?, reject_reason?, message_id? }
 *       —— ai-service 侧字段名沿用 snake_case(与 tool-result 的 tool_call_id 同族)。
 *
 * 失败必抛(照 postToolResult 的 2026-08-06 教训):静默吞掉 = 用户点了"批准"而 AI 侧
 * 永远等不到应答,表单卡停在已批准的假象上。调用方据异常把状态改判为 failed。
 */
export async function postFormResponse(sessionId: string, event: FormResponseEvent): Promise<void> {
  const aiServiceUrl = aiServiceBaseUrl()
  let resp: Response
  try {
    resp = await fetch(`${aiServiceUrl}/llm/complete/stream/${sessionId}/form-response`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request_id: event.requestId,
        kind: event.kind,
        action: event.action,
        ...(event.values ? { values: event.values } : {}),
        ...(event.rejectReason ? { reject_reason: event.rejectReason } : {}),
        ...(event.messageId ? { message_id: event.messageId } : {}),
      }),
    })
  } catch (e) {
    throw new Error(
      `postFormResponse network error (session=${sessionId}, request=${event.requestId}): ${(e as Error).message}`,
    )
  }
  if (!resp.ok) {
    let detail = ''
    try {
      detail = (await resp.text()).slice(0, 200)
    } catch {
      // 忽略 body 读取失败,只保留 status
    }
    throw new Error(
      `postFormResponse failed: HTTP ${resp.status} (session=${sessionId}, request=${event.requestId})${detail ? `: ${detail}` : ''}`,
    )
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
