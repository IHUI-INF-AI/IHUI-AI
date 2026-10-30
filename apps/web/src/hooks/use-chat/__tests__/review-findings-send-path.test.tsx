// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D115 首答主路径接线取证(2026-10-24 立):
// review-findings-wiring.test.tsx 直接调 handler 工厂,证不了"sendMessage 的 streamChat
// 实参里根本没注册 onReviewFinding"这一型(续答路径已注册、首答漏挂正是本票病灶)。
// 本用例喂**真 createSendMessage + 真 store + 真 MessageItem**,只 mock 网络面:
// ① 首答流里来一条 review-finding ⇒ 该 assistant 消息的审查卡出现;
// ② 新建对话(clearMessages)⇒ findings 不残留;同一消息新一轮(index=1)⇒ 旧列表被覆盖。

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'zh-CN',
}))

const { mockStreamChat } = vi.hoisted(() => ({
  mockStreamChat: vi.fn(async (_opts: unknown) => {}),
}))
const { mockToast } = vi.hoisted(() => ({
  mockToast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() },
}))

vi.mock('@ihui/api-client', async (importOriginal) => {
  const orig = (await importOriginal()) as Record<string, unknown>
  return {
    ...orig,
    streamChat: mockStreamChat,
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

vi.mock('../workspace', () => ({
  loadBrowserWorkspaceContext: vi.fn(async () => undefined),
}))

vi.mock('@/stores/agent-hooks', () => ({ emitAgentHook: vi.fn() }))
vi.mock('@/stores/repo-wiki', () => ({ maybeAutoCaptureWiki: vi.fn() }))
vi.mock('@/stores/memory', async (importOriginal) => {
  const orig = (await importOriginal()) as Record<string, unknown>
  return { ...orig, expandRuleToken: (t: string) => t }
})
vi.mock('@/lib/context-token-expander', () => ({
  expandContextTokens: vi.fn(async (t: string) => t),
}))

import type { ReviewFindingEvent } from '@ihui/api-client'

import { MessageItem } from '@/components/chat/message-list/MessageItem'
import { TooltipProvider } from '@/components/feedback'
import { createSendMessage } from '@/hooks/use-chat/send-message'
import type { ChatActionContext } from '@/hooks/use-chat/types'
import { useAuthStore } from '@/stores/auth'
import { useChatStore, type ChatMessage } from '@/stores/chat'

const CONV = 'cccccccc-d115-4959-8959-959595959595'

function makeCtx(): ChatActionContext {
  return {
    t: (key) => key,
    router: { replace: vi.fn() } as unknown as ChatActionContext['router'],
    queryClient: { invalidateQueries: vi.fn() } as unknown as ChatActionContext['queryClient'],
    setFallbackNotice: () => {},
    abortRef: { current: null },
    lastSentContentRef: { current: '' },
    lastSentAnswerRef: { current: null },
    sendInFlightRef: { current: false },
    streamGenerationRef: { current: 0 },
    streamConversationRef: { current: null },
  }
}

function finding(id: string, overrides: Partial<ReviewFindingEvent> = {}): ReviewFindingEvent {
  return {
    findingId: id,
    index: 1,
    total: 1,
    severity: 'P1',
    file: 'src/review.ts',
    line: 42,
    title: `${id} 标题`,
    detail: '',
    suggestion: '',
    ...overrides,
  }
}

/** 真 createSendMessage 发一轮;mock 的 streamChat 在"流内"回调 onReviewFinding。 */
async function sendRound(text: string, ...findings: ReviewFindingEvent[]): Promise<string> {
  mockStreamChat.mockImplementationOnce(async (opts: unknown) => {
    const o = opts as { onReviewFinding?: (e: ReviewFindingEvent) => void }
    // 首答路径必须注册该回调才能解析帧 —— 未注册时 api-client 直接不解析。
    expect(typeof o.onReviewFinding, '首答 streamChat 应注册 onReviewFinding').toBe('function')
    for (const f of findings) o.onReviewFinding?.(f)
  })
  const send = createSendMessage(makeCtx(), useChatStore)
  await send(text)
  const assistant = useChatStore
    .getState()
    .messages.filter((m) => m.role === 'assistant')
    .at(-1) as ChatMessage
  return assistant.id
}

function renderAssistant(message: ChatMessage) {
  render(
    <TooltipProvider>
      <MessageItem message={message} isLast isStreaming={false} assistantLabel="AI" />
    </TooltipProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockStreamChat.mockImplementation(async () => {})
  useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-d115' } as never })
  useChatStore.setState({
    conversationId: CONV,
    currentModel: 'gpt-test',
    isStreaming: false,
    messages: [],
    reviewFindingsByMessageId: {},
  })
})

afterEach(() => {
  cleanup()
  useChatStore.getState().clearMessages()
})

describe('D115 首答主路径:review-finding 帧接线', () => {
  it('首答流里一条 finding ⇒ 该 assistant 消息渲染审查卡', async () => {
    const id = await sendRound('审查一下', finding('rf-1', { severity: 'P1' }))

    expect(useChatStore.getState().reviewFindingsByMessageId[id]?.map((f) => f.findingId)).toEqual([
      'rf-1',
    ])
    renderAssistant(useChatStore.getState().messages.find((m) => m.id === id) as ChatMessage)
    expect(screen.getByTestId(`message-review-findings-${id}`)).toBeTruthy()
    expect(screen.getByTestId('review-group-P1')).toBeTruthy()
    expect(screen.getByTestId('review-finding-rf-1')).toBeTruthy()
  })

  it('新建对话清理不残留;同一消息新一轮 index=1 覆盖旧列表', async () => {
    const firstId = await sendRound('审查一下', finding('rf-1'))

    useChatStore.getState().clearMessages()
    expect(useChatStore.getState().reviewFindingsByMessageId).toEqual({})

    const secondId = await sendRound(
      '再审查一次',
      finding('rf-9', { severity: 'Nit', file: 'src/new.ts' }),
    )
    expect(secondId).not.toBe(firstId)
    expect(
      useChatStore.getState().reviewFindingsByMessageId[secondId]?.map((f) => f.findingId),
    ).toEqual(['rf-9'])

    renderAssistant(useChatStore.getState().messages.find((m) => m.id === secondId) as ChatMessage)
    expect(screen.queryByTestId('review-finding-rf-1')).toBeNull()
    expect(screen.getByTestId('review-finding-rf-9')).toBeTruthy()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
