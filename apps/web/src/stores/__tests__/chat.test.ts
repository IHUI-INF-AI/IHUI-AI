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

  // D92(2026-09-24):错误码必须活到渲染侧 —— 分类表要它才能取到"标题/建议动作",
  // 只把中文文案塞进 content 会让错误卡退回笼统标题(即 D71② 此前的真实障碍)。
  it('setMessageError 带 errorCode → 落到消息上供分类表取词', () => {
    const id = useChatStore.getState().addMessage({ role: 'assistant', content: '', model: 'm' })
    useChatStore.getState().setMessageError(id, '后端超时', 'backend_timeout')
    const msg = useChatStore.getState().messages[0]
    expect(msg?.errorCode).toBe('backend_timeout')
    expect(msg?.error).toBe(true)
  })

  it('setMessageError 两参调用(旧形态)→ 不写 errorCode 键,行为不变', () => {
    const id = useChatStore.getState().addMessage({ role: 'assistant', content: '', model: 'm' })
    useChatStore.getState().setMessageError(id, 'boom')
    const msg = useChatStore.getState().messages[0]
    expect(msg && Object.prototype.hasOwnProperty.call(msg, 'errorCode')).toBe(false)
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

  // ============ D22 引用回复 + 网页搜索开关(2026-09-19 立)============

  describe('D22 quotedMessage / webSearchEnabled', () => {
    beforeEach(() => {
      useChatStore.setState({ quotedMessage: null, webSearchEnabled: false })
    })

    it('setQuotedMessage 设置引用目标(null 语义为清除,输入区 chip 数据源)', () => {
      const q = { id: 'msg-1', role: 'assistant' as const, content: '被引用的回答' }
      useChatStore.getState().setQuotedMessage(q)
      expect(useChatStore.getState().quotedMessage).toEqual(q)
      useChatStore.getState().setQuotedMessage(null)
      expect(useChatStore.getState().quotedMessage).toBeNull()
    })

    it('setWebSearchEnabled 切换开关并回写 localStorage(用户偏好跨刷新保留)', () => {
      useChatStore.getState().setWebSearchEnabled(true)
      expect(useChatStore.getState().webSearchEnabled).toBe(true)
      expect(localStorage.getItem('ihui_web_search_enabled')).toBe('1')
      useChatStore.getState().setWebSearchEnabled(false)
      expect(useChatStore.getState().webSearchEnabled).toBe(false)
      expect(localStorage.getItem('ihui_web_search_enabled')).toBe('0')
    })
  })

  // ============ D28 /side 快速侧问队列(2026-09-20 立,按会话分桶)============

  describe('D28 /side 侧问队列(sideQueueByConversation)', () => {
    beforeEach(() => {
      useChatStore.setState({ sideQueueByConversation: {} })
    })

    it('enqueueSideQuestion 追加条目(text trim,id/createdAt 自动生成)', () => {
      useChatStore.getState().enqueueSideQuestion('conv-1', '  什么是量子纠缠?  ')
      const bucket = useChatStore.getState().sideQueueByConversation['conv-1']
      expect(bucket).toHaveLength(1)
      expect(bucket?.[0]?.text).toBe('什么是量子纠缠?')
      expect(bucket?.[0]?.id.length).toBeGreaterThan(0)
      expect(bucket?.[0]?.createdAt).toBeGreaterThan(0)
    })

    it('enqueueSideQuestion 多条追加保持 FIFO 顺序', () => {
      useChatStore.getState().enqueueSideQuestion('conv-1', '第一条')
      useChatStore.getState().enqueueSideQuestion('conv-1', '第二条')
      useChatStore.getState().enqueueSideQuestion('conv-1', '第三条')
      const texts = useChatStore.getState().sideQueueByConversation['conv-1']?.map((q) => q.text)
      expect(texts).toEqual(['第一条', '第二条', '第三条'])
    })

    it('enqueueSideQuestion 空正文 / 空会话 id 均不入队(不建桶)', () => {
      useChatStore.getState().enqueueSideQuestion('conv-1', '   ')
      useChatStore.getState().enqueueSideQuestion('', '有正文但无会话')
      expect(useChatStore.getState().sideQueueByConversation).toEqual({})
    })

    it('不同会话分桶互不影响(切会话不丢队列)', () => {
      useChatStore.getState().enqueueSideQuestion('conv-1', 'A 会话侧问')
      useChatStore.getState().enqueueSideQuestion('conv-2', 'B 会话侧问')
      const map = useChatStore.getState().sideQueueByConversation
      expect(map['conv-1']?.[0]?.text).toBe('A 会话侧问')
      expect(map['conv-2']?.[0]?.text).toBe('B 会话侧问')
    })

    it('removeSideQuestion 按 id 删除且其余保留', () => {
      useChatStore.getState().enqueueSideQuestion('conv-1', 'q1')
      useChatStore.getState().enqueueSideQuestion('conv-1', 'q2')
      const target = useChatStore.getState().sideQueueByConversation['conv-1']?.[0]
      expect(target).toBeDefined()
      useChatStore.getState().removeSideQuestion('conv-1', target!.id)
      const bucket = useChatStore.getState().sideQueueByConversation['conv-1']
      expect(bucket).toHaveLength(1)
      expect(bucket?.[0]?.text).toBe('q2')
    })

    it('removeSideQuestion 删空后整桶删除(不留空数组键)', () => {
      useChatStore.getState().enqueueSideQuestion('conv-1', 'q1')
      const only = useChatStore.getState().sideQueueByConversation['conv-1']?.[0]
      useChatStore.getState().removeSideQuestion('conv-1', only!.id)
      expect(useChatStore.getState().sideQueueByConversation['conv-1']).toBeUndefined()
    })

    it('removeSideQuestion 未知 id 不破坏队列', () => {
      useChatStore.getState().enqueueSideQuestion('conv-1', 'q1')
      useChatStore.getState().removeSideQuestion('conv-1', 'not-exist')
      expect(useChatStore.getState().sideQueueByConversation['conv-1']).toHaveLength(1)
    })

    it('shiftSideQuestion 出队队首并返回该条目,剩余队列保持顺序', () => {
      useChatStore.getState().enqueueSideQuestion('conv-1', '队首问题')
      useChatStore.getState().enqueueSideQuestion('conv-1', '队尾问题')
      const head = useChatStore.getState().shiftSideQuestion('conv-1')
      expect(head?.text).toBe('队首问题')
      const texts = useChatStore.getState().sideQueueByConversation['conv-1']?.map((q) => q.text)
      expect(texts).toEqual(['队尾问题'])
    })

    it('shiftSideQuestion 最后一条出队后删键;空桶再 shift 返回 null', () => {
      useChatStore.getState().enqueueSideQuestion('conv-1', '唯一一条')
      const head = useChatStore.getState().shiftSideQuestion('conv-1')
      expect(head?.text).toBe('唯一一条')
      expect(useChatStore.getState().sideQueueByConversation['conv-1']).toBeUndefined()
      expect(useChatStore.getState().shiftSideQuestion('conv-1')).toBeNull()
    })

    it('shiftSideQuestion 未知会话返回 null', () => {
      expect(useChatStore.getState().shiftSideQuestion('conv-none')).toBeNull()
    })
  })

  // D38 队列语义完整交互(2026-09-24 立):四动作 + 模式偏好的 store 层契约。
  // 渲染层许可门在 queue-interaction-bar.test.tsx;这里只断言幂等状态变更与
  // 「重排后发送顺序」—— 消费路径(shiftSideQuestion / interruptAndRun)读到的是重排后的顺序,
  // 消费点本身(message-input 流结束 effect)一行不动。
  describe('D38 队列四动作与模式偏好', () => {
    beforeEach(() => {
      // 本组自持隔离:D28 组共用 conv-1 桶,且 sideQueueByConversation 持久化跨用例存留
      useChatStore.setState({ sideQueueByConversation: {}, followUpQueueMode: 'queue' })
    })
    const textsOf = (conv: string) =>
      useChatStore.getState().sideQueueByConversation[conv]?.map((q) => q.text)

    it('requeue 重排后,消费按新顺序取队首 —— 发送顺序断言', () => {
      useChatStore.getState().enqueueSideQuestion('conv-1', '甲')
      useChatStore.getState().enqueueSideQuestion('conv-1', '乙')
      useChatStore.getState().enqueueSideQuestion('conv-1', '丙')
      // 尾位提到队首:显示顺序 [丙, 甲, 乙]
      useChatStore.getState().requeue('conv-1', 2, 0)
      expect(textsOf('conv-1')).toEqual(['丙', '甲', '乙'])
      // 流结束自动补答消费的是新队首丙,而不是入队最早的甲
      const head = useChatStore.getState().shiftSideQuestion('conv-1')
      expect(head?.text).toBe('丙')
      expect(textsOf('conv-1')).toEqual(['甲', '乙'])
    })

    it('requeue 越界 / 同位 / 非整数 / 未知会话一律 no-op', () => {
      useChatStore.getState().enqueueSideQuestion('conv-1', '唯一')
      const before = useChatStore.getState().sideQueueByConversation['conv-1']
      useChatStore.getState().requeue('conv-1', 0, 0) // 同位
      useChatStore.getState().requeue('conv-1', 0, 5) // 越界
      useChatStore.getState().requeue('conv-1', -1, 0) // 负索引
      useChatStore.getState().requeue('conv-1', 0.5, 1) // 非整数
      useChatStore.getState().requeue('conv-none', 0, 1) // 未知会话
      expect(useChatStore.getState().sideQueueByConversation['conv-1']).toEqual(before)
    })

    it('removeQueued 按 id 移除;未知 id no-op;删空删键', () => {
      useChatStore.getState().enqueueSideQuestion('conv-1', '第一条')
      useChatStore.getState().enqueueSideQuestion('conv-1', '第二条')
      const ids = useChatStore.getState().sideQueueByConversation['conv-1']!.map((q) => q.id)
      useChatStore.getState().removeQueued('conv-1', 'not-exist')
      expect(textsOf('conv-1')).toEqual(['第一条', '第二条'])
      useChatStore.getState().removeQueued('conv-1', ids[0]!)
      expect(textsOf('conv-1')).toEqual(['第二条'])
      useChatStore.getState().removeQueued('conv-1', ids[1]!)
      expect(useChatStore.getState().sideQueueByConversation['conv-1']).toBeUndefined()
    })

    it('editQueued 只改文本不动元数据;trim;空文本 / 未知 id no-op', () => {
      useChatStore.getState().enqueueSideQuestion('conv-1', '原始')
      const item = useChatStore.getState().sideQueueByConversation['conv-1']![0]!
      useChatStore.getState().editQueued('conv-1', item.id, '  改后  ')
      const after = useChatStore.getState().sideQueueByConversation['conv-1']![0]!
      expect(after.text).toBe('改后')
      expect(after.createdAt).toBe(item.createdAt)
      useChatStore.getState().editQueued('conv-1', item.id, '   ')
      expect(textsOf('conv-1')).toEqual(['改后'])
      useChatStore.getState().editQueued('conv-1', 'not-exist', 'x')
      expect(textsOf('conv-1')).toEqual(['改后'])
    })

    it('interruptAndRun 返回队首并摘除(消费语义同 shift);空桶 null', () => {
      useChatStore.getState().enqueueSideQuestion('conv-1', '队首')
      useChatStore.getState().enqueueSideQuestion('conv-1', '队尾')
      const head = useChatStore.getState().interruptAndRun('conv-1')
      expect(head?.text).toBe('队首')
      expect(textsOf('conv-1')).toEqual(['队尾'])
      useChatStore.getState().interruptAndRun('conv-1')
      useChatStore.getState().interruptAndRun('conv-1')
      expect(useChatStore.getState().shiftSideQuestion('conv-1')).toBeNull()
    })

    it('setFollowUpQueueMode 切换生效;同值 no-op(状态引用不变)', () => {
      useChatStore.getState().setFollowUpQueueMode('steer')
      expect(useChatStore.getState().followUpQueueMode).toBe('steer')
      const before = useChatStore.getState()
      useChatStore.getState().setFollowUpQueueMode('steer')
      expect(useChatStore.getState()).toBe(before)
      useChatStore.getState().setFollowUpQueueMode('queue')
      expect(useChatStore.getState().followUpQueueMode).toBe('queue')
    })
  })

  // ============ G-703(2026-09-29 立)运行域状态一次性回收 ============
  //
  // 票面诊断的那一型:`setStreaming` 是裸写单键,而 `aiStreamSessionId`(postTerminalInput 的
  // 唯一上行寻址凭据)除初值与 clearMessages 外**没有任何清除点** —— 于是回合进终态后,
  // 上一轮的 sessionId 继续被下一轮的消费点拿去用(假"还在跑" + 把输入送到一条已死的流)。
  // 所以这里的用例分成三件事:① 终态真的把三键并列回收;② 出口只有一个(两条路径同形);
  // ③ 回收**不越界**(非运行域键不得被顺手清 —— 票面同样明令禁止)。

  describe('G-703 终态一次性回收运行域寻址凭据', () => {
    beforeEach(() => {
      useChatStore.setState({
        isStreaming: false,
        streamingAssistantId: null,
        aiStreamSessionId: null,
      })
    })

    /** 把"一轮正在跑"的运行域凭据摆齐(与 send-message 的真实顺序同形:
     *  先 setStreaming(true),再登记 steer 目标与观察到的流会话 ID)。 */
    const seedRunningRound = (): void => {
      const store = useChatStore.getState()
      store.setStreaming(true)
      store.setStreamingAssistantId('msg-1')
      store.noteStreamSessionId('sess-old')
    }

    const runScopedSnapshot = () => {
      const s = useChatStore.getState()
      return {
        isStreaming: s.isStreaming,
        streamingAssistantId: s.streamingAssistantId,
        aiStreamSessionId: s.aiStreamSessionId,
      }
    }

    it('setStreaming(false) 同事务回收三键(票面点名的 aiStreamSessionId 必须有清除点)', () => {
      seedRunningRound()
      expect(runScopedSnapshot()).toEqual({
        isStreaming: true,
        streamingAssistantId: 'msg-1',
        aiStreamSessionId: 'sess-old',
      })

      useChatStore.getState().setStreaming(false)

      expect(runScopedSnapshot()).toEqual({
        isStreaming: false,
        streamingAssistantId: null,
        aiStreamSessionId: null,
      })
    })

    it('clearRunScopedState() 与 setStreaming(false) 必须同形(单一出口,不是两套复位逻辑)', () => {
      seedRunningRound()
      useChatStore.getState().clearRunScopedState()
      const viaExit = runScopedSnapshot()

      seedRunningRound()
      useChatStore.getState().setStreaming(false)
      const viaSetter = runScopedSnapshot()

      expect(viaExit).toEqual(viaSetter)
      expect(viaSetter).toEqual({
        isStreaming: false,
        streamingAssistantId: null,
        aiStreamSessionId: null,
      })
    })

    it('setStreaming(true) 只置运行标志,不得顺手抹掉本轮已登记的凭据(正向对照)', () => {
      // 真实顺序:send-message 先 setStreaming(true),sessionId 是**之后**由同源帧观察登记的;
      // 若 true 侧也走复位集合,每一轮刚开始就把刚登记的地址清掉了 —— 那是另一种丢状态。
      useChatStore.getState().noteStreamSessionId('sess-keep')
      useChatStore.getState().setStreamingAssistantId('msg-keep')
      useChatStore.getState().setStreaming(true)
      const s = useChatStore.getState()
      expect(s.isStreaming).toBe(true)
      expect(s.aiStreamSessionId).toBe('sess-keep')
      expect(s.streamingAssistantId).toBe('msg-keep')
    })

    it('clearMessages 同样回收运行域三键(新建对话不继承上一轮)', () => {
      useChatStore.getState().addMessage({ role: 'user', content: 'a', model: 'm' })
      seedRunningRound()
      useChatStore.getState().clearMessages()
      expect(useChatStore.getState().messages).toEqual([])
      expect(runScopedSnapshot()).toEqual({
        isStreaming: false,
        streamingAssistantId: null,
        aiStreamSessionId: null,
      })
    })

    it('回收不得越界:终端缓冲 / 中断续接键 / 消息本体都不在运行域清单里', () => {
      // 票面另一半约束("不得顺手清非运行域的键")。这一条防的是下一次有人"顺手把清单加大":
      // terminalOutputs 是**终态渲染**要取的更完整缓冲(见 chat.ts :295-308 原注释),
      // interruptedMessageId 是 #21「中断后追加指令继续」在流结束后仍要读的键。
      const id = useChatStore.getState().addMessage({ role: 'assistant', content: 'x', model: 'm' })
      useChatStore.getState().appendTerminalOutput('t-1', '命令输出')
      useChatStore.getState().setTerminalInteraction('t-1', {
        promptTail: 'Password:',
        waitingSinceMs: 1_000,
        maxInputChars: 8,
        submitting: false,
        failed: false,
      })
      useChatStore.getState().setInterruptedMessage(id)
      seedRunningRound()

      useChatStore.getState().setStreaming(false)

      const s = useChatStore.getState()
      expect(s.terminalOutputs['t-1']).toBe('命令输出')
      expect(s.terminalInteractions['t-1']).toBeDefined()
      expect(s.interruptedMessageId).toBe(id)
      expect(s.messages).toHaveLength(1)
    })
  })

  // ============ G-704(2026-09-29 立)值等价即不写 ============
  //
  // 要防的是"回声写":高频 SSE 写入位(send-message 每 800ms 写一次 meta.usage)每帧都**新造**
  // 一个对象交给 store,store 无条件产出新 state ⇒ 订阅侧收到"变了" ⇒ store→effect→set 自环。
  // 用例判的就是"确实没写"这一件事:相等时 **state 引用必须逐字不变**(`toBe`,不是 toEqual),
  // 并且每条短路都配一条"值真变了 ⇒ 必须写"的阳性对照 —— 否则一台恒不写的尺子也能全绿。

  describe('G-704 值等价即不写(高频 SSE 写入位)', () => {
    beforeEach(() => {
      useChatStore.setState({ messages: [], memoryUpdateNotices: [] })
    })

    const addAssistant = (): string =>
      useChatStore.getState().addMessage({ role: 'assistant', content: '', model: 'm' })

    it('updateMessageMeta:同一帧写两次 ⇒ state 引用不变(连消息对象都不重建)', () => {
      const id = addAssistant()
      useChatStore
        .getState()
        .updateMessageMeta(id, { usage: { total: 6, prompt: 4, completion: 2 } })
      const afterFirst = useChatStore.getState()
      const messageAfterFirst = afterFirst.messages[0]
      expect(messageAfterFirst).toBeDefined()

      // 第二帧:全新造的对象、逐字段等值、键序刻意不同(比较器必须键序无关)
      useChatStore.getState().updateMessageMeta(id, {
        usage: { prompt: 4, completion: 2, total: 6 },
      })

      expect(useChatStore.getState()).toBe(afterFirst)
      expect(useChatStore.getState().messages).toBe(afterFirst.messages)
      expect(useChatStore.getState().messages[0]).toBe(messageAfterFirst)
    })

    it('updateMessageMeta:嵌套里一个叶子真变了 ⇒ 必须写(阳性对照:短路不得吞掉更新)', () => {
      const id = addAssistant()
      useChatStore.getState().updateMessageMeta(id, { usage: { total: 6, prompt: 4 } })
      const before = useChatStore.getState()

      useChatStore.getState().updateMessageMeta(id, { usage: { total: 7, prompt: 4 } })

      const after = useChatStore.getState()
      expect(after).not.toBe(before)
      expect(after.messages[0]?.meta).toEqual({ usage: { total: 7, prompt: 4 } })
    })

    it('updateMessageMeta:新增兄弟键 ⇒ 必须写,且不动既有键', () => {
      const id = addAssistant()
      useChatStore.getState().updateMessageMeta(id, { usage: { total: 6 } })
      useChatStore.getState().updateMessageMeta(id, { durationMs: 1_200 })
      expect(useChatStore.getState().messages[0]?.meta).toEqual({
        usage: { total: 6 },
        durationMs: 1_200,
      })
    })

    it('updateMessageMeta:空 meta 且目标本就没有 meta ⇒ 不产出幻影键(等价即不写)', () => {
      const id = addAssistant()
      const before = useChatStore.getState()
      useChatStore.getState().updateMessageMeta(id, {})
      expect(useChatStore.getState()).toBe(before)
      expect(useChatStore.getState().messages[0]?.meta).toBeUndefined()
    })

    it('updateMessageMeta:未知 messageId 仍是 no-op(既有早退语义未被等价短路改变)', () => {
      addAssistant()
      const before = useChatStore.getState()
      useChatStore.getState().updateMessageMeta('no-such-message-id', { usage: { total: 1 } })
      expect(useChatStore.getState()).toBe(before)
    })

    it('appendMemoryNotice:同批 items 重放 ⇒ state 引用不变(done 重放 / 历史与 done 先后到齐)', () => {
      useChatStore.getState().appendMemoryNotice('m-1', ['已记住 A'])
      const before = useChatStore.getState()
      const noticesBefore = before.memoryUpdateNotices

      useChatStore.getState().appendMemoryNotice('m-1', ['已记住 A'])

      expect(useChatStore.getState()).toBe(before)
      expect(useChatStore.getState().memoryUpdateNotices).toBe(noticesBefore)
      expect(useChatStore.getState().memoryUpdateNotices).toHaveLength(1)
    })

    it('appendMemoryNotice:确有新条目 ⇒ 照写并合并去重(阳性对照)', () => {
      useChatStore.getState().appendMemoryNotice('m-1', ['已记住 A'])
      const before = useChatStore.getState()

      useChatStore.getState().appendMemoryNotice('m-1', ['已记住 B', '已记住 A'])

      const after = useChatStore.getState()
      expect(after).not.toBe(before)
      expect(after.memoryUpdateNotices).toHaveLength(1)
      expect(after.memoryUpdateNotices[0]?.items).toEqual(['已记住 A', '已记住 B'])
    })

    it('appendMemoryNotice:不同 messageId ⇒ 各写一条(等价短路只作用于同一条目)', () => {
      useChatStore.getState().appendMemoryNotice('m-1', ['同一句话'])
      const before = useChatStore.getState()
      useChatStore.getState().appendMemoryNotice('m-2', ['同一句话'])
      expect(useChatStore.getState()).not.toBe(before)
      expect(useChatStore.getState().memoryUpdateNotices).toHaveLength(2)
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
