// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D77 业务表单卡的**装车证明**(2026-09-25 立,G-106)。
//
// 钉死四件事(缺一即"造好没装车"):
//  1. form_request 落 store 后,消息流段真的渲染出 BusinessFormCard(不是只有组件自身测试);
//  2. 点「批准」→ 走 form_response(上行帧):带 values、不带 reject_reason;
//  3. 点「拒绝」→ **同样**走 form_response,且带拒绝原因、整字段省略 values(拒绝零副作用);
//  4. 无请求的段整段不渲染(不给空框占位)。
// 两条动作用例都断言真实打到 @ihui/api-client 的 postFormResponse(fetch 被 mock 并检查 URL+body),
// 而不是只断言本地状态 —— 后者证不出"回传通道被调用"。选择器沿用既有 business-form-card.test.tsx
// 的 data-* 口径(卡片不为本票改 props 形态)。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { createElement, type ReactElement } from 'react'

import { BusinessFormSection } from '../business-form-section'
import { useBusinessFormStore } from '@/stores/business-forms'

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string, values?: Record<string, string | number>) =>
    `TR:${String(ns)}.${key}:${JSON.stringify(values ?? {})}`,
}))

const REQUEST_ID = 'frm-d77-001'
const MESSAGE_ID = 'msg-d77-001'

function seedRequest(): void {
  useBusinessFormStore.setState({ byMessage: {} })
  useBusinessFormStore.getState().appendFormRequest({
    requestId: REQUEST_ID,
    sessionId: 'sess-d77',
    kind: 'email',
    messageId: MESSAGE_ID,
    actions: ['approve', 'reject'],
    status: 'pending',
  })
}

function section(): ReactElement {
  return createElement(BusinessFormSection, { messageId: MESSAGE_ID })
}

/** 按字段键定位输入控件(Input → input / multiline → textarea)并写入值 */
function typeField(container: HTMLElement, key: string, value: string): void {
  const field = container.querySelector<HTMLElement>(`[data-form-field="${key}"]`)
  const control = field?.querySelector('textarea') ?? field?.querySelector('input')
  if (!control) throw new Error(`field control not found: ${key}`)
  fireEvent.change(control, { target: { value } })
}

function clickAction(container: HTMLElement, action: 'approve' | 'reject'): void {
  const btn = container.querySelector<HTMLElement>(`[data-action="${action}"]`)
  if (!btn) throw new Error(`action button not found: ${action}`)
  fireEvent.click(btn)
}

function fillEmailForm(container: HTMLElement): void {
  typeField(container, 'to', 'a@b.com')
  typeField(container, 'subject', 'hi')
  typeField(container, 'body', 'hello')
}

/** 最后一次 POST 的 [url, init] */
function lastPost(): { url: string; body: Record<string, unknown> } {
  const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
  const calls = fetchMock.mock.calls
  const call = calls[calls.length - 1] as [string, RequestInit]
  return {
    url: String(call[0]),
    body: JSON.parse(String(call[1].body)) as Record<string, unknown>,
  }
}

describe('D77 BusinessFormSection 装车 + 成对动作', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, text: async () => '' })),
    )
    seedRequest()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    useBusinessFormStore.setState({ byMessage: {} })
  })

  it('form_request → store → 消息流段渲染出 BusinessFormCard(装车点)', () => {
    const { container } = render(section())
    const card = container.querySelector<HTMLElement>('[data-form-kind]')
    expect(card?.getAttribute('data-form-kind')).toBe('email')
    expect(card?.getAttribute('data-form-request-id')).toBe(REQUEST_ID)
  })

  it('无请求的整段不渲染', () => {
    const { container } = render(createElement(BusinessFormSection, { messageId: 'msg-none' }))
    expect(container.querySelector('[data-testid="business-form-section"]')).toBeNull()
  })

  it('成对动作:批准与拒绝两个入口同时在场', () => {
    const { container } = render(section())
    expect(container.querySelector('[data-action="approve"]')).not.toBeNull()
    expect(container.querySelector('[data-action="reject"]')).not.toBeNull()
  })

  it('点批准 → 发 form_response:带 values、无 reject_reason、走同一条会话通道', async () => {
    const { container } = render(section())
    fillEmailForm(container)
    clickAction(container, 'approve')

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const post = lastPost()
    expect(post.url).toContain('/llm/complete/stream/sess-d77/form-response')
    expect(post.body.request_id).toBe(REQUEST_ID)
    expect(post.body.kind).toBe('email')
    expect(post.body.action).toBe('approve')
    expect(post.body.values).toMatchObject({ to: 'a@b.com', subject: 'hi', body: 'hello' })
    expect('reject_reason' in post.body).toBe(false)
  })

  it('点拒绝 → 同样发 form_response,带拒绝原因且整字段省略 values(零副作用)', async () => {
    const { container } = render(section())
    fillEmailForm(container)
    const reasonInput = container.querySelector<HTMLElement>(
      '[data-testid="business-form-reject-reason"]',
    )
    expect(reasonInput).not.toBeNull()
    fireEvent.change(reasonInput!, { target: { value: '时间不合适' } })
    clickAction(container, 'reject')

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const post = lastPost()
    expect(post.body.action).toBe('reject')
    expect(post.body.reject_reason).toBe('时间不合适')
    // 不是 null,是根本不存在该字段(存在即可能诱导后端建空记录)
    expect('values' in post.body).toBe(false)
    expect(post.body.request_id).toBe(REQUEST_ID)
  })

  it('无 sessionId 时不发 POST 且如实判 failed(不把应答静默吞掉)', async () => {
    useBusinessFormStore.setState({ byMessage: {} })
    useBusinessFormStore.getState().appendFormRequest({
      requestId: 'frm-no-session',
      kind: 'calendarEvent',
      messageId: MESSAGE_ID,
      actions: ['approve', 'reject'],
      status: 'pending',
    })
    const { container } = render(section())
    clickAction(container, 'reject')
    await vi.waitFor(() =>
      expect(
        container.querySelector('[data-form-send-failed="frm-no-session"]'),
      ).not.toBeNull(),
    )
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
