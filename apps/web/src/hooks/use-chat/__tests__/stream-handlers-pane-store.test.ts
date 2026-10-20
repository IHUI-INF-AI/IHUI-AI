// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 片2(2026-10-20):stream-handlers 工厂注入窗格 store。
// 成对留证(正向必须配一把"摘掉注入即复现旧行为"的反证,否则用例没有牙):
//  ① 正向 = 传窗格 store 时,tool-call / usage / agent-delta / 压缩预告 / tool-summary
//     写入该窗格实例,另一实例(根侧)快照零变化;
//  ② 反证 = 不传 store(缺省回落)时,写入必须落根单例 useChatStore —— 这正是本次
//     要修的"正文走窗格、工具/用量落根"的串窗格错账,旧行为必须被复现并被断言。

// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createChatStore, useChatStore, type ChatMessage } from '@/stores/chat'
import type { ChatStore } from '@/stores/chat-pane-context'
import type { ToolDeltaEvent, ToolSummaryEvent, UsageEvent } from '@ihui/api-client'
import {
  clearCompactionPreview,
  createAgentDeltaBatcher,
  createToolCallHandler,
  createToolDeltaHandler,
  createToolSummaryHandler,
  createUsageHandler,
} from '../stream-handlers'

const MSG_ID = 'msg-pane-inject-1'

/** 两边各放一条同 id 助手消息(addMessage 自造 id,这里用 setMessages 显式钉死) */
function seed(store: ChatStore): void {
  const message: ChatMessage = {
    id: MSG_ID,
    role: 'assistant',
    content: '',
    createdAt: 1,
    model: 'test-model',
  }
  store.getState().setMessages([message])
}

function makeStores(): { pane: ChatStore; other: ChatStore } {
  const pane = createChatStore('ihui-chat-pane-inject-test-pane')
  const other = createChatStore('ihui-chat-pane-inject-test-other')
  seed(pane)
  seed(other)
  return { pane, other }
}

const toolCallStart = {
  type: 'tool-call-start' as const,
  toolCallId: 'tc-1',
  toolName: 'read_file',
  args: { path: 'a.txt' },
}

const usageEvent = (over: Partial<UsageEvent> = {}): UsageEvent => ({
  promptTokens: 10,
  completionTokens: 20,
  totalTokens: 30,
  reasoningTokens: null,
  messageId: MSG_ID,
  timing: null,
  model: 'm',
  costUsd: null,
  ...over,
})

const summaryEvent = (over: Partial<ToolSummaryEvent> = {}): ToolSummaryEvent => ({
  filesSearched: 1,
  webSearched: 0,
  filesModified: 2,
  linesAdded: 3,
  linesDeleted: 4,
  toolsByCategory: {},
  totalCalls: 5,
  ...over,
})

