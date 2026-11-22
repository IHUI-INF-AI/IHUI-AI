// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// 票60 步序四(2026-10-25 收尾批):发送链路伴生面的窗格寻址。
// 咬一件事:斜杠命令/手动压缩/失败草稿/工具选择这些"发送链路的伴生写"收到哪个
// store,就落在哪个实例 —— 传窗格实例时不串单例;不传时仍默认单例(既有行为不变)。

import { describe, expect, it, vi, beforeEach } from 'vitest'

import { createChatStore, useChatStore } from '@/stores/chat'
import { resetChatPaneStores } from '@/stores/chat-panes'
import { mergeAgentTools } from '../tool-config'
import { persistMessageSafe } from '../persistence'
import { runManualCompact } from '../manual-compact'
import { tryHandleBtwSlash, tryHandleToolSlash, tryHandleGoalSlash } from '../slash-commands'

const {
  mockPersistMessage,
  mockCompactConversation,
  mockGetMessages,
  mockRunBestOfN,
  mockPostSessionGoal,
  mockToast,
} = vi.hoisted(() => ({
  mockPersistMessage: vi.fn(),
  mockCompactConversation: vi.fn(),
  mockGetMessages: vi.fn(),
  mockRunBestOfN: vi.fn(),
  mockPostSessionGoal: vi.fn(),
  mockToast: Object.assign(vi.fn(), {
    info: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  }),
}))

vi.mock('@ihui/api-client', async (importOriginal) => ({
  // 仓内同款写法(ai-side-panel-tools-pane-scope.test.tsx):泛型用 Record 而非
  // typeof import() —— 后者被 @typescript-eslint/consistent-type-imports 禁止。
  ...(await importOriginal<Record<string, unknown>>()),
  sendMessage: mockPersistMessage,
  persistQuestion: vi.fn(),
  compactConversation: mockCompactConversation,
  getMessages: mockGetMessages,
  postSessionGoal: mockPostSessionGoal,
  runCommand: vi.fn(),
}))
vi.mock('@/api/best-of-api', () => ({ runBestOfN: mockRunBestOfN }))
vi.mock('@/components/common', () => ({ toast: mockToast }))
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const t = (key: string) => key

describe('mergeAgentTools 按 store 实例寻址', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChatPaneStores()
    useChatStore.setState({ selectedTools: [], webSearchEnabled: false })
  })

  it('窗格实例选了工具 ⇒ 从窗格实例读,单例的空选不遮蔽', () => {
    const paneStore = createChatStore('ihui-chat-pane-tools-a')
    // 'playwright-mcp' 是插件 id,经 PLUGIN_ID_TO_TOOLS 展开成 browser_* 工具族
    paneStore.setState({ selectedTools: ['playwright-mcp'] })
    // 单例保持空选:若实现仍读根单例,返回 [] 就会露馅
    expect(useChatStore.getState().selectedTools).toEqual([])

    const tools = mergeAgentTools(paneStore)
    expect(tools.length).toBeGreaterThan(0)
    expect(tools).toContain('browser_screenshot')
  })

  it('不传 store 时默认读单例(既有行为零回归)', () => {
    useChatStore.setState({ webSearchEnabled: true })
    expect(mergeAgentTools()).toEqual(['web_search'])
  })
})

describe('persistMessageSafe 失败草稿按 store 实例寻址', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChatPaneStores()
    useChatStore.getState().clearFailedDraft()
  })

  it('窗格发送失败 ⇒ 草稿写到窗格实例,单例不沾', async () => {
    const paneStore = createChatStore('ihui-chat-pane-draft-a')
    mockPersistMessage.mockResolvedValueOnce({ success: false, error: 'Network error' })

    const outcome = await persistMessageSafe(
      'conv-1',
      'hello',
      'user',
      undefined,
      undefined,
      undefined,
      paneStore,
    )

    expect(outcome.status).toBe('failed_retryable')
    expect(paneStore.getState().failedDraft).toBe('hello')
    expect(useChatStore.getState().failedDraft).toBeNull()
  })

  it('同文草稿落库成功 ⇒ 只清传入实例的草稿', async () => {
    const paneStore = createChatStore('ihui-chat-pane-draft-b')
    paneStore.getState().setFailedDraft('hello', 'failed_retryable')
    useChatStore.getState().setFailedDraft('other', 'failed_retryable')
    mockPersistMessage.mockResolvedValueOnce({ success: true, data: { id: 'm1' } })

    await persistMessageSafe('conv-1', 'hello', 'user', undefined, undefined, undefined, paneStore)

    expect(paneStore.getState().failedDraft).toBeNull()
    expect(useChatStore.getState().failedDraft).toBe('other')
  })

  it('不传 store 时默认写单例(既有行为零回归)', async () => {
    mockPersistMessage.mockResolvedValueOnce({ success: false, error: 'Network error' })

    const outcome = await persistMessageSafe('conv-1', 'hello', 'user')

    expect(outcome.status).toBe('failed_retryable')
    expect(useChatStore.getState().failedDraft).toBe('hello')
  })
})

