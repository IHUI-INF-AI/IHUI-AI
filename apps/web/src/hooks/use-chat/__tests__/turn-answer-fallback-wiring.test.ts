// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * 回合答案完整性装车证明(2026-10-29)—— `@ihui/shared/chat/turn-answer-integrity` 的行为面判据。
 *
 * 三句设计意图逐条咬住:
 * ① 空响应 + 流正常结束 ⇒ 不新增 agent 气泡、状态不为"进行中"、且给出重试入口;
 * ② 有内容 + 流结束 ⇒ **不补**,气泡数不变(幂等);
 * ③ 同一轮重复收尾(重连后再收尾)⇒ 仍只有一条,不叠第二张失败卡。
 *
 * 断言一律落在 store 上(转写条数 / isStreaming / error 标记 / 错误码),
 * 以及 `streamChat` 的调用次数 —— 不做源码对账。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockStreamChat, mockToast } = vi.hoisted(() => ({
  mockStreamChat: vi.fn(async (_opts: unknown) => {}),
  mockToast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() },
}))

vi.mock('@ihui/api-client', async (importOriginal) => {
  const orig = (await importOriginal()) as Record<string, unknown>
  return {
    ...orig,
    streamChat: mockStreamChat,
    regenerateConversation: vi.fn(async () => ({ success: false, status: 599 })),
    sendMessage: vi.fn(async () => ({ success: true })),
    persistQuestion: vi.fn(async () => ({ success: true })),
    createConversation: vi.fn(async () => ({ success: false, status: 599 })),
    getMessages: vi.fn(async () => ({ success: false })),
    autoTitleConversation: vi.fn(async () => ({ success: false })),
  }
})

vi.mock('@/lib/api', async (importOriginal) => {
  const orig = (await importOriginal()) as Record<string, unknown>
  return { ...orig, fetchApi: vi.fn(async () => ({ success: false })) }
})

vi.mock('@/components/common', async (importOriginal) => {
  const orig = await importOriginal<Record<string, unknown>>()
  return { ...(orig as object), toast: mockToast }
})

vi.mock('../workspace', () => ({ loadBrowserWorkspaceContext: vi.fn(async () => undefined) }))
vi.mock('@/stores/agent-hooks', () => ({ emitAgentHook: vi.fn() }))
vi.mock('@/stores/repo-wiki', () => ({ maybeAutoCaptureWiki: vi.fn() }))
vi.mock('@/stores/memory', async (importOriginal) => {
  const orig = (await importOriginal()) as Record<string, unknown>
  return { ...orig, expandRuleToken: (t: string) => t }
})
vi.mock('@/lib/context-token-expander', () => ({
  expandContextTokens: vi.fn(async (t: string) => t),
}))

import { createChatStore } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import type { ChatStore } from '@/stores/chat-pane-context'
import { createSendMessage } from '../send-message'
import type { ChatActionContext } from '../types'
import { __test__ as pendingTest } from '../pending-send'
import { applyTurnAnswerFallback } from '../turn-answer-fallback'

const CONV = 'cccccccc-8161-4161-8161-000000000008'

function makeCtx(): ChatActionContext {
  return {
    t: (key) => key,
    router: {} as ChatActionContext['router'],
    queryClient: {} as ChatActionContext['queryClient'],
    setFallbackNotice: () => {},
    abortRef: { current: null },
    lastSentContentRef: { current: '' },
    lastSentAnswerRef: { current: null },
    sendInFlightRef: { current: false },
    streamGenerationRef: { current: 0 },
    streamConversationRef: { current: CONV },
  }
}

function makePane(name: string): ChatStore {
  const pane = createChatStore(`ihui-chat-g8161-${name}`)
  pane.setState({
    conversationId: CONV,
    currentModel: 'gpt-test',
    isStreaming: false,
    messages: [],
  })
  return pane
}

function assistants(pane: ChatStore) {
  return pane.getState().messages.filter((m) => m.role === 'assistant')
}

beforeEach(() => {
  vi.clearAllMocks()
  mockStreamChat.mockImplementation(async () => {})
  useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-g8161' } as never })
  window.localStorage.clear()
  pendingTest.resetLedgerSingleton()
})

describe('① 空响应 + 流正常结束 ⇒ 不伪造 agent 回复,且不卡在"进行中"', () => {
  it('零 delta 收尾:气泡内容不是模型杜撰的答案,状态已回收,并给出失败态 + 重试入口', async () => {
    const pane = makePane('empty')
    const send = createSendMessage(makeCtx(), pane)

    // 流"正常结束"但一个 token 都没有 —— 这正是空气泡的成因
    await expect(send('帮我看下这个文件')).resolves.toBe(true)

    const rows = assistants(pane)
    // 断言"没有伪造回复":占位行没有被写成任何貌似答案的文本,而是一条明确的失败态
    expect(rows).toHaveLength(1)
    expect(rows[0]!.error).toBe(true)
    // 文案来自既有键(本仓的 t 在测试里恒返回 key 本身)
    expect(rows[0]!.content).toBe('emptyAnswerFallback')
    // 落到 shared 层的非"完成"终态:错误码 EMPTY_RESULT ⇒ 失败卡能取到"修改后重试"
    expect(rows[0]!.errorCode).toBe('EMPTY_RESULT')
    // 状态不卡"进行中"
    expect(pane.getState().isStreaming).toBe(false)
    expect(pane.getState().streamingAssistantId).toBeNull()
    // 且已标记为已收尾(刷新后不会再被当成"可续接"而卡住)
    expect(rows[0]!.streamCompleted).toBe(true)
  })

  it('空响应不新增第二条 assistant 行(共享层"不伪造 agent 气泡")', async () => {
    const pane = makePane('empty-count')
    const send = createSendMessage(makeCtx(), pane)
    const before = assistants(pane).length
    await send('空响应测试')
    // 占位行本来就会有一条;关键是**没有多出**一条"agent 说"的气泡
    expect(assistants(pane)).toHaveLength(before + 1)
  })
})

