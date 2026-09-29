// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 可插拔 HTTP 传输层 — 抽象 native fetch,支持非浏览器环境(微信小程序 Taro.request 等)。
 *
 * 设计:
 * - TransportResponse 接口兼容 fetch Response 的子集(ok / status / headers.get / text / json)
 * - 默认 transport 包装 native fetch(web/desktop/extension/mobile-rn 直接用)
 * - 小程序环境通过 setTransport 注入 Taro.request 适配器
 * - streamChat / SSE 端点仍用 native fetch(需要 ReadableStream,小程序保持本地实现)
 */

// D147(2026-09-28):traceparent 的编解码住在 @ihui/types(跨端契约包,零平台依赖),
// 不在这里重复实现格式 —— 两处算同一件事必漂移,本仓记过最多次的那一型。
// api-client 的 dependencies 是空的,而 @ihui/types 已是它的运行时依赖
// (见 client.ts 的 GOAL_WIRE_STATUSES),所以这里取用不需要新增 workspace 依赖。
import { readTraceIdFromResponse, withTraceparentHeader } from '@ihui/types'

/** 传输响应 — 兼容 fetch Response 子集 */
export interface TransportResponse {
  ok: boolean
  status: number
  headers: { get(name: string): string | null }
  text(): Promise<string>
  json(): Promise<unknown>
  /** blob() 仅 web/desktop/extension 实现,小程序环境用不到(downloadFile 走 native) */
  blob?(): Promise<Blob>
}

/** 传输初始化参数 — RequestInit 的跨平台子集 */
export interface TransportInit {
  method?: string
  body?:
    | ReadableStream<Uint8Array>
    | string
    | Blob
    | FormData
    | URLSearchParams
    | ArrayBuffer
    | DataView<ArrayBuffer>
    | null
  headers?: Record<string, string>
  signal?: AbortSignal
  /**
   * fetch credentials 模式。
   * - web/desktop/extension/mobile-rn:传 'include' 让跨端口 fetch 带 cookie
   *   (localhost 跨端口 sameSite=lax 允许,auth_token cookie 发送到 api 端,csrf 插件命中豁免)
   * - 小程序 Taro.request:通常不需要(同域或不跨域),传 'omit' 或不传
   * 默认 'include'(适配 8801 web -> 8802 api 跨端口场景)。
   *
   * 2026-07-30:用字面量联合替代 DOM `RequestCredentials` 类型,因 packages/api-client
   *   是跨端共享包(被 apps/api 等无 DOM lib 的 Node 端消费),DOM 类型不可见。
   *   apps/web 端 TS 仍可通过字符串字面量赋值给 native fetch 的 RequestCredentials,
   *   运行时行为完全一致。
   */
  credentials?: 'include' | 'omit' | 'same-origin'
}

/** 传输函数类型 — 替代 native fetch */
export type Transport = (url: string, init: TransportInit) => Promise<TransportResponse>

/** 默认 transport:包装 native fetch(web/desktop/extension/mobile-rn) */
const defaultTransport: Transport = async (url, init) => {
  // 2026-07-28 加固:web 端 8801 -> 8802 跨端口 fetch 必须 credentials: 'include',
  // 否则 auth_token cookie 不会发送,api 端 csrf 校验失败返回 403
  // (localStorage token 不走 csrf 流程,但 cookie token 是主路径)
  const { body, ...rest } = init
  const response = await fetch(url, {
    ...rest,
    body: body as RequestInit['body'] | undefined,
    credentials: init.credentials ?? 'include',
  })
  return {
    ok: response.ok,
    status: response.status,
    headers: response.headers,
    text: () => response.text(),
    json: () => response.json(),
    blob: () => response.blob(),
  }
}

// D147:默认 transport 同样过装配 —— 否则 web/desktop/RN 走的是没包装的那一份,
// "端侧生成"只对小程序适配器成立,而那正是本票要串的第一段。
let transport: Transport = withTraceparent(defaultTransport)

/**
 * 注入自定义 transport(如 Taro.request 适配器)。
 *
 * D147(2026-09-28):注入点即 traceparent 的**唯一出站装配点** —— 端生成的
 * trace id 在这里进头,所以任何一端(含小程序适配器)都不可能"忘了带"。
 * 判据是幂等的:调用方已带合法 traceparent ⇒ 原样保留(延续同一条 trace),
 * 缺失或非法才新起一条(`withTraceparentHeader` 内已处理,不在此重复形状判断)。
 */
export function setTransport(t: Transport): void {
  transport = withTraceparent(t)
}

/** 把 traceparent 装配到 init.headers 上(不原地改调用方对象)。 */
function withTraceparent(t: Transport): Transport {
  return async (url, init) => {
    const headers = applyTraceparentToHeaders(init.headers)
    const response = await t(url, { ...init, headers })
    recordTraceIdFromResponse(response.headers)
    return response
  }
}

/**
 * D147(2026-09-29 立):**出站 traceparent 的唯一装配出口**,与 `withTraceparent` 同处。
 *
 * 为什么必须导出而不是让调用方自己 `headers.traceparent = createTraceparent()`:
 * `streamChat()` 这条腿走的是 native fetch(端内注释自述"SSE 端点仍用 native fetch"),
 * 结构上绕过了 transport 装配点 —— 而它恰恰是"一轮对话"的主路径。绕过点若各自实现一份
 * 判据,就会出现"普通请求带编号、流式请求不带"这种两边自洽的分裂(本仓最高频失效型)。
 * 现两腿都调这两个出口,判据只有一份。
 */
export function applyTraceparentToHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> {
  return withTraceparentHeader(headers)
}

/** 记下来自响应的排查编号(拿不到就置 null,不回退成请求侧的值冒充"服务端确认过")。 */
export function recordTraceIdFromResponse(responseHeaders: TransportResponse['headers']): void {
  lastTraceId = readTraceIdFromResponse(responseHeaders)
}

let lastTraceId: string | null = null

/**
 * 最近一次服务端回带的 trace id(排查用)。
 * 当前无界面消费者 —— 这是**如实登记的缺口**,不是"已接完":见交付报告的未做清单。
 */
export function getLastTraceId(): string | null {
  return lastTraceId
}

/** 读取当前 transport(测试/诊断用) */
export function getTransport(): Transport {
  return transport
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
