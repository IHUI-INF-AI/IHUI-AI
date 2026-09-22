// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D34/D39 交代帧的**消费通道**单测(2026-09-22 第 42 轮)。
 *
 * 上一批我只做到"这两帧不喷进正文"(parseStreamLine 分流),帧本身被丢弃 ——
 * 生产了却没人看,等于界面上不存在。本文件钉死新增的两条回调通道:
 *   - injection_applied → onInjectionApplied(kind / collapsed / fullText / messageId)
 *   - retry_scheduled   → onRetryScheduled(attempt / maxRetries / retryInMs / httpStatus)
 * 并守住"缺可显示字段就不发回调"(不给界面一条空行)。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setBaseUrl, setStreamBaseUrl, streamChat } from '../src/client.js'

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

const MID = 'msg-d34-unit-001'

function body(events: string[]): string {
  return [
    ...events,
    'event: chunk\ndata: {"content":"正式回答"}\n\n',
    'event: done\ndata: {"content":"正式回答"}\n\n',
  ].join('')
}

const dataFrame = (payload: Record<string, unknown>) =>
  `event: ${String(payload.type)}\ndata: ${JSON.stringify(payload)}\n\n`

describe('D34/D39 交代帧回调通道', () => {
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

  const baseOpts = { model: 'test-model', messages: [{ role: 'user', content: 'hi' }] } as const

  it('injection_applied 触发 onInjectionApplied,字段齐且不落正文', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        body([
          dataFrame({
            type: 'injection_applied',
            kind: 'agents_md',
            collapsed: 'AGENTS.md · 3 条',
            fullText: '展开后的长文本,绝不能出现在正文里',
            messageId: MID,
          }),
        ]),
      ]),
    )
    const onInjectionApplied = vi.fn()
    const onDelta = vi.fn()

    await streamChat({ ...baseOpts, onInjectionApplied, onDelta })

    expect(onInjectionApplied).toHaveBeenCalledTimes(1)
    expect(onInjectionApplied.mock.calls[0][0]).toMatchObject({
      kind: 'agents_md',
      collapsed: 'AGENTS.md · 3 条',
      fullText: '展开后的长文本,绝不能出现在正文里',
      messageId: MID,
    })
    const deltas = onDelta.mock.calls.map((c) => String(c[0])).join('')
    expect(deltas).not.toContain('AGENTS.md')
    expect(deltas).not.toContain('展开后的长文本')
    expect(deltas).toContain('正式回答')
  })

  it('缺 collapsed(无处可显示)时不发回调,也不喷正文', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        body([dataFrame({ type: 'injection_applied', kind: 'repo_wiki', fullText: 'x' })]),
      ]),
    )
    const onInjectionApplied = vi.fn()
    const onDelta = vi.fn()

    await streamChat({ ...baseOpts, onInjectionApplied, onDelta })

    expect(onInjectionApplied).not.toHaveBeenCalled()
    expect(onDelta.mock.calls.map((c) => String(c[0])).join('')).not.toContain('x')
  })

  it('retry_scheduled 触发 onRetryScheduled,数值字段按契约解析', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        body([
          dataFrame({
            type: 'retry_scheduled',
            attempt: 2,
            maxRetries: 5,
            retryInMs: 1200,
            httpStatus: 429,
            message: '第 2/5 次重试,1.2s 后继续',
          }),
        ]),
      ]),
    )
    const onRetryScheduled = vi.fn()
    const onDelta = vi.fn()

    await streamChat({ ...baseOpts, onRetryScheduled, onDelta })

    expect(onRetryScheduled).toHaveBeenCalledTimes(1)
    expect(onRetryScheduled.mock.calls[0][0]).toMatchObject({
      attempt: 2,
      maxRetries: 5,
      retryInMs: 1200,
      httpStatus: 429,
    })
    expect(onDelta.mock.calls.map((c) => String(c[0])).join('')).not.toContain('第 2/5 次重试')
  })

  it('retry_scheduled 缺计数字段时不发回调(不给界面一条没有依据的重试行)', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([body([dataFrame({ type: 'retry_scheduled', retryInMs: 800 })])]),
    )
    const onRetryScheduled = vi.fn()

    await streamChat({ ...baseOpts, onRetryScheduled, onDelta: () => {} })

    expect(onRetryScheduled).not.toHaveBeenCalled()
  })

  it('未注册回调时两帧仍不得污染正文(分流与回调注册无关)', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        body([
          dataFrame({ type: 'injection_applied', kind: 'k', collapsed: '只在这帧里' }),
          dataFrame({ type: 'retry_scheduled', attempt: 1, maxRetries: 3, retryInMs: 0 }),
        ]),
      ]),
    )
    const onDelta = vi.fn()

    await streamChat({ ...baseOpts, onDelta })

    const deltas = onDelta.mock.calls.map((c) => String(c[0])).join('')
    expect(deltas).not.toContain('只在这帧里')
    expect(deltas).toContain('正式回答')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
