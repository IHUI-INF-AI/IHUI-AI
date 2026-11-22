// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 差距⑤(2026-10-30 立):getConversationHistory 的 around 锚点窗口 query 拼装。
 *
 * 断言:
 *   - aroundTurnId/aroundWindow 映射到服务端 query 名 around/window(不是客户端参数名)
 *   - 未传时 query 里不得出现 around/window 键(空值不占位,服务端缺省口径不被客户端抢答)
 *   - 响应透传双向 cursor(prevCursor 键原样读出,本包不解释)。
 * mock 风格与 chat-pinned.test.ts 同款:setTransport 记录 (url, init)。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { setTransport, type Transport } from '../src/transport.js'
import { getConversationHistory } from '../src/endpoints/chat.js'

const CONV_ID = 'cccccccc-3333-4333-8333-333333333333'

function jsonResponse(status: number, body: unknown): ReturnType<Transport> {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as unknown as ReturnType<Transport>
}

function firstUrl(transport: Transport): string {
  const calls = (transport as unknown as { mock: { calls: unknown[][] } }).mock.calls
  return (calls[0]?.[0] ?? '') as string
}

function historyBody(): unknown {
  return {
    code: 0,
    message: 'ok',
    data: {
      turns: [],
      limit: 5,
      hasMore: false,
      nextCursor: null,
      prevCursor: 'cur-prev-1',
      projectionState: null,
    },
  }
}

describe('getConversationHistory around 参数 — 差距⑤ query 拼装', () => {
  afterEach(() => {
    setTransport(undefined as unknown as Transport)
  })

  it('aroundTurnId+aroundWindow ⇒ query 带 around/window(服务端名),响应 prevCursor 原样透传', async () => {
    const transport = vi.fn(async () => jsonResponse(200, historyBody())) as unknown as Transport
    setTransport(transport)

    const result = await getConversationHistory(CONV_ID, {
      limit: 5,
      aroundTurnId: 'turn-42',
      aroundWindow: 3,
    })

    const url = firstUrl(transport)
    expect(url).toContain(`/api/chat/conversations/${CONV_ID}/history?`)
    const qs = new URLSearchParams(url.slice(url.indexOf('?') + 1))
    expect(qs.get('limit')).toBe('5')
    expect(qs.get('around')).toBe('turn-42')
    expect(qs.get('window')).toBe('3')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.prevCursor).toBe('cur-prev-1')
    }
  })

  it('未传 around 系参数 ⇒ query 不得出现 around/window 空键', async () => {
    const transport = vi.fn(async () => jsonResponse(200, historyBody())) as unknown as Transport
    setTransport(transport)

    await getConversationHistory(CONV_ID, { direction: 'newest' })

    const url = firstUrl(transport)
    const qs = new URLSearchParams(url.slice(url.indexOf('?') + 1))
    expect(qs.has('around')).toBe(false)
    expect(qs.has('window')).toBe(false)
    expect(qs.get('direction')).toBe('newest')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
