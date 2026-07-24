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
}

/** 传输函数类型 — 替代 native fetch */
export type Transport = (url: string, init: TransportInit) => Promise<TransportResponse>

/** 默认 transport:包装 native fetch(web/desktop/extension/mobile-rn) */
const defaultTransport: Transport = async (url, init) => {
  const response = await fetch(url, init)
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
