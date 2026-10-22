// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li ChuanChuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// 票59(消息级版本切换 3/3,2026-10-22 立):前端 regenerate 链的 sibling 语义装车证明。
//
// 病灶(1/3 改了服务端、2/3 装了投影,唯独这条前端链没跟上):regenerateMessage 曾调
// truncateMessagesFrom 物理截断本地列表,新回复经 addMessage 裸追加且 streamChat 不带坐标
// —— 与已改 sibling 的服务端矛盾:刷新后旧回复(库里还在)+ 无坐标新回复并存,
// 读投影判不出族,版本切换器不出现,旧回复变"删不掉的幽灵"。
//
// 判据有牙(行为面,非源码对账):
//  ① regenerate 成功后旧回复仍在列表(改回 truncateMessagesFrom ⇒ 该断言当场红);
//  ② 族根被补 siblingIndex=0、占位行带 (parentMessageId, siblingIndex) 按族尾插入
//     (改回 addMessage 裸追加 ⇒ 坐标断言红);
//  ③ streamChat metadata 携带坐标(删透传 ⇒ 红);非 version 流 metadata **没有**这两键
//     (无条件写 ⇒ 普通发送请求体被污染 ⇒ 红);
//  ④ history 切到族根之前,旧回复不进上下文(不切 ⇒ 旧回复混进 messages ⇒ 红);
//     族根缺席时回落全量(与投影"族根缺席整族保留"同失效方向);
//  ⑤ /regenerate 失败 ⇒ 零截断、零 streamChat、toast.error(旧链失败前已截断 ⇒ 红)。

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockStreamChat, mockRegenerateConversation } = vi.hoisted(() => ({
  mockStreamChat: vi.fn(async (_opts: unknown) => {}),
  mockRegenerateConversation: vi.fn(),
}))
const { mockToast } = vi.hoisted(() => ({
  mockToast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() },
}))

vi.mock('@ihui/api-client', async (importOriginal) => {
  const orig = (await importOriginal()) as Record<string, unknown>
  return {
    ...orig,
    streamChat: mockStreamChat,
    regenerateConversation: mockRegenerateConversation,
    // persistence.ts 的 fire-and-forget 落库口(网络面全 mock,测试不发真请求)
    sendMessage: vi.fn(async () => ({ success: true })),
    persistQuestion: vi.fn(async () => ({ success: true })),
    createConversation: vi.fn(async () => ({ success: false, status: 599 })),
    getMessages: vi.fn(async () => ({ success: false })),
    autoTitleConversation: vi.fn(async () => ({ success: false })),
  }
})

vi.mock('@/lib/api', async (importOriginal) => {
  const orig = (await importOriginal()) as Record<string, unknown>
  return {
    ...orig,
    // 成本预检(P3 #43):success:false ⇒ 静默跳过协商,不影响发送主链
    fetchApi: vi.fn(async () => ({ success: false })),
  }
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

import { createChatStore, useChatStore, type ChatMessage } from '@/stores/chat'
import type { ChatStore } from '@/stores/chat-pane-context'
import { useAuthStore } from '@/stores/auth'
import { createSendMessage, regenerateMessage } from '../send-message'
import type { ChatActionContext } from '../types'

const CONV = 'cccccccc-5959-4959-8959-959595959595'
const USER = 'uuuuuuuu-0001-4001-8001-000000000001'
const OLD = 'aaaaaaaa-0002-4002-8002-000000000002'

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
    streamConversationRef: { current: null },
  }
}

function makePane(name: string): ChatStore {
  const pane = createChatStore(`ihui-chat-g59-test-${name}`)
  pane.setState({
    conversationId: CONV,
    currentModel: 'gpt-test',
    isStreaming: false,
    messages: [
      { id: USER, role: 'user', content: '问题', createdAt: 1 },
      { id: OLD, role: 'assistant', content: '旧回复', createdAt: 2 },
    ],
  })
  return pane
}

/** streamChat mock 的捕获形参(只取本票关心的键) */
interface CapturedStream {
  messages: Array<{ role: string; content: string }>
  metadata?: Record<string, unknown>
}

function capturedStream(): CapturedStream {
  expect(mockStreamChat).toHaveBeenCalledTimes(1)
  return mockStreamChat.mock.calls[0]![0] as CapturedStream
}

beforeEach(() => {
  vi.clearAllMocks()
  mockStreamChat.mockImplementation(async () => {})
  useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-g59' } as never })
})

