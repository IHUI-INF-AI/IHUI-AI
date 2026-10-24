// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D77 台账 L29039 最后一格(2026-10-23):web 表单卡**消费应答状态读口**的装车证明。
//
// 钉死四件事:
//  1. 挂载即向 `GET /llm/complete/stream/{sid}/form-response?request_id=…` 对账一次,
//     读口回显 approve/reject ⇒ 卡片直接落"已批准/已拒绝"终态(刷新/重进会话状态不丢);
//  2. 读口回 ok:false(没这条/不是你的同形)⇒ 判"待处理",表单保持可填;
//  3. 读口网络炸 ⇒ **fail-soft**:不改判、不出 failed 徽标、会话流不受影响;
//  4. 提交成功后回拉一次读口,把持久裁决收敛成卡片终态。
// 通道断言:GET 走 `/api/llm/*` 同源代理面(next rewrites `/api/llm/:path*` → ai-service),
// 与 POST 上行同一条会话通道;鉴权头由 fetchAiServiceJson 自动注入,本测试不重复验。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { createElement, type ReactElement } from 'react'

import { BusinessFormCard } from '../business-form-card'
import { BusinessFormSection } from '../business-form-section'
import { useBusinessFormStore } from '@/stores/business-forms'

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string, values?: Record<string, string | number>) =>
    `TR:${String(ns)}.${key}:${JSON.stringify(values ?? {})}`,
}))

const REQUEST_ID = 'frm-d77-rs-001'
const MESSAGE_ID = 'msg-d77-rs-001'
const SESSION_ID = 'sess-d77-rs'

function seedRequest(): void {
  useBusinessFormStore.setState({ byMessage: {} })
  useBusinessFormStore.getState().appendFormRequest({
    requestId: REQUEST_ID,
    sessionId: SESSION_ID,
    kind: 'email',
    messageId: MESSAGE_ID,
    actions: ['approve', 'reject'],
    status: 'pending',
  })
}

function section(): ReactElement {
  return createElement(BusinessFormSection, { messageId: MESSAGE_ID })
}

/**
 * fetch 替身:GET(读口对账)按 `getAck(n)` 第 n 次应答,POST(上行)恒 `{ok:true,accepted:true}`。
 * getAck 返回 Error ⇒ 该次 GET 网络炸(fail-soft 用例)。
 */
function mockFetch(getAck: (nthGet: number) => unknown | Error): void {
  let getNth = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, accepted: true }),
          text: async () => '',
        } as unknown as Response
      }
      getNth += 1
      const payload = getAck(getNth)
      if (payload instanceof Error) throw payload
      return {
        ok: true,
        status: 200,
        json: async () => payload,
        text: async () => '',
      } as unknown as Response
    }),
  )
}

/** GET 腿的调用 URL 列表(上行 POST 与读口 GET 混在同一 mock 里,按 method 分流) */
function getUrls(): string[] {
  const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
  return fetchMock.mock.calls
    .filter((call) => (call[1] as RequestInit | undefined)?.method !== 'POST')
    .map((call) => String(call[0]))
}

function cardRoot(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>(`[data-form-request-id="${REQUEST_ID}"]`)
}

function fillEmailForm(container: HTMLElement): void {
  const set = (key: string, value: string) => {
    const field = container.querySelector<HTMLElement>(`[data-form-field="${key}"]`)
    const control = field?.querySelector('textarea') ?? field?.querySelector('input')
    if (!control) throw new Error(`field control not found: ${key}`)
    fireEvent.change(control, { target: { value } })
  }
  set('to', 'a@b.com')
  set('subject', 'hi')
  set('body', 'hello')
}

