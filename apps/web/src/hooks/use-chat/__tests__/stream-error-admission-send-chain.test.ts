// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * Top5 差距修复 任务 1+2(web 侧,2026-10-30):主链(send-message.ts)的
 * ① stream-error-view 迁移 —— 命名码命中处置表时呈现归新轨(标题/建议/按钮取该码词条),
 *    未收录码与词表缺省时逐字节走既有兜底;BUDGET_EXHAUSTED 硬中断档保持不动。
 * ② 发送准入跟踪器接线 —— inputId 随请求上行、回执按同 id 配对、隐式证据抬升、
 *    零证据收场落 unconfirmed(绝不冒充 admitted)。
 *
 * 行为面 mock 风格参照 g816008-pending-command-ledger.test.ts(断言落在副作用,不做源码对账)。
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
import type { StreamErrorLabelSet } from '@/lib/stream-error-view'

const CONV = 'cccccccc-8100-4100-8100-000000000008'
const TEXT = '这一轮请触发错误'

/** 词表桩:标题/建议走 catalog(`CAT:<key>`),动作按钮走 actions(`A:<action>`),一眼可辨新轨。 */
const LABELS: StreamErrorLabelSet = {
  actions: {
    retry: 'A:retry',
    waitAndRetry: 'A:waitAndRetry',
    switchModel: 'A:switchModel',
    checkQuota: 'A:checkQuota',
    contactAdmin: 'A:contactAdmin',
    relogin: 'A:relogin',
    upgradeApp: 'A:upgradeApp',
    trimContext: 'A:trimContext',
    none: 'A:none',
  },
  admission: {
    tentative: 'P:tentative',
    admitted: 'P:admitted',
    queued: 'P:queued',
    rejected: 'P:rejected',
    unconfirmed: 'P:unconfirmed',
  },
  nextStepLabel: '',
  catalog: (key) => `CAT:${key}`,
}

/** streamChat 被 mock 后可拨动的回调面(与 send-message.ts 传入的选项交叉)。 */
interface StreamOptsProbe {
  inputId?: string
  onSendAdmissionReceipt?: (receipt: unknown) => void
  onError?: (msg: string, info?: { errorCode?: string }) => void
  onResponse?: () => void
  onDelta?: (d: string) => void
  onDone?: () => void
}

function makeCtx(withLabels: boolean = true): ChatActionContext {
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
    ...(withLabels ? { streamErrorLabels: LABELS } : {}),
  }
}

function makePane(name: string): ChatStore {
  const pane = createChatStore(`ihui-chat-top5-${name}`)
  pane.setState({
    conversationId: CONV,
    currentModel: 'gpt-test',
    isStreaming: false,
    messages: [],
  })
  return pane
}

/** 读最后一条(assistant)消息上的准入 meta。 */
function admissionOf(pane: ChatStore): Record<string, unknown> | undefined {
  const msgs = pane.getState().messages
  const tail = msgs[msgs.length - 1]
  const meta = tail?.meta as { admission?: Record<string, unknown> } | undefined
  return meta?.admission
}

beforeEach(() => {
  vi.clearAllMocks()
  mockStreamChat.mockImplementation(async (opts: unknown) => {
    const o = opts as StreamOptsProbe
    o.onDone?.()
  })
  useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-top5' } as never })
  window.localStorage.clear()
  pendingTest.resetLedgerSingleton()
})