describe('② 有内容 + 流结束 ⇒ 不补(幂等),气泡数不变', () => {
  it('正常答出内容:气泡数不增,内容原样,不落失败态', async () => {
    const pane = makePane('content')
    const send = createSendMessage(makeCtx(), pane)
    mockStreamChat.mockImplementationOnce(async (opts: unknown) => {
      const o = opts as { onDelta: (d: string) => void }
      o.onDelta('这是完整回答')
    })

    await send('有内容测试')

    const rows = assistants(pane)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.content).toBe('这是完整回答')
    expect(rows[0]!.error ?? false).toBe(false)
    expect(pane.getState().isStreaming).toBe(false)
  })

  it('共享层判据:同一文本已在转写里 ⇒ duplicate ⇒ 原样返回入参数组(零写入)', () => {
    const pane = makePane('dup')
    pane.setState({
      messages: [
        { id: 'u1', role: 'user', content: '问题', createdAt: 1 },
        { id: 'a1', role: 'assistant', content: '答案', createdAt: 2 },
      ],
    })
    const result = applyTurnAnswerFallback({
      chatStore: pane,
      answer: '答案',
      alreadyFailed: false,
      userStopped: false,
      host: { model: 'gpt-test' },
    })
    expect(result.decision.kind).toBe('duplicate')
    expect(result.wrote).toBe(false)
    expect(pane.getState().messages).toHaveLength(2)
  })
})

describe('③ 同一轮重复收尾(重连后再收尾)⇒ 仍只有一条', () => {
  it('第二次收尾读到已有失败态 ⇒ 不叠第二张卡,气泡数不变', async () => {
    const pane = makePane('reentry')
    const send = createSendMessage(makeCtx(), pane)
    // 先用共享层把"已有答案"这条路径走一遍(等价于重连后又收尾一次)
    await send('重复收尾测试')
    const rowsAfterFirst = assistants(pane)
    expect(rowsAfterFirst).toHaveLength(1)

    const again = applyTurnAnswerFallback({
      chatStore: pane,
      answer: rowsAfterFirst[0]!.content,
      alreadyFailed: rowsAfterFirst[0]!.error === true,
      userStopped: false,
      host: { model: 'gpt-test' },
    })
    // 失败轮的内容不算答案 ⇒ 共享层判 empty;但已失败 ⇒ 端内零写入(不叠第二张卡)
    expect(again.wrote).toBe(false)
    expect(assistants(pane)).toHaveLength(1)
    expect(pane.getState().messages).toHaveLength(2)
  })

  it('同一答案重复落两次 ⇒ 第二次按内容幂等,转写长度不变', () => {
    const pane = makePane('reentry-content')
    pane.setState({
      messages: [
        { id: 'u1', role: 'user', content: '问题', createdAt: 1 },
        { id: 'a1', role: 'assistant', content: '', createdAt: 2 },
      ],
    })
    const first = applyTurnAnswerFallback({
      chatStore: pane,
      answer: '唯一答案',
      alreadyFailed: false,
      userStopped: false,
      host: { model: 'gpt-test' },
    })
    expect(first.decision.kind).toBe('append')
    expect(first.wrote).toBe(true)
    const lengthAfterFirst = pane.getState().messages.length

    const second = applyTurnAnswerFallback({
      chatStore: pane,
      answer: '唯一答案',
      alreadyFailed: false,
      userStopped: false,
      host: { model: 'gpt-test' },
    })
    expect(second.decision.kind).toBe('duplicate')
    expect(second.wrote).toBe(false)
    expect(pane.getState().messages.length).toBe(lengthAfterFirst)
    // 就地补字而非新建气泡:仍然只有一条 assistant 行
    expect(assistants(pane)).toHaveLength(1)
  })
})

describe('④ 用户主动停止不算"失败"(不把用户的选择说成故障)', () => {
  it('空内容 + 用户停止 ⇒ 不落失败卡', async () => {
    const pane = makePane('stopped')
    const send = createSendMessage(makeCtx(), pane)
    // 发送期间把该占位行标成"用户中断"再让流空收尾
    mockStreamChat.mockImplementationOnce(async (opts: unknown) => {
      const o = opts as { onDelta: (d: string) => void }
      void o
      const streamingId = pane.getState().streamingAssistantId
      if (streamingId) pane.getState().setInterruptedMessage(streamingId)
    })
    await send('用户停止测试')
    const rows = assistants(pane)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.error ?? false).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