describe('D77 读口消费 / 挂载对账三态', () => {
  beforeEach(() => {
    seedRequest()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    useBusinessFormStore.setState({ byMessage: {} })
  })

  it('读口回显 approve → 卡片落"已批准"终态,GET 打在同一条 /api/llm 会话通道并带 request_id', async () => {
    mockFetch(() => ({
      ok: true,
      requestId: REQUEST_ID,
      sessionId: SESSION_ID,
      kind: 'email',
      action: 'approve',
      valueCount: 3,
    }))
    const { container } = render(section())

    await vi.waitFor(() =>
      expect(cardRoot(container)?.getAttribute('data-form-phase')).toBe('approved'),
    )
    expect(cardRoot(container)?.getAttribute('data-form-response-state')).toBe('approved')
    expect(container.querySelector('[data-form-status="approved"]')).not.toBeNull()
    // 终态卡不再给动作按钮,字段禁用
    expect(container.querySelector('[data-action="approve"]')).toBeNull()
    expect(container.querySelector('[data-action="reject"]')).toBeNull()

    const urls = getUrls()
    expect(urls).toHaveLength(1)
    expect(urls[0]).toContain('/api/llm/complete/stream/sess-d77-rs/form-response')
    expect(urls[0]).toContain(`request_id=${REQUEST_ID}`)
  })

  it('读口回显 reject → 卡片落"已拒绝"终态', async () => {
    mockFetch(() => ({
      ok: true,
      requestId: REQUEST_ID,
      sessionId: SESSION_ID,
      kind: 'email',
      action: 'reject',
      rejectReason: '时间不合适',
    }))
    const { container } = render(section())

    await vi.waitFor(() =>
      expect(cardRoot(container)?.getAttribute('data-form-phase')).toBe('rejected'),
    )
    expect(cardRoot(container)?.getAttribute('data-form-response-state')).toBe('rejected')
    expect(container.querySelector('[data-form-status="rejected"]')).not.toBeNull()
  })

  it('读口回 ok:false(没这条/不是你的同形)→ 判"待处理",表单保持可填', async () => {
    mockFetch(() => ({
      ok: false,
      error: 'form request not found or expired',
      requestId: REQUEST_ID,
    }))
    const { container } = render(section())

    await vi.waitFor(() =>
      expect(cardRoot(container)?.getAttribute('data-form-response-state')).toBe('pending'),
    )
    expect(cardRoot(container)?.getAttribute('data-form-phase')).toBe('filling')
    expect(container.querySelector('[data-action="approve"]')).not.toBeNull()
    expect(container.querySelector('[data-action="reject"]')).not.toBeNull()
  })

  it('读口网络炸 → fail-soft:不改判、不出上行失败徽标、表单仍可填', async () => {
    mockFetch(() => new Error('network down'))
    const { container } = render(section())

    // 让 GET 腿的 rejection 走完微任务队列
    await vi.waitFor(() => expect(getUrls()).toHaveLength(1))
    expect(cardRoot(container)?.getAttribute('data-form-phase')).toBe('filling')
    expect(cardRoot(container)?.getAttribute('data-form-response-state')).toBeNull()
    expect(container.querySelector('[data-form-send-failed]')).toBeNull()
    expect(container.querySelector('[data-action="approve"]')).not.toBeNull()
  })

  it('无 sessionId 的条目不发读口请求(没有通道就没有落点)', async () => {
    useBusinessFormStore.setState({ byMessage: {} })
    useBusinessFormStore.getState().appendFormRequest({
      requestId: 'frm-no-session-rs',
      kind: 'email',
      messageId: MESSAGE_ID,
      actions: ['approve', 'reject'],
      status: 'pending',
    })
    mockFetch(() => ({ ok: false }))
    render(section())

    await new Promise((r) => setTimeout(r, 0))
    expect(getUrls()).toHaveLength(0)
  })

  it('提交成功后回拉读口:持久裁决到齐即收敛为终态(挂载时先 pending 可填)', async () => {
    // 第 1 次 GET(挂载对账)= 还没答;POST 之后的第 2 次 GET = 库里已存 approve
    mockFetch((nth) =>
      nth >= 2
        ? {
            ok: true,
            requestId: REQUEST_ID,
            sessionId: SESSION_ID,
            kind: 'email',
            action: 'approve',
            valueCount: 3,
          }
        : { ok: false, error: 'form request not found or expired', requestId: REQUEST_ID },
    )
    const { container } = render(section())

    await vi.waitFor(() =>
      expect(cardRoot(container)?.getAttribute('data-form-response-state')).toBe('pending'),
    )
    fillEmailForm(container)
    fireEvent.click(container.querySelector('[data-action="approve"]')!)

    await vi.waitFor(() => expect(getUrls()).toHaveLength(2))
    await vi.waitFor(() =>
      expect(cardRoot(container)?.getAttribute('data-form-phase')).toBe('approved'),
    )
    expect(useBusinessFormStore.getState().byMessage[MESSAGE_ID]?.[0]?.responseState).toBe(
      'approved',
    )
  })
})

describe('D77 BusinessFormCard / responseState 入参直出终态(卡片仍不取数)', () => {
  afterEach(() => {
    useBusinessFormStore.setState({ byMessage: {} })
  })

  it('挂载即带 responseState=approved:初始相位直接是 approved,不闪可填态', () => {
    const { container } = render(
      <BusinessFormCard kind="email" requestId={REQUEST_ID} responseState="approved" />,
    )
    const root = cardRoot(container)
    expect(root?.getAttribute('data-form-phase')).toBe('approved')
    expect(root?.getAttribute('data-form-response-state')).toBe('approved')
    expect(container.querySelector('[data-action="approve"]')).toBeNull()
  })

  it('responseState=pending 维持可填;本地已答的乐观终态不被滞后的 pending 读回降级', () => {
    const view = render(
      <BusinessFormCard
        kind="email"
        requestId={REQUEST_ID}
        responseState="pending"
        onAction={vi.fn()}
      />,
    )
    expect(cardRoot(view.container)?.getAttribute('data-form-phase')).toBe('filling')
    // reject 直达终态(零副作用、不过校验),用它构造"本地已答"的乐观终态
    fireEvent.click(view.container.querySelector('[data-action="reject"]')!)
    expect(cardRoot(view.container)?.getAttribute('data-form-phase')).toBe('rejected')

    // 滞后的读口回包(库里那一行还没到齐)把 responseState 刷成 pending ⇒ 不得把
    // 用户已经做出的拒绝倒退回可填态(只允许向上收敛,不允许向下改判)。
    view.rerender(
      <BusinessFormCard
        kind="email"
        requestId={REQUEST_ID}
        responseState="pending"
        onAction={vi.fn()}
      />,
    )
    expect(cardRoot(view.container)?.getAttribute('data-form-phase')).toBe('rejected')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
