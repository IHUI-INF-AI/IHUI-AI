// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

  // ============ P1 #27 记忆更新可视化(2026-09-16 立)============

  describe('appendMemoryNotice(done 事件 memoryUpdates 落地)', () => {
    beforeEach(() => {
      useChatStore.setState({ memoryUpdateNotices: [] })
    })

    it('首条写入:按 messageId 建立提示条', () => {
      useChatStore.getState().appendMemoryNotice('msg-1', ['用户偏好 TypeScript'])
      const notices = useChatStore.getState().memoryUpdateNotices
      expect(notices).toHaveLength(1)
      expect(notices[0]).toMatchObject({
        messageId: 'msg-1',
        items: ['用户偏好 TypeScript'],
      })
    })

    it('同 messageId 追加:合并 items 并去重(不新增第二条)', () => {
      const s = useChatStore.getState()
      s.appendMemoryNotice('msg-1', ['A', 'B'])
      s.appendMemoryNotice('msg-1', ['B', 'C'])
      const notices = useChatStore.getState().memoryUpdateNotices
      expect(notices).toHaveLength(1)
      expect(notices[0]?.items).toEqual(['A', 'B', 'C'])
    })

    it('不同 messageId 各自独立一条', () => {
      const s = useChatStore.getState()
      s.appendMemoryNotice('msg-1', ['A'])
      s.appendMemoryNotice('msg-2', ['B'])
      expect(useChatStore.getState().memoryUpdateNotices).toHaveLength(2)
    })

    it('空 items 不写入(避免空提示条)', () => {
      useChatStore.getState().appendMemoryNotice('msg-1', [])
      expect(useChatStore.getState().memoryUpdateNotices).toHaveLength(0)
    })

    it('合并时过滤空字符串条目', () => {
      const s = useChatStore.getState()
      s.appendMemoryNotice('msg-1', ['A', ''])
      s.appendMemoryNotice('msg-1', ['', 'B'])
      expect(useChatStore.getState().memoryUpdateNotices[0]?.items).toEqual(['A', 'B'])
    })

    it('clearMessages 清空提示条', () => {
      useChatStore.getState().appendMemoryNotice('msg-1', ['A'])
      useChatStore.getState().clearMessages()
      expect(useChatStore.getState().memoryUpdateNotices).toEqual([])
    })
  })

  // ============ Steer 中途引导(2026-09-19 立)============

  describe('appendSteerNotice(SSE steer 事件落地)', () => {
    beforeEach(() => {
      useChatStore.setState({ steerNoticesByMessageId: {}, streamingAssistantId: null })
    })

    it('首条写入:按 messageId 建立引导记录', () => {
      useChatStore.getState().appendSteerNotice('msg-1', { text: '换一个思路' })
      const notices = useChatStore.getState().steerNoticesByMessageId
      expect(notices['msg-1']).toHaveLength(1)
      expect(notices['msg-1']?.[0]).toMatchObject({ text: '换一个思路' })
    })

    it('同 messageId 追加:累计多条(时序保留,不去重)', () => {
      const s = useChatStore.getState()
      s.appendSteerNotice('msg-1', { text: '第一次引导' })
      s.appendSteerNotice('msg-1', { text: '第二次引导' })
      const notices = useChatStore.getState().steerNoticesByMessageId
      expect(notices['msg-1']).toHaveLength(2)
      expect(notices['msg-1']?.map((n) => n.text)).toEqual(['第一次引导', '第二次引导'])
    })

    it('不同 messageId 各自独立', () => {
      const s = useChatStore.getState()
      s.appendSteerNotice('msg-1', { text: 'A' })
      s.appendSteerNotice('msg-2', { text: 'B' })
      const notices = useChatStore.getState().steerNoticesByMessageId
      expect(notices['msg-1']).toHaveLength(1)
      expect(notices['msg-2']).toHaveLength(1)
    })

    it('空 messageId 或空 text 不写入', () => {
      const s = useChatStore.getState()
      s.appendSteerNotice('', { text: 'A' })
      s.appendSteerNotice('msg-1', { text: '' })
      expect(useChatStore.getState().steerNoticesByMessageId).toEqual({})
    })

    it('单消息上限 8 条:超限静默丢弃(与 ai-service 队列上限对齐)', () => {
      const s = useChatStore.getState()
      for (let i = 0; i < 10; i++) s.appendSteerNotice('msg-1', { text: `引导${i}` })
      const notices = useChatStore.getState().steerNoticesByMessageId
      expect(notices['msg-1']).toHaveLength(8)
      expect(notices['msg-1']?.[0]?.text).toBe('引导0')
    })

    it('setStreamingAssistantId 登记/清空流式目标消息', () => {
      const s = useChatStore.getState()
      s.setStreamingAssistantId('msg-9')
      expect(useChatStore.getState().streamingAssistantId).toBe('msg-9')
      s.setStreamingAssistantId(null)
      expect(useChatStore.getState().streamingAssistantId).toBeNull()
    })

    it('clearMessages 清空引导记录与流式目标', () => {
      const s = useChatStore.getState()
      s.appendSteerNotice('msg-1', { text: 'A' })
      s.setStreamingAssistantId('msg-1')
      s.clearMessages()
      const after = useChatStore.getState()
      expect(after.steerNoticesByMessageId).toEqual({})
      expect(after.streamingAssistantId).toBeNull()
    })
  })

  // ============ P3 #30 diff 评论驱动返工(2026-09-16 立)============

  describe('diff 评审意见队列', () => {
    beforeEach(() => {
      useChatStore.setState({ pendingDiffComments: [] })
    })

    it('addDiffComment 新增一条(自动补 id 与 createdAt)', () => {
      useChatStore.getState().addDiffComment({
        filePath: 'src/a.ts',
        line: 12,
        lineText: 'const x = 1',
        comment: '用 let',
      })
      const list = useChatStore.getState().pendingDiffComments
      expect(list).toHaveLength(1)
      expect(list[0]).toMatchObject({
        filePath: 'src/a.ts',
        line: 12,
        lineText: 'const x = 1',
        comment: '用 let',
      })
      expect(typeof list[0]?.id).toBe('string')
      expect(typeof list[0]?.createdAt).toBe('number')
    })

    it('addDiffComment 去除正文首尾空白', () => {
      useChatStore.getState().addDiffComment({ filePath: 'a.ts', comment: '  修一下  ' })
      expect(useChatStore.getState().pendingDiffComments[0]?.comment).toBe('修一下')
    })

    it('空正文不入队(防误提交空意见)', () => {
      useChatStore.getState().addDiffComment({ filePath: 'a.ts', comment: '   ' })
      expect(useChatStore.getState().pendingDiffComments).toHaveLength(0)
    })

    it('完全重复(同文件+同行+同正文)忽略,不产生第二条', () => {
      const s = useChatStore.getState()
      s.addDiffComment({ filePath: 'a.ts', line: 3, comment: '改这里' })
      s.addDiffComment({ filePath: 'a.ts', line: 3, comment: '改这里' })
      expect(useChatStore.getState().pendingDiffComments).toHaveLength(1)
    })

    it('同行不同正文视为两条(意见可叠加)', () => {
      const s = useChatStore.getState()
      s.addDiffComment({ filePath: 'a.ts', line: 3, comment: '意见一' })
      s.addDiffComment({ filePath: 'a.ts', line: 3, comment: '意见二' })
      expect(useChatStore.getState().pendingDiffComments).toHaveLength(2)
    })

    it('文件级与行级评论可共存(文件级 line 为 undefined)', () => {
      const s = useChatStore.getState()
      s.addDiffComment({ filePath: 'a.ts', comment: '整体意见' })
      s.addDiffComment({ filePath: 'a.ts', line: 8, comment: '行意见' })
      const list = useChatStore.getState().pendingDiffComments
      expect(list).toHaveLength(2)
      expect(list[0]?.line).toBeUndefined()
      expect(list[1]?.line).toBe(8)
    })

    it('removeDiffComment 按 id 删除单条(其余保持不变)', () => {
      const s = useChatStore.getState()
      s.addDiffComment({ filePath: 'a.ts', line: 1, comment: 'A' })
      s.addDiffComment({ filePath: 'b.ts', line: 2, comment: 'B' })
      const target = useChatStore.getState().pendingDiffComments[0]!
      useChatStore.getState().removeDiffComment(target.id)
      const list = useChatStore.getState().pendingDiffComments
      expect(list).toHaveLength(1)
      expect(list[0]?.comment).toBe('B')
    })

    it('removeDiffComment 传入未知 id 时不破坏队列', () => {
      const s = useChatStore.getState()
      s.addDiffComment({ filePath: 'a.ts', comment: 'A' })
      s.removeDiffComment('not-exist')
      expect(useChatStore.getState().pendingDiffComments).toHaveLength(1)
    })

    it('clearDiffComments 清空全部', () => {
      const s = useChatStore.getState()
      s.addDiffComment({ filePath: 'a.ts', comment: 'A' })
      s.addDiffComment({ filePath: 'b.ts', comment: 'B' })
      s.clearDiffComments()
      expect(useChatStore.getState().pendingDiffComments).toEqual([])
    })

    it('clearMessages 一并清空意见队列(新对话后 diff 卡片已不可见)', () => {
      useChatStore.getState().addDiffComment({ filePath: 'a.ts', comment: 'A' })
      useChatStore.getState().clearMessages()
      expect(useChatStore.getState().pendingDiffComments).toEqual([])
    })

    it('toolCallId 随意见记录(便于回溯哪次改动)', () => {
      useChatStore.getState().addDiffComment({ filePath: 'a.ts', toolCallId: 'tc-9', comment: 'A' })
      expect(useChatStore.getState().pendingDiffComments[0]?.toolCallId).toBe('tc-9')
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
