// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D20 会话置顶(G-11)api-client 契约测试(2026-09-26 立)。
 *
 * 钉 setConversationPinned / updateConversation(pinned) 发出的实际请求形态:
 *   - 方法 PATCH、路径 /api/chat/conversations/<encodeURIComponent(id)>(显式路径,非兜底正则)
 *   - 请求体只含 pinned(置顶开关)或补丁原样透传(title + pinned 共存)
 *   - 2xx {code:0} 解包 data.conversation;pinned=false 撤销请求与置顶请求同形
 *   - 403(非属主)归一化为 success=false 且保留 status —— 端上据此提示无权
 * mock 风格与 conversation-import.test.ts 同款:setTransport 记录 (url, init)。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { setTransport, type Transport } from '../src/transport.js'
import { setConversationPinned, updateConversation } from '../src/endpoints/chat.js'

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

function okTransport(body: unknown): Transport {
  return vi.fn(async () => jsonResponse(200, body)) as unknown as Transport
}

function firstCall(
  transport: Transport,
): [string, { method?: string; body?: string | FormData | undefined }] {
  const calls = (transport as unknown as { mock: { calls: unknown[][] } }).mock.calls
  const call = calls[0] ?? []
  return [call[0] as string, (call[1] ?? {}) as { method?: string; body?: string | FormData }]
}

describe('setConversationPinned — 置顶/取消置顶请求形态', () => {
  afterEach(() => {
    setTransport(undefined as unknown as Transport)
  })

  it('pinned=true:PATCH 显式会话路径,body 仅 {pinned:true}', async () => {
    const transport = okTransport({
      code: 0,
      message: 'ok',
      data: { conversation: { id: CONV_ID, title: '会话', pinned: true } },
    })
    setTransport(transport)

    const result = await setConversationPinned(CONV_ID, true)

    const [url, init] = firstCall(transport)
    expect(url).toBe(`/api/chat/conversations/${CONV_ID}`)
    expect(init.method).toBe('PATCH')
    expect(typeof init.body).toBe('string')
    expect(JSON.parse(String(init.body))).toEqual({ pinned: true })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.conversation.pinned).toBe(true)
    }
  })

  it('pinned=false(撤销):与置顶同形,body 仅 {pinned:false}', async () => {
    const transport = okTransport({
      code: 0,
      message: 'ok',
      data: { conversation: { id: CONV_ID, title: '会话', pinned: false } },
    })
    setTransport(transport)

    const result = await setConversationPinned(CONV_ID, false)

    const [, init] = firstCall(transport)
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(String(init.body))).toEqual({ pinned: false })
    expect(result.success).toBe(true)
  })

  it('会话 id 含特殊字符必须走 encodeURIComponent,不得拼出可越段的裸路径', async () => {
    const transport = okTransport({
      code: 0,
      message: 'ok',
      data: { conversation: { id: 'x', title: 't', pinned: true } },
    })
    setTransport(transport)

    await setConversationPinned('a/b c', true)

    const [url] = firstCall(transport)
    expect(url).toBe(`/api/chat/conversations/${encodeURIComponent('a/b c')}`)
    expect(url).not.toContain(' ')
  })

  it('服务端 403(非属主):归一化为 success=false 并保留 status,不抛错', async () => {
    const transport = vi.fn(async () =>
      jsonResponse(403, { code: 403, message: '无权访问该对话' }),
    ) as unknown as Transport
    setTransport(transport)

    const result = await setConversationPinned(CONV_ID, true)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.status).toBe(403)
      expect(result.error).toBe('无权访问该对话')
    }
  })
})

describe('updateConversation — pinned 与其它字段同补丁透传', () => {
  afterEach(() => {
    setTransport(undefined as unknown as Transport)
  })

  it('title+pinned 共存时原样透传两个键(改名不丢置顶,置顶不冲改名)', async () => {
    const transport = okTransport({
      code: 0,
      message: 'ok',
      data: { conversation: { id: CONV_ID, title: '新标题', pinned: true } },
    })
    setTransport(transport)

    await updateConversation(CONV_ID, { title: '新标题', pinned: true })

    const [url, init] = firstCall(transport)
    expect(url).toBe(`/api/chat/conversations/${CONV_ID}`)
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(String(init.body))).toEqual({ title: '新标题', pinned: true })
  })

  it('未传 pinned 时请求体不得出现 pinned 键(避免部分更新连带改置顶态)', async () => {
    const transport = okTransport({
      code: 0,
      message: 'ok',
      data: { conversation: { id: CONV_ID, title: '仅改名', pinned: false } },
    })
    setTransport(transport)

    await updateConversation(CONV_ID, { title: '仅改名' })

    const [, init] = firstCall(transport)
    const sent = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(sent.title).toBe('仅改名')
    expect('pinned' in sent).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
