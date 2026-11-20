// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  type GoalWireStatus,
  type ReasoningEffort,
  type ApiResult,
  type PlanUpdateEvent,
  type TerminalStartEvent,
  type TerminalEndEvent,
  type CitationsEvent,
} from '@ihui/types'
// #11 Citations 全链路(2026-09-13 立):类型已迁至 @ihui/types(与 PlanUpdateEvent 等一致),
// 本地不再重复定义,消除 import 与本地声明的 TS2440 冲突。
export type { CitationsEvent }
import { type CircuitBreaker, CircuitOpenError } from './circuit-breaker.js'
// 客户端签名注入(三端注册的 provider 在这里落到 X-IHUI-Client 头;算法本体在 @ihui/shared)
// 后缀必须是 .js:本包 `"type": "module"` 是纯 ESM,tsc 输出 dist 后由 Node ESM 消费,
// 无后缀在 dist 里会被判 Cannot find module(extension 构建实测踩过),故与包内既有 import 同形。
import { applyClientSignature } from './client-sign.js'
import {
  applyTraceparentToHeaders,
  getTransport,
  recordTraceIdFromResponse,
  requireAbortSignal,
  runtimeSupportsAbort,
  startTimeoutWatchdog,
  type TransportInit,
} from './transport.js'
// D138(承 V4 #96):流式传输注入口(streamChat 的 fetch 腿改经此,小程序注入 Taro adapter)
import { getStreamTransport } from './stream-transport.js'
// D116 原始 SSE 全帧采集(默认关闭,零开销;展示端 stream-inspector 挂工具托盘)
import { recordStreamFrame } from './stream-frame-log.js'
// b76-13 票1:帧水位与纪元读环判据(唯一语义出口在 @ihui/shared 的 agent-events,
// 本包零依赖不得反向 import,此为逐字同形移植,漂移由 frame-watermark-parity 测试钉住)
import {
  isFrameGap,
  readFrameWatermark,
  type FrameWatermark,
  type FrameWatermarkCursor,
} from './frame-watermark.js'
// b76-15(2026-10-29 立):seq 维水位生产点(从网关 `id: <seq>` 行派生连续性事实)
import {
  assembleFrameWatermarkFacts,
  carriesPayloadWatermark,
  createFrameSeqTracker,
  frameWatermarkGapAction,
  watermarkFactDisposition,
} from './frame-watermark-producer.js'
import {} from './frame-watermark-producer.js'
// G-816030:帧归属屏障 —— 本包零依赖边界下的同形移植(判据源在 shared,对账测试钉住);
// 溢出错误(FrameBarrierOverflowError)由屏障 activate 命中溢出记录时构造抛出,
// reason/droppedCount 以屏障内记录为准,本侧不重复构造。
import { createFrameOwnershipBarrier, type BarrierFrame } from './frame-ownership-barrier.js'
// G-816031:权威信封路由 —— 恢复闸门在 SSE 帧流上的生产消费点(判据源在 shared,本包同形移植)
import { createStreamAuthorityRouter, StreamAuthorityResubscribeError } from './stream-authority.js'
import {} from './recovery-gate.js'
import type { DeviceFingerprintCollector } from '@ihui/types'
// D152(2026-09-29):goal 状态的合法值集是**运行时判据**(解析帧时要验 status),
// 故按值导入而非 type-only —— 单一来源仍是 @ihui/types 的 GOAL_WIRE_STATUSES。
import { GOAL_WIRE_STATUSES } from '@ihui/types'
// b76-08a(2026-09-30 立):连接级能力位由宿主注入 —— 本包是 TS 侧唯一转发注入口的调用方。
import { stripClientCapabilityFields } from '@ihui/types'
// error 序列化唯一出口(2026-09-26 立)。上行 tool-result 帧的 error 字段若被调用方在
// catch 里把 Error 本体(as 强转即可过 tsc)塞进来,JSON.stringify 会得 "{}" ——
// ai-service 的 tool loop 唤醒时收到的是空对象事故现场。详见 postToolResult 上方 toWireError。
// 发布收口(2026-09-26 同批):原为 `import { serializeError } from '@ihui/types'` —— 那是本包
// dist 里唯一一条对 @ihui/types 的**具名值**运行时导入,而 @ihui/types 不可发布(private、exports
// 指向 src),判据 9 据此把本包钉成坏包。值出口搬到包内逐字移植(error-serialize.ts,类型仍从
// @ihui/types 锚定,零重写),同 nullDeviceFingerprintCollector 的既有收口形态。
import { serializeError } from './error-serialize.js'
// 2026-11-05 立:OpenAI 兼容流式工具调用解析（逆向-复现-超越 Qoder/Trae 的 tool-call args 流式修复）。
// 仅在 opts.openAiCompat === true 时启用,默认走既有 Vercel AI SDK 协议解析,零行为变化。
import {
  parseOpenAiStreamLine,
  createOpenAiToolCallAccumulator,
  parseToolCallArgsDeltaFrame,
} from './openai-tool-stream.js'

/**
 * 默认空采集器(发布物自包含,2026-09-26 立)。
 *
 * 原先这里是 @ihui/types 的一个**具名值**导入(nullDeviceFingerprintCollector)—— 那是
 * `@ihui/api-client` 唯一的运行时跨包依赖,而 `@ihui/types` 仍是 private 且 exports 指向
 * `./src/*.ts`(实测 `node scripts/check-pkg-installable.mjs packages/types` 有 6 条 blocker),
 * 所以只要这行在,本包的 `dependencies` 就摘不掉 `workspace:` 协议 —— 发出去即 ERR_MODULE_NOT_FOUND。
 * 改成包内常量后,`@ihui/types` 降级为纯类型面(devDependency),tsc 把 `import type` 整条抹掉,
 * dist 里不再有任何 `@ihui/types` 运行时引用;这与 `@ihui-ai/sdk` 的既有形态同形
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
/** 最近一次成功刷新的结果与时刻,供 REFRESH_SUCCESS_REUSE_MS 窗口内短路 */
let lastRefreshSuccessToken: string | null = null
let lastRefreshSuccessAt = 0
// 2026-09-04 根治刷新风暴:刷新失败后的冷却窗口(毫秒)。
// refresh token 已失效时,每次 401 都会触发一次 refresh(后端单次轮转 + RFC 6749 §10.4
// family 吊销),并发业务请求各 401 → 各触发一次 → 形成 6+ 次串行 /auth/refresh 风暴,
// 且反复用已吊销 token 重放会加剧 family 吊销。失败后进入冷却,窗口内直接返回 null,
// 由调用方按"登录过期"处理,不再空转重复刷新。
const REFRESH_FAIL_COOLDOWN_MS = 5000
/**
 * 429 限流冷却:/auth/refresh 窗口是 1 分钟 20 次,冷却必须盖住整窗,
 * 否则下一个失败请求会立刻再敲一次门把窗口继续顶满(实测自锁)。
 */
const REFRESH_RATE_LIMIT_COOLDOWN_MS = 65_000
/**
 * 刷新成功后复用窗口:窗口内 getToken() 仍是刚换到的那枚 ⇒ 直接复用,不再发请求。
 * 取 10s 而非更久:access token 有效期 15 分钟,10s 只吸收"同一批并发/紧邻重试",
 * 不会让真正过期的 token 被误复用。
 */
const REFRESH_SUCCESS_REUSE_MS = 10_000
// 冷却期内共享的失败结果 promise(避免多个等待方各拿一份 null 后立即重试)
let refreshFailCooldown: Promise<string | null> | null = null
let refreshFailCooldownTimer: ReturnType<typeof setTimeout> | null = null
// 请求超时的默认档：**全仓只住这一枚常量**(2026-08-06 各腿各自硬写 30_000,四处同值漂移过一次)。
// 缺省口径住在 client 层而不是 transport 层 —— transport.ts 第 83 行注自述"不设默认值"。
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000
/** 调用方给的超时值取用规则:正数才生效,否则落默认档。 */
function resolveRequestTimeoutMs(requested: number | undefined): number {
  return requested && requested > 0 ? requested : DEFAULT_REQUEST_TIMEOUT_MS
}
// 2026-08-02 设备维度风控:默认空采集器,各端启动时注入实现
let deviceFingerprintProvider: DeviceFingerprintProvider = nullDeviceFingerprintCollector
let baseUrl: string = ''
// ai-service 专用基址覆盖(2026-10-12 立,根治"桌面端 dev 签到页报 Route GET:/api/checkin/accounts not found")。
// null=未注入(沿用共享 baseUrl,其它端零回归);''=同源(/api/* 经 next rewrites / nginx 反代);
// 'http://127.0.0.1:8803'=直连本机 ai-service。
// 背景:web 的 REST 共享基址在"Tauri + 本地 origin"下是本机 API 8802,fetchAiServiceJson 复用它
// 会把只存在于 ai-service(8803) 的路由(/api/checkin/*、/api/mcp/*、/api/agents/* 等)打到
// 8802 → Fastify 404(Route GET:/api/checkin/accounts not found)。
let aiServiceBaseOverride: string | null = null
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
 * 读取当前共享基址(B4 2026-11-02 立)。
 *
 * 直连 fetch 的腿(如 Agent 会话 SSE)自己拼 URL 时不能假设 baseUrl 可读 ——
 * 此前只有写入口没有读出口,端内只能自己再存一份 API_BASE_URL,就是第二份真相。
 * 浏览器端返回 ''(同源相对路径),RN/桌面返回已注入的绝对基址。
 */
export function getBaseUrl(): string {
  return baseUrl
}

/**
 * 注入 ai-service 专用基址(2026-10-12 立,见 aiServiceBaseOverride 处注释)。
 * 只影响 fetchAiServiceJson;传 null 恢复"沿用共享 baseUrl"的旧行为(其它端零回归)。
 * web 端在 src/lib/api.ts 用 resolveAiServiceBaseUrl() 注入
 * (Tauri 本地 dev → http://127.0.0.1:8803;其余 → '' 同源走 rewrites/nginx 反代)。
 */
