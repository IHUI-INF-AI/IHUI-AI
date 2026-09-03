// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top

/**
 * streamChat 吞错修复回归测试(2026-09-04 Fix B)。
 *
 * 背景:流内 SSE error 事件(如 provider 402 配额耗尽, errorCode: LLM_ERROR)耗尽内部
 * 重试后进入 catch 块的 !canRetry 分支。修复前:无 onError 消费者时错误被吞,
 * Promise 正常 resolve,调用方拿到"成功的空补全"。修复后:
 *   - 传了 onError → 保持原行为:回调后 return(resolve)
 *   - 未传 onError → throw err(reject),错误信息含流内 error message
 *
 * 通过 mock 全局 fetch + ReadableStream 模拟 SSE 流,构造 error 事件与重试耗尽场景。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { streamChat, setStreamBaseUrl, setBaseUrl } from '../src/client.js'

/** 构造一段 SSE 流的 Response mock(仅实现 streamChat 用到的字段) */
function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
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
}

/** 流内 error 事件(provider 402 配额耗尽场景) */
const QUOTA_ERROR_LINE =
  'data: {"type":"error","message":"provider 402 quota exhausted","errorCode":"LLM_ERROR"}\n\n'

/** 正常文本 token + [DONE](对照场景) */
const OK_CHUNKS = ['data: {"choices":[{"delta":{"content":"hello"}}]}\n\n', 'data: [DONE]\n\n']

const baseOpts = {
  model: 'test-model',
  messages: [{ role: 'user', content: 'hi' }],
} as const

describe('streamChat 吞错修复(!canRetry 分支)', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    setBaseUrl('http://localhost:8803')
    setStreamBaseUrl('http://localhost:8803')
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('不传 onError + 流内 error 事件(重试耗尽)→ reject,错误信息含流内 error message', async () => {
    fetchMock.mockResolvedValue(sseResponse([QUOTA_ERROR_LINE]))

    // maxRetries: 0 → 首次 error 即进入 !canRetry 分支(等价于重试耗尽)
    const promise = streamChat({ ...baseOpts, maxRetries: 0 })

    await expect(promise).rejects.toThrow('provider 402 quota exhausted')

    // 错误对象保留 SSEError 元数据
    const err = await promise.catch((e: unknown) => e)
    expect(err).toBeInstanceOf(Error)
    expect((err as Error & { name: string }).name).toBe('SSEError')
    expect((err as Error & { errorCode?: string }).errorCode).toBe('LLM_ERROR')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('传 onError + 流内 error 事件(重试耗尽)→ 保持原行为:resolve + onError 被调用', async () => {
    fetchMock.mockResolvedValue(sseResponse([QUOTA_ERROR_LINE]))
    const onError = vi.fn()

    // 修复后此分支保持原行为(回调后 return),不得 reject
    await expect(
      streamChat({ ...baseOpts, maxRetries: 0, onError }),
    ).resolves.toBeUndefined()

    expect(onError).toHaveBeenCalledTimes(1)
    const [message, info] = onError.mock.calls[0] as [
      string,
      { errorCode?: string; recoverable?: boolean } | undefined,
    ]
    expect(message).toContain('provider 402 quota exhausted')
    // info 透传流内 errorCode;非业务错误(非 401/403/429)标记 recoverable
    expect(info?.errorCode).toBe('LLM_ERROR')
    expect(info?.recoverable).toBe(true)
  })

  it('重试耗尽(默认退避重连后仍 error)→ 不传 onError 最终 reject,fetch 重试 maxRetries+1 次', async () => {
    vi.useFakeTimers()
    // 每次尝试(含重连)都返回 error 事件流
    fetchMock.mockImplementation(async () => sseResponse([QUOTA_ERROR_LINE]))
    const onReconnect = vi.fn()

    const promise = streamChat({ ...baseOpts, maxRetries: 1, onReconnect })
    // 先挂接 rejects 断言(避免推进假时钟期间 promise reject 成为 unhandled rejection)
    const assertion = expect(promise).rejects.toThrow('provider 402 quota exhausted')
    // 推进 1s(首次退避)+ 余量,驱动重连后再次失败
    await vi.advanceTimersByTimeAsync(2_000)
    await assertion
    // 初始请求 + 1 次重连 = 2 次 fetch
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(onReconnect).toHaveBeenCalledWith(1, 1000)
  })

  it('对照:正常流(无 error 事件)不受影响,不传 onError 也正常 resolve', async () => {
    fetchMock.mockResolvedValue(sseResponse(OK_CHUNKS))
    const onDelta = vi.fn()

    await expect(streamChat({ ...baseOpts, onDelta })).resolves.toBeUndefined()
    expect(onDelta).toHaveBeenCalledWith('hello')
  })
})
