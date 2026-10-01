// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 可插拔流式(SSE)HTTP 传输层 — 抽象 native fetch 的流式读取,支持非浏览器环境
 * (微信小程序 Taro.request enableChunked 等)。
 *
 * D138(承 V4 #96):streamChat 此前直用 native fetch,小程序端因此被迫在
 * apps/miniapp-taro/src/lib/sse.ts 自养第二份"重连/退避/读超时/断点续传"实现。
 * 本文件把**流式传输**抽成与 transport.ts 同形的注入口:
 * - 默认实现包装 native fetch(web/desktop/extension/mobile-rn 直接用;
 *   对旧的 streamChat 内联 fetch 逐字同参,缺省路径行为零变化)
 * - 小程序环境通过 setStreamTransport 注入 Taro.request enableChunked 适配器
 * - 重连/退避/读超时/续传游标逻辑只住在 client.ts 的 runResumableSSEStream,
 *   任何一端都不再自写第二份
 */

/** 流式读取器 — fetch Response.body.getReader() 返回值的跨平台子集 */
export interface StreamBodyReader {
  read(): Promise<{ done: boolean; value?: Uint8Array }>
  cancel(): Promise<void>
}

/** 流式传输初始化参数 — RequestInit 的跨平台子集 */
export interface StreamTransportInit {
  method?: string
  body?: string | null
  headers?: Record<string, string>
  signal?: AbortSignal
  /**
   * fetch credentials 模式(语义同 transport.ts TransportInit.credentials)。
   * **刻意不设默认值**:streamChat 显式传 'include'(跨端口 CORS 带凭证),
   * 小程序薄壳不传 ⇒ native fetch 默认 'same-origin',与小程序旧自写层的
   * H5 fetch 行为逐字一致。
   */
  credentials?: 'include' | 'omit' | 'same-origin'
}

/** 流式传输响应 — 兼容 fetch Response 的流式子集 */
export interface StreamTransportResponse {
  ok: boolean
  status: number
  headers: { get(name: string): string | null }
  text(): Promise<string>
  /** 流式响应体;非流式响应可为 null */
  body: { getReader(): StreamBodyReader } | null
}

/** 流式传输函数类型 — 替代 streamChat 内联的 native fetch */
export type StreamTransport = (
  url: string,
  init: StreamTransportInit,
) => Promise<StreamTransportResponse>

/**
 * 默认流式 transport 工厂:包装 native fetch(web/desktop/extension/mobile-rn)。
 * 小程序 H5 构建也用它(enableChunked 不可用,旧自写层同款降级)。
 */
export function createFetchStreamTransport(): StreamTransport {
  return async (url, init) => {
    const response = await fetch(url, {
      method: init.method,
      headers: init.headers,
      body: init.body ?? undefined,
      signal: init.signal,
      ...(init.credentials !== undefined ? { credentials: init.credentials } : {}),
    })
    const body = response.body
    return {
      ok: response.ok,
      status: response.status,
      headers: response.headers,
      text: () => response.text(),
      body: body ? { getReader: () => body.getReader() } : null,
    }
  }
}

const defaultStreamTransport: StreamTransport = createFetchStreamTransport()

let streamTransport: StreamTransport = defaultStreamTransport

/** 注入自定义流式 transport(如 Taro.request enableChunked 适配器) */
export function setStreamTransport(t: StreamTransport): void {
  streamTransport = t
}

/** 读取当前流式 transport(测试/诊断用) */
export function getStreamTransport(): StreamTransport {
  return streamTransport
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