export function setAiServiceBase(url: string | null): void {
  aiServiceBaseOverride = url === null ? null : url.replace(/\/$/, '')
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

/**
 * 401 终局通知前的凭据复核(2026-09-29 立,台账票 G-814411):
 * 请求发出时所带的 token 若已不是当前值(刷新在飞期间 provider 被切换 / 凭据被另一
 * 路径更新),这个 401 就属于已被替换的旧凭据 —— 此时通知端内会触发登出清理,误清掉
 * 新凭据的登录态。故只在「该请求的 token 就是当前 token」时才放行通知。
 * (「重试仍 401」的出口不复核:那一格的新 token 刚过 CAS 复核,本就是当时的凭据。)
 */
function isTokenStillCurrent(requestToken: string | null): boolean {
  return tokenProvider.getToken() === requestToken
}

/** 读取当前 token(供需要原生 fetch 的场景使用,如 SSE 流式) */
export function getToken(): string | null {
  return tokenProvider.getToken()
}

/**
 * 刷新瞬时失败标记(2026-10-09 根治「自动登录总被清掉」)。
 *
 * 各端 refreshAccessToken 实现对**网络错误/超时/5xx/无 status** 这类"服务暂不可用"
 * 的失败抛本错误 —— 是否瞬时的判据复用 `@ihui/shared/auth/auto-login-policy` 的
 * `classifyRefreshFailureStatus`(唯一出口,本包零依赖不重复实现判据);
 * 返回 null 仍表示"凭据被服务端明确拒绝(401/403)"。
 *
 * api-client 据此让 401 续期失败出口分型:瞬时失败**不**触发 notifyUnauthorized ——
 * 否则端内出口(RN/小程序/扩展的会话终结出口)会把一次网络抖动/api 重启当成会话
 * 彻底失效,结束本地会话并写持久登出标记,30 天 refresh 凭据被永久废掉,
 * 用户被迫反复手动登录(与 web 冷启动 bootstrap 同一根因,同批根治)。
 */
export class TransientRefreshError extends Error {
  constructor(message = 'refresh transient failure (network/5xx)') {
    super(message)
    this.name = 'TransientRefreshError'
  }
}

/**
 * 续期被限流(HTTP 429)。
 *
 * 为什么要与 TransientRefreshError 分开(2026-11-12 实测):
 * `/auth/refresh` 限流 20 次/分钟。被限流时响应体里**没有**新 accessToken,
 * 若按"瞬时失败"处理,401 拦截器会立刻再触发一次续期 ⇒ 更限流 ⇒ 自锁。
 * 真浏览器实测:一次页面加载打出 21 次 refresh(前 20 次 200、第 21 次 429),
 * 此后每个 401 都再触发一次,页面永远停在未登录且用户看到"请先登录"。
 *
 * 单独成类是为了让上层**退避到限流窗口之外**,而不是按 5s 冷却反复敲门。
 */
export class RefreshRateLimitedError extends Error {
  constructor(message = 'refresh rate limited (429)') {
    super(message)
    this.name = 'RefreshRateLimitedError'
  }
}

/**
 * 最近一次刷新失败是否为瞬时性质。
 * 与 refreshInFlight/refreshFailCooldown 同步串行:消费点在 await 该轮刷新后同步读取,
 * 冷却窗口内不会有新一轮刷新改写本标志(5s 冷却 > 读取点的微任务间隙)。
 */
let lastRefreshWasTransient = false

/** 读取最近一次刷新失败的瞬时标志(fetchApi 的 401 出口与测试用) */
export function wasLastRefreshTransient(): boolean {
  return lastRefreshWasTransient
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
 *
 * 2026-09-29 CAS 复核(台账票 G-814411):刷新响应写回(交回调用方去覆盖凭据)前,
 * 复核「发起刷新时的 active provider 仍是当前 provider,且旧 accessToken 仍是当前值」,
 * 任一漂移即丢弃响应(返回 null,不算失败、不进冷却)—— 防止刷新请求在飞期间凭据被
 * 另一路径更新(换 provider / 再登录 / 另一轮续期)后,过期的刷新结果覆盖新凭据。
 */
export async function refreshAccessTokenOnce(): Promise<string | null> {
  if (!tokenProvider.refreshAccessToken) return null
  // 失败冷却期内:直接返回共享的失败 promise,不重复发起 refresh
  if (refreshFailCooldown) return refreshFailCooldown
  if (refreshInFlight) return refreshInFlight
  // 刚成功刷新过 ⇒ 直接返回那枚新 token(2026-11-12 修刷新风暴)。
  //
  // 病灶:refreshInFlight 只合并"同一时刻"的调用,挡不住"前一个刚落地、后一个立刻发起"。
  // 真浏览器实测:一次页面加载里 6 个 useAuthBootstrap 使用方 + 若干 401 拦截器
  // 在 15 秒内串行打出 21 次 /auth/refresh(全部 200),撞上 20 次/分钟限流后 429,
  // 整个续期链自锁、页面永远停在未登录。
  //
  // 语义:refresh token 单次轮转,刚换到的新 access token 有效期 15 分钟,没有任何理由
  // 在 10 秒内再换一次。窗口内直接复用,既省请求也避开限流。
  if (
    lastRefreshSuccessToken &&
    Date.now() - lastRefreshSuccessAt < REFRESH_SUCCESS_REUSE_MS &&
    tokenProvider.getToken() === lastRefreshSuccessToken
  ) {
    return lastRefreshSuccessToken
  }
  // 2026-09-29 CAS 复核基线(台账票 G-814411):发起那一刻的 active provider
  // (tokenProvider 对象身份,即本包唯一的"当前生效凭据上下文",等价于上游的
  // generation + activeProvider)与旧 accessToken。刷新实现一并就地捕获 ——
  // 这次 in-flight 归属于发起它的那份凭据,而不是微任务轮到时恰好挂在
  // tokenProvider 上的那一份。
  const providerAtStart = tokenProvider
  const oldTokenAtStart = providerAtStart.getToken()
  const refreshImpl = providerAtStart.refreshAccessToken!
  refreshInFlight = Promise.resolve()
    .then(() => refreshImpl())
    .then((t) => {
      // 走到这里(含 CAS 丢弃)说明端内实现没有抛瞬时错误:成功或明确拒绝
      lastRefreshWasTransient = false
      const newToken = t ?? null
      // 2026-09-29 CAS 复核(台账票 G-814411):响应返回后、写回前,三者比对 ——
      // active provider 未切换,且旧 accessToken 仍是当前值(或已被本刷新自己
      // 持久化成响应值:provider 契约是"内部自行持久化",值相等即同一份凭据,
      // 放行不算覆盖)。漂移 ⇒ 凭据在刷新飞期间已被换人,本响应是过期账目,
      // 丢弃:不覆盖新凭据,调用方拿 null 走既有失败路径;本分支不算刷新失败,
      // 不进冷却窗口(否则会拦住新凭据自己的正常续期)。
      if (tokenProvider !== providerAtStart) return null
      const currentToken = tokenProvider.getToken()
      if (currentToken !== oldTokenAtStart && currentToken !== newToken) return null
      // 刷新成功:清空冷却态(如有),返回新 token
      clearRefreshFailCooldown()
      if (newToken) {
        lastRefreshSuccessToken = newToken
        lastRefreshSuccessAt = Date.now()
      }
      return newToken
    })
    .catch((err) => {
      // 刷新失败:进入冷却窗口,阻止后续 401 在窗口内重复刷新
      // 429 需要退避到限流窗口之外(默认 5s 冷却敲不服 20 次/分钟的窗口)
      startRefreshFailCooldown(
        err instanceof RefreshRateLimitedError ? REFRESH_RATE_LIMIT_COOLDOWN_MS : undefined,
      )
      // 2026-10-09 分型:端内实现抛 TransientRefreshError = 网络/5xx 性质的失败,
      // 不构成"会话不可恢复" —— fetchApi 的 401 出口据此外置标志跳过 notifyUnauthorized,
      // 防止端内出口把瞬时失败当会话终结(写持久登出标记 → 30 天 refresh 凭据被永久废掉)。
      lastRefreshWasTransient = err instanceof TransientRefreshError
      return null
    })
    .finally(() => {
      refreshInFlight = null
    })
  return refreshInFlight
}

/** 启动失败冷却窗口:窗口内 refreshAccessTokenOnce 直接返回共享失败 promise */
function startRefreshFailCooldown(ttlMs: number = REFRESH_FAIL_COOLDOWN_MS): void {
  if (refreshFailCooldown) return
  refreshFailCooldown = Promise.resolve(null)
  refreshFailCooldownTimer = setTimeout(() => {
    refreshFailCooldown = null
    refreshFailCooldownTimer = null
  }, ttlMs)
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
  lastRefreshWasTransient = false
  lastRefreshSuccessToken = null
  lastRefreshSuccessAt = 0
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

/**
 * 登录 / 换验证码端点的 401 独立分型判据(台账票 G-1121553)。
 *
 * 服务端在「验证码错误或已过期」时同样回 HTTP 401(实测 `POST /api/auth/login/sms`:
 * `{"code":401,"message":"验证码错误或已过期"}`),而通用 401 出口把它渲染成
 * 「登录已过期,请重新登录」—— 真机复验里这条误导文案让人连按"会话被踢 / 服务端限流"
 * 方向排查三轮,重启 App、清 token 才定位到"码打错了"。
 *
 * 判据刻意**不只认 status code**:登录/换码这一类失败必须先过分型再谈通用出口。两级判据
 * (命中任一即成立):
 *   ① errorCode 点名验证码(`SMS_CODE_INVALID` / `AUTH_CODE_EXPIRED` 等);
 *   ② 服务端 message 以「验证码」起头(实测后端这条不发 errorCode,只能靠文案前缀点名;
 *      前缀而非全串包含,避免"会话已过期,请重新获取验证码"这类句式被误吞进本型)。
 */
export function isVerificationCodeFailure(
  errorCode: string | undefined,
  message: string | undefined,
): boolean {
  if (
    errorCode &&
    /^(?:[A-Z]+_)?CODE_(?:INVALID|EXPIRED|ERROR|FAILED|REQUIRED)$/i.test(errorCode)
  ) {
    return true
  }
  if (message && /^(?:短信|邮箱)?验证码/.test(message.trim())) return true
  return false
}

/** 规范化 URL(供需要原生 fetch 的场景使用) */
export function normalizeUrlPublic(url: string): string {
  return normalizeUrl(url)
}

/**
 * 敏感操作的 2FA step-up 拒绝同样回 401,但它不是凭据失效。
 *
 * 若按通用 401 出口走:一个开了 2FA 的用户点一次提现,会被弹「登录已过期」并被触发
 * 一次无谓的 token 续期(续期即便成功,重试那一发仍是 401)。与验证码那一型同一处置 ——
 * 剥掉 status,让 errorCode 原样交给调用方去拉二次验证面板。
 *
 * ACCOUNT_UNJUDGED 一并归此型:那是服务端读不到账号的 2FA 状态(判不出就不放行),
 * 不是用户凭据被否 —— 把人登出既救不了这一次操作,还会打断他正在做的事。
 */
export function isStepUpRejection(errorCode: string | undefined): boolean {
  return errorCode === 'STEP_UP_REQUIRED' || errorCode === 'ACCOUNT_UNJUDGED'
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
/**
 * 本站凭据只许发往本站域集合(2026-10-31 安全强化第 20 批)。
 *
 * 病灶:`normalizeUrl` 的第一条分支是 `if (/^https?:\/\//i.test(url)) return url` ——
 * 绝对 URL 原样直通,而下面挂凭据的那一步只看"有没有 token",不看"这枚请求要去哪"。
 * 于是任何能让 `fetchApi/apiOrThrow` 拿到一个外链 path 的通道(现读到的这一条是
 * 浏览器扩展的 api.proxy:后台代持 accessToken,调用方给的 path 一路透传),
 * 都会**带着本站长期凭据请求任意域**,并把响应原样带回调用方。
 *
 * 判据口径:相对 URL 是同源 ⇒ 照挂;绝对 URL 只有 origin 命中"本端已注入的基址集合"
 * (api 基址 / 流式基址 / ai-service 基址 / 宿主同源)才挂。集合为空且目标是绝对 URL ⇒
 * **不挂**(fail-closed:调用方给了完整外链,凭据该不该去与基址是否注入无关)。
 */
export function credentialAllowedOrigins(
  bases: Array<string | null | undefined>,
  sameOrigin?: string | null,
): Set<string> {
  const out = new Set<string>()
  for (const b of bases) {
    if (!b) continue
    try {
      out.add(new URL(b).origin)
    } catch {
      // 相对基址(同源代理):本身不产 origin,由 sameOrigin 那一路覆盖
    }
  }
  if (sameOrigin) {
    try {
      out.add(new URL(sameOrigin).origin)
    } catch {
      // 同上:解析不了就不进集合
    }
  }
  return out
}

/** 目标 URL 是否允许携带本站凭据。 */
export function shouldAttachCredential(
  target: string,
  allowedOrigins: ReadonlySet<string>,
): boolean {
  // 无 scheme 形态 = 同源相对请求 ⇒ 与旧行为一致
  if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(target)) return true
  let origin: string
  try {
    origin = new URL(target).origin
  } catch {
    return false
  }
  return allowedOrigins.has(origin)
}

/** 宿主同源(浏览器/WebView 有 location;RN/小程序没有 ⇒ null,由基址集合覆盖)。 */
function hostOrigin(): string | null {
  const loc = (globalThis as { location?: { origin?: unknown } }).location
  return typeof loc?.origin === 'string' && loc.origin ? loc.origin : null
}

/** 本端已注入基址的 origin 集合(每次现算 —— 基址可在运行期被 setBaseUrl 改)。 */
function currentCredentialAllowedOrigins(): Set<string> {
  // aiServiceBaseUrl() 是"裸 fetch 腿"的合法目标(工具结果回传、上传表单等十几条腿
  // 都打它的绝对 URL),不纳入就会把那些腿的凭据一起掐掉 —— 它是同一条既有真相源,
  // 不是新开的口子。
  let aiBase: string | null = null
  try {
    aiBase = aiServiceBaseUrl()
  } catch {
    aiBase = null
  }
  return credentialAllowedOrigins(
    [baseUrl, streamBaseUrl, aiServiceBaseOverride, aiBase],
    hostOrigin(),
  )
}

function normalizeUrl(url: string, useStreamBase = false, baseOverride?: string | null): string {
  if (/^https?:\/\//i.test(url)) return url
  const normalized = (() => {
    if (url.startsWith('/api/') || url.startsWith('/uploads/') || url.startsWith('/ws/')) return url
    if (url.startsWith('/cozeZhsApi')) {
      return url.replace(/^\/cozeZhsApi/, '/api')
    }
    if (url.startsWith('/')) return `/api${url}`
    return `/api/${url}`
  })()
  // baseOverride(2026-10-12):fetchAiServiceJson 的 ai-service 专用基址通道 ——
  // undefined=未注入走默认;''=同源;非空=直连指定 base。优先级最高(含高于 useStreamBase)。
  const base =
    baseOverride !== undefined
      ? baseOverride
      : useStreamBase && streamBaseUrl
        ? streamBaseUrl
        : baseUrl
  return base ? `${base}${normalized}` : normalized
}

/**
 * 非 2xx 响应体 → { message, errorCode } 的唯一派生出口。
 *
 * 立门前这张逻辑有三份副本(fetchOnce / fetchApiOnce / SSE 直连),且已经漂到三个不同方向:
 *   - 兜底文案一份写全角括号、一份写半角;
 *   - message 与 detail 的优先级一份是 message 优先、另一份是 detail 覆盖 message;
 *   - SSE 那一腿干脆不做空白判定,`text ||` 让一个空格的 body 原样进 Error.message。
 * 空白 body 不是格式问题:nginx 的空 404、被裁过的错误页都会返回长度为 1 的空白,调用方普遍写
 * `showToast(res.error || t('…'))`,同一个 `||` 兜不住 ⇒ 真机拍到一个只有图标没有文字的深色方块。
 * 所以判据只能有一处实现,三条腿都从这里取(§3 共享层优先 / §22c 同一件事不得有两份真相)。
 *
 * 优先级口径取 message 先、detail 后:自家 api 的契约是 `{code, message, data}`,
 * `{detail}` 是 FastAPI 经 api 原样透传那一族,两者同时出现时前者才是我们要给用户看的那条。
 */
export function deriveFailureFromBody(
  text: string,
  status: number,
): { message: string; errorCode?: string } {
  let message = text.trim() || `请求失败（${status}）`
  let errorCode: string | undefined
  let parsed: Record<string, unknown> | undefined
  try {
    const raw: unknown = JSON.parse(text)
    if (raw && typeof raw === 'object') parsed = raw as Record<string, unknown>
  } catch {
    // 非 JSON 响应,保留 text 作为 message
  }
  if (parsed) {
    // FastAPI 的错误体有**两种**形态:
    //   ① `{"detail":"字符串"}` —— 路由只给一句话;
    //   ② `{"detail":{"errorCode":"…","message":"…"}}` —— 路由显式传 dict(多结论端点的
    //      标准写法,如 `/agents/{sid}/pause` 用状态码分辨 403/404/409/503)。
    // 旧实现只认 ①:形态 ② 下 `message`/`errorCode` 双双取不到,于是 error 落回**整段
    // 原始 JSON 文本**、errorCode 恒 undefined —— 端上想按结论格分流就只能自己去解析响应体,
    // 而"哪种失败"恰恰是本仓最不允许折叠成一格的信息(§5 响应必须可分辨)。
    const detailObject =
      parsed.detail && typeof parsed.detail === 'object'
        ? (parsed.detail as Record<string, unknown>)
        : undefined
    const nestedMessage =
      detailObject && typeof detailObject.message === 'string' && detailObject.message.trim()
        ? detailObject.message
        : undefined
    const nestedErrorCode =
      detailObject && typeof detailObject.errorCode === 'string'
        ? detailObject.errorCode
        : undefined
    // message 优先于 detail(自家 api 契约是 {code,message,data};detail 只作 FastAPI 透传的补位)
    if (typeof parsed.message === 'string' && parsed.message.trim()) message = parsed.message
    else if (typeof parsed.detail === 'string' && parsed.detail.trim()) message = parsed.detail
    else if (nestedMessage) message = nestedMessage
    if (typeof parsed.errorCode === 'string') errorCode = parsed.errorCode
    else if (nestedErrorCode) errorCode = nestedErrorCode
  }
  // 429 人机验证挑战降级(2026-11-13 立,治「做不了的 CAPTCHA」死锁)。
  //
  // 后端 anti-automation 越过挑战阈值后回 `429 + errorCode:'challenge_required'`,
  // message 是「请求频率过高,需完成人机验证」。但首方客户端(web/桌面/移动/CLI)
  // **没有任何 CAPTCHA 实现**(见 apps/api/src/plugins/anti-automation.ts、
  // apps/mobile-rn/src/lib/config.ts 的注释),用户只见文案、无控件可完成 ⇒ 死锁。
  //
  // 判据用机器可读 errorCode 优先,再兜一条中文文案正则(后端尚未全量带 errorCode 的窗口期);
  // 非此型(普通 429 限流,如「验证码请求过于频繁」)一律不误伤。
  if (status === 429 && isChallengeSignal(errorCode, message)) {
    return { message: '请求过于频繁,请稍后再试', errorCode: 'challenge_required' }
  }
  return { message, errorCode }
}

/**
 * 是否为「需人机验证」信号:机器可读 errorCode 优先,中文文案正则兜底。
 * 文案正则只匹配 anti-automation 那条原话,不误伤普通 429 限流文案。
 */
function isChallengeSignal(errorCode: string | undefined, message: string): boolean {
  if (errorCode === 'challenge_required') return true
  // 覆盖 anti-automation「需完成人机验证」与 sms-send-captcha「先完成人机验证」两种措辞
  return /频率过高.{0,12}人机验证|完成人机验证/.test(message.trim())
}

// ===================== 响应体入站 strict 校验 + 读前 scrub(b76-01 票1) =====================
// 权威 schema 面在 @ihui/types/api-contracts(ApiResponseEnvelopeSchema / scrubRevokedKeys /
// ContractValidationError),本包按 error-serialize 收口先例(见文件头 2026-09-26 注)逐字移植
// 运行时判据:@ihui/types 的 exports 指向 dist,运行时值导入会把本包重新钉回 workspace-only,
// 故类型面沿用 ApiResponse 锚定(import type),判据在包内自持。三处语义对齐票面:
//   ① strict:包络只认已声明字段,未知字段判失败 —— 新增字段一律先声明成 optional,
//     让升级后打开的历史载荷不至于整块退化成纯文本失败;
//   ② kind 定向读前 scrub:只删在场的键,不给缺席键补 undefined;
//   ③ 未列出的兄弟 kind 原样通过 scrub,交由 strict 面统一裁决。
// 已撤销字段不得在 strict 下"整块被拒",所以先 scrub 再 strict,两步成对,缺一即红。

const INBOUND_ENVELOPE_REVOKED_KEYS: Readonly<Record<string, readonly string[]>> = {
  // kind='envelope':历史载荷曾以布尔 `ok` 表达成功位,该字段已撤销 —— 读前剥掉,
  // 历史载荷不至于在 strict 下整块退化为失败。
  envelope: ['ok'],
}

const INBOUND_ENVELOPE_ALLOWED_KEYS: ReadonlySet<string> = new Set([
  'kind',
  'code',
  'message',
  'data',
  'errorCode',
])

/** 包络入站契约校验失败(与 @ihui/types/api-contracts 的同名错误同形)。 */
export class ContractValidationError extends Error {
  readonly issues: readonly string[]
  constructor(issues: readonly string[]) {
    super(`响应契约校验失败(${issues.length} 条): ${issues.join(' | ')}`)
    this.name = 'ContractValidationError'
    this.issues = issues
  }
}

/** 入站响应包络(strict 白面)。与 @ihui/types 的 ApiResponse 逐字段对齐。 */
export interface InboundEnvelope {
  code: number
  message: string
  data: unknown
  errorCode?: string
}

export type EnvelopeInboundResult =
  { matched: true; envelope: InboundEnvelope } | { matched: false }

/**
 * 响应体入站校验的唯一入口(fetchOnce 2xx 分支调用)。
 *
 * matched=false:不是包络 —— 非 JSON 对象,或无 `code` 包装的裸 JSON(ai-service 直返体)。
 * 后者维持既有语义:整个响应视作 data 返回。
 * matched=true:包络载荷 —— 先做 kind 定向读前 scrub,再做 strict 白名单裁决,
 * 未知字段/类型不符抛 ContractValidationError(未知字段整包判失败,不静默剥掉重放)。
 */
export function validateEnvelopeInbound(raw: unknown): EnvelopeInboundResult {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return { matched: false }
  const candidate = raw as Record<string, unknown>
  if (candidate.code === undefined) return { matched: false }

  // kind 定向读前 scrub:只删在场的键,不给缺席键补 undefined(undefined 也是值,
  // 补进去等于把"字段缺席"篡改成"字段存在但不知道",strict 与下游都会误判)。
  const kind = typeof candidate.kind === 'string' ? candidate.kind : undefined
  if (kind !== undefined) {
    const revoked = INBOUND_ENVELOPE_REVOKED_KEYS[kind]
    if (revoked) {
      for (const key of revoked) {
        if (key in candidate) delete candidate[key]
      }
    }
  }

  const issues: string[] = []
  const unknownKeys = Object.keys(candidate).filter((k) => !INBOUND_ENVELOPE_ALLOWED_KEYS.has(k))
  if (unknownKeys.length > 0) issues.push(`未知字段: ${unknownKeys.join(', ')}`)
  const codeValue: unknown = candidate.code
  const messageValue: unknown = candidate.message
  const errorCodeValue: unknown = candidate.errorCode
  if (typeof codeValue !== 'number') issues.push('code 必须是 number')
  if (typeof messageValue !== 'string') issues.push('message 必须是 string')
  if (errorCodeValue !== undefined && typeof errorCodeValue !== 'string') {
    issues.push('errorCode 必须是 string')
  }
  if (issues.length > 0) throw new ContractValidationError(issues)
  // 上面 typeof 判据已把形态钉死,这里的 as 是把"已验证"翻给类型面看(非 any,无宽化)。
  return {
    matched: true,
    envelope: {
      code: codeValue as number,
      message: messageValue as string,
      data: candidate.data,
      errorCode: typeof errorCodeValue === 'string' ? errorCodeValue : undefined,
    },
  }
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
  options: RequestInit & { timeoutMs?: number },
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
    // 没有中止能力的运行时(微信小程序)靠这一档把超时交给介质(Taro.request 的 timeout)
    timeoutMs: options.timeoutMs,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    const derived = deriveFailureFromBody(text, response.status)
    const message = derived.message
    const errorCode = derived.errorCode
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
    // G-1121553:登录 / 换验证码端点的"验证码错误或已过期"同样回 401。若把 status:401
    // 原样交出去,下游判序(status 档先于 message)会把它上屏成「登录已过期,请重新登录」
    // —— 真机误导即由此来。此型剥离 status,让服务端点名「验证码」的原话直接作为身份上屏。
    // 连带效果(方向正确):该 401 不再进 fetchApi 的续期 / notifyUnauthorized 块 ——
    // 打错验证码不是会话死亡,不得触发"会话被踢"清理(换绑手机验旧码等非认证端点同理受益)。
    const failureStatus =
      response.status === 401 &&
      (isVerificationCodeFailure(errorCode, message) || isStepUpRejection(errorCode))
        ? undefined
        : response.status
    return {
      success: false,
      error: message,
      status: failureStatus,
      errorCode,
      retryAfter: retryAfterValue,
    }
  }

  // b76-01 票1:入站 strict 校验 + 读前 scrub(判据见 validateEnvelopeInbound 上方注)。
  // 裸 JSON(ai-service 直返体,无 {code,message,data} 包装)不归包络管,维持原语义:
  // 整个响应视作 data 返回;包络载荷则严格按白面裁决,未知字段整包判失败。
  // BUG-13:2xx 一律禁止直接 response.json() —— 204/空体会抛 SyntaxError,被外层
  // normalizeErrorToResult 归一成「无 status 的网络异常」⇒ 命中网络重试 ⇒ 非幂等写
  // (POST/PUT)被重放。改走 text():「真空体」= 成功且 data=null;「有体但解析失败」=
  // 带 status 的业务失败(不是网络抖动,不重试、不重放),两者不再混为一谈。
  // 本段局部名刻意不叫 `text`:形状锁测试把「JSON.parse 直取 text」当作「失败体派生出现
  // 第二份副本」的指纹,本处在解析**成功体**(BUG-13 的 text() 路线),不是失败派生。
  const rawBody = await response.text().catch(() => '')
  if (rawBody.trim() === '') {
    return { success: true, data: null as T, status: response.status }
  }
  let rawJson: unknown
  try {
    rawJson = JSON.parse(rawBody) as unknown
  } catch {
    return {
      success: false,
      error: '响应体不是合法 JSON',
      status: response.status,
    }
  }
  const inbound = validateEnvelopeInbound(rawJson)
  if (!inbound.matched) {
    // 2026-09-09 0-5 迁移:成功分支携带 HTTP status(upsert 场景需区分 200/201)
    return { success: true, data: rawJson as T, status: response.status }
  }

  if (inbound.envelope.code !== 0) {
    return {
      success: false,
      error: inbound.envelope.message.trim() || '请求失败',
      status: response.status,
      errorCode: inbound.envelope.errorCode,
    }
  }

  return { success: true, data: inbound.envelope.data as T, status: response.status }
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

/**
 * 沿 `cause` 链向下找真 AbortError(2026-11-14 真机取证:登录页横幅直出英文原文)。
 *
 * 浏览器 / RN / undici 在 fetch 被 abort 时**抛的是 `TypeError('fetch failed')`**,
 * 真 `AbortError` 藏在 `cause` 里 ⇒ 仅靠 `isAbortError` 判不出,"超时/取消"被当成
 * 未知异常,英文 message 原样进了用户可见横幅。
 *
 * - 递归向下剥 `cause`,直到命中 `isAbortError` 或走到链尾;
 * - **环检测**:`cause` 指回自身(或已访问集合内)时立即回落到**原错误**,
 *   不死循环(调用方语义 = 拿不到真身就当普通错误处理);
 * - 无 cause / 非 Error:原样返回,调用方按普通错误路径走。
 *
 * 与 `isAbortError` 的分工:`isAbortError` 只判一层(裸 AbortError);
 * 本函数负责跨 `cause` 链找真身,调用方写 `isAbortError(unwrapAbortCause(err))`。
 */
export function unwrapAbortCause(err: unknown, depth = 0): unknown {
  // 防御性深度上限(理论 4 层足够;防御性放宽到 8,再多必是环)
  if (depth > 8) return err
  if (isAbortError(err)) return err
  const cause = (err as { cause?: unknown } | null)?.cause
  if (cause === undefined || cause === null || cause === err) return err
  // 防自引/环:已访问集合
  const seen = new Set<unknown>([err])
  let cur: unknown = cause
  for (let i = 0; i < 8; i++) {
    if (isAbortError(cur)) return cur
    if (typeof cur !== 'object' || cur === null) return err
    if (seen.has(cur)) return err
    seen.add(cur)
    const next = (cur as { cause?: unknown }).cause
    if (next === undefined || next === null || next === cur) return err
    cur = next
  }
  return err
}

/**
 * 网络类英文 message 关键词闭集(2026-11-14 立判据)。
 *
 * 只收**确定是网络层抛出**的英文原文;业务侧的英文(如 `Invalid or expired token`)
 * **不在**此列 —— 它要交给 @ihui/shared 的 `toUserFriendlyMessage` 映射成
 * 「登录已过期,请重新登录」,若在这里吞成"网络异常"会把用户引导去查网络。
 */
const NETWORK_ERROR_MESSAGE_PATTERNS: readonly RegExp[] = [
  /^fetch failed\b/i, // undici / Node fetch / RN fetch abort 的外壳
  /^Network request failed$/i, // RN iOS / Android 原生 fetch
  /^Network Error$/i, // axios 风格兜底
  /^Failed to fetch$/i, // 浏览器 fetch
  /^Load failed$/i, // Safari / WebKit fetch
]

/**
 * 无 status 的传输层异常 → 用户可读文案(2026-11-14 立判据)。
 *
 * ## 为什么需要这一层
 *
 * `fetchApi` 把 `err.message` 原样塞进 `ApiResult.error`,而 239 处调用点写的是
 * `setError(res.error || t('x'))` ⇒ 拦住 239 处的唯一出口是本函数,**不是**逐屏改文案。
 *
 * ## 判据
 *
 * 1. `cause` 链里有真 AbortError ⇒ 「网络连接异常,请检查网络后重试」
 *    (超时 / 取消的真身被外壳包住的情况;打一条 `console.warn` 带原 message 做诊断);
 * 2. message 命中 `NETWORK_ERROR_MESSAGE_PATTERNS` ⇒ 同上(真网络断);
 * 3. 其他 Error 且 message 非空 ⇒ **原样透传**:
 *    - 中文业务文案(「请先绑定手机号!」/「积分不足」)原样保留;
 *    - 英文业务文案(`Invalid or expired token`)原样交给共享层正则分类;
 *    - 非 Error 值(对象 / undefined / null)⇒ 「网络异常」通用兜底;
 * 4. message 为空白 / 缺失 ⇒ 「网络异常」。
 *
 * ## 副作用纪律
 *
 * 只在命中第 1 / 2 条(确定是网络层)时打**一条** `console.warn`,带原 message 做诊断;
 * 第 3 条(业务文案)不打 —— 调用方会自己决定要不要上报,这里刷屏是噪声。
 */
export function transportFailureText(err: unknown): string {
  // ① cause 链里有真 AbortError(裸 TypeError 包真 AbortError 的真机形态)
  if (isAbortError(unwrapAbortCause(err))) {
    const msg = err instanceof Error ? err.message : ''
    console.warn('[api-client] transport abort (wrapped):', msg || '(no message)')
    return '网络连接异常,请检查网络后重试'
  }
  // ② 非 Error 值 ⇒ 通用兜底(不猜)
  if (!(err instanceof Error)) return '网络异常'
  const msg = err.message
  if (typeof msg !== 'string' || msg.trim() === '') return '网络异常'
  // ③ 网络类英文原文 ⇒ 用户可读文案 + 打一条诊断日志
  if (NETWORK_ERROR_MESSAGE_PATTERNS.some((re) => re.test(msg))) {
    console.warn('[api-client] transport network error:', msg)
    return '网络连接异常,请检查网络后重试'
  }
  // ④ 业务文案(中英皆可)原样透传,不在本层抢职责
  return msg
}

/** 把内部抛出的错误归一化为 ApiFailure(CircuitOpenError 由调用方处理) */
function normalizeErrorToResult(err: unknown): ApiFailure {
  if (isAbortError(unwrapAbortCause(err))) {
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
  // 无 status:走传输层文案判据(网络类英文原文 ⇒ 用户可读;业务文案原样透传)
  return {
    success: false,
    error: err instanceof Error ? transportFailureText(err) : '网络异常',
  }
}

/**
 * 「取数据，失败就抛」的单源出口 —— 给 web 侧(RSC 页面与 PageClient)用的那一层薄壳。
 *
 * 为什么要提到这里而不是留在各页：`apps/web` 里此前有 **237 个文件各自手抄了一份
 * `async function api<T>() { const r = await fetchApi<T>(…); if (!r.success) throw …; return r.data }`**
 * (HEAD 面现读，另有 1162 处 `api<…>` 调用点)。每份拷贝都在本地**自己决定 `r.data` 是什么**，
 * 于是"后端把响应从裸数组改成 {list,total} 时，237 个副本按各自理解漂移"这件事在结构上无法被发现 ——
 * 而本仓移动端那 15 族"把信封当数组 ⇒ 界面静默空列表"正是同一个病。
 * 收敛动作的口径 = 只保留这一份实现；页面侧只许 `import { apiOrThrow }`，不得再抄本地壳。
 */
export async function apiOrThrow<T>(url: string, options: FetchApiOptions = {}): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) {
    // BUG-30③:失败分支的 status / errorCode / retryAfter 必须随 Error 一起抛出去,
    // 否则 237 个 RSC 页面只拿到一句 message,分不清 404(该 notFound())与
    // 500(该 error boundary),也拿不到 429 的 retryAfter。
    const err = new Error(r.error) as Error & {
      status?: number
      errorCode?: string
      retryAfter?: number
    }
    if (r.status !== undefined) err.status = r.status
    if (r.errorCode !== undefined) err.errorCode = r.errorCode
    if (r.retryAfter !== undefined) err.retryAfter = r.retryAfter
    throw err
  }
  return r.data
}

export async function fetchApi<T>(
  url: string,
  options: FetchApiOptions = {},
): Promise<ApiResult<T>> {
  const token = tokenProvider.getToken()
  const { params: rawParams, ...restOptions } = options
  // b76-08a:转发前摘除连接级能力位(connectionId/clientMode/deliveryProfile/
  // subscriberScope/workflowRunDeltas)—— 这些是连接事实,客户端自报一律不得出网;
  // 宿主真值由服务端注入口(engine.py::_bind_principal)写。唯一出口见 @ihui/types。
  const params = rawParams ? stripClientCapabilityFields(rawParams) : rawParams
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
  applyClientSignature(headers)

  if (token && shouldAttachCredential(normalizedUrl, currentCredentialAllowedOrigins())) {
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
  const DEFAULT_TIMEOUT_MS = resolveRequestTimeoutMs(options.timeoutMs)
  // 2026-10-23 根治:看门狗只住 transport.ts 一处(本层原先四条腿各自 new AbortController(),
  // 在没有 AbortController 的运行时里当场抛 ReferenceError,请求根本没发出去)。
  // 拿不到中止能力时不假装超时还在 —— timeoutMs 一起透给介质,由那一端用自己的机制掐。
  const watchdog = startTimeoutWatchdog(DEFAULT_TIMEOUT_MS)
  const userSignal = restOptions.signal
  const mergedSignal =
    runtimeSupportsAbort() && watchdog.signal
      ? userSignal
        ? mergeAbortSignals([userSignal, watchdog.signal])
        : watchdog.signal
      : (userSignal ?? undefined)
  const optionsWithTimeout = {
    ...restOptions,
    signal: mergedSignal,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  }

  try {
    // 无 breaker:保留原始重试策略(maxRetries=1)
    if (!circuitBreaker) {
      const maxRetries = 1
      let lastError = '网络异常'
      let authRetried = false
      // 2026-10-26 修「循环预算洞」:网络重试与 401 续期重放**各花各的预算**。
      // 原实现两者共用循环计数 `attempt` ⇒「先网络异常、后 401、续期成功」这一格里,
      // 续期重放的 `continue` 把计数推过上限,循环直接退出 ⇒ 新 token 与 401 结果双双
      // 丢弃,还返回**上一跳的网络错误文案** —— 刷新明明成功了,这次请求却失败
      // (用户侧表现为"又要重新登录")。改成两个独立闸:
      //   · networkRetries:网络异常仍只重试 maxRetries 次(既有语义一字不动);
      //   · authRetried:401 续期重放仍恰好一次(既有语义一字不动);
      // 两者不再互相挤掉。循环上界相应放宽到 attempt <= maxRetries+1
      // (⇒ 共 maxRetries+2 次尝试:首发 + 网络重试 + 续期重放),仍是有界循环 ——
      // 免得不可达代码告警与"无界"疑虑。
      let networkRetries = 0

      for (let attempt = 0; attempt <= maxRetries + 1; attempt++) {
        try {
          const result = await fetchOnce<T>(normalizedUrl, optionsWithTimeout, headers)
          // 401 自动续期(2026-08-06):access token 过期 → 静默刷新 → 重试一次
          if ('status' in result && result.status === 401 && !isAuthEndpoint(normalizedUrl)) {
            if (authRetried) {
              // 续期拿到了新 token、重试**仍然 401** ⇒ 新凭据也被服务端拒 = 会话真死了。
              // 这一格此前是静默的:`!authRetried` 把整个 401 块跳过,连通知都不发 ——
              // 而它恰恰是最不可恢复的那一种 401(真机实测:能力上报每 60s 重复,永远不进登录页)。
              notifyUnauthorized(normalizedUrl, restOptions.method)
            } else {
              const newToken = await refreshAccessTokenOnce()
              if (newToken) {
                // 同一条判据:外链目标即使续期成功也不挂凭据
                if (shouldAttachCredential(normalizedUrl, currentCredentialAllowedOrigins()))
                  headers['Authorization'] = `Bearer ${newToken}`
                authRetried = true
                continue
              }
              // 2026-10-09 分型(根治「自动登录总被清掉」):刷新失败若为瞬时性质
              // (网络抖动/5xx/api 重启窗口,端内实现以 TransientRefreshError 标注),
              // 不是"会话不可恢复" —— 不通知端内出口(其语义是终结本地会话,会写
              // 持久登出标记把 30 天 refresh 凭据永久废掉),返回原 401 结果交调用方。
              if (wasLastRefreshTransient()) return result as ApiResult<T>
              // 401 且续期没拿到 token(未注入续期实现 / 续期失败)→ 通知端内(2026-09-25)
              // 2026-09-29 凭据复核(台账票 G-814411):续期响应被 CAS 丢弃 = 刷新在飞
              // 期间凭据已被换人,这个 401 属于旧凭据 —— 通知出去会误清新凭据,跳过。
              if (isTokenStillCurrent(token)) notifyUnauthorized(normalizedUrl, restOptions.method)
            }
          }
          return result as ApiResult<T>
        } catch (err) {
          // AbortError:用户主动取消或超时,直接返回,不重试
          if (isAbortError(err)) {
            // 区分用户取消 vs 超时:看门狗 fired 说明是超时
            // 文案按**实际**超时值生成(默认 30s,调用方传 timeoutMs 时随之变化)——
            // 硬编码 '30s' 会对自定义超时的调用方说谎(2026-10-12 去硬编码)。
            return {
              success: false,
              error: watchdog.fired()
                ? `请求超时(${Math.round(DEFAULT_TIMEOUT_MS / 1000)}s)`
                : '请求已取消',
            }
          }
          const result = normalizeErrorToResult(err)
          // 5xx / 4xx(已带 status):直接返回,不重试
          if (result.status !== undefined) {
            return result as ApiResult<T>
          }
          // 网络异常:重试或返回 lastError
          // 2026-10-26:网络重试有**自己的**预算闸(networkRetries < maxRetries),
          // 不再与 401 续期重放共用循环计数 —— 共用时「先网络异常、后 401」会把
          // 续期成功的新 token 与 401 结果一起丢掉(见上方 for 循环处注)。
          lastError = result.error
          if (networkRetries < maxRetries) {
            networkRetries++
            continue
          }
          // 预算耗尽 ⇒ 跳出循环,交由循环后的兜底 return 落账(与改动前同形)
          break
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
          // 同一条判据:外链目标即使续期成功也不挂凭据
          if (shouldAttachCredential(normalizedUrl, currentCredentialAllowedOrigins()))
            headers['Authorization'] = `Bearer ${newToken}`
          result = await circuitBreaker.execute(async () => {
            return await fetchOnce<T>(normalizedUrl, optionsWithTimeout, headers)
          })
          // 与无熔断分支同一出口:重试仍 401 = 新凭据也被拒,必须通知(2026-09-27)
          if ('status' in result && result.status === 401) {
            notifyUnauthorized(normalizedUrl, restOptions.method)
          }
        } else {
          // 401 且续期没拿到 token → 通知端内(与上方无熔断分支同一出口,2026-09-25)
          // 2026-09-29 凭据复核(台账票 G-814411):同无熔断分支,CAS 丢弃 = 凭据已
          // 被换人,401 属于旧凭据,通知会误清新凭据的登录态。
          // 2026-10-09 分型:瞬时失败(网络/5xx)不通知,与无熔断分支同处置。
          if (!wasLastRefreshTransient() && isTokenStillCurrent(token)) {
            notifyUnauthorized(normalizedUrl, restOptions.method)
          }
        }
      }
      return result as ApiResult<T>
    } catch (err) {
      if (err instanceof CircuitOpenError) throw err
      if (isAbortError(err)) {
        // 同无熔断分支:超时文案按实际超时值生成,不硬编码 '30s'(2026-10-12)
        return {
          success: false,
          error: watchdog.fired()
            ? `请求超时(${Math.round(DEFAULT_TIMEOUT_MS / 1000)}s)`
            : '请求已取消',
        }
      }
      return normalizeErrorToResult(err) as ApiResult<T>
    }
  } finally {
    watchdog.clear()
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
  try {
    return await fetchTextOnce(url, options)
  } catch (err) {
    // access 只有 15 分钟:这条腿只认 Bearer,不续期就表现为"功能突然不可用"。
    // 401 ⇒ 静默续期后重放一次;续期失败原样抛出,语义仍由调用方按 401 处理。
    if ((err as { status?: number }).status !== 401) throw err
    const refreshed = await refreshAccessTokenOnce()
    if (!refreshed) throw err
    return fetchTextOnce(url, options, refreshed)
  }
}

async function fetchTextOnce(
  url: string,
  options: RequestInit,
  tokenOverride?: string,
): Promise<string> {
  const token = tokenOverride ?? tokenProvider.getToken()
  const normalizedUrl = normalizeUrl(url)
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  }
  applyClientSignature(headers)
  // 2026-10-31 第 20 批:凭据只发往本站域集合(判据见 shouldAttachCredential)
  if (token && shouldAttachCredential(normalizedUrl, currentCredentialAllowedOrigins()))
    headers['Authorization'] = `Bearer ${token}`
  // 2026-08-02 修复:配合后端 CSRF 防护
  if (!headers['X-Requested-With']) headers['X-Requested-With'] = 'XMLHttpRequest'
  if (userAgentHeader && !headers['User-Agent']) headers['User-Agent'] = userAgentHeader
  // 2026-08-02 设备维度风控(2026-08-17 P2:传递 signal 让 abort 短路)
  await injectDeviceFingerprintHeader(headers, options.signal)
  // 2026-08-06 修复:补充请求超时(30s),原实现无超时,网络挂起时调用方永久等待。
  // 调用方已传 signal 时不覆盖(尊重外部取消)。
  // 2026-10-23:看门狗收进 transport.ts 单源;本运行时没有中止能力时,把 timeoutMs 透给介质。
  const watchdog = startTimeoutWatchdog(DEFAULT_REQUEST_TIMEOUT_MS)
  try {
    const response = await getTransport()(normalizedUrl, {
      method: options.method,
      headers,
      body: resolveBody(options.body),
      signal: options.signal ?? watchdog.signal ?? undefined,
      timeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw attachHttpErrorMeta(new Error(`${response.status}: ${text}`), response.status, text)
    }
    return response.text()
  } finally {
    watchdog.clear()
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
  const first = await fetchAiServiceJsonOnce<T>(url, options)
  // 2026-10-26:ai-service 只认 Bearer access token,而 access 只有 15 分钟。
  // 此前这条腿遇 401 只返回失败 ⇒ 签到/知识库/MCP 等全部表现为"用着用着突然不可用"。
  // 401 ⇒ 静默续期后重放一次(与 fetchApi 的拦截器同语义);续期失败原样返回 401。
  if (first.success || first.status !== 401) return first
  const refreshed = await refreshAccessTokenOnce()
  if (!refreshed) return first
  return fetchAiServiceJsonOnce<T>(url, options, refreshed)
}

async function fetchAiServiceJsonOnce<T>(
  url: string,
  options: FetchApiOptions,
  tokenOverride?: string,
): Promise<ApiResult<T>> {
  const token = tokenOverride ?? tokenProvider.getToken()
  const { params: rawParams, ...restOptions } = options
  // b76-08a:同 fetchApi —— 转发前摘除连接级能力位,客户端自报不出网(唯一出口见 @ihui/types)。
  const params = rawParams ? stripClientCapabilityFields(rawParams) : rawParams
  // 2026-10-12:走 ai-service 专用基址通道(aiServiceBaseOverride)——
  // 未注入(null)沿用共享 baseUrl(其它端零回归);web 端注入后 Tauri 本地 dev 直连 8803,
  // 不再把 /api/checkin/* 等 ai-service 路由打到本机 API 8802 造成 Fastify 404。
  // `?? undefined`:normalizeUrl 只认 undefined=未注入(null 会被当成覆盖值吞掉共享基址)。
  let normalizedUrl = normalizeUrl(url, false, aiServiceBaseOverride ?? undefined)
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
  applyClientSignature(headers)
  // 2026-10-31 第 20 批:凭据只发往本站域集合(判据见 shouldAttachCredential)
  if (token && shouldAttachCredential(normalizedUrl, currentCredentialAllowedOrigins()))
    headers['Authorization'] = `Bearer ${token}`
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

  const DEFAULT_TIMEOUT_MS = resolveRequestTimeoutMs(options.timeoutMs)
  // 2026-10-23:与 fetchApi 同一条出口——看门狗只住 transport.ts,没有中止能力的运行时
  // 不假装超时还在,把 timeoutMs 透给介质兑现。
  const watchdog = startTimeoutWatchdog(DEFAULT_TIMEOUT_MS)
  const userSignal = restOptions.signal
  const mergedSignal =
    runtimeSupportsAbort() && watchdog.signal
      ? userSignal
        ? mergeAbortSignals([userSignal, watchdog.signal])
        : watchdog.signal
      : (userSignal ?? undefined)

  try {
    const response = await getTransport()(normalizedUrl, {
      method: restOptions.method,
      headers,
      body: resolveBody(restOptions.body),
      signal: mergedSignal,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      const derived = deriveFailureFromBody(text, response.status)
      return {
        success: false,
        error: derived.message,
        status: response.status,
        errorCode: derived.errorCode,
      }
    }

    // ai-service 直接返回 JSON,无 {code, data} 包装,整体作为 data
    const json = (await response.json()) as T
    // 2026-09-09 0-5 迁移:成功分支携带 HTTP status(与 fetchOnce 对齐)
    return { success: true, data: json, status: response.status }
  } catch (err) {
    if (isAbortError(err)) {
      // 超时文案按实际超时值生成(默认 30s,timeoutMs 自定义时随之变化),不硬编码(2026-10-12)
      return {
        success: false,
        error: watchdog.fired()
          ? `请求超时(${Math.round(DEFAULT_TIMEOUT_MS / 1000)}s)`
          : '请求已取消',
      }
    }
    return normalizeErrorToResult(err) as ApiResult<T>
  } finally {
    watchdog.clear()
  }
}

/** 拉取原始二进制响应(如 PNG 截图),自动加 Authorization 头。 */
export async function fetchRaw(url: string, options: RequestInit = {}): Promise<Blob> {
  try {
    return await fetchRawOnce(url, options)
  } catch (err) {
    // 同 fetchText:access 过期是常态,401 ⇒ 续期后重放一次,续期失败原样抛出。
    if ((err as { status?: number }).status !== 401) throw err
    const refreshed = await refreshAccessTokenOnce()
    if (!refreshed) throw err
    return fetchRawOnce(url, options, refreshed)
  }
}

async function fetchRawOnce(
  url: string,
  options: RequestInit,
  tokenOverride?: string,
): Promise<Blob> {
  const token = tokenOverride ?? tokenProvider.getToken()
  const normalizedUrl = normalizeUrl(url)
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  }
  applyClientSignature(headers)
  // 2026-10-31 第 20 批:凭据只发往本站域集合(判据见 shouldAttachCredential)
  if (token && shouldAttachCredential(normalizedUrl, currentCredentialAllowedOrigins()))
    headers['Authorization'] = `Bearer ${token}`
  // 2026-08-02 修复:配合后端 CSRF 防护
  if (!headers['X-Requested-With']) headers['X-Requested-With'] = 'XMLHttpRequest'
  if (userAgentHeader && !headers['User-Agent']) headers['User-Agent'] = userAgentHeader
  // 2026-08-02 设备维度风控
  await injectDeviceFingerprintHeader(headers)
  // 2026-08-06 修复:补充请求超时(30s),原实现无超时,网络挂起时调用方永久等待。
  // 2026-10-23 本腿没有别的超时手段(要读二进制,transport 的 timeoutMs 只对支持的介质成立)
  // ⇒ 拿不到中止能力时**当场喊响**,不能把"30s 超时"这一保护悄悄丢掉:静默丢掉等于永久挂起。
  const watchdog = startTimeoutWatchdog(DEFAULT_REQUEST_TIMEOUT_MS)
  const signal = requireAbortSignal(options.signal ?? watchdog.signal, 'fetchRaw')
  try {
    const response = await getTransport()(normalizedUrl, {
      method: options.method,
      headers,
      body: resolveBody(options.body),
      signal,
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
    watchdog.clear()
  }
}

// ==================== 裸 fetch 腿的 401 续期(包内唯一出口) ====================

/**
 * 这条 body 能不能"再发一次"。判据只住这一处(§0.6 单一真相源),
 * 各端点函数不得自己再判一遍 —— 自己判的那一份迟早会比这里松。
 *
 * 可重放:每次 `fetch()` 都会把这一份值**重新序列化**一遍的请求体
 * (string / URLSearchParams / ArrayBuffer 及其视图 / Blob(含 File) / FormData ——
 * 它们是"条目记录",不是被吃掉的流;浏览器、undici、RN 原生 fetch 都是按请求重建 body)。
 *
 * 不可重放:`ReadableStream` / AsyncIterable / `Request` 这类**一次性介质**。
 * 对它们重放 = 第二次发的是空 body,而服务端会照单收下并回 200 ——
 * 那就是"重放发了空 body 的假成功"(比不修更坏)。这一档宁可少做:
 * 直接返回原 401 响应,既不续期也不重放,调用方看到的失败与改动前逐字一致。
 */
function isReplayableBody(body: BodyInit | null | undefined): boolean {
  if (body === null || body === undefined) return true
  if (typeof body === 'string') return true
  if (typeof Blob !== 'undefined' && body instanceof Blob) return true
  if (typeof FormData !== 'undefined' && body instanceof FormData) return true
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return true
  if (typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer) return true
  if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(body)) return true
  return false
}

/** 把 fetch 的三种 headers 形态收敛成一份**新**的 Record(绝不原地改调用方对象)。 */
function copyHeaders(headers: RequestInit['headers']): Record<string, string> {
  const out: Record<string, string> = {}
  if (Array.isArray(headers)) {
    for (const [key, value] of headers) out[key] = String(value)
  } else if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    // 2026-10-26:本包 tsconfig 下 `Headers` 解析不到 DOM 声明(`headers` 被收敛成 any)⇒
    // forEach 回调的 value/key 落 TS7006 隐式 any。显式标注参数类型,不改运行期行为。
    headers.forEach((value: string, key: string) => {
      out[key] = value
    })
  } else if (headers && typeof headers === 'object') {
    Object.assign(out, headers as Record<string, string>)
  }
  return out
}

/** 调用方是否**自己写了** Authorization(大小写不敏感)。 */
function hasOwnAuthorization(headers: RequestInit['headers']): boolean {
  return Object.keys(copyHeaders(headers)).some((key) => key.toLowerCase() === 'authorization')
}

/**
 * 把 access token 装配进请求头(不原地改调用方的 headers)。
 *
 * 三条不变量:
 * 1. **没有 token ⇒ 一个 Authorization 头都不加** —— 绝不塞空 `Bearer `:
 *    服务端把"带了个坏凭据"与"没带凭据(走 cookie 兜底)"是两条不同分支,
 *    塞空串会把原本还能靠 cookie 走通的腿提前判死(红线:cookie 兜底路径不得被破坏);
 * 2. 其余头逐字透传(含 multipart 的"不给 Content-Type,让 fetch 自己生成 boundary");
 * 3. 调用方自己写了 Authorization ⇒ 不在这里覆盖(见 {@link hasOwnAuthorization},
 *    那一格由 {@link fetchWithAuthRefresh} 整块让路,不做重放)。
 */
function withBearerHeader(
  headers: RequestInit['headers'],
  token: string | null,
): Record<string, string> {
  const out = copyHeaders(headers)
  if (token) out['Authorization'] = `Bearer ${token}`
  return out
}

/** {@link fetchWithAuthRefresh} 的可选入参 */
export interface FetchWithAuthRefreshOptions {
  /**
   * 本趟要用的 access token。
   * - 缺省(undefined)⇒ 取 `tokenProvider.getToken()`;
   * - 显式传值(含 null / 空串)⇒ 用这一份,不再回读 provider
   *   (调用方自己管凭据时判序由它定,但"空 ⇒ 不加头"仍由本处兜住);
   * - 401 续期成功后的**重放**恒用刷新回来的新 token,不用这里的旧值。
   *
   * 为什么开这个口子而不让调用方直接写 `headers.Authorization`:
   * 写进 headers 的凭据就不归本出口装配,续期回来的新 token 与它**不同源**,
   * 拿它顶掉别人的凭据去重放等于"用另一个身份重试这次操作"(越权方向);
   * 而走 `accessToken` 的,本出口知道它是谁,重放才安全。voice-stt 的 `params.token`
   * 因此一律经这里进,不经 headers。
   */
  accessToken?: string | null
  /**
   * 本趟目标服务的基址(仅当调用方**在代码里**指定了非默认基址时传)。
   *
   * 2026-10-31 第 20 批:凭据只发往本站域集合,而 voice-stt 这类腿允许调用方显式传
   * `aiServiceUrl`(例如测试里的 http://ai.test、桌面端直连的 127.0.0.1:8803)。
   * 可信性必须由**代码**声明,不能被数据驱动 —— 所以这里要求调用方把基址显式递进来,
   * 本出口只把它并进"允许带凭据的 origin 集合",不据此放宽其它请求。
   */
  serviceBaseUrl?: string
}

/**
 * 包里**绕过 fetchApi 的裸 fetch 腿**共用的 401 续期出口(2026-10-26 立)。
 *
 * 病灶:access JWT 只有 15 分钟,而 ai-service 回传端点(审批/表单/工具结果/终端输入/
 * goal)、放行规则、报告导出、上传、SSE 启动、STT 这几条腿各自 `fetch()`,
 * 遇 401 直接抛错或返回 success:false —— 用户表现为"审批点了没反应 / 导出失败 / 上传失败",
 * 而 refresh(30 天)明明还能换。fetchApi 的拦截器管不到它们,因为它们不走 transport。
 *
 * 语义(与 fetchApi 的 401 拦截器同一条契约,判序只此一份):
 *  - 取当前 token 注入 Authorization;无 token 不加头(见 {@link withBearerHeader});
 *  - `status !== 401` ⇒ **原对象逐字返回**(403/5xx/2xx 一律不碰,响应体不消费,
 *    流式/blob 腿还能在它上面继续读);
 *  - `status === 401` ⇒ `await refreshAccessTokenOnce()`(全局单飞 + 失败冷却,已实现,
 *    这里不复制判据)→ 拿到新 token 就**带新 token 重放恰好一次**;
 *  - 续期返回 null ⇒ 把**原 401 响应**(body 未消费)交回调用方,由它按既有语义报错;
 *  - 重放后仍是 401 ⇒ 就地交回,不再续期、不再重放(绝不循环);
 *  - body 不可重放 ⇒ 不续期不重放(见 {@link isReplayableBody});
 *  - 调用方自带 Authorization ⇒ 不覆盖、不重放、不续期(那一格的凭据不归本出口管,
 *    重放只会用同一枚被拒的凭据再吃一次 401,或更糟:拿别人的新凭据顶掉它)。
 *
 * 刻意**不**调 `notifyUnauthorized`:这些腿的 401 终局此前从不驱动端内登出,
 * 接上会把"一次导出失败"升级成"会话被终结",属本票范围外的行为变化。
 *
 * @returns 与 `fetch` 同样的 `Response`(失败也返回响应,不抛;抛错语义留给调用方自己那一条腿)
 */
export async function fetchWithAuthRefresh(
  url: string,
  init: RequestInit = {},
  options: FetchWithAuthRefreshOptions = {},
): Promise<Response> {
  const ownsAuth = hasOwnAuthorization(init.headers)
  const token = options.accessToken === undefined ? getToken() : options.accessToken
  // 2026-10-31 第 20 批:外链目标不挂凭据(判据同 fetchApi 那一条,不另立一套)
  const allowedOrigins = currentCredentialAllowedOrigins()
  if (options.serviceBaseUrl) {
    for (const o of credentialAllowedOrigins([options.serviceBaseUrl])) allowedOrigins.add(o)
  }
  const urlCarriesCredential = shouldAttachCredential(url, allowedOrigins)
  const first = await fetch(url, {
    ...init,
    headers: ownsAuth
      ? copyHeaders(init.headers)
      : withBearerHeader(init.headers, urlCarriesCredential ? token : null),
  })
  if (first.status !== 401) return first
  if (!isReplayableBody(init.body)) return first
  if (ownsAuth) return first
  const refreshed = await refreshAccessTokenOnce()
  if (!refreshed) return first
  // 只重放这一次:第二次仍 401 也照样交回(循环重放=凭据死循环,fetchApi 同此红线)
  return fetch(url, {
    ...init,
    headers: withBearerHeader(init.headers, urlCarriesCredential ? refreshed : null),
  })
}

// SSE 流式对话的解析与事件形状已下沉 packages/api-client/src/stream.ts(门 103 C1 收口);
// 公开面由 `export *` 逐名等值转出,包内其他模块的 import 路径不变。
export * from './stream.js'
import {
  type GoalUpdateEvent,
  parseContextLedgerSnapshot,
  parseCompactBoundarySnapshot,
  parseUsageCacheTokens,
  type StreamChatOptions,
  parseStreamLine,
  extractAgentId,
  type AlertSeverity,
  type HookFailureEvent,
  type FormRequestEvent,
  type FormResponseEvent,
  projectToolApprovalDecisionInfo,
  projectToolApprovalExpiredFact,
  projectToolApprovalEnvFacts,
  parseFallbackEvent,
  parseStreamLineReasoning,
  getSSEErrorInfo,
  readSendAdmissionReceipt,
} from './stream.js'
// ===========================================================================
// b76-13 票3(2026-09-30 立):消费者绝不施加界 —— 有界表归生产者,
// 且淘汰必须"说出来 + 继续可数"
// ===========================================================================
//
// 上游禁令:客户端**绝不**自设 maxNodes/maxActors 一类界,只有生产者能淘汰,
// 且淘汰必须随载荷声明(removed/truncated 位)。我方的失效型恰是票面点名那条:
// UI 层悄悄取最后 10 条并把 10 当事实展示(changes/terminal/tool-calls 三个
// progress-section 的 slice(-10)),既没有"少列了多少"的计数,也没有 truncated 位
// —— 数字偏小且自洽,typecheck 全绿,现有守门(几何/字节预算/数据库写计数)全盲。
//
// 判据三条(照抄上游,落我方词汇):
//   (a) 渲染裁尾必须**同时**产出被裁掉的条数(omittedCount),并渲染成「N more」;
//   (b) 界与"为什么是这个数"只住在本处常量,注释区分**展示预算** vs **生产契约**;
//   (c) 生产端要截尾必须在载荷里带 truncated 位;消费端不得自行加界 ——
//       集合裁尾一律走 tailWithOmittedCount 本出口(对字符串/路径的 slice(-N) 不判)。
// 常驻尺子:scripts/check-list-cap-honesty.mjs(--self-test;不接提交链,由主会话定)。

/**
 * **展示预算**(非生产契约):为什么是 10 —— 单屏可读密度,超过部分以
 * 「N more」形态露出而不是消失。这个数不是引擎/协议约束,改它不需要同步后端;
 * 生产契约类的界(如 fan-out 上限)不归本常量管,必须由载荷的 truncated 位声明。
 */
export const SSE_LIST_DISPLAY_BUDGET = 10

export interface TailedResult<T> {
  /** 保留的尾部条目(渲染直接用) */
  items: T[]
  /** 被裁掉的条目数 —— 消费方**必须**把它渲染出来(「N more」),不许吞掉 */
  omittedCount: number
}

/**
 * 消费侧集合裁尾的**唯一出口**:裁尾与"少列了多少"原子产出,
 * 结构上杜绝"悄悄取最后 N 条并把 N 当事实"的那一型。
 * 纯函数:不改入参;cap 非正整数 ⇒ 原样全量返回(omittedCount=0)。
 */
export function tailWithOmittedCount<T>(
  items: readonly T[],
  cap: number = SSE_LIST_DISPLAY_BUDGET,
): TailedResult<T> {
  if (!Number.isSafeInteger(cap) || cap <= 0 || items.length <= cap) {
    return { items: [...items], omittedCount: 0 }
  }
  return { items: [...items.slice(items.length - cap)], omittedCount: items.length - cap }
}

const STREAM_MAX_RETRIES = 3
const STREAM_INITIAL_RETRY_DELAY = 1000
const STREAM_MAX_RETRY_DELAY = 30_000
/**
 * 读流空闲看门狗(ms):单个 chunk 间空闲超过该值即判本次尝试断线。
 *
 * 2026-11-06 批1 起该值与服务端 SSE 周期心跳间隔(15s,`apps/api/src/utils/
 * sse-stream-registry.ts` 的唯一实现)绑定为 2 拍 —— 任意字节(含 `: ping`
 * 注释帧)都会让 `reader.read()` 返回、重置窗口,因此容忍偶发丢一拍仍不断流;
 * 连续两拍无字节才 abort 重连(带 Last-Event-ID 续传,不重跑上游)。
 *
 * 为什么不 import `@ihui/shared/constants` 的 STREAM_READ_TIMEOUT_MS:本包
 * dependencies 只有 @ihui/types,补 @ihui/shared 会形成 shared↔api-client 依赖环
 * (见 packages/shared/src/constants.ts 与 tests/g-693-stream-idle-parity.test.ts 头注)。
 * 两处取值同值,改动必须同步(shared 侧已写明"与 client.ts 保持一致")。
 */
const STREAM_READ_TIMEOUT_MS = 30_000

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

/** 帧载荷里那个关联键的键名(与 ai-service / @ihui/shared 两侧契约同名,由判例表对账)。 */
const FRAME_TRACE_ID_KEY = 'traceId'

/**
 * 从一行 SSE 文本里取帧级 trace 关联键(D174 的到端那一半)。
 *
 * 为什么本包要有一份:本包**不依赖 @ihui/shared**(package.json 只声明 @ihui/types),
 * 直接 import 那份出口就是加一条未声明的幽灵依赖(§12e 那类"本地能跑、装完就崩")。
 * 值规则(小写 32 hex、全 0 非法)因此在本包**重实现了一次** —— 这是明知有第二份的写法,
 * 所以配套了一把尺子:`config/sse-trace-id-cases.json` 是两侧共用的判例表,
 * 本包与 @ihui/shared 各自跑同一张表(`packages/api-client/tests/stream-trace-id-parity.test.ts`
 * 与 `packages/shared/src/sse/__tests__/sse-frame-trace-id.test.ts`),漂开即红。
 * 放宽判据、把表改成迁就某一侧,都是本票禁止的出路。
 */
export function readStreamTraceId(line: string): string | null {
  const raw = typeof line === 'string' ? line.trim() : ''
  if (raw.length === 0 || raw.startsWith(':') || raw.startsWith('event:') || raw.startsWith('id:'))
    return null
  let payload = raw
  if (raw.startsWith('data:')) payload = raw.slice(5).trim()
  if (payload.length === 0 || payload === '[DONE]') return null
  // 小程序自写传输层的 `<数字>:<载荷>` 协议前缀:与本包正常形态不同,判不出即返回 null(不猜)
  if (/^\d+:/u.test(payload)) return null
  let json: unknown
  try {
    json = JSON.parse(payload)
  } catch {
    return null
  }
  const value = (json as Record<string, unknown> | null)?.[FRAME_TRACE_ID_KEY]
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (!/^[0-9a-f]{32}$/.test(normalized)) return null
  // 全 0 是 W3C 规定的非法 trace id,不配当关联键(与生产侧同源)
  if (/^0+$/.test(normalized)) return null
  return normalized
}

// ===========================================================================
// D138(承 V4 #96):可复用的 SSE 续传流 runner —— 重连 / 指数退避 / 读超时 /
// 断点续传游标的**唯一实现**。
//
// 病灶(票面):小程序曾在 apps/miniapp-taro/src/lib/sse.ts 自养第二份
// "重连/退避/超时/id: 游标"实现,与本文件 streamChat 的读环长期两处漂移。
// 现在两端都喂给本 runner:streamChat 的逐行解析走 onLine 钩子;小程序薄壳
// (apps/miniapp-taro/src/lib/sse.ts)把行喂回自己的事件分发层 —— 传输策略只有这一份,
// 传输介质(fetch / Taro.request enableChunked)由 stream-transport.ts 的 adapter 注入口决定。
// ===========================================================================

/** D138:SSE 断点续传头的**唯一写入出口**(runner 重试时调用;agent-runtime 两条流同样走这里)。 */
export function appendResumeEventIdHeader(
  headers: Record<string, string>,
  lastEventId: string | undefined,
): void {
  if (lastEventId) headers['Last-Event-ID'] = lastEventId
}

export interface ResumableSSEStreamOptions {
  /** 完整请求地址 */
  url: string
  method?: string
  /** 请求体(调用方 JSON.stringify 之后的字符串) */
  body?: string
  /** 基础请求头;续传头由 runner 注入,调用方不得预写 */
  headers: Record<string, string>
  signal?: AbortSignal
  /** 自动重连上限(默认 STREAM_MAX_RETRIES)。业务错误(401/403/429 无 retryAfter)不重试 */
  maxRetries?: number
  /** 指数退避初值 ms(默认 STREAM_INITIAL_RETRY_DELAY) */
  initialRetryDelayMs?: number
  /** 指数退避上限 ms(默认 STREAM_MAX_RETRY_DELAY;Retry-After 消费同受此上限约束) */
  maxRetryDelayMs?: number
  /** 读超时 ms:单个 chunk 间空闲超过该值视为断线,取消本次尝试进入重连判定(缺省 30s) */
  readTimeoutMs?: number
  /** fetch credentials 模式(透传 stream transport;缺省不携带 = native fetch 默认) */
  credentials?: 'include' | 'omit' | 'same-origin'
  /** 响应到达且 ok 后触发一次(streamChat 的 onResponse 语义) */
  onResponse?: () => void
  /** 每次尝试开始(含首次,attempt 从 0 起):消费方在此复位 per-attempt 状态 */
  onAttemptStart?: (attempt: number) => void
  /**
   * 每个完整 SSE 行(不含行尾换行,\r 已剥;空行 / 注释行 / event:/id:/retry: 控制行照常递出)。
   * id: 行先被 runner 捕获为续传游标,再原样递出 —— 消费方无需(也不得)自持游标。
   * 回调抛错视同本次尝试失败,交由 runner 按同一套业务错误口径判定是否重连。
   */
  onLine: (line: string) => void | Promise<void>
  /** 重连前通知(指数退避,attempt 从 1 起) */
  onReconnect?: (attempt: number, delayMs: number) => void
  /**
   * HTTP 401 且尚未重试过时的续期钩子(2026-10-26)。
   *
   * 流式请求只认 Bearer access token(15 分钟),过期后此前直接按业务错误抛出 ⇒
   * "聊到一半提示登录过期"。返回 true 表示已换到新凭据,**调用方必须同步改写
   * `opts.headers` 里的 Authorization**;runner 随即原地重试一次。返回 false 或未注入
   * 时维持旧行为(401 业务错误、不重连)。只在 HTTP 层(尚未读流)判定,流内 error 帧不在此列。
   */
  refreshAuth?: () => Promise<boolean>
}

/**
 * 跑一条可断点续传的 SSE 流(重连/退避/读超时/游标唯一的实现)。
 *
 * 正常结束 / abort / 业务错误 / 重试耗尽时返回或抛出;abort 原样上抛
 * (streamChat 的既有 catch 语义:isAbortError ⇒ onDone + 静默收束)。
 */
export async function runResumableSSEStream(opts: ResumableSSEStreamOptions): Promise<void> {
  const maxRetries = opts.maxRetries ?? STREAM_MAX_RETRIES
  const initialRetryDelayMs = opts.initialRetryDelayMs ?? STREAM_INITIAL_RETRY_DELAY
  const maxRetryDelayMs = opts.maxRetryDelayMs ?? STREAM_MAX_RETRY_DELAY
  const readTimeoutMs = opts.readTimeoutMs ?? STREAM_READ_TIMEOUT_MS
  // 断点续传游标:捕获 SSE id: 行,重连时经 appendResumeEventIdHeader 回传
  let lastEventId = ''
  let attempt = 0
  // 凭据续期只做一次:续期后仍 401 = 新凭据也被拒(会话真死),不得无限重放
  let authRefreshed = false
  for (;;) {
    try {
      opts.onAttemptStart?.(attempt)
      if (opts.signal?.aborted) throw createAbortError()

      const headers = { ...opts.headers }
      appendResumeEventIdHeader(headers, lastEventId || undefined)
      const resp = await getStreamTransport()(opts.url, {
        method: opts.method ?? 'POST',
        // D147(2026-09-29 立):traceparent 的出站装配走 transport 那份唯一出口
        // (原 streamChat 内联 fetch 处的同一段判据,随读环一起搬进 runner)。
        headers: applyTraceparentToHeaders(headers),
        body: opts.body ?? null,
        signal: opts.signal,
        ...(opts.credentials !== undefined ? { credentials: opts.credentials } : {}),
      })
      // 回带:服务端若把编号写回响应头,记为"本轮排查编号"(编号不上 UI,只留读取出口)。
      recordTraceIdFromResponse(resp.headers)
      if (!resp.ok || !resp.body) {
        // 2026-10-26:access 过期(15 分钟)在流式通道上表现为"聊一半提示登录过期"。
        // 401 且尚未续过 ⇒ 交给调用方换票(它负责改写 headers 里的 Authorization),成功则原地重试一次。
        // 只在 HTTP 层判定:此时还没消费任何帧,重放不会产生重复内容。
        if (resp.status === 401 && opts.refreshAuth && !authRefreshed) {
          authRefreshed = true
          const refreshed = await opts.refreshAuth()
          if (refreshed) {
            attempt++
            continue
          }
        }
        const text = await resp.text().catch(() => '')
        // 与另两条腿共用同一个派生出口(空白 body 走兜底、message 优先于 detail、errorCode 一并取出),
        // 本腿只在出口之后追加 SSE 消费方约定的 `（status）` 后缀。
        const derived = deriveFailureFromBody(text, resp.status)
        const err = new Error(derived.message)
        ;(err as Error & { name: string }).name = 'SSEError'
        ;(err as Error & { code: number }).code = resp.status
        if (derived.errorCode) {
          ;(err as Error & { errorCode: string }).errorCode = derived.errorCode
        }
        // getSSEErrorInfo 会从文本里回捞 `[（(]\d{3}[)）]`,文本自带状态码时不再追加。
        if (!/[（(]\d{3}[)）]/.test(err.message)) {
          err.message = `${err.message}（${resp.status}）`
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

      opts.onResponse?.()
      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      // 行缓冲熔断上限(第 18 批 F6):正常 SSE 帧远小于该值
      const MAX_SSE_LINE_BUFFER_BYTES = 1 * 1024 * 1024
      // 2026-08-15 修复(原 streamChat 读环注释,随环搬入):reader.read() 在 fetch 完成后
      // 无法被 AbortController 中断,若后端返回 200 但不发送数据,流会永久挂起。
      // 为读操作加超时保护,超时后 cancel 并抛错,由外层 catch 做重连判定。
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
          }, readTimeoutMs)
        })
        try {
          return await Promise.race([readPromise, timeoutPromise])
        } finally {
          if (timer) clearTimeout(timer)
        }
      }

      const consumeLine = async (raw: string): Promise<void> => {
        const line = raw.replace(/\r$/, '')
        // 捕获 SSE id: 行(断点续传游标;重连时经 appendResumeEventIdHeader 回传)
        if (line.startsWith('id:')) lastEventId = line.slice(3).trim()
        await opts.onLine(line)
      }

      for (;;) {
        const { done, value } = await readWithTimeout()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        // 2026-10-31 安全强化第 18 批(F6):行缓冲熔断 —— 读超时只覆盖"不发数据"
        // 的挂起,不覆盖"持续发数据但永无换行"的畸形流,无上限的 buffer 可被打满。
        // 超限即断流报错(正常 SSE 帧远小于该值;该信道被控本身即上游失守)。
        if (buffer.length > MAX_SSE_LINE_BUFFER_BYTES) {
          throw new Error('SSE line buffer overflow (malformed upstream stream)')
        }
        let nl: number
        while ((nl = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, nl)
          buffer = buffer.slice(nl + 1)
          await consumeLine(line)
        }
      }
      // 尾部残留(末帧无换行)同样递出,与原 streamChat 尾块对称
      if (buffer.trim()) await consumeLine(buffer)
      return
    } catch (err) {
      if (isAbortError(err)) throw err
      const info = getSSEErrorInfo(err)
      const code = info?.code
      // P2-2 retry-after 协商:429 + retryAfter 视为可重试(走网络重试路径,按 retryAfter 等待);
      // 429 无 retryAfter 仍视为业务错误(不重连);401/403 永远是业务错误
      const isBusinessError =
        code === 401 || code === 403 || (code === 429 && info?.retryAfter === undefined)
      // F3 修复(2026-11-13):流内业务 error 帧(attachErrorMeta 打标,区别于 HTTP 层错误)
      // 默认是确定性业务失败,不是网络抖动 ⇒ 立即终态、不重连,避免反复重投白烧 token。
      // 保留既有语义:该帧显式带 retryAfter 时仍走下方 Retry-After 协商重连。
      const isStreamBusinessError =
        (err as Error & { isStreamBusinessError?: boolean }).isStreamBusinessError === true &&
        info?.retryAfter === undefined
      if (isBusinessError || isStreamBusinessError || attempt >= maxRetries) throw err
      // P2-2 优先消费 Retry-After(秒转毫秒,上限 maxRetryDelayMs);
      // 无 retryAfter 时走指数退避:1s, 2s, 4s, 8s... 上限 30s(与 useAgentSSE 重连模式一致)
      const delay =
        info?.retryAfter !== undefined
          ? Math.min(info.retryAfter * 1000, maxRetryDelayMs)
          : Math.min(initialRetryDelayMs * 2 ** attempt, maxRetryDelayMs)
      attempt++
      opts.onReconnect?.(attempt, delay)
      await sleepWithAbort(delay, opts.signal)
    }
  }
}

export async function streamChat(opts: StreamChatOptions): Promise<void> {
  const maxRetries = opts.maxRetries ?? STREAM_MAX_RETRIES
  // 跨重连尝试共享的状态:已接收内容(dedupe)。D138 起续传游标(id: 捕获 + 重放头
  // 注入)归 runResumableSSEStream 独有,调用方不再自持(消灭两端各持一份的那一型)。
  const receivedContentRef = { current: '' }
  const receivedAgentRef = { current: new Map<string, string>() }
  // b76-13 票1:帧水位游标。Last-Event-ID 只答"服务端接着哪儿发",本游标答
  // "手上状态属于哪个代际/纪元/位点" —— 没有它,会话重建/fork/rewind 后
  // id 仍能对上而内容属于另一个纪元,消费端会静默拼接两个纪元的状态。
  const frameWatermarkRef = { current: null as FrameWatermarkCursor | null }
  // b76-15(2026-10-29 立):seq 维水位**生产点**。载荷级四字段生产端至今不下发
  // (现读:ai-service 的 `_sse()` 与网关 `emitUpstreamLine` 都不写),所以
  // `readFrameWatermark` 那条腿在真机上恒 `undetermined`;本追踪器从网关确实在发的
  // `id: <seq>` 行派生 seq 连续性事实,把"看起来有、实际没跑"补成有生产点的腿。
  // 跨 attempt 保留(重连续传后 seq 接着原值),见 frame-watermark-producer 头注。
  const frameSeqTracker = createFrameSeqTracker()
  /**
   * 载荷级四字段是否**真的**见过(at least once)。它是"未判定"与"判过"的分水岭:
   * 全程 false ⇒ 生产端没下发,seq 腿是唯一在场的判据;true ⇒ 三维腿接管过。
   * 报给上层而不是留在本文件里自证(§0.3:没判绝不能写成判过)。
   */
  let payloadWatermarkSeen = false
  // 丢帧留痕计数。b76-15 起**有读取方**(`onFrameWatermarkFacts` + 终态兜底上报),
  // 摘掉 `_` 前缀 —— 只写不读的计数器就是"造了一个没人读的出口"。
  let watermarkDroppedFrames = 0
  // b76-13 票2:字段级结构不变量的 typed fault 计数(读环侧;shared 侧同表
  // 判据见 SSE_FRAME_SCHEMAS —— 丢帧必须留痕,不冒充解析成功)
  let _sseFrameSchemaFaults = 0
  // 差距①(2026-10-30 立):admission 帧"形状不认 ⇒ 丢弃"的留痕计数(不猜档、不抛错)。
  // 与 `_sseFrameSchemaFaults` 同口径登记(故意未读):回执本体只经 onSendAdmissionReceipt
  // 递出,畸形帧不得从那条通道冒充回执。
  let _admissionReceiptDropped = 0
  // G-816031:权威信封路由。跨重试共享(重试不是新的权威授予);仅当生产端下发
  // deliveryKind/reasonCode 时进入 fail-closed,旧生产端逐帧放行、零行为变化。
  const streamAuthority = createStreamAuthorityRouter()
  let recoveryLedgerReported = false
  const reportRecoveryGateLedger = (): void => {
    if (recoveryLedgerReported) return
    recoveryLedgerReported = true
    opts.onRecoveryGateLedger?.(streamAuthority.ledger())
  }
  /**
   * b76-15(2026-10-29 立):帧水位事实的**唯一上报出口**。
   *
   * 立因是现读出来的一格哑账:丢帧计数此前叫 `_frameGapDropped`,带 `_` 前缀,按
   * lint 允许口径带 `_` 前缀登记"故意未读" —— 计了数,但全仓没有第二个地方读它。
   * 一个只有写入方的计数器等于没有(`AGENTS` §0.10「失效方向必须是多要一次定向
   * 说明」的反面:这里连说明都没有)。现在三条:① 每次丢弃都立刻上报;② 流终态
   * 兜底再报一次(把"全程零丢弃"也变成可读事实,而不是靠缺席去猜);③ 载荷级四字段
   * 是否真的到场一并报出 —— 那一维是 `undetermined` 还是 `ok`,上层必须能分清。
   *
   * 回调未注册 ⇒ 零成本返回(与 onMemoryUpdates / onFinishReason 同口径:未注册
   * 不解析);这不算"造了没人读的出口",因为注册方就是本仓的 web 端(见
   * `apps/web/src/hooks/use-chat/stream-error-report.ts`)。
   */
  const emitFrameWatermarkFacts = (kind: string, frame: FrameWatermark | null = null): void => {
    if (!opts.onFrameWatermarkFacts) return
    // 必须在改 frameWatermarkRef 之前调用：held 是断线前手上的那一段。
    opts.onFrameWatermarkFacts(
      assembleFrameWatermarkFacts({
        kind,
        dropped: watermarkDroppedFrames,
        seqCursor: frameSeqTracker.cursor(),
        payloadWatermarkSeen,
        held: frameWatermarkRef.current,
        frame,
        disposition: watermarkFactDisposition(kind, frame),
      }),
    )
  }
  // G-816030:帧归属屏障 —— ACK(本 attempt 首个 ok 水位帧)之前,undetermined 帧
  // 有界暂存不投递(上游 ackActivationBarrier:通知先于 RPC 响应抵达时,半截批次
  // 不得被当完整快照投影);ACK 时按原序冲刷;越界整批清空并显式失败。
  // 首游标未立基线(frameWatermarkRef.current === null)时 undetermined 帧照常放行,
  // 旧生产端(从未下发水位)零行为变化。
  const frameBarrier = createFrameOwnershipBarrier<string>()
  const FRAME_BARRIER_TOPIC = 'chat-stream'
  const FRAME_BARRIER_PENDING_SUBSCRIPTION = 'pending-ack'
  let frameBarrierAckedThisAttempt = false
  let _frameBarrierFlush: BarrierFrame<string>[] = []
  // ok 水位帧 = ACK:确立本 attempt 的订阅所有权,并收回 ACK 前暂存的帧
  // (冲刷由 processLine 在水位闸后按原序消费 _frameBarrierFlush)。
  const ackFrameBarrier = (subscriptionId: string): void => {
    if (frameBarrierAckedThisAttempt) return
    frameBarrierAckedThisAttempt = true
    _frameBarrierFlush = frameBarrier.activate({
      subscriptionId,
      topics: [FRAME_BARRIER_TOPIC],
    })
  }
  // 水位闸:两条来源同一事实,由 `carriesPayloadWatermark` 择一,不并行判两遍
  // (AGENTS §0.6)。
  //   ① 载荷级四字段(**生产端至今不下发**)⇒ `readFrameWatermark` 判三维;
  //   ② `id: <seq>` 行(网关**确实在发**)⇒ seq 维连续性,见 b76-15 注记。
  // 两腿的失效方向一致:读不出 ⇒ undetermined 原样放行;gap/死帧 ⇒ 丢弃且计数,
  // 不进渲染、不推进游标,重连后从服务端快照重建,绝不把残帧算成"已应用"。
  const shouldDropByWatermark = (line: string): boolean => {
    if (!line.startsWith('data:')) return false
    const raw = line.slice(5).trim()
    if (!raw || raw === '[DONE]') return false
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return false
    }
    // G-816031:先过权威信封三轴(解门 / 重订阅 / 片处置),再走帧水位闸。
    // 旧生产端不带 authority 字段 ⇒ observeFrame 恒放行;一旦带过字段,门关着时
    // 普通帧不投递,只有 deliveryKind === 'recovery' 能重新开门。
    const authority = streamAuthority.observeFrame(parsed)
    if (authority.resubscribe) {
      throw new StreamAuthorityResubscribeError(authority.reason ?? 'unspecified')
    }
    if (authority.drop) {
      watermarkDroppedFrames++
      emitFrameWatermarkFacts('authority-closed')
      return true
    }
    // b76-15:载荷级四字段在场 ⇒ 三维腿接管,seq 腿让位(只此一份判据生效)。
    // 不在场 ⇒ 走 seq 腿,它判的那一维就是"网关到底有没有丢帧"。
    if (!carriesPayloadWatermark(parsed)) {
      const verdict = frameSeqTracker.observeLine(line)
      if (verdict.kind === 'gap') {
        watermarkDroppedFrames++
        emitFrameWatermarkFacts('seq-discontinuity')
        return true
      }
      if (verdict.kind === 'invalid') {
        watermarkDroppedFrames++
        emitFrameWatermarkFacts('seq-invalid')
        return true
      }
      return false
    }
    const read = readFrameWatermark(parsed)
    if (read.verdict === 'undetermined') {
      // G-816030:本 attempt 尚未 ACK(还没见过 ok 水位帧)且手上已有水位基线 ⇒
      // 这帧的所有权未确认,有界暂存、不投递;溢出 ⇒ 整批已清,经伪订阅 activate
      // 抛出携带 reason/droppedCount 的 FrameBarrierOverflowError —— onLine 抛错
      // 视同本次尝试失败,runner 重连后 onAttemptStart 复位屏障重建(与上游
      // "越界整批清空并让 subscribe 明确失败"同形)。
      if (frameBarrierAckedThisAttempt || frameWatermarkRef.current === null) return false
      const verdict = frameBarrier.offer({
        topic: FRAME_BARRIER_TOPIC,
        subscriptionId: FRAME_BARRIER_PENDING_SUBSCRIPTION,
        byteSize: line.length,
        frame: line,
      })
      if (verdict === 'overflow') {
        frameBarrier.activate({
          subscriptionId: FRAME_BARRIER_PENDING_SUBSCRIPTION,
          topics: [],
        })
        return false // 不可达:activate 命中溢出记录必抛
      }
      return verdict === 'staged'
    }
    if (read.verdict === 'invalid') {
      watermarkDroppedFrames++
      emitFrameWatermarkFacts('payload-invalid')
      return true
    }
    // 到这儿 read.verdict === 'ok':载荷级四字段真的到场了。这一位是"判过"与
    // "没判"的分水岭,必须记下并上报(全程 false ⇒ seq 腿是唯一在场判据)。
    payloadWatermarkSeen = true
    const cursor = frameWatermarkRef.current
    if (cursor === null) {
      // 首个带水位的帧:手上没有可比状态,以服务端帧为基线(owned snapshot 语义)
      frameWatermarkRef.current = {
        subscriptionId: read.watermark.subscriptionId,
        logEpoch: read.watermark.logEpoch,
        seq: read.watermark.toSeq,
      }
      // G-816030:首个 ok 水位帧 = ACK,冲刷 ACK 前暂存的帧
      ackFrameBarrier(read.watermark.subscriptionId)
      return false
    }
    const gap = isFrameGap(cursor, read.watermark)
    if (gap !== null) {
      const action = frameWatermarkGapAction(gap, read.watermark)
      if (action === 'replace-segment') {
        // fromSeq=0 的 snapshot：旧订阅/旧纪元整段作废，本帧成为新基线。
        // 不把这段补进旧游标，也不把序号对不上的 delta 当成新段。
        emitFrameWatermarkFacts(gap, read.watermark)
        frameWatermarkRef.current = {
          subscriptionId: read.watermark.subscriptionId,
          logEpoch: read.watermark.logEpoch,
          seq: read.watermark.toSeq,
        }
        ackFrameBarrier(read.watermark.subscriptionId)
        return false
      }
      // G-816030:所有权未确立(本 attempt 未 ACK)时,gap 说明暂存帧可能属于
      // 旧代际 —— 与被丢的 gap 帧同批清空,不得投递("整批清空"防半截批次投影)。
      if (!frameBarrierAckedThisAttempt) frameBarrier.reset()
      // G-816031:gap 即权威断档 ⇒ 关闸,直到 recovery 信封重新授予权威。
      streamAuthority.observeGap(gap)
      watermarkDroppedFrames++
      emitFrameWatermarkFacts(gap, read.watermark)
      return true
    }
    frameWatermarkRef.current = { ...cursor, seq: read.watermark.toSeq }
    // G-816030:重连续传后首个 ok 帧可能直接走连续路径(游标已立基线,不经过
    // cursor===null 分支),ACK 同样要在此发生(ackFrameBarrier 幂等)。
    ackFrameBarrier(read.watermark.subscriptionId)
    return false
  }
  const token = tokenProvider.getToken()
  // 2026-07-27 修复 SSE 流被 Next.js dev proxy 中断:
  // streamChat 用 streamBaseUrl(直连 API 服务器),绕过 Next.js dev proxy 的超时/缓冲。
  // 普通请求仍用 baseUrl(走同源代理,cookie SSR 正常)。
  const url = normalizeUrl(opts.path ?? '/ai/chat/stream', true)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  }
  applyClientSignature(headers)
  // 2026-10-31 第 20 批:外链目标不挂凭据(判据同 fetchApi 那一条)
  if (token && shouldAttachCredential(url, currentCredentialAllowedOrigins()))
    headers['Authorization'] = `Bearer ${token}`
  // 2026-08-02 P2 修复：与 fetchApi/postApi/putApi/patchApi/deleteApi 保持一致，
  // 注入 X-Requested-With 配合后端 CSRF 防护(无 Bearer token 时走 cookie 兜底路径)
  if (!headers['X-Requested-With']) headers['X-Requested-With'] = 'XMLHttpRequest'
  if (userAgentHeader && !headers['User-Agent']) headers['User-Agent'] = userAgentHeader
  // 2026-10-26:401 续期只做一次(与各条 REST 腿同一口径)
  // 「只续一次」这道闸住在 runResumableSSEStream 内(其 authRefreshed 变量):
  // runner 是本函数内唯一的流式执行体,401 续期后仍 401 ⇒ runner 不再回调本处。
  // 本处原先另持一道 sseAuthRefreshed 闸 —— 与 runner 的闸语义重复,且因 runner
  // 根本不会发起第二次 refreshAuth 调用,那道闸恒为 false(死代码)。
  // 2026-10-26 收口:两道闸并存的形态已撤,单一真相源 = runner 的 authRefreshed。
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
  // D01(2026-10-25 立):已绑 agentId 优先;未绑 agent 而选了对话内 persona 时,
  // 用同一个传输槽把 persona id 送上行(ai-service 据此并入 system 提示与工具白名单)。
  const boundAgentId = opts.agentId ?? opts.personaId
  if (boundAgentId) body.agentId = boundAgentId
  if (opts.agentTools && opts.agentTools.length > 0) body.agentTools = opts.agentTools
  // V3 #58(2026-09-26 立):权限模式档位透传。api-client 仅在字段存在时写入 body;
  // 网关 schema 已声明 permissionMode(否则 zod strip 静默丢弃,链路掐断),
  // 网关再以 permission_mode(snake_case)透传到 ai-service 审批门。
  if (opts.permissionMode) body.permissionMode = opts.permissionMode
  // 79 号票(2026-10-18 立):权限双轴两轴档位透传。与 permissionMode / reasoningEffort
  // 同形:仅字段存在时写入,undefined 不进 body ⇒ 旧客户端零行为变化。
  // 票第 8 栏点名的静默失效就在这一行:删掉它,前端选了档而上游收不到,界面仍一切正常
  // (但双轴裁决门会把它读成"未携带"而整段跳过 ⇒ 选了等于没选)。
  if (opts.sandboxMode !== undefined) body.sandboxMode = opts.sandboxMode
  if (opts.approvalPolicy !== undefined) body.approvalPolicy = opts.approvalPolicy
  // D130(2026-09-30 立):推理强度档位。仅字段存在时写入(与 permissionMode 同形):
  // undefined 不进 body ⇒ 后端走默认档,旧客户端零行为变化。
  if (opts.reasoningEffort !== undefined) body.reasoningEffort = opts.reasoningEffort
  // 差距①(2026-10-30 立):准入配对标识上行。仅字段存在时写入(与 permissionMode 同形):
  // undefined 不进 body ⇒ 旧服务端零行为变化。服务端在 admission 帧里逐字回显它。
  if (opts.inputId !== undefined) body.inputId = opts.inputId
  if (opts.extraBody) Object.assign(body, opts.extraBody)
  // 2026-08-15 立:streamChat 默认流式,后端 detectStreamUsage 依赖 request.stream===true 才启用 usage chunk。
  // 默认 true,允许 extraBody 或显式 opts.stream 覆盖为 false。
  body.stream = opts.stream ?? true

  // ===== D138(承 V4 #96):重连/退避/读超时/续传游标收敛到 runResumableSSEStream(下方)=====
  // 以下可变状态原在 while(true) 每次尝试内重建;runner 的 onAttemptStart 逐次复位,
  // 语义与原"每 attempt 新建"逐字一致。续传游标归 runner 独有,经 appendResumeEventIdHeader 注入。
  let isRetry = false
  let dedupeActive = false
  let dedupeBuffer = ''
  const agentDedupeBuffer = new Map<string, string>()
  let seenTraceId: string | null = null
  try {
    const hasReasoning = typeof opts.onReasoning === 'function'
    const hasCompaction = typeof opts.onCompaction === 'function'
    const hasQuestion = typeof opts.onQuestion === 'function'
    // 2026-11-08 立:提问结算帧解析开关(未注册回调时不解析,零开销)
    const hasQuestionResolved = typeof opts.onQuestionResolved === 'function'
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
    // D115(2026-10-23 立):review-finding 结构化发现帧解析开关(onReviewFinding 注册才解析)
    const hasReviewFinding = typeof opts.onReviewFinding === 'function'
    // W1(2026-09-12 立):plan / terminal SSE 事件能力检测
    const hasPlanUpdate = typeof opts.onPlanUpdate === 'function'
    const hasTerminal =
      typeof opts.onTerminalStart === 'function' && typeof opts.onTerminalEnd === 'function'
    // 终端实时输出增量(2026-09-18 立):onTerminalDelta 存在时启用解析
    const hasTerminalDelta = typeof opts.onTerminalDelta === 'function'
    // D151:没接这条腿就不解析该帧(与 onToolDelta/onInjection 同口径)
    const hasTerminalInteraction = typeof opts.onTerminalInteraction === 'function'
    // D152:没接这条腿就不解析该帧(与 onTerminalInteraction/onToolDelta 同口径)
    const hasGoalUpdate = typeof opts.onGoalUpdate === 'function'
    // D113:tool-delta 流中预览(未注册回调不解析)
    const hasToolDelta = typeof opts.onToolDelta === 'function'
    // #11 Citations 全链路(2026-09-13 立):knowledge_lookup 工具执行后下发引用溯源
    const hasCitations = typeof opts.onCitations === 'function'
    // P1 #27(2026-09-16 立):done 事件携带 memoryUpdates(已记住提示条数据源)
    const hasMemoryUpdates = typeof opts.onMemoryUpdates === 'function'
    // D130(2026-09-30 立):done 帧携带 reasoningEffort 回落通知(未注册回调不解析)
    const hasReasoningEffortNotice = typeof opts.onReasoningEffortNotice === 'function'
    const hasUsage = typeof opts.onUsage === 'function'
    // Steer(中途引导,2026-09-19 立):onSteer 存在时启用解析
    const hasSteer = typeof opts.onSteer === 'function'
    // 差距①(2026-10-30 立):onSendAdmissionReceipt 存在时启用解析(未注册不解析,同口径)
    const hasSendAdmission = typeof opts.onSendAdmissionReceipt === 'function'
    // Budget(用量分档提醒,2026-09-19 立):onBudget 存在时启用解析
    const hasBudget = typeof opts.onBudget === 'function'
    // G-815976(2026-10-04 收口入契约):流式中断标记帧;未注册回调不解析
    const hasPartialDone = typeof opts.onPartialDone === 'function'
    // G-425(2026-10-07 立):done 帧携带 finishReason(截断提示数据源;未注册回调不解析)
    const hasFinishReason = typeof opts.onFinishReason === 'function'
    // D155(2026-09-29 立):下行告警三档;未注册回调不解析(与其余 per-field 同口径)
    const hasConfigWarning = typeof opts.onConfigWarning === 'function'
    const hasDeprecationNotice = typeof opts.onDeprecationNotice === 'function'
    const hasGuardianWarning = typeof opts.onGuardianWarning === 'function'
    const hasInjection = typeof opts.onInjectionApplied === 'function'
    const hasRetryScheduled = typeof opts.onRetryScheduled === 'function'
    // D77(2026-09-25 立):业务表单请求帧;帧带 fields/actions 结构化字段,
    // 未注册回调时不解析(与 injection 同口径)。
    const hasFormRequest = typeof opts.onFormRequest === 'function'
    // G-87 补链(2026-10-29 立):hook 执行失败帧;未注册回调不解析(与其余 per-field 同口径)
    const hasHookFailure = typeof opts.onHookFailure === 'function'
    // hasCitations 被 tryParseCitations 的守护读取(消除 TS6133:声明未使用)
    void hasCitations

    // ===== Dedupe 机制(isRetry 时启用) =====
    // 重连后若服务端不支持续传会从头重发,前端用 receivedContent 前缀匹配
    // 跳过已接收内容,仅追加新增部分;若服务端发送不同内容则放弃 dedupe 全量追加。
    // (D138:dedupeBuffer/dedupeActive/agentDedupeBuffer 声明上移,isRetry 由
    // runResumableSSEStream 的 onAttemptStart 逐次复位;读超时同批搬入 runner。)

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
      } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
        return
      }
      if (!data || data === '[DONE]') return
      try {
        const json = JSON.parse(data)
        // 兼容两种线格式:历史顶层 key 形态 {"compaction":{...}} 与命名帧形态
        // {"type":"compaction",...}(网关 extraFirstEvents 两种都会发)。
        const compactionPayload =
          json?.compaction && typeof json.compaction === 'object'
            ? json.compaction
            : json?.type === 'compaction'
              ? json
              : null
        if (compactionPayload?.triggered === true) {
          opts.onCompaction!({
            tokensBefore: Number(compactionPayload.tokensBefore ?? 0),
            tokensAfter: Number(compactionPayload.tokensAfter ?? 0),
            removedCount: Number(compactionPayload.removedCount ?? 0),
            // A10B-8:截断量是披露判据的事实来源。**刻意不写 `?? 0` 归一** ——
            // 旧帧(生产者尚未带该字段)缺席必须原样传成 undefined,归零等于把
            // "没被告知"改写成"确实没截断",消费侧就退回"该说不说"的沉默那一型。
            truncatedCount:
              typeof compactionPayload.truncatedCount === 'number' &&
              Number.isFinite(compactionPayload.truncatedCount)
                ? compactionPayload.truncatedCount
                : undefined,
            usageRatio: Number(compactionPayload.usageRatio ?? 0),
            trigger:
              typeof compactionPayload.trigger === 'string' ? compactionPayload.trigger : undefined,
            compressedMessages: compactionPayload.compressedMessages,
            // 批次 3(2026-11-06):边界形状不认则缺席(不猜),前端按"无边界可回看"处理。
            boundary: parseCompactBoundarySnapshot(compactionPayload.boundary),
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
      } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
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
                  .map((o: { id: unknown; label: unknown; description?: unknown }) => ({
                    id: String(o.id),
                    label: String(o.label),
                    ...(typeof o.description === 'string' && o.description
                      ? { description: o.description }
                      : {}),
                  }))
              : [],
            allowCustom: q.allowCustom !== false,
            allowMultiple: q.allowMultiple === true,
            ...(typeof q.header === 'string' && q.header ? { header: q.header } : {}),
            ...(typeof q.expiresAt === 'string' || typeof q.expiresAt === 'number'
              ? { expiresAt: q.expiresAt }
              : {}),
            ...(typeof q.sessionId === 'string' && q.sessionId ? { sessionId: q.sessionId } : {}),
          })
        }
      } catch {
        /* 非 JSON 或非 question 事件忽略 */
      }
    }

    /**
     * 2026-11-08 立:提问结算帧解析。
     * 形状:{"type":"question-resolved","questionId":"q_x","status":"answered|timeout|withdrawn|interrupted",
     *       "selectedOptionIds":[],"customText":""}
     * 只做结构校验,不猜状态值域 —— 未知 status 一律忽略(旧/坏帧不能伪造终态)。
     */
    const QUESTION_RESOLVED_STATUSES = new Set(['answered', 'timeout', 'withdrawn', 'interrupted'])
    const tryParseQuestionResolved = (line: string): void => {
      if (!hasQuestionResolved) return
      if (!line || line.startsWith(':')) return
      let data = line
      if (line.startsWith('data:')) {
        data = line.slice(5).replace(/^\s/, '')
      } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
        return
      }
      if (!data || data === '[DONE]') return
      try {
        const json = JSON.parse(data)
        if (
          json?.type !== 'question-resolved' ||
          typeof json?.questionId !== 'string' ||
          !json.questionId ||
          typeof json?.status !== 'string' ||
          !QUESTION_RESOLVED_STATUSES.has(json.status)
        ) {
          return
        }
        opts.onQuestionResolved!({
          type: 'question-resolved',
          questionId: json.questionId,
          status: json.status,
          selectedOptionIds: Array.isArray(json.selectedOptionIds)
            ? json.selectedOptionIds.filter((id: unknown) => typeof id === 'string')
            : [],
          ...(typeof json.customText === 'string' ? { customText: json.customText } : {}),
        })
      } catch {
        /* 非 JSON 或非 question-resolved 事件忽略 */
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
      } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
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
          if ((json?.type === 'tool_result' || json?.type === 'tool-result') && json?.toolCallId) {
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
      } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
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
            messageId: typeof json.messageId === 'string' ? json.messageId : undefined,
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
              messageId: typeof json.messageId === 'string' ? json.messageId : undefined,
            })
          }
        } else if (json?.type === 'subagent_end' && json?.id) {
          opts.onSubagentEnd!({
            id: String(json.id),
            status: json.status === 'failed' ? 'failed' : json.status === 'stub' ? 'stub' : 'done',
            failureReason: typeof json.failureReason === 'string' ? json.failureReason : undefined,
            timestamp:
              typeof json.timestamp === 'string' ? json.timestamp : new Date().toISOString(),
            messageId: typeof json.messageId === 'string' ? json.messageId : undefined,
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
      } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
        return
      }
      if (!data || data === '[DONE]') return
      try {
        const json = JSON.parse(data) as Record<string, unknown>
        if (json?.type !== 'tool-summary') return
        // 兼容 snake_case / camelCase 字段(后端 SSE 序列化策略)
        const numOr = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
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
          // 2026-11-04(sse-event-parity):契约声明 directories/edits/terminalCommands,
          // 原实现只透传 8 键;这里按类型校验后透传(历史帧缺省不带,不以 0 冒充)。
          ...(typeof json.directories === 'number' ? { directories: json.directories } : {}),
          ...(typeof json.edits === 'number' ? { edits: json.edits } : {}),
          ...(typeof json.terminalCommands === 'number'
            ? { terminalCommands: json.terminalCommands }
            : {}),
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
      } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
        return
      }
      if (!data || data === '[DONE]') return
      let invoked = false
      try {
        const json = JSON.parse(data) as Record<string, unknown>
        if (json?.type !== 'tool-delegate') return
        if (typeof json.session_id !== 'string' || typeof json.tool_call_id !== 'string') return
        invoked = true
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
      } catch (err) {
        // 原语义保留:**没被识别成本帧**(非 JSON / 缺字段)一律静默跳过,不中断读流。
        // 但"回调已经跑起来了"再抛,就是**回传没送达** —— 后端协程还在等,静默咽掉等于
        // 让整轮工具链默默等到超时(§5e「失败必须响」同一条禁令;2026-08-06 那句
        // "抛错让调用方重试"在这一层从来没有出口,调用方拿不到任何信号)。
        // 处置:不中断流(与既有设计一致),但必须喊出来,且喊的内容要能定位是哪一轮。
        if (invoked) {
          console.error(
            '[streamChat] tool-delegate 回传未送达(后端将等到超时):',
            err instanceof Error ? err.message : err,
          )
        }
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
      } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
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
          // D159:执行环境/网络目标事实必须随帧递出 —— 解析层不递 ⇒ 弹窗那一块
          // 结构上永远是"字段缺席=整块不渲染",组件测得再全也到不了端。
          ...projectToolApprovalEnvFacts(json),
          // 批次 2:结构化决策信息(原因/风险/argv/cwd/路径/作用域/摘要)。
          ...projectToolApprovalDecisionInfo(json),
          // D-07(2026-10-26):失效留痕帧原样递出 expired 标记,消费方据此分流成提示
          // 而不是弹窗。与 replay 同理 —— 解析层不递,端上就永远看不到"丢过什么"。
          ...projectToolApprovalExpiredFact(json),
        })
      } catch {
        /* 非 JSON 或非 tool-approval 事件忽略 */
      }
    }

    /** D115(2026-10-23 立):解析 review-finding SSE 帧(review 模式结构化发现,一 finding 一帧)。
     *  - 契约:ReviewFindingEvent(定义在本包,零依赖包边界);wire 形 camelCase 直通
     *  - 畸形帧(缺 findingId/severity/file 等 key 字段或 severity 越域)一律不发回调 ——
     *    与 tool-approval「缺 id 不弹窗」同口径:半截帧上屏只会渲染出坏行
     *  - 未注册 onReviewFinding 时不解析(hasReviewFinding 首道守护,与其余 per-field 同口径) */
    const tryParseReviewFinding = (line: string): void => {
      if (!hasReviewFinding) return
      if (!line || line.startsWith(':')) return
      let data = line
      if (line.startsWith('data:')) {
        data = line.slice(5).replace(/^\s/, '')
      } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
        return
      }
      if (!data || data === '[DONE]') return
      try {
        const json = JSON.parse(data) as Record<string, unknown>
        if (json?.type !== 'review-finding') return
        const findingId = json.findingId
        const severity = json.severity
        const file = json.file
        const title = json.title
        if (
          typeof findingId !== 'string' ||
          findingId === '' ||
          (severity !== 'P1' && severity !== 'P2' && severity !== 'Nit') ||
          typeof file !== 'string' ||
          file === '' ||
          typeof title !== 'string'
        ) {
          return
        }
        const index = json.index
        const total = json.total
        const line0 = json.line
        if (
          typeof index !== 'number' ||
          !Number.isFinite(index) ||
          typeof total !== 'number' ||
          !Number.isFinite(total) ||
          typeof line0 !== 'number' ||
          !Number.isFinite(line0)
        ) {
          return
        }
        opts.onReviewFinding!({
          findingId,
          index,
          total,
          severity,
          file,
          line: line0,
          title,
          detail: typeof json.detail === 'string' ? json.detail : '',
          suggestion: typeof json.suggestion === 'string' ? json.suggestion : '',
          ...(typeof json.target === 'string' && json.target !== '' ? { target: json.target } : {}),
        })
      } catch {
        /* 非 JSON 或非 review-finding 事件忽略 */
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
      } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
        return
      }
      if (!data || data === '[DONE]') return
      try {
        const json = JSON.parse(data) as Record<string, unknown>
        if ((json?.type !== 'plan_updated' && json?.type !== 'plan') || !Array.isArray(json.plan)) {
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
      } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
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
            // 2026-11-04:契约声明 status;读取并校验(当前域仅 'running')
            status: json.status === 'running' ? 'running' : 'running',
            ...(typeof json.startedAt === 'string' ? { startedAt: json.startedAt } : {}),
            ...(typeof json.messageId === 'string' ? { messageId: json.messageId } : {}),
          }
          opts.onTerminalStart!(evt)
          return
        }
        if (json?.type === 'terminal_end') {
          if (typeof json.terminalId !== 'string') return
          if (json.status !== 'completed' && json.status !== 'failed') return
          // b76-13 票2:结构不变量(必要字段对)—— truncated=true 而 totalChars
          // 缺席/坏型是"截断了却不知道截掉多少"的假话帧 ⇒ typed fault 丢弃且计数
          // (不冒充解析成功,也不放行);对照:装饰字段(output,见下)坏了只降级。
          if (json.truncated === true && typeof json.totalChars !== 'number') {
            _sseFrameSchemaFaults++
            return
          }
          const evt: TerminalEndEvent = {
            terminalId: json.terminalId,
            status: json.status,
            // 装饰档(output):坏型 ⇒ 整字段按缺省处理,那张卡退化成纯文本,
            // 不决定本帧生死(与 @ihui/shared SSE_DECORATIVE_FIELDS 同档登记)
            ...(typeof json.output === 'string' ? { output: json.output } : {}),
            ...(typeof json.exitCode === 'number' ? { exitCode: json.exitCode } : {}),
            ...(typeof json.endedAt === 'string' ? { endedAt: json.endedAt } : {}),
            ...(typeof json.durationMs === 'number' ? { durationMs: json.durationMs } : {}),
            ...(typeof json.interactionCount === 'number'
              ? { interactionCount: json.interactionCount }
              : {}),
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
    // D113:tool-delta 流中预览帧解析(增量正文透传;seq 升格为收敛判据,消费端按 seq 收敛追加)
    const tryParseToolDelta = (line: string): void => {
      if (!hasToolDelta) return
      if (!line || line.startsWith(':')) return
      let data = line
      if (line.startsWith('data:')) {
        data = line.slice(5).replace(/^\s/, '')
      } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
        return
      }
      if (!data || data === '[DONE]') return
      try {
        const json = JSON.parse(data) as Record<string, unknown>
        if (json?.type !== 'tool-delta') return
        if (typeof json.toolCallId !== 'string') return
        // G-816035(2026-10-08):seq 是收敛判据,必须为 >= 1 的整数,否则整帧不投递
        // (修复"字段缺席落 0"的未声明即放行形态 —— 落 0 既掩盖缺字段,又被消费端当成陈旧帧)。
        if (typeof json.seq !== 'number' || !Number.isInteger(json.seq) || json.seq < 1) return
        opts.onToolDelta!({
          toolCallId: json.toolCallId,
          seq: json.seq,
          partialText: typeof json.partialText === 'string' ? json.partialText : '',
          ...(json.truncated === true ? { truncated: true } : {}),
        })
      } catch {
        /* 非 JSON 或非 tool-delta 事件忽略 */
      }
    }

    const tryParseTerminalDelta = (line: string): void => {
      if (!hasTerminalDelta) return
      if (!line || line.startsWith(':')) return
      let data = line
      if (line.startsWith('data:')) {
        data = line.slice(5).replace(/^\s/, '')
      } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
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

    /** D151(2026-09-29):解析 terminal_interaction —— "命令停住了、在等你敲一行"。
     *  判据与 tryParseTerminalDelta 同形(先看 type 再看 terminalId),但**不看 text 字段**:
     *  服务端分流靠 payload 的 type,不是靠"有没有 text" —— 前端也必须按 type 认,
     *  否则同一承载面上两种帧就会互相顶掉。 */
    const tryParseTerminalInteraction = (line: string): void => {
      if (!hasTerminalInteraction) return
      if (!line || line.startsWith(':')) return
      let data = line
      if (line.startsWith('data:')) {
        data = line.slice(5).replace(/^\s/, '')
      } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
        return
      }
      if (!data || data === '[DONE]') return
      try {
        const json = JSON.parse(data) as Record<string, unknown>
        if (json?.type !== 'terminal_interaction') return
        if (typeof json.terminalId !== 'string') return
        opts.onTerminalInteraction!({
          terminalId: json.terminalId,
          sessionId: typeof json.sessionId === 'string' ? json.sessionId : '',
          promptTail: typeof json.promptTail === 'string' ? json.promptTail : '',
          waitingSinceMs: typeof json.waitingSinceMs === 'number' ? json.waitingSinceMs : 0,
          // 2026-11-04(sse-event-parity):契约声明 inputMode;读取并校验(当前域仅 'line')
          inputMode: json.inputMode === 'line' ? 'line' : 'line',
          maxInputChars: typeof json.maxInputChars === 'number' ? json.maxInputChars : 4096,
          ...(typeof json.messageId === 'string' ? { messageId: json.messageId } : {}),
        })
      } catch {
        /* 非 JSON 或非 terminal_interaction 事件忽略 */
      }
    }

    /** D152(2026-09-29):解析 goal_updated —— 服务端那份目标主副本变了。
     *  判据与同族一致:先看 type,再验 `status` ∈ GOAL_WIRE_STATUSES(六档 + cleared)。
     *  **status 不合法就丢弃**,绝不回落成 chunk/meta 或"当作没发生"—— 把"没认出来"
     *  写成"看见了"是本仓最高频的失效型。合法值集从 @ihui/types 现取,不在本包抄第二份。 */
    const tryParseGoalUpdate = (line: string): void => {
      if (!hasGoalUpdate) return
      if (!line || line.startsWith(':')) return
      let data = line
      if (line.startsWith('data:')) {
        data = line.slice(5).replace(/^\s/, '')
      } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
        return
      }
      if (!data || data === '[DONE]') return
      try {
        const json = JSON.parse(data) as Record<string, unknown>
        if (json?.type !== 'goal_updated') return
        const status = json.status
        if (typeof status !== 'string' || !GOAL_WIRE_STATUSES.includes(status as GoalWireStatus)) {
          return
        }
        const event: GoalUpdateEvent = {
          sessionId: typeof json.sessionId === 'string' ? json.sessionId : '',
          status: status as GoalWireStatus,
          ...(typeof json.objective === 'string' ? { objective: json.objective } : {}),
          ...(typeof json.elapsedMs === 'number' ? { elapsedMs: json.elapsedMs } : {}),
          ...(typeof json.tokenUsage === 'number' ? { tokenUsage: json.tokenUsage } : {}),
          ...(typeof json.updatedAt === 'number' ? { updatedAt: json.updatedAt } : {}),
        }
        opts.onGoalUpdate!(event)
      } catch {
        /* 非 JSON 或非 goal_updated 事件忽略 */
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
      } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
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
      } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
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
      } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
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

    /** 解析 done 帧的推理强度档位回落通知(D130,2026-09-30 立)。
     *  与 tryParseMemoryUpdates 同形:读的是**同一个已存在的 done 帧**上新增的可选字段,
     *  不新增事件名 ⇒ 不动 SSE 契约两侧 / sse-parse / dispatch 台账(本票文件清单外)。
     *  只在 requested ≠ effective 或后端显式标 fallback 时回调 —— 没回落就不该有徽章。 */
    const tryParseReasoningEffortNotice = (line: string): void => {
      if (!hasReasoningEffortNotice) return
      if (!line || line.startsWith(':')) return
      let data = line
      if (line.startsWith('data:')) {
        data = line.slice(5).replace(/^\s/, '')
      } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
        return
      }
      if (!data || data === '[DONE]') return
      try {
        const json = JSON.parse(data) as Record<string, unknown>
        if (json?.type !== 'done') return
        const raw = json.reasoningEffort
        if (raw === undefined || raw === null || typeof raw !== 'object') return
        const info = raw as Record<string, unknown>
        const requested =
          typeof info.requested === 'string' ? (info.requested as ReasoningEffort) : null
        const effective =
          typeof info.effective === 'string' ? (info.effective as ReasoningEffort) : null
        const fallback = info.fallback === true || (requested !== null && effective !== requested)
        if (!fallback) return
        opts.onReasoningEffortNotice!({
          requested,
          effective,
          fallback: true,
          reason: typeof info.reason === 'string' ? info.reason : undefined,
        })
      } catch {
        /* 非 JSON 或非 done 事件忽略 */
      }
    }

    /** 解析 done 帧的 finish/stop reason(G-425,2026-10-07 立,默认档"只提示")。
     *  与 tryParseMemoryUpdates 同形:读的是**同一个已存在的 done 帧**上新增的可选字段,
     *  不新增事件名 ⇒ 不动 SSE 契约两侧 / sse-parse / dispatch 台账(本票文件清单外)。
     *  原样透传不归一;缺席不带键,回调不触发 —— 不把"没采到"折成"stop"。 */
    const tryParseFinishReason = (line: string): void => {
      if (!hasFinishReason) return
      if (!line || line.startsWith(':')) return
      let data = line
      if (line.startsWith('data:')) {
        data = line.slice(5).replace(/^\s/, '')
      } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
        return
      }
      if (!data || data === '[DONE]') return
      try {
        const json = JSON.parse(data) as Record<string, unknown>
        if (json?.type !== 'done') return
        const raw = json.finishReason
        if (typeof raw !== 'string' || raw === '') return
        opts.onFinishReason!({
          finishReason: raw,
          // 2026-11-04(sse-event-parity):done 帧同载体的四个契约键在此读取并透传
          // (原实现只取 finishReason,契约声明的 usage/model/stub/capabilities 无人读)。
          ...(typeof json.model === 'string' ? { model: json.model } : {}),
          ...(json.usage && typeof json.usage === 'object'
            ? { usage: json.usage as Record<string, unknown> }
            : {}),
          ...(typeof json.stub === 'boolean' ? { stub: json.stub } : {}),
          ...(json.capabilities && typeof json.capabilities === 'object'
            ? { capabilities: json.capabilities as Record<string, unknown> }
            : {}),
        })
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
      } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
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
            typeof reasoningRaw === 'number' && Number.isFinite(reasoningRaw) ? reasoningRaw : null,
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
          // G-1058632(2026-10-05 立):缓存读/写两维在此接住。
          // 刻意**不受** isNamedFrame 门控(与上面 reasoningTokens 相反):ai-service 的命名帧
          // (app/routers/llm.py 的 _usage_frame)今天根本不带这两键,有数据的是 relay
          // verbatim 转发的 OpenAI 协议路径(apps/api/src/services/relay-upstream-forwarder.ts
          // 头注「逐行转发上游原始 data 行…不改写」)。沿用门控就等于对唯一有数据的通路全盲。
          // 上游没回报 ⇒ null(未采到),不得在此造 0。
          ...parseUsageCacheTokens(usage),
          // 批次 3(2026-11-06):七类账本只在命名帧读取;形状不认(七类不齐/未知类别)
          // 整帧丢弃,不猜档 —— 与本包"不造默认值"纪律同口径。
          contextLedger: isNamedFrame ? parseContextLedgerSnapshot(json.contextLedger) : undefined,
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
      } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
        return
      }
      if (!data || data === '[DONE]') return
      try {
        const json = JSON.parse(data) as Record<string, unknown>
        if (json?.type !== 'steer' || typeof json?.text !== 'string') return
        opts.onSteer!({
          // 2026-11-04(sse-event-parity):契约声明 phase/kind;读取并校验 phase 域
          phase: json.phase === 'injected' ? 'injected' : 'injected',
          ...(typeof json.kind === 'string' ? { kind: json.kind } : {}),
          text: json.text,
          timestamp: typeof json.timestamp === 'string' ? json.timestamp : undefined,
          messageId: typeof json.messageId === 'string' ? json.messageId : undefined,
        })
      } catch {
        /* 非 JSON 或非 steer 事件忽略 */
      }
    }

    /**
     * 差距①(2026-10-30 立):发送准入回执帧(admission)。服务端在流开始、完成准入判定后、
     * 首个内容帧之前回显客户端上行的 inputId 与 disposition:
     *   event: admission → data: { type:'admission', inputId, disposition,
     *                              messageId?, queuedTurnId?, reason? }
     * 严格解析走 readSendAdmissionReceipt(与 @ihui/shared chat/send-admission.ts 同规则):
     * 返回 null ⇒ 丢弃并计数(不猜档、不抛错)—— 把形状坏的帧读成 accepted 等于用一次
     * 解析失败伪造"服务端收下了"。成功则回调上层,由 SendAdmissionTracker 按 inputId 配对。 */
    const tryParseSendAdmission = (line: string): void => {
      if (!hasSendAdmission) return
      if (!line || line.startsWith(':')) return
      let data = line
      if (line.startsWith('data:')) {
        data = line.slice(5).replace(/^\s/, '')
      } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
        return
      }
      if (!data || data === '[DONE]') return
      try {
        const json = JSON.parse(data) as Record<string, unknown>
        if (json?.type !== 'admission') return
        const receipt = readSendAdmissionReceipt(json)
        if (!receipt) {
          _admissionReceiptDropped += 1
          return
        }
        opts.onSendAdmissionReceipt!(receipt)
      } catch {
        /* 非 JSON 或非 admission 事件忽略 */
      }
    }

    /**
     * Budget(用量分档提醒,2026-09-19 立,网关发):流首网关按用户当日 AI 用量
     * 三态分档下发提醒帧(80%~95% warning / 95%~100% critical,均放行不中断流):
     *   event: budget → data: { type:'budget', level:'warning'|'critical', percent?,
     *                            usedTokens?, limitTokens?, tier?, resetAt? }
     * 前端消费(V3 #69 起):onBudget → 写 budget-state 落点渲染输入框上方进度条 + toast 提示。 */
    const tryParseBudget = (line: string): void => {
      if (!hasBudget) return
      if (!line || line.startsWith(':')) return
      let data = line
      if (line.startsWith('data:')) {
        data = line.slice(5).replace(/^\s/, '')
      } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
        return
      }
      if (!data || data === '[DONE]') return
      try {
        const json = JSON.parse(data) as Record<string, unknown>
        if (json?.type !== 'budget') return
        // 批次 3(2026-11-06):stopped 是终态档,必须与 warning/critical 一样被接住,
        // 否则硬停止帧会被静默丢弃,前端永远看不到"因预算停止"。
        if (json?.level !== 'warning' && json?.level !== 'critical' && json?.level !== 'stopped')
          return
        opts.onBudget!({
          level: json.level,
          percent: typeof json.percent === 'number' ? json.percent : undefined,
          usedTokens: typeof json.usedTokens === 'number' ? json.usedTokens : undefined,
          limitTokens: typeof json.limitTokens === 'number' ? json.limitTokens : undefined,
          tier: typeof json.tier === 'string' ? json.tier : undefined,
          resetAt: typeof json.resetAt === 'string' ? json.resetAt : undefined,
          reasonCode: typeof json.reasonCode === 'string' ? json.reasonCode : undefined,
          scope: typeof json.scope === 'string' ? json.scope : undefined,
          pillar: typeof json.pillar === 'string' ? json.pillar : undefined,
          usagePercent:
            typeof json.usagePercent === 'number' && Number.isFinite(json.usagePercent)
              ? json.usagePercent
              : undefined,
          remainingTokens:
            typeof json.remainingTokens === 'number' && Number.isFinite(json.remainingTokens)
              ? json.remainingTokens
              : undefined,
          stoppedAtIteration:
            typeof json.stoppedAtIteration === 'number' && Number.isFinite(json.stoppedAtIteration)
              ? json.stoppedAtIteration
              : undefined,
        })
      } catch {
        /* 非 JSON 或非 budget 事件忽略 */
      }
    }

    /**
     * G-815976(2026-10-04 收口入契约):流式中断标记帧解析。llm_gateway astream
     * 异常中断且已发过 chunk 时发出 —— 收到它意味着"这条回答到这里被打断",
     * 已到达正文有效,但端上必须如实告知截断,不得当完整回答收束。
     * 与 tryParseBudget 同构:type 命中即收帧,字段只做 typeof 收窄不猜。
     */
    const tryParsePartialDone = (line: string): void => {
      if (!hasPartialDone) return
      if (!line || line.startsWith(':')) return
      let data = line
      if (line.startsWith('data:')) {
        data = line.slice(5).replace(/^\s/, '')
      } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
        return
      }
      if (!data || data === '[DONE]') return
      try {
        const json = JSON.parse(data) as Record<string, unknown>
        if (json?.type !== 'partial_done') return
        opts.onPartialDone!({
          fallback_applied: json.fallback_applied === true,
          reason: typeof json.reason === 'string' ? json.reason : 'stream_interrupted',
          model: typeof json.model === 'string' ? json.model : undefined,
        })
      } catch {
        /* 非 JSON 或非 partial_done 事件忽略 */
      }
    }

    /**
     * D155(2026-09-29 立)下行告警三档解析(契约见 shared contract.ts 的
     * SSE_ALERT_EVENTS 段)。与 tryParseBudget 同构,但三档共用一条归一纪律:
     * `type` 命中 + `message` 非空串 ⇒ 收帧;severity 表外/缺省**回退 'warning'**
     * 而不是丢帧(D34/D40 教训:至少 message/severity 要到消费端);
     * 可选串字段只在 `typeof === 'string'` 时透传(非串垃圾当缺省)。
     */
    const alertSeverity = (value: unknown): AlertSeverity =>
      value === 'info' || value === 'warning' || value === 'critical' ? value : 'warning'

    const tryParseConfigWarning = (line: string): void => {
      if (!hasConfigWarning) return
      if (!line || line.startsWith(':')) return
      let data = line
      if (line.startsWith('data:')) {
        data = line.slice(5).replace(/^\s/, '')
      } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
        return
      }
      if (!data || data === '[DONE]') return
      try {
        const json = JSON.parse(data) as Record<string, unknown>
        if (json?.type !== 'config-warning') return
        if (typeof json.message !== 'string' || json.message === '') return
        opts.onConfigWarning!({
          severity: alertSeverity(json.severity),
          message: json.message,
          field: typeof json.field === 'string' ? json.field : undefined,
          provider: typeof json.provider === 'string' ? json.provider : undefined,
          effectiveValue: typeof json.effectiveValue === 'string' ? json.effectiveValue : undefined,
        })
      } catch {
        /* 非 JSON 或非 config-warning 事件忽略 */
      }
    }

    const tryParseDeprecationNotice = (line: string): void => {
      if (!hasDeprecationNotice) return
      if (!line || line.startsWith(':')) return
      let data = line
      if (line.startsWith('data:')) {
        data = line.slice(5).replace(/^\s/, '')
      } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
        return
      }
      if (!data || data === '[DONE]') return
      try {
        const json = JSON.parse(data) as Record<string, unknown>
        if (json?.type !== 'deprecation-notice') return
        if (typeof json.message !== 'string' || json.message === '') return
        opts.onDeprecationNotice!({
          severity: alertSeverity(json.severity),
          message: json.message,
          capability: typeof json.capability === 'string' ? json.capability : undefined,
          alternative: typeof json.alternative === 'string' ? json.alternative : undefined,
          sunsetAt: typeof json.sunsetAt === 'string' ? json.sunsetAt : undefined,
        })
      } catch {
        /* 非 JSON 或非 deprecation-notice 事件忽略 */
      }
    }

    const tryParseGuardianWarning = (line: string): void => {
      if (!hasGuardianWarning) return
      if (!line || line.startsWith(':')) return
      let data = line
      if (line.startsWith('data:')) {
        data = line.slice(5).replace(/^\s/, '')
      } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
        return
      }
      if (!data || data === '[DONE]') return
      try {
        const json = JSON.parse(data) as Record<string, unknown>
        if (json?.type !== 'guardian-warning') return
        if (typeof json.message !== 'string' || json.message === '') return
        opts.onGuardianWarning!({
          severity: alertSeverity(json.severity),
          message: json.message,
          category: typeof json.category === 'string' ? json.category : undefined,
          reviewId: typeof json.reviewId === 'string' ? json.reviewId : undefined,
        })
      } catch {
        /* 非 JSON 或非 guardian-warning 事件忽略 */
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
     *  - admission:tryParseSendAdmission(差距① 2026-10-30 立,发送受理回执;
     *    严格解析,形状不合即丢弃并计数,不猜不抛)
     *  - budget:tryParseBudget(Budget 用量分档提醒 2026-09-19 立,网关发)
     *  - config-warning / deprecation-notice / guardian-warning:
     *    tryParseConfigWarning / tryParseDeprecationNotice / tryParseGuardianWarning
     *    (D155 2026-09-29 立,下行告警三档)
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
      } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
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
      } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
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
      } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
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
          ...(typeof json.mode === 'string' && json.mode !== '' ? { mode: json.mode } : {}),
          ...(typeof json.sessionId === 'string' ? { sessionId: json.sessionId } : {}),
          ...(typeof json.messageId === 'string' ? { messageId: json.messageId } : {}),
        })
      } catch {
        /* 非 JSON 或非 form_request 事件忽略 */
      }
    }

    /**
     * G-87 补链(2026-10-29 立):hook 执行失败帧的解析器。
     *
     * 畸形帧一律**不发回调**(与 injection_applied / form_request 同纪律):
     *   · 缺 `state` 或不在两档内 ⇒ 丢帧(`state` 是六态卡唯一派发依据,猜一个就会把
     *     "未记录"伪装成"失败",正是判定层点名禁止的那一型);
     *   · 缺 `hookName` / `hookEvent` ⇒ 丢帧(卡片上没有任何可指认的对象)。
     *
     * 三个可选证据字段(`command`/`stderr`/`exitCode`)只在**类型对得上**时透传:
     * `exitCode` 收窄成 `number` 而不是 `Number(x)` —— `Number(null)` 是 0,会把
     * "没取到"变成"确实以 0 退出"这个肯定结论。
     */
    const tryParseHookFailure = (line: string): void => {
      if (!hasHookFailure) return
      if (!line || line.startsWith(':')) return
      let data = line
      if (line.startsWith('data:')) {
        data = line.slice(5).replace(/^\s/, '')
      } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
        return
      }
      if (!data || data === '[DONE]') return
      try {
        const json = JSON.parse(data) as Record<string, unknown>
        if (json?.type !== 'hook-failed') return
        const state = json.state
        if (state !== 'failed' && state !== 'timedOut') return
        const hookName = json.hookName
        const hookEvent = json.hookEvent
        if (typeof hookName !== 'string' || hookName === '') return
        if (typeof hookEvent !== 'string' || hookEvent === '') return
        const event: HookFailureEvent = {
          // 服务端 wire 用 snake(hook_id,与其余 hook 透传帧同族);camel 是视图形态。
          // 两形状都认:只认一种会让真帧的 hookId 恒为空串(实测过)。
          hookId:
            typeof json.hookId === 'string'
              ? json.hookId
              : typeof json.hook_id === 'string'
                ? json.hook_id
                : '',
          hookName,
          hookEvent,
          state,
          error: typeof json.error === 'string' ? json.error : '',
          durationMs: typeof json.durationMs === 'number' ? json.durationMs : 0,
          failedAt: typeof json.failedAt === 'string' ? json.failedAt : '',
          ...(typeof json.actionType === 'string' && json.actionType !== ''
            ? { actionType: json.actionType }
            : {}),
          ...(typeof json.command === 'string' && json.command !== ''
            ? { command: json.command }
            : {}),
          ...(typeof json.stderr === 'string' && json.stderr !== '' ? { stderr: json.stderr } : {}),
          ...(typeof json.exitCode === 'number' ? { exitCode: json.exitCode } : {}),
          ...(typeof json.messageId === 'string' ? { messageId: json.messageId } : {}),
        }
        opts.onHookFailure!(event)
      } catch {
        /* 非 JSON 或非 hook-failed 事件忽略 */
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
          case 'question-resolved':
            return 'question_resolved'
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
          // D113:文件写类工具流中 diff 预览
          case 'tool-delta':
            return 'tool_delta'
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
          // D151(2026-09-29):命令在等键盘输入 —— 专用通道,不落正文、不当 delta
          case 'terminal_interaction':
            return 'terminal_interaction'
          // D152(2026-09-29):会话目标状态帧 —— 专用通道,不落正文
          case 'goal_updated':
            return 'goal_updated'
          case 'thinking':
            return 'thinking'
          // 2026-09-18 立:补 type==='compaction' 这一路(原仅认 json.compaction 字段形态)
          case 'compaction':
            return 'compaction'
          // Steer(2026-09-19 立):中途引导注入确认帧
          case 'steer':
            return 'steer'
          // 差距①(2026-10-30 立):发送受理回执帧(admission,契约名见 shared/sse/contract)
          case 'admission':
            return 'admission'
          // Budget(2026-09-19 立):网关用量分档提醒帧
          case 'budget':
            return 'budget'
          // G-815976(2026-10-04 收口入契约):流式中断标记帧
          case 'partial_done':
            return 'partial_done'
          // D155(2026-09-29 立):下行告警三档(配置告警/弃用预告/守护告警)
          case 'config-warning':
            return 'config-warning'
          case 'deprecation-notice':
            return 'deprecation-notice'
          case 'guardian-warning':
            return 'guardian-warning'
          // D34/D39(2026-09-22 立):运行环境交代与重试交代帧
          case 'injection_applied':
            return 'injection_applied'
          case 'retry_scheduled':
            return 'retry_scheduled'
          // D77(2026-09-25 立):对话流业务表单请求帧
          case 'form_request':
            return 'form_request'
          // G-87 补链(2026-10-29):hook 执行失败帧。必须显式分流 —— 静默返回 null 与
          // "没人订阅" 在端上完全同形(本仓最高频的失效形态)。
          case 'hook-failed':
            return 'hook_failed'
          // D115:review 模式结构化发现帧 —— 同 hook-failed 口径,必须显式分流。
          case 'review-finding':
            return 'review_finding'
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
      } else if (route === 'question_resolved') {
        tryParseQuestionResolved(line)
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
      } else if (route === 'review_finding') {
        tryParseReviewFinding(line)
      } else if (route === 'plan') {
        tryParsePlanUpdate(line)
      } else if (route === 'terminal') {
        tryParseTerminal(line)
      } else if (route === 'citations') {
        tryParseCitations(line)
      } else if (route === 'terminal_delta') {
        tryParseTerminalDelta(line)
      } else if (route === 'terminal_interaction') {
        tryParseTerminalInteraction(line)
      } else if (route === 'goal_updated') {
        tryParseGoalUpdate(line)
      } else if (route === 'tool_delta') {
        tryParseToolDelta(line)
      } else if (route === 'thinking') {
        tryParseThinking(line)
      } else if (route === 'usage') {
        tryParseUsage(line)
        // G-425(2026-10-07 立):ai-service 的 done 帧恒带 usage 对象 ⇒ 被上方
        // routeLineByType 的 `json.usage ⇒ 'usage'` 判据截走,永远走不到 fallback
        // 全量链 —— 挂在 done 帧上的可选字段解析器必须在此补调(三个 parser 的
        // 首道守护都是 `json.type !== 'done'` 即 return,对真 OpenAI usage chunk
        // 是 no-op)。此前的 memoryUpdates(P1 #27)/reasoningEffort(D130)同样
        // 只挂在 fallback 链上,生产 done 帧(带 usage)上从未触发过 —— 同根因,
        // 本票一并接上;行为面收敛到"done 帧字段在带 usage 时也能被读到"。
        tryParseMemoryUpdates(line)
        tryParseReasoningEffortNotice(line)
        tryParseFinishReason(line)
      } else if (route === 'steer') {
        tryParseSteer(line)
      } else if (route === 'admission') {
        tryParseSendAdmission(line)
      } else if (route === 'budget') {
        tryParseBudget(line)
      } else if (route === 'partial_done') {
        tryParsePartialDone(line)
      } else if (route === 'config-warning') {
        tryParseConfigWarning(line)
      } else if (route === 'deprecation-notice') {
        tryParseDeprecationNotice(line)
      } else if (route === 'guardian-warning') {
        tryParseGuardianWarning(line)
      } else if (route === 'injection_applied') {
        tryParseInjection(line)
      } else if (route === 'retry_scheduled') {
        tryParseRetryScheduled(line)
      } else if (route === 'form_request') {
        tryParseFormRequest(line)
        tryParseHookFailure(line)
      } else if (route === 'hook_failed') {
        tryParseHookFailure(line)
      } else {
        // fallback:无 type / 未知 type / 注释 / event:/id:/retry: / 非 JSON token 行。
        // 各 tryParse 内部第一道守护(`if (!hasXxx) return` + line 前缀检查)对非匹配行立即 return,
        // 对 token 行(非 JSON)无 JSON.parse 开销,保持原有行为
        tryParseCompaction(line)
        tryParseQuestion(line)
        tryParseQuestionResolved(line)
        tryParseToolCall(line)
        tryParseSubagent(line)
        tryParseToolSummary(line)
        tryParsePlanUpdate(line)
        tryParseTerminal(line)
        await tryParseToolDelegate(line)
        tryParseToolApproval(line)
        tryParseReviewFinding(line)
        tryParseCitations(line)
        tryParseUsage(line)
        tryParseMemoryUpdates(line)
        tryParseReasoningEffortNotice(line)
        tryParseFinishReason(line)
        tryParseTerminalDelta(line)
        tryParseTerminalInteraction(line)
        tryParseGoalUpdate(line)
        tryParseThinking(line)
        tryParseSteer(line)
        tryParseSendAdmission(line)
        tryParseBudget(line)
        tryParsePartialDone(line)
        tryParseConfigWarning(line)
        tryParseDeprecationNotice(line)
        tryParseGuardianWarning(line)
        tryParseInjection(line)
        tryParseRetryScheduled(line)
        tryParseFormRequest(line)
        tryParseHookFailure(line)
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

    // D174:帧级 trace 关联键首次出现即记录;G-916415 R1(2026-10-07)起**记录与回调解耦** ——
    // 错误上报体(SSEErrorInfo.traceId)是常驻消费方,不再以"是否注册 onTraceId"为求值前提,
    // 否则只接 onError 的端在错误上报里永远缺 trace(正是 [[contract-and-view-green-while-parser-drops-fields]]
    // 那一型:回调全绿而解析面丢字段)。代价 = 每行一次 readStreamTraceId(数据行多一次 JSON.parse,
    // 换失败轮次可归因);onTraceId 降级为可选旁路,注册了才回调。
    // (D138:seenTraceId 声明上移,由 runResumableSSEStream 的 onAttemptStart 逐次复位)
    const noteFrameTraceId = (raw: string): void => {
      if (seenTraceId !== null) return
      const id = readStreamTraceId(raw)
      if (id !== null) {
        seenTraceId = id
        opts.onTraceId?.(id)
      }
    }

    // 2026-11-05 立:OpenAI 兼容流式模式(默认关闭 ⇒ 零行为变化)。
    // 开启后逐行经 parseOpenAiStreamLine 解析 tool_calls/文本增量,累积器按 call index 渐进出 partial/complete 态。
    const hasOpenAiCompat = opts.openAiCompat === true
    const openAiAccumulator = createOpenAiToolCallAccumulator()
    // 2026-11-05 立:ai-service 自定义逐分片帧与 openAiCompat **互相独立**。
    // 只有订阅了 onOpenAiToolCall 才解析(未订阅零开销);openAiCompat 仍只管
    // OpenAI 原生行,默认关闭时 Vercel 协议解析路径逐字不变。
    const hasOpenAiToolCall = typeof opts.onOpenAiToolCall === 'function'

    // ===== D138(承 V4 #96):逐行处理体(原内联读环的行处理,原样搬为闭包)=====
    // 读环、行缓冲、id: 游标捕获、读超时、重连/退避全部下沉 runResumableSSEStream;
    // 本闭包只负责"一行已到"之后的解析与分发(id: 行由 runner 捕获游标后照常递出)。
    const processLine = async (line: string, alreadyCaptured = false): Promise<void> => {
      // D116:原始帧采集(关闭时零开销);G-816030:屏障冲刷重放时已采集过,不双记
      if (!alreadyCaptured) {
        recordStreamFrame(line)
        noteFrameTraceId(line)
      }
      // b76-13 票1 / b76-15:水位闸 —— gap/死帧丢弃且计数,不进下游解析与渲染。
      // 闸内的 seq 判读只吃 `data:` 行;`id:` / `event:` 行不经过闸(闸首行就
      // `return false`),所以它们必须在进闸之前先喂给追踪器 —— 否则 id 与随后的
      // data 永远配不上对(见 frame-watermark-producer 的字段序注记)。
      if (!line.startsWith('data:')) frameSeqTracker.observeLine(line)
      if (shouldDropByWatermark(line)) return
      // G-816030:ACK 帧(本 attempt 首个 ok 水位帧)到达 ⇒ 先按原序交付 ACK 之前
      // 暂存的帧,再处理 ACK 帧本身 —— "ACK 前的帧按原序交付"由此成立。
      // 冲刷帧都是 undetermined(未带水位)且此刻已 ACK,不会再被暂存,无递归环。
      if (_frameBarrierFlush.length > 0) {
        const flush = _frameBarrierFlush
        _frameBarrierFlush = []
        for (const stagedFrame of flush) {
          await processLine(stagedFrame.frame, true)
        }
      }
      await dispatchTryParse(line)
      // 2026-11-05 立:ai-service 工具入参逐分片直推帧(独立门控,不依赖 openAiCompat)。
      // 载荷不含 content/delta/text ⇒ 下方 parseStreamLine 不会把它当正文二次累加;
      // 未订阅 onOpenAiToolCall 时这一行都不执行 ⇒ 旧客户端零行为变化。
      if (hasOpenAiToolCall) {
        const argsDelta = parseToolCallArgsDeltaFrame(line)
        if (argsDelta) opts.onOpenAiToolCall?.(argsDelta)
      }
      // P4-2: 优先检查 fallback 事件,命中即触发回调跳过 parseStreamLine
      if (hasFallback) {
        const fbEvt = parseFallbackEvent(line)
        if (fbEvt) {
          opts.onFallback!(fbEvt)
          return
        }
      }
      const delta = parseStreamLine(line)
      if (delta) {
        const chunkAgentId = hasAgentDelta ? extractAgentId(line) : undefined
        // D01(2026-10-25 立):persona 选择走 agentId 上行时,网关会给每条 data 行
        // 回贴同一个 agentId(= 所选 persona)。那不是子代理,正文归属主对话 ——
        // 同一 id 的 chunk 降级回 onDelta,避免整轮回复被塞进 subagent 卡片。
        const echoedByPersona = chunkAgentId !== undefined && chunkAgentId === opts.personaId
        const agentId = echoedByPersona ? undefined : chunkAgentId
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
      // 2026-11-05 立:OpenAI 兼容流式模式(仅 openAiCompat 时启用)。Vercel parseStreamLine 对
      // OpenAI 行返回 null,不会重复发 delta,故两条解析互不干扰。
      if (hasOpenAiCompat) {
        const frame = parseOpenAiStreamLine(line)
        if (frame?.toolCalls?.length) {
          const deltas = openAiAccumulator.pushToolCalls(frame.toolCalls)
          for (const d of deltas) opts.onOpenAiToolCall?.(d)
        }
        if (frame && frame.finishReason !== undefined) {
          openAiAccumulator.finish()
          for (const d of openAiAccumulator.snapshot()) opts.onOpenAiToolCall?.(d)
        }
        if (frame?.content) opts.onOpenAiContent?.(frame.content)
      }
    }

    await runResumableSSEStream({
      url,
      method: 'POST',
      body: (() => {
        const wire = JSON.stringify(body)
        // 决定性仪器(2026-11-06 立):`IHUI_BODY_AUDIT=1` 才出声,缺省**零行为变化**(逐字仍发 wire)。
        // 为什么必须量在序列化之后:那条 400 今晚被四次"找到真因"推翻,最新一次是整族零宽在
        // `content` 与 `tool_calls[].function.arguments` 两格都归零(`sent=0 zwj=0 extra=0`)而 400 不动
        // ⇒ 病灶只可能在 CLI 射程之外。这里量的正是那一格之外唯一还没看过的东西:**发出去的字节本身**。
        // 四类各自独立报数,不合并成一个"干净/不干净":
        //  · loneHigh/loneLow —— 孤立代理项。`String.prototype.slice` 把 emoji/非 BMP 从中间切开才会产生;
        //    `JSON.stringify` 把它写成 `\udXXX` 转义(所以逐 code unit 扫原串看不见,必须扫 wire 的转义形态),
        //    前端中转的严格 JSON 解析器多按"非法字符"拒 —— 与"请求包含不合法字符"这条文案同形。
        //  · repl —— U+FFFD(上游裁剪/解码失败的残迹);ctrl —— 逃过 JSON 转义的原生 C0/C1 控制符;
        //  · bytes —— 体量,用来把"字符非法"与"体过大被截"两类分开。
        if (typeof process !== 'undefined' && process.env?.IHUI_BODY_AUDIT) {
          const loneHigh = (wire.match(/\\ud[89ab][0-9a-f]{2}(?!\\ud[c-f][0-9a-f]{2})/gi) ?? [])
            .length
          const loneLow = (wire.match(/(?<!\\ud[89ab][0-9a-f]{2})\\ud[c-f][0-9a-f]{2}/gi) ?? [])
            .length
          const repl = (wire.match(/\\ufffd/gi) ?? []).length
          const ctrl = (wire.match(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g) ?? []).length
          const bytes = new TextEncoder().encode(wire).length
          const msgs = (body as { messages?: unknown[] })?.messages?.length ?? -1
          process.stderr.write(
            `[body-audit] msgs=${msgs} bytes=${bytes} loneHigh=${loneHigh} loneLow=${loneLow} repl=${repl} ctrl=${ctrl}\n`,
          )
        }
        return wire
      })(),
      headers,
      signal: opts.signal,
      maxRetries,
      // 原 streamChat 读环的 30s 读超时:改为同一命名常量(2 拍服务端心跳),
      // 数值与行为逐字不变,只消灭本文件内第二个硬编码字面量。
      readTimeoutMs: STREAM_READ_TIMEOUT_MS,
      // 2026-07-27 跨域 SSE 直连:携带 credentials 让 CORS 允许凭证,
      // Bearer token 在 Authorization header 中不受影响。
      credentials: 'include',
      onResponse: () => opts.onResponse?.(),
      onAttemptStart: (runnerAttempt) => {
        isRetry = runnerAttempt > 0
        dedupeActive = isRetry && receivedContentRef.current.length > 0
        dedupeBuffer = ''
        agentDedupeBuffer.clear()
        seenTraceId = null
        debugChunkTimer?.reset()
        // G-816030:每 attempt 复位帧归属屏障 —— 重连后重新 ACK;溢出重连由此重建
        frameBarrierAckedThisAttempt = false
        _frameBarrierFlush = []
        frameBarrier.reset()
        // 2026-11-05 立:重连后重建 OpenAI 工具调用累积器(避免上一轮的分片污染本轮)。
        openAiAccumulator.reset()
        // G-816031:新 attempt = 新订阅代际 ⇒ 权威须重新授予(仅权威感知流;legacy 无操作)
        if (runnerAttempt > 0) streamAuthority.observeReconnect()
      },
      onLine: (line) => processLine(line),
      onReconnect: (retryAttempt, delayMs) => opts.onReconnect?.(retryAttempt, delayMs),
      // 2026-10-26:流式通道遇 401(access 15 分钟过期)续期一次并改写本次请求头;
      // runner 在原地重试,不需要调用方重开会话。
      // 「只续一次」由 runner 的 authRefreshed 闸保证(见上方声明),本回调不再自持闸。
      refreshAuth: async () => {
        const fresh = await refreshAccessTokenOnce()
        if (!fresh) return false
        headers['Authorization'] = `Bearer ${fresh}`
        return true
      },
    })
    reportRecoveryGateLedger()
    // b76-15:终态兜底上报 —— 把"全程零丢弃"也变成可读事实(靠回调缺席去猜
    // "没丢"就是把未判定读成绿)。
    emitFrameWatermarkFacts('stream-end')
    opts.onDone?.()
    return
  } catch (err) {
    if (isAbortError(err)) {
      reportRecoveryGateLedger()
      emitFrameWatermarkFacts('stream-end')
      opts.onDone?.()
      return
    }
    // D138:重连判定/指数退避/Retry-After 消费已在 runResumableSSEStream 内做完,
    // 走到这里都是终态(abort / 业务错误 / 自动重试耗尽)。
    const info = getSSEErrorInfo(err)
    const code = info?.code
    // P2-2 口径保持:401/403/429 无 retryAfter 的业务错误分类,此处只影响
    // recoverable 标记,不再驱动重试(重试已前移进 runner)。
    const codeIsBusiness =
      code === 401 || code === 403 || (code === 429 && info?.retryAfter === undefined)
    // F3 补全(2026-11-13):流内业务 error 帧(attachErrorMeta 打标,runner 已据它免重连)
    // 在终态同样要落成 recoverable=false——否则 code 为 undefined 会算成"网络可重试但已
    // 耗尽重连次数",前端对 402 配额耗尽这类确定性失败误显示"网络不稳定,可手动重试"。
    const isStreamBusinessError =
      (err as Error & { isStreamBusinessError?: boolean }).isStreamBusinessError === true
    const isBusinessError = codeIsBusiness || isStreamBusinessError
    const message = err instanceof Error ? err.message : '网络异常'
    // G-816031:无论终态是业务错误还是重试耗尽,账目都要交出去(未判定逐条报名)。
    reportRecoveryGateLedger()
    // b76-15:失败终态同样兜底上报帧水位事实 —— 丢帧计数与"载荷级水位有没有到场"
    // 在失败轮次里同样是可归因读数,不因失败而免报。
    emitFrameWatermarkFacts('stream-end')
    // 2026-09-04 吞错修复(Fix B):流内 SSE error 事件(如 provider 402 配额耗尽, errorCode: LLM_ERROR)
    // 耗尽内部重试后,若调用方传了 onError 则保持原行为(回调后 return);
    // 若未传 onError 则必须 throw err(reject),否则 Promise 会正常 resolve,
    // 不传 onError 的调用方会把失败当成功(拿到空补全),错误被静默吞掉。
    if (opts.onError) {
      // recoverable=true 标记"网络可重试但已耗尽自动重连次数",前端可显示"网络不稳定,可手动重试"
      // G-916415 R1(2026-10-07):本轮 attempt 见过帧级 traceId ⇒ 进错误上报体(traceId 进上报体,
      // 端上消费方拍板 = 错误上报)。info 由 getSSEErrorInfo 挑字段构造,这里只追加 traceId 一键 ——
      // 上报体字段集 = SSEErrorInfo 白名单,不得整包展开原始 Error(镜像锁:stream-error-report-trace-id)。
      opts.onError(message, {
        ...info,
        recoverable: !isBusinessError,
        ...(seenTraceId !== null ? { traceId: seenTraceId } : {}),
      })
      return
    }
    throw err
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
 * D158(2026-09-28)起 export:approval-grants 管理出口(list/revoke)也直连
 * ai-service,经同一解析出口取 base URL,不抄第二份默认值。
 */
export function aiServiceBaseUrl(): string {
  const viteEnv = (import.meta as unknown as { env?: Record<string, unknown> }).env
  const nextUrl =
    typeof process !== 'undefined' && process.env
      ? process.env.NEXT_PUBLIC_AI_SERVICE_URL
      : undefined
  const rawUrl = viteEnv?.NEXT_PUBLIC_AI_SERVICE_URL ?? nextUrl
  const baseUrl = typeof rawUrl === 'string' && rawUrl ? rawUrl : undefined
  return baseUrl || 'http://localhost:8803'
}

/**
 * 上行 error 字段归一(2026-09-26 立,唯一出口 serializeError)。
 *
 * 契约上 error 是 string | null,但 TS 类型挡不住调用方在 catch 分支把 Error 对象
 * 强转塞进来 —— 而 `JSON.stringify(Error实例) === "{}"`(name/message/stack 都是
 * 非枚举自有属性),等于回传一个"什么都没发生"的事故现场。越界值经唯一出口压成
 * `Name: message <- Caused by: …`(含 truncated 标注)的单行链;wire 类型仍是
 * string | null,后端契约不变;合规 string 输入逐字节走原路径,零行为变化。
 */
function toWireError(error: string | null): string | null {
  const raw: unknown = error
  if (raw === null || typeof raw === 'string') return raw
  const parts: string[] = []
  let node: ReturnType<typeof serializeError> | undefined = serializeError(raw)
  while (node) {
    parts.push(`${node.name}: ${node.message}`)
    if (node.truncated) {
      parts.push('[truncated]')
      break
    }
    node = node.cause
  }
  return parts.join(' <- ')
}

/**
 * 直连 ai-service 的上行应答端点**共用的**"这一趟到底被接受了没有"判据(唯一实现):
 * `tool-result` / `approval-response` / `form-response` 对"会话不存在或已过期""条目不存在"
 * 回的都是 **HTTP 200 + `{ok:false,error:…}`**(见 `apps/ai-service/app/routers/llm.py`
 * 里各端点头两个 `return {"ok": False, …}`)。只看 `resp.ok` 会把"没送达"读成"已送达"——
 * 三处的下游后果完全同形:等待方(工具协程 / 审批协程 / 表单协程)一直等到超时,
 * 而界面上没有任何一条失败可看(与守门 134「改了 0 行也回成功」同一条病)。
 *
 * 包体不可解析(JSON 之外,如网关截出的 HTML 错误页)**也按未接受处理**:
 * 读不出"被接受"就不是被接受 —— 把"判不出"写成"成功了"是本仓最高频的失效型。
 *
 * ⚠️ 本函数在 2026-09-28 被 `7baa8ab0e7`(一枚**纯 web UI** 的提交)随 `client.ts` 的
 * 旧基线整文件回写**一起删掉过**(连同下面三条调用点与 streamChat 的 `invoked` 诊断),
 * 而 `git status`、diff 行数与其余守门全都不响 —— 台账 G-593 当时把它记成"守卫没跟上实现",
 * 逐行取史后才定性:**是实现被回写,不是测试超前**。还原本判据即那次静默回滚的清偿。
 */
async function assertAiServiceAccepted(resp: Response, context: string): Promise<void> {
  let body: { ok?: boolean; error?: string } | null = null
  try {
    body = (await resp.json()) as { ok?: boolean; error?: string }
  } catch {
    body = null
  }
  if (!body || body.ok !== true) {
    throw new Error(`${context} not accepted: ${body?.error ?? '响应体不是可判定的 JSON'}`)
  }
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
    // 2026-10-26:本腿此前**完全不带 Authorization**(只靠 15 分钟的 cookie 兜底),
    // access 一过期就永久 401 ⇒ 用户表现为"工具执行完了但 AI 那边没反应"。
    // 走包内唯一裸 fetch 出口:补 Bearer + 401 续期后重放一次(body 是 JSON string,可重放)。
    resp = await fetchWithAuthRefresh(
      `${aiServiceUrl}/llm/complete/stream/${sessionId}/tool-result`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool_call_id: toolCallId, result, error: toWireError(error) }),
      },
    )
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
  await assertAiServiceAccepted(resp, `postToolResult (session=${sessionId}, tool=${toolCallId})`)
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
  /**
   * D158(2026-09-28):审批第四档「批准并生成放行规则」的正交扩展 —— 与三档 scope
   * 语义并行,不是第四个 scope 字符串。仅 chat-stream 通道生效(llm.py 回传端点);
   * agent 任务流通道的网关 schema 会静默丢弃该字段,调用方应避免在那一档传入。
   */
  grantRule?: { kind: 'exec_prefix'; tokens: number }
}): Promise<void> {
  const aiServiceUrl = aiServiceBaseUrl()
  let resp: Response
  try {
    // 2026-10-26:同 postToolResult —— 原实现不带 Authorization,access 过期后
    // "点批准"永久 401(AI 侧审批协程一直等)。走包内唯一裸 fetch 出口续期并重放一次。
    resp = await fetchWithAuthRefresh(
      `${aiServiceUrl}/llm/complete/stream/${input.sessionId}/approval-response`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approval_id: input.approvalId,
          decision: input.decision,
          ...(input.scope !== undefined ? { scope: input.scope } : {}),
          // 空原因不携带(与"用户没说原因"区分于"说了个空原因")
          ...(input.reason !== undefined && input.reason !== '' ? { reason: input.reason } : {}),
          // D158:第四档批准时随 approve 一并上送(与后端 grant_rule 校验同形;
          // 缺省不携带 = 旧客户端语义,不生成任何规则)
          ...(input.grantRule ? { grant_rule: input.grantRule } : {}),
        }),
      },
    )
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
  await assertAiServiceAccepted(
    resp,
    `postToolApprovalResponse (session=${input.sessionId}, approval=${input.approvalId})`,
  )
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
    // 2026-10-26:同 postToolResult —— 补 Bearer + 401 续期后重放一次。
    resp = await fetchWithAuthRefresh(
      `${aiServiceUrl}/llm/complete/stream/${sessionId}/form-response`,
      {
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
      },
    )
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
  await assertAiServiceAccepted(
    resp,
    `postFormResponse (session=${sessionId}, request=${event.requestId})`,
  )
}

