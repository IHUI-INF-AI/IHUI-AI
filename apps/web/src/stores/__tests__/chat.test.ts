import { describe, it, expect, beforeEach } from 'vitest'
import { useChatStore } from '../chat'

describe('useChatStore', () => {
  beforeEach(() => {
    useChatStore.setState({
      messages: [],
      currentModel: 'gpt-4o-mini',
      isStreaming: false,
      error: null,
      conversationId: null,
    })
  })

  it('初始状态', () => {
    const s = useChatStore.getState()
    expect(s.messages).toEqual([])
    expect(s.currentModel).toBe('gpt-4o-mini')
    expect(s.isStreaming).toBe(false)
    expect(s.error).toBeNull()
    expect(s.conversationId).toBeNull()
  })

  it('setModel 切换模型', () => {
    useChatStore.getState().setModel('claude-3')
    expect(useChatStore.getState().currentModel).toBe('claude-3')
  })

  it('addMessage 添加消息并返回 id', () => {
    const id = useChatStore.getState().addMessage({
      role: 'user',
      content: 'hello',
      model: 'gpt-4o-mini',
    })
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
    const s = useChatStore.getState()
    expect(s.messages).toHaveLength(1)
    expect(s.messages[0]).toMatchObject({
      role: 'user',
      content: 'hello',
      model: 'gpt-4o-mini',
    })
    expect(s.messages[0]?.id).toBe(id)
    expect(typeof s.messages[0]?.createdAt).toBe('number')
  })

  it('addMessage 多次添加按顺序追加', () => {
    useChatStore.getState().addMessage({ role: 'user', content: 'a', model: 'm' })
    useChatStore.getState().addMessage({ role: 'assistant', content: 'b', model: 'm' })
    const msgs = useChatStore.getState().messages
    expect(msgs).toHaveLength(2)
    expect(msgs[0]?.content).toBe('a')
    expect(msgs[1]?.content).toBe('b')
  })

  it('appendToMessage 追加内容到指定消息', () => {
    const id = useChatStore.getState().addMessage({
      role: 'assistant',
      content: 'Hello',
      model: 'm',
    })
    useChatStore.getState().appendToMessage(id, ' World')
    expect(useChatStore.getState().messages[0]?.content).toBe('Hello World')
  })

  it('appendToMessage 不影响其他消息', () => {
    const id1 = useChatStore.getState().addMessage({ role: 'user', content: 'a', model: 'm' })
    const id2 = useChatStore.getState().addMessage({ role: 'assistant', content: 'b', model: 'm' })
    useChatStore.getState().appendToMessage(id2, 'c')
    const msgs = useChatStore.getState().messages
    expect(msgs.find((m) => m.id === id1)?.content).toBe('a')
    expect(msgs.find((m) => m.id === id2)?.content).toBe('bc')
  })

  it('setMessageError 标记错误并填充内容', () => {
    const id = useChatStore.getState().addMessage({
      role: 'assistant',
      content: '',
      model: 'm',
    })
    useChatStore.getState().setMessageError(id, '网络错误')
    const msg = useChatStore.getState().messages[0]
    expect(msg?.error).toBe(true)
    expect(msg?.content).toBe('网络错误')
    expect(useChatStore.getState().error).toBe('网络错误')
  })

  it('clearMessages 清空消息和错误', () => {
    useChatStore.getState().addMessage({ role: 'user', content: 'a', model: 'm' })
    useChatStore.getState().setError('err')
    useChatStore.getState().clearMessages()
    const s = useChatStore.getState()
    expect(s.messages).toEqual([])
    expect(s.error).toBeNull()
  })

  it('setStreaming 切换流式状态', () => {
    useChatStore.getState().setStreaming(true)
    expect(useChatStore.getState().isStreaming).toBe(true)
    useChatStore.getState().setStreaming(false)
    expect(useChatStore.getState().isStreaming).toBe(false)
  })

  it('setConversationId 设置会话 ID', () => {
    useChatStore.getState().setConversationId('conv-123')
    expect(useChatStore.getState().conversationId).toBe('conv-123')
    useChatStore.getState().setConversationId(null)
    expect(useChatStore.getState().conversationId).toBeNull()
  })
})
