// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { isChatMessage, type WSNotification } from '../src/notification.js'

/** 构造 WS 通知(模拟服务端推送结构) */
function wsOf(data: unknown): WSNotification {
  return { data } as unknown as WSNotification
}

describe('isChatMessage(V2 #23 多端同步守卫)', () => {
  it('合法用户消息载荷 → true 且类型收窄', () => {
    const n = wsOf({
      type: 'chat_message',
      conversationId: 'conv-1',
      message: { id: 'm-1', role: 'user', content: 'hello' },
    })
    expect(isChatMessage(n)).toBe(true)
    if (isChatMessage(n)) {
      expect(n.data.message.id).toBe('m-1')
      expect(n.data.conversationId).toBe('conv-1')
    }
  })

  it('合法 assistant 消息载荷(含可选字段)→ true', () => {
    const n = wsOf({
      type: 'chat_message',
      conversationId: 'conv-1',
      message: {
        id: 'm-2',
        role: 'assistant',
        content: 'answer',
        reasoning: null,
        tokens: 42,
        createdAt: '2026-09-16T01:00:00.000Z',
      },
    })
    expect(isChatMessage(n)).toBe(true)
  })

  it('type 不匹配(ai_response)→ false', () => {
    const n = wsOf({
      type: 'ai_response',
      conversationId: 'conv-1',
      message: { id: 'm-1', role: 'assistant', content: 'x' },
    })
    expect(isChatMessage(n)).toBe(false)
  })

  it('缺 message → false', () => {
    const n = wsOf({ type: 'chat_message', conversationId: 'conv-1' })
    expect(isChatMessage(n)).toBe(false)
  })

  it('message.id 非字符串/为空 → false(脏数据防御)', () => {
    expect(
      isChatMessage(
        wsOf({ type: 'chat_message', message: { id: '', role: 'user', content: 'x' } }),
      ),
    ).toBe(false)
    expect(
      isChatMessage(wsOf({ type: 'chat_message', message: { role: 'user', content: 'x' } })),
    ).toBe(false)
    expect(
      isChatMessage(
        wsOf({ type: 'chat_message', message: { id: 123, role: 'user', content: 'x' } }),
      ),
    ).toBe(false)
  })

  it('null/空载荷 → false(不抛异常)', () => {
    expect(isChatMessage(null)).toBe(false)
    expect(isChatMessage(wsOf(null))).toBe(false)
    expect(isChatMessage(wsOf({}))).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