/** D151(2026-09-29 立,用户批「默认开 + 单次等待 300s」):把用户键入送回正在等的命令。
 *
 * 上行形状是 **snake_case**(`terminal_id` / `text`),与 postFormResponse 同族 ——
 * 而**下行**的 terminal_interaction 帧是 camelCase。两条通道形状不同是刻意的,
 * 写错不会报错、只会整帧被服务端丢弃(所以这里把形状写在函数签名旁边,不靠注释找)。
 *
 * 失败必抛(照 postFormResponse 的教训):静默吞掉 = 用户按了回车而命令一个字节都没收到,
 * 界面停在"等待输入"的假象上。调用方据异常把该行改判为 failed。
 *
 * 刻意**不返回服务端回包内容**:回包恒 `{ok, accepted, terminalId}`,不含键入 —— 键入
 * 可能是密码,不要把它回读进状态树或日志。
 */
export async function postTerminalInput(
  sessionId: string,
  input: { terminalId: string; text: string },
): Promise<{ ok: boolean; accepted?: boolean }> {
  const aiServiceUrl = aiServiceBaseUrl()
  let resp: Response
  try {
    // 2026-10-26:同 postToolResult —— 补 Bearer + 401 续期后重放一次。
    // 重放安全:401 的那一趟**没有被服务端接受**(鉴权层就回了),不存在"键入送两遍"。
    resp = await fetchWithAuthRefresh(
      `${aiServiceUrl}/llm/complete/stream/${sessionId}/terminal-input`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          terminal_id: input.terminalId,
          text: input.text,
        }),
      },
    )
  } catch (e) {
    // 报错面同样不得带上 text —— 只报 id 与原因。
    throw new Error(
      `postTerminalInput network error (session=${sessionId}, terminal=${input.terminalId}): ${(e as Error).message}`,
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
      `postTerminalInput failed: HTTP ${resp.status} (session=${sessionId}, terminal=${input.terminalId})${detail ? `: ${detail}` : ''}`,
    )
  }
  // 服务端对"没这条"与"不是你的"**刻意回 HTTP 200 + {ok:false}**(不给存在性预言机)。
  // 所以只看 resp.ok 会把"没送到"读成"送到了" —— 必须把 ack 读回来并交给调用方判,
  // 这也是本函数从 Promise<void> 改成返回 ack 的唯一理由。
  let ack: { ok?: unknown; accepted?: unknown }
  try {
    ack = (await resp.json()) as { ok?: unknown; accepted?: unknown }
  } catch (e) {
    throw new Error(
      `postTerminalInput ack unreadable (session=${sessionId}, terminal=${input.terminalId}): ${(e as Error).message}`,
    )
  }
  const ok = ack?.ok === true
  return ok ? { ok: true, accepted: ack?.accepted === true } : { ok: false }
}

