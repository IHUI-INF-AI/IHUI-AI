import { describe, it, expect } from 'vitest'
import { isAIResponse, type WSNotification } from '../use-websocket'

/**
 * isAIResponse 类型守卫测试。
 *
 * Plan A 回调链路的回归守门:确保 ai_response 推送的载荷结构
 * (type/conversationId/clientMessageId/message)被正确识别,
 * 防止字段名漂移导致 chat/page.tsx 静默丢弃 AI 回复推送。
 */
describe('isAIResponse 类型守卫', () => {
  it('识别完整的 ai_response 推送', () => {
    const n: WSNotification = {
      type: 'notification',
      data: {
        type: 'ai_response',
        conversationId: 'conv-1',
        clientMessageId: 'placeholder-uuid',
        message: { id: 'db-id', role: 'assistant', content: 'hello', createdAt: '2026-01-01' },
      },
    }
    expect(isAIResponse(n)).toBe(true)
  })

  it('识别无 clientMessageId 的 ai_response(多端同步场景)', () => {
    const n: WSNotification = {
      type: 'notification',
      data: {
        type: 'ai_response',
        conversationId: 'conv-1',
        message: { id: 'db-id', role: 'assistant', content: 'hello' },
      },
    }
    expect(isAIResponse(n)).toBe(true)
  })

  it('拒绝 null', () => {
    expect(isAIResponse(null)).toBe(false)
  })

  it('拒绝非 ai_response 类型', () => {
    const n: WSNotification = {
      type: 'notification',
      data: { type: 'chat_message', message: { id: '1', role: 'user', content: 'x' } },
    }
    expect(isAIResponse(n)).toBe(false)
  })

  it('拒绝缺少 message 的 ai_response', () => {
    const n: WSNotification = {
      type: 'notification',
      data: { type: 'ai_response', conversationId: 'conv-1' },
    }
    expect(isAIResponse(n)).toBe(false)
  })

  it('接受 message 为空对象的 ai_response(守卫只检查 message 真值)', () => {
    const n: WSNotification = {
      type: 'notification',
      data: { type: 'ai_response', conversationId: 'conv-1', message: {} as never },
    }
    // message 存在但无 id 字段 — 守卫只检查 !!message,空对象通过
    // 可接受:消费方读 message.id 替换占位,空 id 不会破坏 store
    expect(isAIResponse(n)).toBe(true)
  })
})