describe('任务 1:主链 onError(SSE 支)stream-error-view 双轨', () => {
  it('已收录码(RATE_LIMITED)走新轨:标题/建议/按钮全取该码词条,原始文本退为附注', async () => {
    const pane = makePane('sse-catalog-hit')
    const send = createSendMessage(makeCtx(), pane)
    mockStreamChat.mockImplementationOnce(async (opts: unknown) => {
      const o = opts as StreamOptsProbe
      o.onError?.('too many requests', { errorCode: 'RATE_LIMITED' })
    })

    await expect(send(TEXT)).resolves.toBe(true)

    // waitAndRetry ⇒ retryable ⇒ toast.error + 定向按钮(不是通用 t('retry'))
    const call = mockToast.error.mock.calls.at(-1)
    expect(call?.[0]).toBe('CAT:RATE_LIMITED.title')
    const payload = call?.[1] as {
      description: string
      action?: { label: string }
    }
    expect(payload.description).toContain('CAT:RATE_LIMITED.action')
    // 旧轨的 [errorCode] 透出在新轨里仍作附注拼在 detail 后(send-answer 样板姿势)
    expect(payload.description).toContain('[RATE_LIMITED]')
    expect(payload.action?.label).toBe('A:waitAndRetry')
    // 失败卡标题同样归新轨
    const msgs = pane.getState().messages
    expect(msgs[msgs.length - 1]?.content).toBe('CAT:RATE_LIMITED.title')
  })

  it('已收录但不可重试码(CONTEXT_TOO_LONG)走新轨 warning,不给重发按钮', async () => {
    const pane = makePane('sse-catalog-no-retry')
    const send = createSendMessage(makeCtx(), pane)
    mockStreamChat.mockImplementationOnce(async (opts: unknown) => {
      const o = opts as StreamOptsProbe
      o.onError?.('context overflow', { errorCode: 'CONTEXT_TOO_LONG' })
    })

    await expect(send(TEXT)).resolves.toBe(true)

    const call = mockToast.warning.mock.calls.at(-1)
    expect(call?.[0]).toBe('CAT:CONTEXT_TOO_LONG.title')
    const payload = call?.[1] as { action?: unknown }
    expect(payload.action).toBeUndefined()
  })

  it('未收录码(NOT_A_REAL_CODE)走兜底:与迁移前一致([码] 前缀 + 通用 retry 按钮)', async () => {
    const pane = makePane('sse-unknown-code')
    const send = createSendMessage(makeCtx(), pane)
    mockStreamChat.mockImplementationOnce(async (opts: unknown) => {
      const o = opts as StreamOptsProbe
      o.onError?.('mystery failure', { errorCode: 'NOT_A_REAL_CODE' })
    })

    await expect(send(TEXT)).resolves.toBe(true)

    const call = mockToast.error.mock.calls.at(-1)
    // 标题保持既有 formatSSEError 产物(绝不 CAT: 顶上去)
    expect(String(call?.[0])).not.toMatch(/^CAT:/)
    const payload = call?.[1] as { description: string; action?: { label: string } }
    expect(payload.description).toContain('[NOT_A_REAL_CODE]')
    expect(payload.action?.label).toBe('retry')
  })

  it('BUDGET_EXHAUSTED 硬中断档保持不动:即便词表在场,呈现与控制流都走原支', async () => {
    const pane = makePane('sse-budget')
    const send = createSendMessage(makeCtx(), pane)
    mockStreamChat.mockImplementationOnce(async (opts: unknown) => {
      const o = opts as StreamOptsProbe
      o.onError?.('budget exhausted', { errorCode: 'BUDGET_EXHAUSTED' })
    })

    await expect(send(TEXT)).resolves.toBe(true)

    const call = mockToast.error.mock.calls.at(-1)
    expect(call?.[0]).toBe('今日 AI 用量已达上限')
    expect((call?.[1] as { description: string }).description).toBe(
      '今日 token 预算已用尽,明日 0 点重置后可继续对话',
    )
  })

  it('词表缺省(streamErrorLabels 未注入)⇒ 已收录码也走旧轨,零行为变化', async () => {
    const pane = makePane('sse-no-labels')
    const send = createSendMessage(makeCtx(false), pane)
    mockStreamChat.mockImplementationOnce(async (opts: unknown) => {
      const o = opts as StreamOptsProbe
      o.onError?.('too many requests', { errorCode: 'RATE_LIMITED' })
    })

    await expect(send(TEXT)).resolves.toBe(true)

    const all = JSON.stringify([...mockToast.error.mock.calls, ...mockToast.warning.mock.calls])
    expect(all).not.toContain('CAT:')
    expect(all).toContain('[RATE_LIMITED]')
  })
})

describe('任务 1:主链 catch(HTTP 抛错支)双轨', () => {
  it('已收录码走新轨:标题取该码词条,按钮按可重试性给', async () => {
    const pane = makePane('catch-catalog-hit')
    const send = createSendMessage(makeCtx(), pane)
    mockStreamChat.mockImplementationOnce(async () => {
      throw Object.assign(new Error('http boom'), { status: 429, errorCode: 'RATE_LIMITED' })
    })

    await expect(send(TEXT)).resolves.toBe(true)

    const call = mockToast.error.mock.calls.at(-1)
    expect(call?.[0]).toBe('CAT:RATE_LIMITED.title')
    const payload = call?.[1] as { description: string; action?: { label: string } }
    expect(payload.description).toContain('CAT:RATE_LIMITED.action')
    expect(payload.action?.label).toBe('A:waitAndRetry')
    const msgs = pane.getState().messages
    expect(msgs[msgs.length - 1]?.content).toBe('CAT:RATE_LIMITED.title')
  })

  it('未收录码走兜底:description 带 [码] 前缀,标题不是 CAT:', async () => {
    const pane = makePane('catch-unknown-code')
    const send = createSendMessage(makeCtx(), pane)
    mockStreamChat.mockImplementationOnce(async () => {
      throw Object.assign(new Error('http mystery'), { status: 500, errorCode: 'NOT_A_REAL_CODE' })
    })

    await expect(send(TEXT)).resolves.toBe(true)

    const call = mockToast.error.mock.calls.at(-1)
    expect(String(call?.[0])).not.toMatch(/^CAT:/)
    expect((call?.[1] as { description: string }).description).toContain('[NOT_A_REAL_CODE]')
  })
})