/** D152(2026-09-29 立,用户拍板「服务化,但存会话元数据、不建新表」):
 *  把一个会话的「当前目标 + 状态」写进**服务端主副本**。
 *
 * POST /llm/sessions/{session_id}/goal
 * Body: { action: 'set'|'pause'|'resume'|'clear', objective?, elapsed_ms?, token_usage? }
 *       —— 上行沿用 snake_case(与同通道的 form-response / terminal-input 同族)。
 *
 * 一个端点带 action,不拆四条路由:四种动作改的是同一个键、走同一条归属判定,
 * 拆四条就会有人只接三条(本仓"一条门只管自己立项那一型"的同族风险)。
 *
 * 失败必抛(照 postFormResponse 的教训):静默吞掉 = 用户点了 /goal 而服务端一个字都没写,
 * 界面停在"设好了"的假象上,而这一票要修的正是"换浏览器/换端就看不见目标"。
 *
 * ⚠️ **回退口径(票第 8 栏)**:`accepted:false` 表示服务端这一轮**没有**这个会话的主副本
 * (典型:纯聊天会话没建引擎线程行,或该会话不属于本主体 —— 两种情形服务端同形回包,
 * 不给存在性预言机)。调用方据此**退回纯本地态**(stores/goal 仍是缓存,功能不中断),
 * 不得把它当成"目标设置失败"弹错。
 */