describe('stream-handlers 工厂按窗格 store 注入(片2)', () => {
  let stores: { pane: ChatStore; other: ChatStore } = makeStores()

  const resetRoot = (): void => {
    useChatStore.setState({
      messages: [],
      usageByMessageId: {},
      subAgentActivities: [],
    })
    useChatStore.getState().setCompactionStatus(null)
  }

  beforeEach(() => {
    stores = makeStores()
    resetRoot()
  })

  afterEach(() => {
    resetRoot()
  })

  describe('正向:注入窗格 store ⇒ 只写该实例,另一实例零变化', () => {
    it('createToolCallHandler:tool-call-start 写入窗格 store 的 messages', () => {
      createToolCallHandler(MSG_ID, stores.pane)(toolCallStart)

      expect(stores.pane.getState().messages[0]?.toolCalls?.map((t) => t.id)).toEqual(['tc-1'])
      expect(stores.other.getState().messages[0]?.toolCalls ?? []).toEqual([])
      expect(useChatStore.getState().messages).toEqual([])
    })

    it('createToolCallHandler:tool-result 更新窗格实例,另一实例仍无该 toolCall', () => {
      const handler = createToolCallHandler(MSG_ID, stores.pane)
      handler(toolCallStart)
      handler({
        type: 'tool-result',
        toolCallId: 'tc-1',
        toolName: 'read_file',
        result: 'ok',
        durationMs: 5,
      })

      expect(stores.pane.getState().messages[0]?.toolCalls?.[0]?.status).toBe('success')
      expect(stores.other.getState().messages[0]?.toolCalls ?? []).toEqual([])
    })

    it('createUsageHandler:用量落窗格实例 usageByMessageId,另一实例索引为空', () => {
      createUsageHandler(MSG_ID, stores.pane)(usageEvent())

      expect(stores.pane.getState().usageByMessageId[MSG_ID]?.totalTokens).toBe(30)
      expect(Object.keys(stores.other.getState().usageByMessageId)).toEqual([])
    })

    it('createAgentDeltaBatcher:增量落窗格实例 subAgentActivities,另一实例不受影响', () => {
      const batcher = createAgentDeltaBatcher(stores.pane)
      batcher.batch('agent-a', 'hello')
      batcher.flushAll()

      expect(stores.pane.getState().subAgentActivities[0]?.streamingContent).toBe('hello')
      expect(stores.other.getState().subAgentActivities).toEqual([])
    })

    it('clearCompactionPreview:只清窗格实例的 compacting 预告态', () => {
      stores.pane.getState().setCompactionStatus({ phase: 'compacting' })
      stores.other.getState().setCompactionStatus({ phase: 'compacting' })

      clearCompactionPreview(stores.pane)

      expect(stores.pane.getState().compactionStatus).toBeNull()
      expect(stores.other.getState().compactionStatus?.phase).toBe('compacting')
    })

    it('createToolSummaryHandler:汇总落窗格实例,另一实例消息不带 toolCallSummary', () => {
      createToolSummaryHandler(MSG_ID, stores.pane)(summaryEvent())

      expect(stores.pane.getState().messages[0]?.toolCallSummary?.filesModified).toBe(2)
      expect(stores.other.getState().messages[0]?.toolCallSummary).toBeUndefined()
    })

    it('createToolDeltaHandler:partialDiff 写窗格实例,另一实例零写入', () => {
      const tc = { id: 'tc-1', toolName: 'write_file', args: {}, status: 'running' as const }
      stores.pane
        .getState()
        .setMessages([{ ...stores.pane.getState().messages[0]!, toolCalls: [tc] }])
      stores.other
        .getState()
        .setMessages([{ ...stores.other.getState().messages[0]!, toolCalls: [tc] }])

      const evt: ToolDeltaEvent = { toolCallId: 'tc-1', seq: 1, partialText: '+line' }
      createToolDeltaHandler(MSG_ID, stores.pane)(evt)

      expect(stores.pane.getState().messages[0]?.toolCalls?.[0]?.partialDiff).toBe('+line')
      expect(stores.other.getState().messages[0]?.toolCalls?.[0]?.partialDiff).toBeUndefined()
    })
  })

  describe('反证:不传 store(缺省回落根单例)⇒ 复现串窗格旧行为', () => {
    it('省略第二参 ⇒ createToolCallHandler 写根单例 useChatStore,窗格实例零变化', () => {
      seed(useChatStore)
      createToolCallHandler(MSG_ID)(toolCallStart)

      expect(useChatStore.getState().messages[0]?.toolCalls?.map((t) => t.id)).toEqual(['tc-1'])
      expect(stores.pane.getState().messages[0]?.toolCalls ?? []).toEqual([])
    })

    it('显式传 undefined ⇒ createUsageHandler 写根单例索引,窗格实例为空', () => {
      createUsageHandler(MSG_ID, undefined)(usageEvent())

      expect(useChatStore.getState().usageByMessageId[MSG_ID]?.totalTokens).toBe(30)
      expect(Object.keys(stores.pane.getState().usageByMessageId)).toEqual([])
    })

    it('显式传 undefined ⇒ createAgentDeltaBatcher 的增量落根单例', () => {
      const batcher = createAgentDeltaBatcher(undefined)
      batcher.batch('agent-a', 'hello')
      batcher.flushAll()

      expect(useChatStore.getState().subAgentActivities[0]?.streamingContent).toBe('hello')
      expect(stores.pane.getState().subAgentActivities).toEqual([])
    })

    it('显式传 undefined ⇒ clearCompactionPreview 清的是根单例,窗格实例不动', () => {
      useChatStore.getState().setCompactionStatus({ phase: 'compacting' })
      stores.pane.getState().setCompactionStatus({ phase: 'compacting' })

      clearCompactionPreview(undefined)

      expect(useChatStore.getState().compactionStatus).toBeNull()
      expect(stores.pane.getState().compactionStatus?.phase).toBe('compacting')
    })

    it('省略第二参 ⇒ createToolSummaryHandler / createToolDeltaHandler 落根单例', () => {
      const tc = { id: 'tc-1', toolName: 'write_file', args: {}, status: 'running' as const }
      seed(useChatStore)
      useChatStore
        .getState()
        .setMessages([{ ...useChatStore.getState().messages[0]!, toolCalls: [tc] }])

      createToolSummaryHandler(MSG_ID)(summaryEvent())
      const evt: ToolDeltaEvent = { toolCallId: 'tc-1', seq: 1, partialText: '+line' }
      createToolDeltaHandler(MSG_ID)(evt)

      expect(useChatStore.getState().messages[0]?.toolCallSummary?.totalCalls).toBe(5)
      expect(useChatStore.getState().messages[0]?.toolCalls?.[0]?.partialDiff).toBe('+line')
      expect(stores.pane.getState().messages[0]?.toolCallSummary).toBeUndefined()
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