describe('runManualCompact 按 store 实例寻址', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChatPaneStores()
  })

  it('窗格在流式中 ⇒ 守卫读窗格实例判 skipped(单例闲着也不放行)', async () => {
    const paneStore = createChatStore('ihui-chat-pane-compact-a')
    paneStore.setState({ isStreaming: true })

    const outcome = await runManualCompact('conv-1', t, paneStore)

    expect(outcome).toBe('skipped')
    expect(mockCompactConversation).not.toHaveBeenCalled()
  })

  it('压缩成功 ⇒ 重拉消息写回窗格实例(单例 messages 不动)', async () => {
    const paneStore = createChatStore('ihui-chat-pane-compact-b')
    paneStore.setState({ conversationId: 'conv-1' })
    mockCompactConversation.mockResolvedValueOnce({
      success: true,
      data: { compressed: true, originalTokens: 100, compressedTokens: 40 },
    })
    mockGetMessages.mockResolvedValueOnce({
      success: true,
      data: {
        messages: [
          { id: 'm1', role: 'user', content: 'after-compact', createdAt: '2026-10-25T00:00:00Z' },
        ],
      },
    })

    const outcome = await runManualCompact('conv-1', t, paneStore)

    expect(outcome).toBe('ok')
    expect(paneStore.getState().messages.map((m) => m.content)).toEqual(['after-compact'])
    expect(useChatStore.getState().messages).toEqual([])
  })
})

describe('斜杠命令按 store 实例寻址', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChatPaneStores()
    useChatStore.setState({ messages: [] })
  })

  it('/btw 侧聊回答落到窗格实例,单例 messages 不动', async () => {
    const paneStore = createChatStore('ihui-chat-pane-btw-a')
    mockRunBestOfN.mockResolvedValueOnce({
      candidates: [{ content: 'side answer', model: 'test-model' }],
    })

    const handled = await tryHandleBtwSlash('/btw 什么是多窗格', t, paneStore)

    expect(handled).toBe(true)
    expect(paneStore.getState().messages).toHaveLength(1)
    expect(paneStore.getState().messages[0]?.meta?.sidechat).toBe(true)
    expect(useChatStore.getState().messages).toEqual([])
  })

  it('/diff 收集的是窗格实例的消息(单例无会话改动也不弹 empty)', async () => {
    const paneStore = createChatStore('ihui-chat-pane-diff-a')
    paneStore.setState({
      messages: [
        {
          id: 'm1',
          role: 'assistant',
          content: '```diff\n+ added line\n```',
          createdAt: Date.now(),
          model: 'test-model',
        },
      ],
    })

    const handled = await tryHandleToolSlash('/diff', t, paneStore)

    expect(handled).toBe(true)
  })

  it('/status 的 sidechat 回显写进窗格实例', async () => {
    const paneStore = createChatStore('ihui-chat-pane-status-a')
    paneStore.setState({ conversationId: 'conv-1', messages: [] })

    const handled = await tryHandleToolSlash('/status', t, paneStore)

    expect(handled).toBe(true)
    expect(paneStore.getState().messages).toHaveLength(1)
    expect(paneStore.getState().messages[0]?.meta?.sidechat).toBe(true)
    expect(useChatStore.getState().messages).toEqual([])
  })

  it('/goal clear 上行取的是窗格实例的 conversationId', () => {
    const paneStore = createChatStore('ihui-chat-pane-goal-a')
    paneStore.setState({ conversationId: 'conv-pane-9' })
    mockPostSessionGoal.mockResolvedValueOnce({ accepted: true })

    const handled = tryHandleGoalSlash('/goal clear', t, paneStore)

    expect(handled).toBe(true)
    expect(mockPostSessionGoal).toHaveBeenCalledWith(
      'conv-pane-9',
      expect.objectContaining({ action: 'clear' }),
    )
  })

  it('不传 store 时全部默认单例(既有行为零回归)', async () => {
    useChatStore.setState({ conversationId: 'conv-root' })
    mockRunBestOfN.mockResolvedValueOnce({
      candidates: [{ content: 'root answer', model: 'test-model' }],
    })

    const handled = await tryHandleBtwSlash('/btw hi', t)

    expect(handled).toBe(true)
    expect(useChatStore.getState().messages).toHaveLength(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