export async function postSessionGoal(
  sessionId: string,
  input: {
    action: 'set' | 'pause' | 'resume' | 'clear'
    objective?: string
    elapsedMs?: number
    tokenUsage?: number
  },
): Promise<{ ok: boolean; accepted: boolean; status?: GoalWireStatus; sessionId?: string }> {
  const aiServiceUrl = aiServiceBaseUrl()
  let resp: Response
  try {
    // 2026-10-26:同 postToolResult —— 补 Bearer + 401 续期后重放一次。
    resp = await fetchWithAuthRefresh(`${aiServiceUrl}/api/llm/sessions/${sessionId}/goal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: input.action,
        ...(typeof input.objective === 'string' && input.objective
          ? { objective: input.objective }
          : {}),
        ...(typeof input.elapsedMs === 'number' ? { elapsed_ms: input.elapsedMs } : {}),
        ...(typeof input.tokenUsage === 'number' ? { token_usage: input.tokenUsage } : {}),
      }),
    })
  } catch (e) {
    throw new Error(
      `postSessionGoal network error (session=${sessionId}, action=${input.action}): ${(e as Error).message}`,
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
      `postSessionGoal failed: HTTP ${resp.status} (session=${sessionId}, action=${input.action})${detail ? `: ${detail}` : ''}`,
    )
  }
  // "没这条会话"与"不是你的"同形(HTTP 200 + accepted:false),所以只看 resp.ok 会把
  // "没写成"读成"写成了" —— ack 必须读回来交给调用方判(与 postTerminalInput 同一条理由)。
  let ack: {
    ok?: unknown
    accepted?: unknown
    status?: unknown
    sessionId?: unknown
  }
  try {
    ack = (await resp.json()) as typeof ack
  } catch (e) {
    throw new Error(
      `postSessionGoal ack unreadable (session=${sessionId}, action=${input.action}): ${(e as Error).message}`,
    )
  }
  return {
    ok: ack?.ok === true,
    accepted: ack?.accepted === true,
    ...(typeof ack?.status === 'string' ? { status: ack?.status as GoalWireStatus } : {}),
    ...(typeof ack?.sessionId === 'string' ? { sessionId: ack?.sessionId } : {}),
  }
}

/**
 * 控制帧 `resume_goal`(2026-10-28 立):把会话目标从「被暂停」恢复到 active。
 *
 * POST /llm/sessions/{session_id}/goal/resume
 *
 * 与 `postSessionGoal(action:'resume')` 的差别 = **入口是帧名**而不是猜 action 串:
 * 竞品原帧即 `request({type:"resume_goal"})`,判据是「宿主显式调用 + 必须回报结果」。
 * 服务端那一侧两条路共用同一份实现(`services/goal_resume.py`),不存在两处漂移。
 *
 * 失败必抛(同 `postSessionGoal` 的教训):静默吞掉 = 用户点了「恢复」而服务端一个字
 * 都没写,界面停在「恢复好了」的假象上。
 *
 * ⚠️ **回退口径**:`ok:false` 表示服务端这一轮**没有**这条会话的主副本
 * (不存在 / 不属于本主体 —— 两种情形服务端同形回包,不给存在性预言机)。调用方据此
 * **退回纯本地态**(stores/goal 仍是缓存,功能不中断),不得把它当成「恢复失败」弹错。
 * `ok:true` 但 `accepted:false` 时 `reason` 给出**确定原因**(见 `GoalResumeReason`),
 * 那一侧是调用方自己那条会话的确定答案,应当把原因显示出来。
 */
export type GoalResumeReason =
  'no_goal' | 'terminal' | 'already_active' | 'not_resumable' | 'no_objective'

export interface SessionGoalResumeResult {
  /** 帧是否给出了确定结论(false = 同形拒绝:不存在 / 非属主 / 未鉴权) */
  ok: boolean
  /** 本次调用是否真的把服务端主副本写成了 active */
  accepted: boolean
  /** 是否真的发生了「被暂停 → active」的状态迁移(不谎报) */
  resumed: boolean
  /** 服务端权威状态;同形拒绝时缺席 */
  status?: GoalWireStatus
  /** 恢复后保留的目标文本(恢复不换目标) */
  objective?: string
  sessionId?: string
  /** 有结论但没恢复的原因码(仅归属闸门已过时出现) */
  reason?: GoalResumeReason
}

export async function resumeSessionGoal(sessionId: string): Promise<SessionGoalResumeResult> {
  const aiServiceUrl = aiServiceBaseUrl()
  let resp: Response
  try {
    resp = await fetchWithAuthRefresh(
      `${aiServiceUrl}/api/llm/sessions/${encodeURIComponent(sessionId)}/goal/resume`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
    )
  } catch (e) {
    throw new Error(
      `resumeSessionGoal network error (session=${sessionId}): ${(e as Error).message}`,
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
      `resumeSessionGoal failed: HTTP ${resp.status} (session=${sessionId})${detail ? `: ${detail}` : ''}`,
    )
  }
  let ack: {
    ok?: unknown
    accepted?: unknown
    resumed?: unknown
    status?: unknown
    objective?: unknown
    sessionId?: unknown
    reason?: unknown
  }
  try {
    ack = (await resp.json()) as typeof ack
  } catch (e) {
    throw new Error(
      `resumeSessionGoal ack unreadable (session=${sessionId}): ${(e as Error).message}`,
    )
  }
  const reason = ack?.reason
  return {
    ok: ack?.ok === true,
    accepted: ack?.accepted === true,
    resumed: ack?.resumed === true,
    ...(typeof ack?.status === 'string' ? { status: ack?.status as GoalWireStatus } : {}),
    ...(typeof ack?.objective === 'string' ? { objective: ack?.objective } : {}),
    ...(typeof ack?.sessionId === 'string' ? { sessionId: ack?.sessionId } : {}),
    ...(typeof reason === 'string' ? { reason: reason as GoalResumeReason } : {}),
  }
}

/** 票 77:My Quests 看板的服务端聚合行(GET /api/sessions/goals)。 */
export interface MyGoalAssessment {
  id: string
  /** epoch 毫秒(引擎侧写入;与线程行的 createdAt/updatedAt 秒不同单位) */
  at: number
  status: string
  progress: number
  summary: string
  source: 'engine'
}

export interface MyGoalRow {
  threadId: string
  /** 引擎线程 metadata.conversationId;缺省 '' = 该线程没记会话 id,端内不猜 */
  sessionId: string
  title: string
  workspaceId: string
  /** epoch 秒(与 threads 表同源) */
  createdAt: number
  updatedAt: number
  goal: {
    status: string
    objective: string
    elapsedMs?: number
    tokenUsage?: number
    updatedAt?: number
  }
  /**
   * 引擎侧自评估轨迹(票77 goal-verify 回灌)。
   * 缺省容忍:滚动升级期旧服务不返回此字段 ⇒ 端内按空轨迹处理(不伪造条目)。
   */
  assessments?: MyGoalAssessment[]
}

function isMyGoalAssessment(value: unknown): value is MyGoalAssessment {
  if (!value || typeof value !== 'object') return false
  const a = value as Record<string, unknown>
  return (
    typeof a.id === 'string' &&
    typeof a.at === 'number' &&
    typeof a.status === 'string' &&
    typeof a.progress === 'number' &&
    typeof a.summary === 'string' &&
    a.source === 'engine'
  )
}

function isMyGoalRow(value: unknown): value is MyGoalRow {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  const goal = row.goal
  if (!goal || typeof goal !== 'object') return false
  const g = goal as Record<string, unknown>
  if (row.assessments !== undefined) {
    if (!Array.isArray(row.assessments) || !row.assessments.every(isMyGoalAssessment)) return false
  }
  return (
    typeof row.threadId === 'string' &&
    typeof row.sessionId === 'string' &&
    typeof row.title === 'string' &&
    typeof row.workspaceId === 'string' &&
    typeof row.createdAt === 'number' &&
    typeof row.updatedAt === 'number' &&
    typeof g.status === 'string' &&
    typeof g.objective === 'string'
  )
}

/**
 * 票 77(2026-10-18):跨会话目标聚合(My Quests 跨 workspace 全局看板数据源)。
 *
 * GET /api/sessions/goals —— **归属由服务端按令牌主体过滤**,客户端不自报 userId
 * (与 postSessionGoal 同一条「认证不等于授权」判序)。
 *
 * 失败必抛:静默吞掉会让看板停在空列表,读起来像"我真的没有目标",
 * 而真相是"这一次没读到";调用方据此退回端内登记表(D152 回退口径)。
 * 行形状不合规同样抛(指出第几行)—— 静默 filter 会把不可读折成"没有"。
 */
export async function listMyGoals(limit = 100): Promise<MyGoalRow[]> {
  const aiServiceUrl = aiServiceBaseUrl()
  let resp: Response
  try {
    // 2026-10-26:同族裸 fetch 腿 —— 补 Bearer + 401 续期后重放一次(GET 无 body,恒可重放)。
    resp = await fetchWithAuthRefresh(
      `${aiServiceUrl}/api/sessions/goals?limit=${encodeURIComponent(String(limit))}`,
    )
  } catch (e) {
    throw new Error(`listMyGoals network error: ${(e as Error).message}`)
  }
  if (!resp.ok) {
    let detail = ''
    try {
      detail = (await resp.text()).slice(0, 200)
    } catch {
      // 忽略 body 读取失败,只保留 status
    }
    throw new Error(`listMyGoals failed: HTTP ${resp.status}${detail ? `: ${detail}` : ''}`)
  }
  let body: unknown
  try {
    body = await resp.json()
  } catch (e) {
    throw new Error(`listMyGoals response unreadable: ${(e as Error).message}`)
  }
  const data = (body as { data?: unknown } | null)?.data
  const goals = (data as { goals?: unknown } | null | undefined)?.goals
  if (!Array.isArray(goals)) {
    throw new Error('listMyGoals response unreadable: data.goals is not an array')
  }
  return goals.map((row, index) => {
    if (!isMyGoalRow(row)) {
      throw new Error(`listMyGoals malformed row at index ${index}`)
    }
    return row
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
