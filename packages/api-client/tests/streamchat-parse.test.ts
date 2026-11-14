// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * streamChat 权威解析层两条 P1 缺陷的回归测试。
 *
 * F5 —— 非法 JSON 的 `data:` 行曾沿 `catch (e) { if (e instanceof SyntaxError) return data }`
 *       被当成正文增量返回,上游偶发截断帧/非 JSON 帧会喷进回答气泡且无告警。
 *       修复后:本应是 JSON 帧(以 { 或 [ 开头)却解析失败 ⇒ 丢弃(return null)、不喷正文,
 *       并在模块级 `_sseParseFaults` 计数留痕(经 `getStreamParseFaultCount()` 读取)。
 *       纯文本 token 行(不以 {/[ 开头)仍保留既有正文 delta 兼容,不视为故障。
 *
 * F3 —— 流内业务 error 帧(`{type:'error', message, errorCode}` 且不带数字 code/status)曾因
 *       `getSSEErrorInfo(err).code === undefined` 判不出业务错误,被 runner 当网络错误
 *       指数退避重连,把确定性业务失败(如 402 配额耗尽)反复重投直到 attempt 耗尽。
 *       修复后:这类帧默认不可重试(立即终态,不重连);仅当帧显式带 retryAfter 时保留
 *       现有的可重试语义。HTTP 层 401/403/429 的既有分类与 retryAfter 协商不变。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  streamChat,
  parseStreamLine,
  getStreamParseFaultCount,
  setStreamBaseUrl,
  setBaseUrl,
} from '../src/client.js'

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

const baseOpts = {
  model: 'test-model',
  messages: [{ role: 'user', content: 'hi' }],
} as const

describe('F5:非法 JSON 的 data 帧丢弃,不喷正文且计数留痕', () => {
  beforeEach(() => {
    setBaseUrl('http://localhost:8803')
    setStreamBaseUrl('http://localhost:8803')
  })

  it('parseStreamLine:截断 JSON 帧(以 { 开头)返回 null,合法帧照常', () => {
    const faultsBefore = getStreamParseFaultCount()
    // 上游偶发截断的 JSON 帧形态
    expect(parseStreamLine('data: {"choices":[{"delta":{"content":"he')).toBeNull()
    expect(getStreamParseFaultCount()).toBe(faultsBefore + 1)
    // 合法帧对照:正常 delta 通道未被本修复破坏
    expect(parseStreamLine('data: {"choices":[{"delta":{"content":"hi"}}]}')).toBe('hi')
    expect(getStreamParseFaultCount()).toBe(faultsBefore + 1)
  })

  it('parseStreamLine:纯文本 token 行仍原样返回(既有正文 delta 兼容,不计故障)', () => {
    const faultsBefore = getStreamParseFaultCount()
    expect(parseStreamLine('data: plain text no json')).toBe('plain text no json')
    expect(getStreamParseFaultCount()).toBe(faultsBefore)
  })

  it('端到端:截断 JSON 帧不产生 onDelta 正文,合法帧照常递出', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    try {
      const faultsBefore = getStreamParseFaultCount()
      fetchMock.mockResolvedValue(
        sseResponse([
          // 非法 JSON 帧(截断),修复前其原串会被 onDelta 喷进回答气泡
          'data: {"choices":[{"delta":{"content":"he\n\n',
          'data: {"choices":[{"delta":{"content":"hello"}}]}\n\n',
          'data: [DONE]\n\n',
        ]),
      )
      const onDelta = vi.fn()
      await streamChat({ ...baseOpts, onDelta, maxRetries: 0 })

      const deltas = onDelta.mock.calls.map((c) => String(c[0])).join('')
      expect(deltas).toContain('hello')
      expect(deltas).not.toContain('{"choices"')
      expect(getStreamParseFaultCount()).toBeGreaterThan(faultsBefore)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('F3:流内业务 error 帧(无数字 code)默认不可重试,不重连', () => {
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

  it('error 帧带 errorCode 无数字 code ⇒ 立即终态 onError,不触发 onReconnect', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        'data: {"type":"error","message":"quota exhausted","errorCode":"LLM_ERROR"}\n\n',
      ]),
    )
    const onReconnect = vi.fn()
    const onError = vi.fn()

    await streamChat({ ...baseOpts, maxRetries: 3, onReconnect, onError })

    // 修复前:runner 判不出业务错误 ⇒ 走指数退避,fetchMock 被反复重投直到 attempt 耗尽
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(onReconnect).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledTimes(1)
    const [, info] = onError.mock.calls[0] as [
      string,
      { errorCode?: string; recoverable?: boolean } | undefined,
    ]
    expect(info?.errorCode).toBe('LLM_ERROR')
    // 业务错误(非网络抖动)不得标成"网络可重试但已耗尽自动重连次数"
    expect(info?.recoverable).toBe(false)
  })

  it('error 帧显式带 retryAfter ⇒ 保留既有可重试语义(onReconnect 被调用)', async () => {
    vi.useFakeTimers()
    fetchMock
      .mockResolvedValueOnce(
        sseResponse([
          'data: {"type":"error","message":"rate limited","code":429,"retryAfter":1}\n\n',
        ]),
      )
      .mockResolvedValueOnce(
        sseResponse(['data: {"choices":[{"delta":{"content":"ok"}}]}\n\n', 'data: [DONE]\n\n']),
      )
    const onReconnect = vi.fn()
    const onError = vi.fn()

    const promise = streamChat({ ...baseOpts, onReconnect, onError, maxRetries: 2 })
    await vi.advanceTimersByTimeAsync(2000)
    await promise

    expect(onReconnect).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()
  })
})
