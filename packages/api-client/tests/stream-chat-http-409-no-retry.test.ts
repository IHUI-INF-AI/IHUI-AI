// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 409 不是网络抖动:服务端积分 hold 已存在时,同一 assistantId 的流式重试
 * 只会反复撞同一把锁。本文件钉死 4xx 业务错误的终态语义:
 *   - 409 REQUEST_IN_PROGRESS 不得自动重投(否则 UI 会等 1s+2s+4s 后仍失败);
 *   - 5xx 仍保留原有退避重连能力(不能把整条恢复链一起关掉)。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setBaseUrl, setStreamBaseUrl, streamChat } from '../src/client.js'

function response(status: number, body: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => body,
    json: async () => JSON.parse(body),
  } as unknown as Response
}

const baseOpts = {
  model: 'test-model',
  messages: [{ role: 'user', content: 'hi' }],
} as const

describe('streamChat HTTP 4xx 业务错误不重试', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    setBaseUrl('http://localhost:8803')
    setStreamBaseUrl('http://localhost:8803')
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('409 REQUEST_IN_PROGRESS 一次请求即终态,不再重投同一 assistantId', async () => {
    fetchMock.mockResolvedValue(
      response(
        409,
        JSON.stringify({
          code: 'REQUEST_IN_PROGRESS',
          message: '该请求正在处理中，请勿重复提交',
        }),
      ),
    )

    await expect(streamChat({ ...baseOpts, maxRetries: 3 })).rejects.toThrow(
      '该请求正在处理中',
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('500 仍按退避重试,证明 4xx 收敛没有误伤服务端抖动恢复', async () => {
    fetchMock
      .mockResolvedValueOnce(response(500, JSON.stringify({ message: 'boom' })))
      .mockResolvedValueOnce(
        (() => {
          const encoder = new TextEncoder()
          const stream = new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n'))
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              controller.close()
            },
          })
          return {
            ok: true,
            status: 200,
            body: stream,
            headers: { get: () => null },
            text: async () => '',
          } as unknown as Response
        })(),
      )

    await expect(streamChat({ ...baseOpts, maxRetries: 1, initialRetryDelayMs: 10 })).resolves
      .toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
