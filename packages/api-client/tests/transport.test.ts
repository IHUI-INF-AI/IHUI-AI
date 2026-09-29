// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  setTransport,
  getTransport,
  type Transport,
  type TransportInit,
  type TransportResponse,
} from '../src/transport.js'

describe('Transport', () => {
  afterEach(() => {
    // 恢复默认 transport
    setTransport(undefined as unknown as Transport)
  })

  /**
   * 「注入后返回同一实例」这条断言在 D147(traceparent 贯通,`setTransport` 会把注入的
   * transport 包一层)之后就不再是契约 —— 但**把它改回 `toBe(custom)` 等于删掉链路追踪**:
   * `client.ts` 有 4 处是 `getTransport()(url, init)`,取到未包的那一份就静默不发 traceparent
   * (账面全绿、跨端串不上)。所以这里判的是可观察行为,而不是对象身份:
   *  ① 注入确实生效(请求穿透到注入的那一份);
   *  ② 穿透时确实带上了装配头(D147 的那一层还在);
   *  ③ `getTransport()` 返回的**不是**裸实例(反向锁:谁把包装删掉,这条立刻红)。
   */
  it('setTransport 注入后:请求穿透到注入的 transport,且外层仍套着 traceparent 装配', async () => {
    const seen: Array<{ url: string; headers: Record<string, string> }> = []
    const custom: Transport = vi.fn(async (url: string, init: TransportInit) => {
      seen.push({ url, headers: (init.headers ?? {}) as Record<string, string> })
      return { ok: true, status: 200, text: async () => '{}', json: async () => ({}) }
    }) as unknown as Transport
    setTransport(custom)
    const active = getTransport()
    expect(active).not.toBe(custom) // ③ 包装层还在 = D147 没被偷偷摘掉
    await active('/api/ping', { method: 'GET' })
    expect(seen).toHaveLength(1) // ① 穿透到注入的那一份
    expect(seen[0].url).toBe('/api/ping')
    expect(seen[0].headers.traceparent).toMatch(
      /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/, // ② W3C 形态,不是"有个键就算过"
    )
  })

  it('getTransport 返回的是"当前生效"的那一份:换注入即换目标', async () => {
    const first: Transport = vi.fn(async () => ({ ok: true, status: 200 }) as unknown as TransportResponse)
    const second: Transport = vi.fn(async () => ({ ok: true, status: 204 }) as unknown as TransportResponse)
    setTransport(first)
    await getTransport()('/a', {})
    setTransport(second)
    const r = await getTransport()('/b', {})
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
    expect(r.status).toBe(204) // 生效的是新注入的那一份,旧的不再被调用
  })

  it('TransportResponse 类型定义包含必要方法', () => {
    const response: TransportResponse = {
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => 'hello',
      json: async () => ({ message: 'hello' }),
    }
    expect(response.ok).toBe(true)
    expect(response.status).toBe(200)
  })

  it('TransportInit 类型定义支持 method/headers/body/signal', () => {
    const controller = new AbortController()
    const init: TransportInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"test":true}',
      signal: controller.signal,
      credentials: 'include',
    }
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"test":true}')
    expect(init.credentials).toBe('include')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
