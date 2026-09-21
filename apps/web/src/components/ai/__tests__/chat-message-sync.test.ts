// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * V2 #23 多端同步:chat_message WS 事件 → ChatStore 追加/去重 逻辑验证。
 *
 * ai-side-panel 是重组件(依赖 useChat/router/多个子组件),直接渲染成本高;
 * 这里抽取与组件 effect 内联逻辑语义一致的最小处理函数做行为验证,
 * 并对组件源码做静态断言,保证实现未偏离契约(守卫顺序/去重/会话过滤)。
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isChatMessage, type WSNotification } from '@ihui/types'

interface StoreMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
}

/** 与 ai-side-panel.tsx chat_message 分支同语义的最小处理函数 */
function applyChatMessage(
  messages: StoreMessage[],
  payload: WSNotification,
  currentConv: string,
): StoreMessage[] | null {
  if (!isChatMessage(payload)) return null
  const { conversationId, message } = payload.data
  if (conversationId && currentConv && conversationId !== currentConv) return null
  if (!message?.id) return null
  if (messages.some((m) => m.id === message.id)) return null
  return [
    ...messages,
    {
      id: message.id,
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: message.content,
      createdAt: message.createdAt ? new Date(message.createdAt).getTime() : Date.now(),
    },
  ]
}

function wsOf(data: unknown): WSNotification {
  return { data } as unknown as WSNotification
}

const MSG = (id: string, role: 'user' | 'assistant'): StoreMessage => ({
  id,
  role,
  content: `content-${id}`,
  createdAt: 1000,
})

describe('chat_message 多端同步语义(V2 #23)', () => {
  it('其他端用户消息 → 追加到末尾', () => {
    const next = applyChatMessage(
      [MSG('m1', 'user')],
      wsOf({
        type: 'chat_message',
        conversationId: 'c1',
        message: { id: 'm2', role: 'user', content: 'hi' },
      }),
      'c1',
    )
    expect(next).toHaveLength(2)
    const appended1 = next![1]!
    expect(appended1.id).toBe('m2')
    expect(appended1.role).toBe('user')
  })

  it('其他端 assistant 落盘消息 → 追加', () => {
    const next = applyChatMessage(
      [MSG('m1', 'user')],
      wsOf({
        type: 'chat_message',
        conversationId: 'c1',
        message: { id: 'm2', role: 'assistant', content: 'answer' },
      }),
      'c1',
    )
    const appended2 = next![1]!
    expect(appended2.role).toBe('assistant')
  })

  it('id 已存在(本端已渲染)→ 去重零操作', () => {
    const next = applyChatMessage(
      [MSG('m1', 'user')],
      wsOf({
        type: 'chat_message',
        conversationId: 'c1',
        message: { id: 'm1', role: 'user', content: 'dup' },
      }),
      'c1',
    )
    expect(next).toBeNull()
  })

  it('非当前会话 → 忽略(不跨会话污染)', () => {
    const next = applyChatMessage(
      [MSG('m1', 'user')],
      wsOf({
        type: 'chat_message',
        conversationId: 'other',
        message: { id: 'm2', role: 'user', content: 'x' },
      }),
      'c1',
    )
    expect(next).toBeNull()
  })

  it('非 chat_message 事件 → 守卫返回 null(交给其他分支)', () => {
    expect(
      applyChatMessage(
        [],
        wsOf({
          type: 'ai_response',
          conversationId: 'c1',
          message: { id: 'x', role: 'assistant', content: '' },
        }),
        'c1',
      ),
    ).toBeNull()
  })
})

describe('ai-side-panel 实现契约静态断言', () => {
  const src = readFileSync(resolve(__dirname, '../ai-side-panel.tsx'), 'utf8')

  it('chat_message 分支存在于 WS 分发链且使用 isChatMessage 守卫', () => {
    expect(src).toContain('isChatMessage')
  })

  it('去重防御:按 message.id 查重后才 setState', () => {
    expect(src).toContain('store.messages.some((m) => m.id === message.id)')
  })

  it('会话过滤:非当前会话早退(与其他三类事件一致)', () => {
    expect(src).toContain('conversationId !== currentConv')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
