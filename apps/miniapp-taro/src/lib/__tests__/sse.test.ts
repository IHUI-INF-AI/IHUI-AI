// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * SSE 流式传输单测(#12 小程序 AI 增强,2026-09-15):
 * ① SSEStreamParser:半包续接 / 粘包 / flush / Last-Event-ID 游标
 * ② streamSSE H5 通道:事件分发 / 401 业务错误不重试
 * 测试数据使用后端真实 data-stream 协议(`data: 0:"..."` / `data: [DONE]`)。
 * Taro 端原生通道不在 node 环境覆盖范围(需真机),此处以 H5 通道验证传输契约。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetEnv } = vi.hoisted(() => ({ mockGetEnv: vi.fn(() => 'WEB') }))

vi.mock('@tarojs/taro', () => ({
  default: {
    getEnv: mockGetEnv,
    ENV_TYPE: { WEB: 'WEB' },
    request: vi.fn(),
  },
  getEnv: mockGetEnv,
  ENV_TYPE: { WEB: 'WEB' },
  request: vi.fn(),
}))

vi.mock('@/utils/auth', () => ({
  getToken: () => 'test-token',
}))

import { SSEStreamParser, streamSSE } from '../sse'

describe('SSEStreamParser', () => {
  it('完整单帧一次解出(chunk 事件)', () => {
    const p = new SSEStreamParser()
    const events = p.push('data: 0:"你"\n\n')
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: 'chunk', content: '你' })
  })

  it('半包:一行被切在中间,下一 push 续接解析', () => {
    const p = new SSEStreamParser()
    expect(p.push('data: 0:"你')).toHaveLength(0)
    const events = p.push('好"\n\n')
    expect(events).toHaveLength(1)
  })

  it('粘包:多个事件挤在一个 chunk 一次全解', () => {
    const p = new SSEStreamParser()
    const events = p.push('data: 0:"a"\n\ndata: 0:"b"\n\ndata: 0:"c"\n\n')
    expect(events).toHaveLength(3)
  })

  it('flush:流结束时收割无尾随空行的残余事件', () => {
    const p = new SSEStreamParser()
    expect(p.push('data: 0:"x"')).toHaveLength(0)
    expect(p.flush()).toHaveLength(1)
    expect(p.flush()).toHaveLength(0)
  })

  it('Last-Event-ID 游标:捕获 / 重置', () => {
    const p = new SSEStreamParser()
    p.push('id: evt-42\ndata: 0:"x"\n\n')
    expect(p.getLastEventId()).toBe('evt-42')
    p.reset()
    expect(p.getLastEventId()).toBeUndefined()
  })

  it('空输入直接返回空数组', () => {
    const p = new SSEStreamParser()
    expect(p.push('')).toHaveLength(0)
  })
})

/** 构造 H5 ReadableStream 形态的 fetch 响应 */
function sseResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c))
      controller.close()
    },
  })
  return new Response(stream, { status, headers: { 'content-type': 'text/event-stream' } })
}

describe('streamSSE(H5 通道)', () => {
  beforeEach(() => {
    mockGetEnv.mockReturnValue('WEB')
  })

  it('逐 chunk 分发 SSE 事件到 onEvent', async () => {
    const events: unknown[] = []
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      sseResponse(['data: 0:"你"\n\n', 'data: 0:"好"\n\ndata: [DONE]\n\n']),
    )
    await streamSSE({
      url: '/api/ai/chat/stream',
      body: { message: 'hi' },
      onEvent: (evt) => events.push(evt),
    })
    expect(events.length).toBeGreaterThanOrEqual(3)
    vi.restoreAllMocks()
  })

  it('401 业务错误不重试(fetch 仅调用一次)', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('unauthorized', { status: 401 }))
    await expect(
      streamSSE({ url: '/api/ai/chat/stream', body: {}, onEvent: () => {} }),
    ).rejects.toThrow()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    vi.restoreAllMocks()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
