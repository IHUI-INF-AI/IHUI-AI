/**
 * 可插拔 HTTP 传输层 — 抽象 native fetch,支持非浏览器环境(微信小程序 Taro.request 等)。
 *
 * 设计:
 * - TransportResponse 接口兼容 fetch Response 的子集(ok / status / headers.get / text / json)
 * - 默认 transport 包装 native fetch(web/desktop/extension/mobile-rn 直接用)
 * - 小程序环境通过 setTransport 注入 Taro.request 适配器
 * - streamChat / SSE 端点仍用 native fetch(需要 ReadableStream,小程序保持本地实现)
 */

/** 传输响应 — 兼容 fetch Response 子集 */
export interface TransportResponse {
  ok: boolean
  status: number
  headers: { get(name: string): string | null }
  text(): Promise<string>
  json(): Promise<unknown>
}

/** 传输初始化参数 — RequestInit 的跨平台子集 */
export interface TransportInit {
  method?: string
  headers?: Record<string, string>
  body?: string
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
  const response = await fetch(url, {
    ...init,
    credentials: init.credentials ?? 'include',
  })
  return {
    ok: response.ok,
    status: response.status,
    headers: response.headers,
    text: () => response.text(),
    json: () => response.json(),
  }
}

let transport: Transport = defaultTransport

/** 注入自定义 transport(如 Taro.request 适配器) */
export function setTransport(t: Transport): void {
  transport = t
}

/** 读取当前 transport(测试/诊断用) */
export function getTransport(): Transport {
  return transport
}
