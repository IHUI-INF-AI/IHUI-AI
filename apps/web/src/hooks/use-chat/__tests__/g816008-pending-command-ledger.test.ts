// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * G-816008 装车证明:「已 accepted 未投影」账本在发送链路上的**行为面**判据。
 *
 * 咬的是用户级风险本身 —— 弱网下带副作用的指令被重复执行。断言一律落在
 * **副作用有没有发生**(`streamChat` 被调了几次 / 转写里多了一条还是零条),不做源码对账。
 *
 * 四态成对:
 * ① 正向:账本里还挂着"已发出但没回执"的那条 ⇒ 同一条再提交被拦,零请求;
 * ② 反向:上一轮正常走完了 ⇒ 同内容再提交放行 —— 这是**合法重发**;
 * ③ 时间:T-T-L 过后同一条放行 —— 不是永久锁死;
 * ④ 收据:空内容但流正常走完**也算**回执(onDone 到了就说明这一轮结束了)。
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
import { __test__ as pendingTest, claimPendingSend, settlePendingSend } from '../pending-send'

const CONV = 'cccccccc-8100-4100-8100-000000000008'
const INSTRUCTION = '删除 /tmp/out.txt'

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
  const pane = createChatStore(`ihui-chat-g816008-${name}`)
  pane.setState({
    conversationId: CONV,
    currentModel: 'gpt-test',
    isStreaming: false,
    messages: [],
  })
  return pane
}

