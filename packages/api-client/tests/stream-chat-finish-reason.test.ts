// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/** G-425(2026-10-07 立,默认档"只提示"):done 帧 finishReason 透传测试。
 *  守护:①带 finishReason 的 done 帧 ⇒ onFinishReason 收到原样值;
 *  ②无 finishReason ⇒ 回调不触发(缺席 ≠ stop,不造值);
 *  ③done 帧绝不落入正文 onDelta。与 stream-chat-usage.test.ts 同一 mock 模式。 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { streamChat, setStreamBaseUrl, setBaseUrl } from '../src/client.js'
import type { FinishReasonEvent } from '../src/client.js'

/** 构造一段 SSE 流的 Response mock(参照 stream-chat-usage.test.ts 模式) */
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

const DONE_WITH_LENGTH = [
  'data: {"type":"done","model":"deepseek-chat","finishReason":"length","usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}',
  '',
  'data: [DONE]',
  '',
]

const DONE_WITH_GEMINI_NATIVE = [
  'data: {"type":"done","model":"gemini-1.5-pro","finishReason":"MAX_TOKENS"}',
  '',
  'data: [DONE]',
  '',
]

const DONE_WITHOUT_FR = [
  'data: {"type":"done","model":"deepseek-chat","usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}',
  '',
  'data: [DONE]',
  '',
]

const baseOpts = {
  model: 'test-model',
  messages: [{ role: 'user', content: 'hi' }],
} as const

describe('streamChat done 帧 finishReason 透传(G-425)', () => {
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

  it('done 帧 finishReason=length → onFinishReason 收到原样值', async () => {
    fetchMock.mockResolvedValue(sseResponse(DONE_WITH_LENGTH))
    const onFinishReason = vi.fn()
    await streamChat({ ...baseOpts, onFinishReason })
    expect(onFinishReason).toHaveBeenCalledTimes(1)
    const e = onFinishReason.mock.calls[0][0] as FinishReasonEvent
    expect(e.finishReason).toBe('length')
  })

  it('Gemini 原生 MAX_TOKENS 同样原样透传(不归一)', async () => {
    fetchMock.mockResolvedValue(sseResponse(DONE_WITH_GEMINI_NATIVE))
    const onFinishReason = vi.fn()
    await streamChat({ ...baseOpts, onFinishReason })
    expect(onFinishReason).toHaveBeenCalledTimes(1)
    expect((onFinishReason.mock.calls[0][0] as FinishReasonEvent).finishReason).toBe('MAX_TOKENS')
  })

  it('done 帧无 finishReason ⇒ 回调不触发(缺席不带键,不造值)', async () => {
    fetchMock.mockResolvedValue(sseResponse(DONE_WITHOUT_FR))
    const onFinishReason = vi.fn()
    await streamChat({ ...baseOpts, onFinishReason })
    expect(onFinishReason).not.toHaveBeenCalled()
  })

  it('未注册 onFinishReason ⇒ 不解析,流正常收束', async () => {
    fetchMock.mockResolvedValue(sseResponse(DONE_WITH_LENGTH))
    const onDelta = vi.fn()
    await streamChat({ ...baseOpts, onDelta })
    expect(onDelta).not.toHaveBeenCalled()
  })
})
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
