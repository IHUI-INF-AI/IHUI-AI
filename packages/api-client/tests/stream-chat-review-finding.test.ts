// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/** D115(G-229)review-finding 帧解析测试。
 *  守护四条:
 *  ① 合法帧 ⇒ onReviewFinding 逐字段原样收到(不猜、不改写);
 *  ② 一 finding 一帧、多档严重度全数到端(白名单未登记时这里恒 0 次 —— 帧被静默丢弃);
 *  ③ 非法帧(severity 表外 / findingId 空 / line 非数)⇒ 丢帧而不是猜档位;
 *  ④ 本帧绝不落入正文 onDelta(专用通道),未注册回调时不解析。
 *  mock 模式与 stream-chat-finish-reason.test.ts 同源。 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { streamChat, setStreamBaseUrl, setBaseUrl } from '../src/client.js'
import type { ReviewFindingEvent } from '../src/client.js'

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

const P1_FRAME =
  'data: {"type":"review-finding","findingId":"rf-1","index":1,"total":3,' +
  '"severity":"P1","file":"src/a.ts","line":42,"title":"空指针","detail":"未判空",' +
  '"suggestion":"加可选链","target":"uncommitted"}'

const P2_FRAME =
  'data: {"type":"review-finding","findingId":"rf-2","index":2,"total":3,' +
  '"severity":"P2","file":"src/b.ts","line":7,"title":"魔法数","detail":"","suggestion":""}'

const NIT_WHOLE_FILE_FRAME =
  'data: {"type":"review-finding","findingId":"rf-3","index":3,"total":3,' +
  '"severity":"Nit","file":"src/c.ts","line":0,"title":"命名","detail":"","suggestion":""}'

const baseOpts = {
  model: 'test-model',
  messages: [{ role: 'user', content: 'review' }],
} as const

describe('streamChat review-finding 帧(D115)', () => {
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

  it('合法帧 ⇒ 回调逐字段原样收到', async () => {
    fetchMock.mockResolvedValue(sseResponse([P1_FRAME, '', 'data: [DONE]', '']))
    const onReviewFinding = vi.fn()
    await streamChat({ ...baseOpts, onReviewFinding })
    expect(onReviewFinding).toHaveBeenCalledTimes(1)
    expect(onReviewFinding.mock.calls[0][0] as ReviewFindingEvent).toEqual({
      findingId: 'rf-1',
      index: 1,
      total: 3,
      severity: 'P1',
      file: 'src/a.ts',
      line: 42,
      title: '空指针',
      detail: '未判空',
      suggestion: '加可选链',
      target: 'uncommitted',
    })
  })

  it('P1/P2/Nit 三档三帧全数到端,整文件级 line=0 原样保留', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([P1_FRAME, '', P2_FRAME, '', NIT_WHOLE_FILE_FRAME, '', 'data: [DONE]', '']),
    )
    const onReviewFinding = vi.fn()
    await streamChat({ ...baseOpts, onReviewFinding })
    expect(onReviewFinding).toHaveBeenCalledTimes(3)
    const severities = onReviewFinding.mock.calls.map(
      (call) => (call[0] as ReviewFindingEvent).severity,
    )
    expect(severities).toEqual(['P1', 'P2', 'Nit'])
    expect((onReviewFinding.mock.calls[2][0] as ReviewFindingEvent).line).toBe(0)
  })

  it('非法帧(表外 severity / 空 findingId / line 非数)一律丢帧,不猜档位', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        'data: {"type":"review-finding","findingId":"rf-x","index":1,"total":1,"severity":"P3","file":"src/x.ts","line":1,"title":"t","detail":"","suggestion":""}',
        '',
        'data: {"type":"review-finding","findingId":"","index":1,"total":1,"severity":"P1","file":"src/x.ts","line":1,"title":"t","detail":"","suggestion":""}',
        '',
        'data: {"type":"review-finding","findingId":"rf-y","index":1,"total":1,"severity":"P2","file":"src/x.ts","line":"12","title":"t","detail":"","suggestion":""}',
        '',
        'data: [DONE]',
        '',
      ]),
    )
    const onReviewFinding = vi.fn()
    await streamChat({ ...baseOpts, onReviewFinding })
    expect(onReviewFinding).not.toHaveBeenCalled()
  })

  it('review-finding 绝不落入正文 onDelta;未注册回调时不解析', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        P1_FRAME,
        '',
        'data: {"type":"chunk","content":"正文"}',
        '',
        'data: [DONE]',
        '',
      ]),
    )
    const onDelta = vi.fn()
    await streamChat({ ...baseOpts, onDelta })
    expect(onDelta.mock.calls.map((call) => call[0])).toEqual(['正文'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
