// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 2026-11-07: Coze SSE 长连接加空闲超时(不是全量 body deadline)。
// 三组判据:停流超时断开并记日志 / 正常流式照常转发 / 上游非 2xx 走固定错误帧。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { FastifyReply } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.COZE_API_KEY = 'test-coze-key'
  // 50ms 让用例快速到达 idle 分支;生产默认 60s
  process.env.COZE_SSE_IDLE_TIMEOUT_MS = '50'
})

import { streamCozeSse } from '../coze.js'

function makeReply() {
  const chunks: string[] = []
  const raw = {
    writeHead: vi.fn(),
    write: vi.fn((s: string) => {
      chunks.push(s)
      return true
    }),
    end: vi.fn(),
  }
  const warn = vi.fn()
  const reply = {
    hijack: vi.fn(),
    status: vi.fn(),
    send: vi.fn(),
    raw,
    request: { log: { warn, info: vi.fn(), error: vi.fn(), debug: vi.fn() } },
  } as unknown as FastifyReply
  return { reply, chunks, raw, warn }
}

describe('Coze SSE 空闲超时', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('数据停流超过阈值 → 断开半死连接、写固定错误帧并记 warn', async () => {
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const signal = init.signal as AbortSignal
      const body = new ReadableStream({
        start(controller) {
          signal.addEventListener('abort', () => {
            controller.error(Object.assign(new Error('aborted'), { name: 'AbortError' }))
          })
        },
        // 故意一个 chunk 都不给:模拟上游半死连接
      })
      return new Response(body, { status: 200 })
    })

    const { reply, chunks, raw, warn } = makeReply()
    await streamCozeSse(reply, '/v3/chat', { stream: true })

    await vi.waitFor(() => expect(raw.end).toHaveBeenCalled(), { timeout: 2000 })
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ upstreamPath: '/v3/chat', idleMs: 50 }),
      expect.stringContaining('空闲超时'),
    )
    expect(chunks.join('')).toContain('流式生成失败')
    expect(raw.end).toHaveBeenCalledTimes(1)
  })

  it('正常流式输出 → 逐行转发后 end,且不触发空闲超时日志', async () => {
    const encoder = new TextEncoder()
    fetchMock.mockImplementation(async () => {
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('hello\nworld'))
          controller.close()
        },
      })
      return new Response(body, { status: 200 })
    })

    const { reply, chunks, raw, warn } = makeReply()
    await streamCozeSse(reply, '/v3/chat', { stream: true })

    expect(chunks.join('')).toContain('data: hello\n\n')
    expect(chunks.join('')).toContain('data: world\n\n')
    expect(raw.end).toHaveBeenCalledTimes(1)
    expect(warn).not.toHaveBeenCalled()
  })

  it('上游非 2xx → 固定错误帧 Coze <status>,不泄露上游原文', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }))

    const { reply, chunks, raw, warn } = makeReply()
    await streamCozeSse(reply, '/v3/chat', { stream: true })

    expect(chunks.join('')).toContain('Coze 500')
    expect(raw.end).toHaveBeenCalledTimes(1)
    expect(warn).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
