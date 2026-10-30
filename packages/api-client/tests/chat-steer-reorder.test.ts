// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 差距③ mutateQueue(2026-10-30 立):reorderSteerQueue 请求形态钉死。
 *
 * 断言:
 *   - POST /api/ai/chat/steer/reorder(前缀坑位同 withdrawSteer:/api/ai,非 /api/chat)
 *   - body 原样透传三元组 {conversationId, messageId, order}
 *   - 2xx 信封解包出 {ok, queued, orderApplied};orderApplied 是上游竞态豁免后的
 *     实际生效结论,本包不改写。
 * mock 风格与 chat-steer-withdraw.test.ts 同款:setTransport 记录 (url, init)。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { setTransport, type Transport } from '../src/transport.js'
import { reorderSteerQueue } from '../src/endpoints/chat.js'

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

describe('reorderSteerQueue — 差距③ mutateQueue 请求形态', () => {
  afterEach(() => {
    setTransport(undefined as unknown as Transport)
  })

  it('POST /api/ai/chat/steer/reorder,body 原样透传三元组,信封解包出 orderApplied', async () => {
    const transport = vi.fn(async () =>
      jsonResponse(200, {
        code: 0,
        message: 'ok',
        data: { ok: true, queued: 2, orderApplied: ['t2', 't1'] },
      }),
    ) as unknown as Transport
    setTransport(transport)

    const result = await reorderSteerQueue({
      conversationId: 'c-1',
      messageId: 'm-1',
      order: ['t2', 't1'],
    })

    const [url, init] = firstCall(transport)
    expect(url).toBe('/api/ai/chat/steer/reorder')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({
      conversationId: 'c-1',
      messageId: 'm-1',
      order: ['t2', 't1'],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toMatchObject({ ok: true, queued: 2, orderApplied: ['t2', 't1'] })
    }
  })

  it('422(覆盖不符)走失败信封:success=false,调用方据此回滚本地乐观顺序', async () => {
    const transport = vi.fn(async () =>
      jsonResponse(422, {
        ok: false,
        error: 'order must exactly cover all pending queue entries',
      }),
    ) as unknown as Transport
    setTransport(transport)

    const result = await reorderSteerQueue({
      conversationId: 'c-1',
      messageId: 'm-1',
      order: ['x'],
    })
    expect(result.success).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