/** 一次"正常走完"的流:吐出 delta 并触发 onDone(等价于收到 done 帧) */
function normalStream(delta = '已删除 out.txt') {
  mockStreamChat.mockImplementationOnce(async (opts: unknown) => {
    const o = opts as { onDelta?: (d: string) => void; onDone?: () => void }
    if (delta) o.onDelta?.(delta)
    o.onDone?.()
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockStreamChat.mockImplementation(async (opts: unknown) => {
    const o = opts as { onDone?: () => void }
    o.onDone?.()
  })
  useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-g816008' } as never })
  window.localStorage.clear()
  pendingTest.resetLedgerSingleton()
})

describe('G-816008 ①:已发出未回执 ⇒ 同一条再提交被拦(副作用没发生)', () => {
  it('账本里挂着未确认条目(模拟上一页死在半路)⇒ 零请求,并给定向说明', async () => {
    const pane = makePane('block')
    const send = createSendMessage(makeCtx(), pane)

    // 真实窗口:上一次请求已经发出去了,但页面死在半路(finally 从没跑)⇒ 条目留在账本里。
    // 这正是本账本存在的理由,也是"禁用按钮"结构上盖不住的那一格(在途锁早已随页面消失)。
    claimPendingSend({ conversationId: CONV, text: INSTRUCTION, rows: [] })
    // 换页/刷新:账本从 localStorage 重新读出来
    pendingTest.resetLedgerSingleton()

    await expect(send(INSTRUCTION)).resolves.toBe(false)

    // 断言副作用没发生:一个请求都没发,转写里也没有用户消息
    expect(mockStreamChat).not.toHaveBeenCalled()
    expect(pane.getState().messages).toHaveLength(0)
    // 拦下时必须给定向说明(不是静默失败)
    expect(mockToast.warning).toHaveBeenCalled()
  })

  it('被拦时不锁死:toast 带人工放行入口,点了即真的发出去(同一条链路)', async () => {
    const pane = makePane('force')
    const send = createSendMessage(makeCtx(), pane)

    claimPendingSend({ conversationId: CONV, text: INSTRUCTION, rows: [] })
    pendingTest.resetLedgerSingleton()
    await expect(send(INSTRUCTION)).resolves.toBe(false)
    expect(mockStreamChat).not.toHaveBeenCalled()

    const payload = mockToast.warning.mock.calls.at(-1)?.[1] as
      { action?: { onClick: () => void } } | undefined
    expect(payload?.action?.onClick).toBeTypeOf('function')
    payload!.action!.onClick()
    await vi.waitFor(() => expect(mockStreamChat).toHaveBeenCalledTimes(1))
  })
})

describe('G-816008 ②:上一轮正常走完 ⇒ 同内容再提交放行(合法重发)', () => {
  it('连发两条一模一样的指令:第二次照常发出,用户气泡两条', async () => {
    const pane = makePane('allow')
    const send = createSendMessage(makeCtx(), pane)

    normalStream()
    await expect(send(INSTRUCTION)).resolves.toBe(true)
    expect(mockStreamChat).toHaveBeenCalledTimes(1)

    // 用户就是想再发一次(重复提问是合法的)
    normalStream()
    await expect(send(INSTRUCTION)).resolves.toBe(true)
    expect(mockStreamChat).toHaveBeenCalledTimes(2)
    expect(pane.getState().messages.filter((m) => m.role === 'user')).toHaveLength(2)
  })

  it('不同会话里同一条指令互不相干', async () => {
    const pane = makePane('conv-scope')
    const send = createSendMessage(makeCtx(), pane)
    claimPendingSend({ conversationId: 'another-conv', text: INSTRUCTION, rows: [] })
    pendingTest.resetLedgerSingleton()

    await expect(send(INSTRUCTION)).resolves.toBe(true)
    expect(mockStreamChat).toHaveBeenCalledTimes(1)
  })
})

describe('G-816008 ③:TTL 过期 ⇒ 同一条放行(不是永久锁死)', () => {
  it('条目过期(>24h)⇒ 放行;未过期 ⇒ 仍拦(成对,证明不是恒放行)', () => {
    const stale = {
      commandId: 'c-ttl',
      conversationId: CONV,
      preview: 'x',
      firstRegisteredAt: Date.now() - 25 * 60 * 60 * 1000,
    }
    window.localStorage.setItem(pendingTest.STORAGE_KEY, JSON.stringify([stale]))
    pendingTest.resetLedgerSingleton()
    expect(claimPendingSend({ conversationId: CONV, text: INSTRUCTION, rows: [] }).allowed).toBe(
      true,
    )

    const fresh = {
      commandId: claimPendingSend({ conversationId: CONV, text: INSTRUCTION, rows: [] }).commandId,
      conversationId: CONV,
      preview: 'x',
      firstRegisteredAt: Date.now(),
    }
    window.localStorage.setItem(pendingTest.STORAGE_KEY, JSON.stringify([fresh]))
    pendingTest.resetLedgerSingleton()
    expect(claimPendingSend({ conversationId: CONV, text: INSTRUCTION, rows: [] }).allowed).toBe(
      false,
    )
  })
})

describe('G-816008 ④:回执语义与结算', () => {
  it('空内容但流正常走完 ⇒ 仍算有回执(下一轮同文不被拦)', async () => {
    const pane = makePane('empty-ack')
    const send = createSendMessage(makeCtx(), pane)

    normalStream('') // onDone 到了、一个 token 都没有
    await expect(send(INSTRUCTION)).resolves.toBe(true)

    normalStream()
    await expect(send(INSTRUCTION)).resolves.toBe(true)
    expect(mockStreamChat).toHaveBeenCalledTimes(2)
  })

  it('超时 abort 不算回执 ⇒ 条目留在账本(下一次同文被拦)', async () => {
    const pane = makePane('timeout')
    const send = createSendMessage(makeCtx(), pane)

    // 复现 30s 冷启动超时的真实路径:本流自己 controller.abort() ⇒ api-client 的
    // isAbortError 分支仍会调 onDone ⇒ 若单看 onDone 会把超时误当"有回执"。
    // 所以这一段必须用真实定时器推进(abortedByTimeout15s 只在 setTimeout 回调里置位)。
    vi.useFakeTimers()
    try {
      mockStreamChat.mockImplementationOnce(async (opts: unknown) => {
        const o = opts as { signal?: AbortSignal; onDone?: () => void }
        await new Promise<never>((_resolve, reject) => {
          o.signal?.addEventListener(
            'abort',
            () => {
              o.onDone?.()
              reject(new DOMException('aborted', 'AbortError'))
            },
            { once: true },
          )
        })
      })
      const inflight = send(INSTRUCTION)
      await vi.advanceTimersByTimeAsync(31_000)
      await inflight
    } finally {
      vi.useRealTimers()
    }

    normalStream()
    await expect(send(INSTRUCTION)).resolves.toBe(false)
    expect(mockStreamChat).toHaveBeenCalledTimes(1)
  })

  it('结算后同一条再提交放行(settle 是唯一结算口)', () => {
    const claim = claimPendingSend({ conversationId: CONV, text: INSTRUCTION, rows: [] })
    expect(claim.allowed).toBe(true)
    expect(claimPendingSend({ conversationId: CONV, text: INSTRUCTION, rows: [] }).allowed).toBe(
      false,
    )
    settlePendingSend(claim.commandId)
    expect(claimPendingSend({ conversationId: CONV, text: INSTRUCTION, rows: [] }).allowed).toBe(
      true,
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
