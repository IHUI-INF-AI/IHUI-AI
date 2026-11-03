// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 差距③ Phase1(2026-10-30 立):withdrawSteer 请求形态钉死。
 *
 * 断言:
 *   - POST /api/ai/chat/steer/withdraw(前缀坑位同 steerChatStream:/api/ai,非 /api/chat)
 *   - body 原样透传三元组 {conversationId, messageId, queuedAt}
 *   - 2xx 信封解包出 {ok, status};三档 status 是服务端结论,本包不改写。
 * mock 风格与 chat-pinned.test.ts 同款:setTransport 记录 (url, init)。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { setTransport, type Transport } from '../src/transport.js'
import { withdrawSteer } from '../src/endpoints/chat.js'

function jsonResponse(status: number, body: unknown): ReturnType<Transport> {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as unknown as ReturnType<Transport>
}

function firstCall(
  transport: Transport,
): [string, { method?: string; body?: string | FormData | undefined }] {
  const calls = (transport as unknown as { mock: { calls: unknown[][] } }).mock.calls
  const call = calls[0] ?? []
  return [call[0] as string, (call[1] ?? {}) as { method?: string; body?: string | FormData }]
}

describe('withdrawSteer — 差距③ Phase1 撤回请求形态', () => {
  afterEach(() => {
    setTransport(undefined as unknown as Transport)
  })

  it('POST /api/ai/chat/steer/withdraw,body 原样透传三元组,信封解包出三档 status', async () => {
    const transport = vi.fn(async () =>
      jsonResponse(200, {
        code: 0,
        message: 'ok',
        data: { ok: true, status: 'withdrawn' },
      }),
    ) as unknown as Transport
    setTransport(transport)

    const result = await withdrawSteer({
      conversationId: 'c-1',
      messageId: 'm-1',
      queuedAt: '2026-10-30T08:00:00Z',
    })

    const [url, init] = firstCall(transport)
    expect(url).toBe('/api/ai/chat/steer/withdraw')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({
      conversationId: 'c-1',
      messageId: 'm-1',
      queuedAt: '2026-10-30T08:00:00Z',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toMatchObject({ ok: true, status: 'withdrawn' })
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