describe('票59③:regenerateMessage 走 sibling 分支(不截断、带坐标入族)', () => {
  it('成功路径:旧回复保留为族根(补 0),占位带坐标族尾插入,metadata 透传坐标,history 切族根前', async () => {
    const pane = makePane('ok')
    createSendMessage(makeCtx(), pane)
    mockRegenerateConversation.mockResolvedValue({
      success: true,
      status: 200,
      data: { regeneratedFrom: OLD, remainingCount: 2, rootId: OLD, nextSiblingIndex: 1 },
    })

    const ok = await regenerateMessage(OLD, pane)
    expect(ok).toBe(true)
    expect(mockRegenerateConversation).toHaveBeenCalledWith(CONV, OLD)

    // ① 旧回复仍在列表(反证 truncateMessagesFrom 已摘除)
    const msgs = pane.getState().messages
    const old = msgs.find((m) => m.id === OLD)
    expect(old).toBeDefined()
    expect(old!.content).toBe('旧回复')
    // ② 族根补 siblingIndex=0(读投影判族的前提)
    expect(old!.siblingIndex).toBe(0)
    // ② 占位行带坐标、紧跟族尾(不跑到整段对话末尾,也不裸追加)
    expect(msgs.map((m) => m.id)).toEqual([USER, OLD, msgs[2]!.id])
    const placeholder = msgs[2]!
    expect(placeholder.role).toBe('assistant')
    expect(placeholder.id).not.toBe(OLD)
    expect(placeholder.parentMessageId).toBe(OLD)
    expect(placeholder.siblingIndex).toBe(1)

    // ③ metadata 透传坐标(网关 schema → 回调 → worker 落库的源头)
    const stream = capturedStream()
    expect(stream.metadata?.parentMessageId).toBe(OLD)
    expect(stream.metadata?.siblingIndex).toBe(1)
    expect(stream.metadata?.messageId).toBe(placeholder.id)
    expect(stream.metadata?.conversationId).toBe(CONV)

    // ④ 上下文切到族根之前:只剩用户问题,旧回复不进上下文
    expect(stream.messages).toEqual([{ role: 'user', content: '问题' }])

    // 流收尾:isStreaming 回收,不残留运行态
    expect(pane.getState().isStreaming).toBe(false)
  })

  it('族根缺席(分页/局部回放)⇒ history 回落全量,坐标仍透传', async () => {
    const pane = makePane('ghost-root')
    const send = createSendMessage(makeCtx(), pane)

    const ok = await send('追问', {
      regenerate: true,
      version: { rootId: 'ffffffff-0009-4009-8009-000000000009', siblingIndex: 3 },
    })
    expect(ok).toBe(true)
    const stream = capturedStream()
    expect(stream.metadata?.parentMessageId).toBe('ffffffff-0009-4009-8009-000000000009')
    expect(stream.metadata?.siblingIndex).toBe(3)
    // 回落全量:旧回复进上下文(宁可多带一轮,不可无声丢半段)
    expect(stream.messages.some((m) => m.content === '旧回复')).toBe(true)
    // mergeVersionMessage 族根缺席 ⇒ 按列表末尾插入且自带坐标
    const last = pane.getState().messages.at(-1) as ChatMessage
    expect(last.parentMessageId).toBe('ffffffff-0009-4009-8009-000000000009')
    expect(last.siblingIndex).toBe(3)
  })

  it('/regenerate 失败 ⇒ 零截断、零 streamChat、toast.error', async () => {
    const pane = makePane('fail')
    createSendMessage(makeCtx(), pane)
    mockRegenerateConversation.mockResolvedValue({
      success: false,
      status: 500,
      error: '服务异常',
    })

    const ok = await regenerateMessage(OLD, pane)
    expect(ok).toBe(false)
    expect(mockStreamChat).not.toHaveBeenCalled()
    // 旧链在失败前就截断本地列表;新链失败必须零残留
    expect(pane.getState().messages.map((m) => m.id)).toEqual([USER, OLD])
    expect(mockToast.error).toHaveBeenCalled()
  })
})

describe('票59③:普通发送不受影响(缺省 = 三条全不触发)', () => {
  it('无 version 的 sendMessage:metadata 没有坐标键,占位走 addMessage 裸追加', async () => {
    const pane = makePane('plain')
    const send = createSendMessage(makeCtx(), pane)

    const ok = await send('新提问')
    expect(ok).toBe(true)
    const stream = capturedStream()
    expect('parentMessageId' in (stream.metadata ?? {})).toBe(false)
    expect('siblingIndex' in (stream.metadata ?? {})).toBe(false)
    const msgs = pane.getState().messages
    const placeholder = msgs.at(-1) as ChatMessage
    expect(placeholder.role).toBe('assistant')
    expect(placeholder.siblingIndex ?? null).toBe(null)
    expect(placeholder.parentMessageId).not.toBe(OLD)
    // 普通发送的上下文 = 全量历史 + 本轮问题
    expect(stream.messages.at(-1)).toEqual({ role: 'user', content: '新提问' })
  })
})

// 单例护栏:createSendMessage(ctx) 缺省注册到根单例(票60 步序三),本票不得回退成
// 模块级单例语义 —— regenerateMessage 缺省参数也钉同一实例。
describe('票59③:按 store 实例触发(与票60 运行时注册协同)', () => {
  it('regenerateMessage 缺省走根单例运行时,窗格实例互不串扰', async () => {
    const pane = makePane('isolation')
    useChatStore.setState({ conversationId: null, messages: [], isStreaming: false })
    createSendMessage(makeCtx(), pane)
    mockRegenerateConversation.mockResolvedValue({
      success: true,
      status: 200,
      data: { regeneratedFrom: OLD, remainingCount: 2, rootId: OLD, nextSiblingIndex: 1 },
    })

    // 根单例没有该消息 ⇒ 缺省调用找不到目标,拒绝(不碰窗格 store)
    await expect(regenerateMessage(OLD)).resolves.toBe(false)
    expect(mockRegenerateConversation).not.toHaveBeenCalled()
    // 显式传窗格实例 ⇒ 正常开分支
    await expect(regenerateMessage(OLD, pane)).resolves.toBe(true)
  })
})
