// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 片1(2026-10-20):resume-stream 降级「重新生成」派发的窗格身份补全。
// 咬两件事,成对留证:
//  ① 正向 = resumePendingMessage/autoResumeAfterHistory 传入 paneId 时,
//     'ihui:regenerate-message' 的 detail.paneId 带上它,且 matchesPaneEvent(唯一门控出口)
//     只对目标窗格放行、对根窗格拒绝;
//  ② 反证 = 不传 paneId(既有调用面)时派发恒被根窗格接走 —— 复现"非根窗格续传失败
//     重生成落根"的旧行为,证明 ① 的用例确有牙。

// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useChatStore } from '@/stores/chat'
import { matchesPaneEvent } from '@/stores/chat-pane-context'
import type { PendingResume } from '../resume-stream'
import { autoResumeAfterHistory, resumePendingMessage } from '../resume-stream'

vi.mock('@ihui/api-client', () => ({
  getModelContextCapacity: () => 128_000,
  parseStreamLine: (): string | null => null,
  // 本用例的失败注入是 500(不是 401)⇒ 续期这条腿一次都不该被走到
  refreshAccessTokenOnce: vi.fn(async () => null),
}))

vi.mock('@/lib/api', () => ({
  // status 查询:未落库 ⇒ 走直接续生成;随后 POST /resume 返回 500 ⇒ notifyResumeFailed
  fetchApi: vi.fn(async () => ({
    success: true,
    data: { exists: false, completed: false, content: '', updatedAt: null },
  })),
  getToken: vi.fn(() => 'test-token'),
  getStreamBaseUrl: vi.fn(() => ''),
  isAbortError: (e: unknown) => e instanceof Error && e.name === 'AbortError',
}))

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }))
vi.mock('@/components/common', () => ({
  toast: { error: toastError, warning: vi.fn(), info: vi.fn(), success: vi.fn() },
}))

const LABELS = { title: '续接失败', action: '重新生成', noProgress: '无新内容' }

const PENDING: PendingResume = {
  conversationId: 'conv-1',
  messageId: 'assistant-1',
  content: '已生成的前半段',
}

/** 令 POST /api/chat/resume 返回 500,触发降级 toast */
function stubResumeHttpFailure(): void {
  global.fetch = vi.fn(
    async () => new Response('boom', { status: 500, statusText: 'Internal Server Error' }),
  ) as never
}

interface CapturedEvent {
  type: string
  detail: { messageId?: string; paneId?: string | null }
}

/** 从 toast.error 捕获的 action 里取出 onClick 并派发,回读 CustomEvent detail */
function fireRegenerateAction(): CapturedEvent {
  const call = toastError.mock.calls[0]
  expect(call).toBeDefined()
  const options = (call as unknown as [string, { action?: { onClick?: () => void } }])[1]
  const onClick = options?.action?.onClick
  expect(typeof onClick).toBe('function')

  const events: CapturedEvent[] = []
  const listener = (e: Event): void => {
    events.push({ type: e.type, detail: (e as CustomEvent).detail })
  }
  window.addEventListener('ihui:regenerate-message', listener)
  onClick?.()
  window.removeEventListener('ihui:regenerate-message', listener)
  const captured = events[0]
  if (!captured) throw new Error('派发未命中监听方:ihui:regenerate-message 没有事件回读')
  return captured
}

describe('resume-stream 降级派发的窗格身份(片1)', () => {
  beforeEach(() => {
    toastError.mockClear()
    stubResumeHttpFailure()
    // 降级链路会写真实根单例(streamCompleted/messages),逐例复位防互相污染
    useChatStore.setState({ conversationId: null, messages: [], isStreaming: false })
  })

  it('正向:传入 paneId ⇒ 派发 detail 带上该窗格身份,门控只放行目标窗格', async () => {
    await resumePendingMessage(PENDING, {
      signal: new AbortController().signal,
      labels: LABELS,
      paneId: 'pane-leaf-1',
    })

    const captured = fireRegenerateAction()
    expect(captured.type).toBe('ihui:regenerate-message')
    expect(captured.detail.messageId).toBe('assistant-1')
    expect(captured.detail.paneId).toBe('pane-leaf-1')
    // 门控口径唯一出口 matchesPaneEvent:目标窗格接走,根窗格与其他窗格都不接
    expect(matchesPaneEvent(captured.detail.paneId, 'pane-leaf-1')).toBe(true)
    expect(matchesPaneEvent(captured.detail.paneId, null)).toBe(false)
    expect(matchesPaneEvent(captured.detail.paneId, 'pane-other')).toBe(false)
  })

  it('反证:不传 paneId(既有调用面)⇒ detail 无窗格身份,恒被根窗格接走(旧行为)', async () => {
    await resumePendingMessage(PENDING, {
      signal: new AbortController().signal,
      labels: LABELS,
    })

    const captured = fireRegenerateAction()
    expect(captured.detail.messageId).toBe('assistant-1')
    expect(captured.detail.paneId).toBeUndefined()
    expect(matchesPaneEvent(captured.detail.paneId, null)).toBe(true)
    expect(matchesPaneEvent(captured.detail.paneId, 'pane-leaf-1')).toBe(false)
  })

  it('autoResumeAfterHistory 第 5 参透传:paneId 一路走到派发 detail', async () => {
    // autoResumeAfterHistory 有会话一致性守卫(store.conversationId 必须等于入参),
    // 否则在守卫处就 return,根本走不到派发 —— 按真实链路先落会话。
    useChatStore.setState({ conversationId: 'conv-1', messages: [] })
    const pendingRef = { current: { ...PENDING } }
    await autoResumeAfterHistory(
      pendingRef,
      'conv-1',
      new AbortController().signal,
      LABELS,
      'pane-leaf-9',
    )

    const captured = fireRegenerateAction()
    expect(captured.detail.paneId).toBe('pane-leaf-9')
    expect(matchesPaneEvent(captured.detail.paneId, 'pane-leaf-9')).toBe(true)
    expect(matchesPaneEvent(captured.detail.paneId, null)).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
