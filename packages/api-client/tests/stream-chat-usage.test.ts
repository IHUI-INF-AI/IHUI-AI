// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/** D1 消息级计量(2026-09-19 立):usage 帧分流测试。
 * 核心守护:命名帧 event: usage(type:'usage')必须走 onUsage 全字段回调;
 * 旧 OpenAI 协议 usage chunk 兼容;usage 帧绝不落入正文 onDelta。 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { streamChat, setStreamBaseUrl, setBaseUrl } from '../src/client.js'
import type { UsageEvent } from '../src/client.js'

/** 构造一段 SSE 流的 Response mock(参照 stream-chat-swallow-fix.test.ts 模式) */
function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(`${chunk}\n`))
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

/** 命名帧:event: usage + data(type:'usage',ai-service 流收尾下发) */
const NAMED_FRAME = [
  'event: usage',
  'data: {"type":"usage","messageId":"m-1","usage":{"promptTokens":100,"completionTokens":30,"totalTokens":130,"reasoningTokens":12},"timing":{"firstTokenMs":420,"durationMs":3400},"model":"deepseek-chat","costUsd":0.0021}',
  '',
  'data: [DONE]',
  '',
]

/** 旧 OpenAI 协议 usage chunk(stream_options.include_usage) */
const LEGACY_CHUNK = [
  'data: {"choices":[{"delta":{"content":"hi"}}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}',
  '',
  'data: [DONE]',
  '',
]

const baseOpts = {
  model: 'test-model',
  messages: [{ role: 'user', content: 'hi' }],
} as const

describe('streamChat usage 帧分流(D1)', () => {
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

  it('命名帧 event:usage → onUsage 收到全字段(含 timing/model/costUsd)', async () => {
    fetchMock.mockResolvedValue(sseResponse(NAMED_FRAME))
    const onUsage = vi.fn()
    await streamChat({ ...baseOpts, onUsage })
    expect(onUsage).toHaveBeenCalledTimes(1)
    const u = onUsage.mock.calls[0][0] as UsageEvent
    expect(u.totalTokens).toBe(130)
    expect(u.reasoningTokens).toBe(12)
    expect(u.messageId).toBe('m-1')
    expect(u.timing?.firstTokenMs).toBe(420)
    expect(u.timing?.durationMs).toBe(3400)
    expect(u.model).toBe('deepseek-chat')
    expect(u.costUsd).toBeCloseTo(0.0021)
  })

  it('旧 OpenAI 协议 usage chunk → onUsage 兼容触发(扩展字段为 null)', async () => {
    fetchMock.mockResolvedValue(sseResponse(LEGACY_CHUNK))
    const onUsage = vi.fn()
    await streamChat({ ...baseOpts, onUsage })
    expect(onUsage).toHaveBeenCalledTimes(1)
    const u = onUsage.mock.calls[0][0] as UsageEvent
    expect(u.totalTokens).toBe(15)
    expect(u.messageId).toBeNull()
    expect(u.timing).toBeNull()
    expect(u.model).toBeNull()
  })

  it('usage 帧绝不落入正文 onDelta(核心守护)', async () => {
    fetchMock.mockResolvedValue(sseResponse(NAMED_FRAME))
    const onDelta = vi.fn()
    await streamChat({ ...baseOpts, onUsage: vi.fn(), onDelta })
    expect(onDelta).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