describe('任务 2:主链准入跟踪器接线(inputId 上行 / 回执配对 / 隐式证据 / 收场结算)', () => {
  it('inputId 随请求上行,且回执回调在场;meta 带同一 inputId', async () => {
    const pane = makePane('adm-input-id')
    const send = createSendMessage(makeCtx(), pane)
    let captured: StreamOptsProbe | undefined
    mockStreamChat.mockImplementationOnce(async (opts: unknown) => {
      captured = opts as StreamOptsProbe
      captured.onDone?.()
    })

    await expect(send(TEXT)).resolves.toBe(true)

    expect(typeof captured?.inputId).toBe('string')
    expect((captured?.inputId ?? '').length).toBeGreaterThan(0)
    expect(typeof captured?.onSendAdmissionReceipt).toBe('function')
    expect(admissionOf(pane)?.inputId).toBe(captured?.inputId)
  })

  it('配对回执(同 inputId,accepted)⇒ phase 迁移 admitted 并落 meta', async () => {
    const pane = makePane('adm-receipt-hit')
    const send = createSendMessage(makeCtx(), pane)
    mockStreamChat.mockImplementationOnce(async (opts: unknown) => {
      const o = opts as StreamOptsProbe
      o.onSendAdmissionReceipt?.({ inputId: o.inputId, disposition: 'accepted' })
      expect(admissionOf(pane)?.phase).toBe('admitted')
      o.onDone?.()
    })

    await expect(send(TEXT)).resolves.toBe(true)
    expect(admissionOf(pane)?.phase).toBe('admitted')
    expect(admissionOf(pane)?.disposition).toBe('accepted')
  })

  it('错配回执(别人的 inputId)⇒ 丢弃,本条保持 tentative', async () => {
    const pane = makePane('adm-receipt-mismatch')
    const send = createSendMessage(makeCtx(), pane)
    mockStreamChat.mockImplementationOnce(async (opts: unknown) => {
      const o = opts as StreamOptsProbe
      o.onSendAdmissionReceipt?.({ inputId: 'not-this-input-id', disposition: 'accepted' })
      expect(admissionOf(pane)?.phase).toBe('tentative')
      o.onDone?.()
    })

    await expect(send(TEXT)).resolves.toBe(true)
  })

  it('隐式证据:onResponse(流已开)⇒ admitted,无需回执帧', async () => {
    const pane = makePane('adm-evidence-open')
    const send = createSendMessage(makeCtx(), pane)
    mockStreamChat.mockImplementationOnce(async (opts: unknown) => {
      const o = opts as StreamOptsProbe
      o.onResponse?.()
      expect(admissionOf(pane)?.phase).toBe('admitted')
      o.onDone?.()
    })

    await expect(send(TEXT)).resolves.toBe(true)
  })

  it('queued 回执 ⇒ phase 迁移 queued 且 meta 落盘 queuedTurnId;开始执行帧(accepted)抬升 admitted', async () => {
    // 差距③(2026-10-30):服务端确认排队 —— 同会话有活跃流时首个回执是
    // {disposition:'queued', queuedTurnId},前流收口晋升后同链路补一帧 accepted。
    const pane = makePane('adm-receipt-queued')
    const send = createSendMessage(makeCtx(), pane)
    mockStreamChat.mockImplementationOnce(async (opts: unknown) => {
      const o = opts as StreamOptsProbe
      o.onSendAdmissionReceipt?.({
        inputId: o.inputId,
        disposition: 'queued',
        queuedTurnId: 'qt-77',
      })
      expect(admissionOf(pane)?.phase).toBe('queued')
      expect(admissionOf(pane)?.queuedTurnId).toBe('qt-77')
      // 前流收口 ⇒ 本条晋升,开始执行帧携带同 queuedTurnId(关联凭据)
      o.onSendAdmissionReceipt?.({
        inputId: o.inputId,
        disposition: 'accepted',
        queuedTurnId: 'qt-77',
      })
      expect(admissionOf(pane)?.phase).toBe('admitted')
      o.onDone?.()
    })

    await expect(send(TEXT)).resolves.toBe(true)
    expect(admissionOf(pane)?.phase).toBe('admitted')
    expect(admissionOf(pane)?.queuedTurnId).toBe('qt-77')
  })

  it('有正文正常走完 ⇒ admitted;零证据收场 ⇒ unconfirmed(绝不冒充 admitted)', async () => {
    const pane = makePane('adm-settle')
    const send = createSendMessage(makeCtx(), pane)

    // 第一路:有 delta ⇒ admitted
    mockStreamChat.mockImplementationOnce(async (opts: unknown) => {
      const o = opts as StreamOptsProbe
      o.onDelta?.('你好')
      o.onDone?.()
    })
    await expect(send(TEXT)).resolves.toBe(true)
    expect(admissionOf(pane)?.phase).toBe('admitted')

    // 第二路:一个回调都没有(请求发出去了但毫无回音)⇒ unconfirmed
    mockStreamChat.mockImplementationOnce(async () => {})
    await expect(send(TEXT)).resolves.toBe(true)
    const msgs = pane.getState().messages
    const lastAssistant = msgs.filter((m) => m.role === 'assistant').at(-1)
    const adm = (lastAssistant?.meta as { admission?: Record<string, unknown> } | undefined)
      ?.admission
    expect(adm?.phase).toBe('unconfirmed')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
