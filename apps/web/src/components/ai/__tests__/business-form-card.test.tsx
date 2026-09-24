// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  BUSINESS_FORM_FIELDS,
  type BusinessFormActionPayload,
} from '@ihui/shared/chat/business-forms'

import { BusinessFormCard } from '../business-form-card'

// 只断言**结构与判据**(字段集 / 校验错误 / 成对动作 / 折叠),文案一律走 key,
// 真实文案覆盖由下面「读真实词包」那组用例守住 —— 组件测试不依赖文案措辞变动。
vi.mock('next-intl', () => ({
  useTranslations:
    (ns: string) =>
    (key: string, values?: Record<string, unknown>) =>
      values ? `${ns}.${key}(${JSON.stringify(values)})` : `${ns}.${key}`,
}))

const here = dirname(fileURLToPath(import.meta.url))
const MESSAGES_ROOT = join(here, '../../../../../../packages/i18n/messages/web')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

const fillField = (container: HTMLElement, key: string, value: string) => {
  const field = container.querySelector(`[data-form-field="${key}"]`)
  if (!field) throw new Error(`missing field: ${key}`)
  const input = field.querySelector('input, textarea')
  if (!input) throw new Error(`missing input for field: ${key}`)
  fireEvent.change(input, { target: { value } })
}

describe('D77 BusinessFormCard / 两形状渲染', () => {
  it('email 卡渲染六字段(字段集与判定层 schema 同源)', () => {
    const { container } = render(<BusinessFormCard kind="email" />)
    expect(container.querySelector('[data-form-kind="email"]')).not.toBeNull()
    expect(container.querySelector('[data-form-phase="filling"]')).not.toBeNull()
    for (const field of BUSINESS_FORM_FIELDS.email) {
      expect(container.querySelector(`[data-form-field="${field.key}"]`), field.key).not.toBeNull()
    }
    expect(container.querySelector('[data-form-field]')).not.toBeNull()
  })

  it('calendarEvent 卡渲染三字段 + 多出席人输入', () => {
    const { container } = render(<BusinessFormCard kind="calendarEvent" />)
    expect(container.querySelector('[data-form-kind="calendarEvent"]')).not.toBeNull()
    for (const field of BUSINESS_FORM_FIELDS.calendarEvent) {
      expect(container.querySelector(`[data-form-field="${field.key}"]`), field.key).not.toBeNull()
    }
  })

  it('批准侧文案按形态派发:email=批准 / 日历 create=创建 / update=保存', () => {
    const onAction = vi.fn()
    const email = render(<BusinessFormCard kind="email" onAction={onAction} />)
    expect(email.container.querySelector('[data-action="approve"]')?.textContent).toContain(
      'ai.pane.businessForms.action.approve',
    )
    const created = render(<BusinessFormCard kind="calendarEvent" mode="create" onAction={vi.fn()} />)
    expect(created.container.querySelector('[data-action="approve"]')?.textContent).toContain(
      'ai.pane.businessForms.action.create',
    )
    const updated = render(<BusinessFormCard kind="calendarEvent" mode="update" onAction={vi.fn()} />)
    expect(updated.container.querySelector('[data-action="approve"]')?.textContent).toContain(
      'ai.pane.businessForms.action.save',
    )
    expect(updated.container.querySelector('[data-form-submit-intent="save"]')).not.toBeNull()
  })
})

describe('D77 BusinessFormCard / 校验错误显示与 onAction 门槛', () => {
  it('负例:email 必填缺失点批准 → 显示 fieldErrors,onAction 不被调用,仍停在 filling', () => {
    const onAction = vi.fn()
    const { container } = render(<BusinessFormCard kind="email" onAction={onAction} />)
    fireEvent.click(container.querySelector('[data-action="approve"]')!)
    expect(container.querySelector('[data-form-error="to"]')).not.toBeNull()
    expect(container.querySelector('[data-form-error="subject"]')).not.toBeNull()
    expect(container.querySelector('[data-form-error="body"]')).not.toBeNull()
    expect(onAction).not.toHaveBeenCalled()
    expect(container.querySelector('[data-form-phase="filling"]')).not.toBeNull()
  })

  it('负例:email 格式错误 → invalidEmail 显示;修正后批准带完整 values', () => {
    const onAction = vi.fn()
    const { container } = render(<BusinessFormCard kind="email" onAction={onAction} />)
    fillField(container, 'to', 'bad')
    fireEvent.click(container.querySelector('[data-action="approve"]')!)
    expect(container.querySelector('[data-form-error="to"]')?.getAttribute('data-form-error-kind')).toBe(
      'invalidEmail',
    )
    expect(onAction).not.toHaveBeenCalled()

    fillField(container, 'to', 'a@b.com')
    fillField(container, 'subject', '评审')
    fillField(container, 'body', '请查收')
    fireEvent.click(container.querySelector('[data-action="approve"]')!)
    expect(onAction).toHaveBeenCalledTimes(1)
    const payload = onAction.mock.calls[0]?.[0] as BusinessFormActionPayload
    expect(payload.action).toBe('approve')
    expect(payload.kind).toBe('email')
    expect(payload.values).toMatchObject({ to: 'a@b.com', subject: '评审', body: '请查收' })
    expect(container.querySelector('[data-form-phase="approved"]')).not.toBeNull()
  })

  it('负例:日历 开始>=结束 → endBeforeStart;出席人空 → noAttendees;均不触发 onAction', () => {
    const onAction = vi.fn()
    const { container } = render(<BusinessFormCard kind="calendarEvent" onAction={onAction} />)
    fillField(container, 'start', '2026-09-24T11:00')
    fillField(container, 'end', '2026-09-24T10:00')
    fireEvent.click(container.querySelector('[data-action="approve"]')!)
    expect(container.querySelector('[data-form-error="end"]')?.getAttribute('data-form-error-kind')).toBe(
      'endBeforeStart',
    )
    expect(container.querySelector('[data-form-error="attendees"]')?.getAttribute('data-form-error-kind')).toBe(
      'noAttendees',
    )
    expect(onAction).not.toHaveBeenCalled()
  })
})

describe('D77 BusinessFormCard / 批准-拒绝成对与拒绝零副作用(本票硬约束负例)', () => {
  it('拒绝:onAction 只收到一次 reject-only 应答(values=null),不触发提交,状态回显 rejected', () => {
    const onAction = vi.fn()
    const { container } = render(<BusinessFormCard kind="email" onAction={onAction} />)
    fillField(container, 'to', 'a@b.com')
    fireEvent.click(container.querySelector('[data-action="reject"]')!)

    expect(onAction).toHaveBeenCalledTimes(1)
    const payload = onAction.mock.calls[0]?.[0] as BusinessFormActionPayload
    expect(payload.action).toBe('reject')
    expect(payload.values).toBeNull()
    expect(container.querySelector('[data-form-phase="rejected"]')).not.toBeNull()
    expect(container.querySelector('[data-form-status="rejected"]')).not.toBeNull()
    // 拒绝后动作行收起,不得再给批准入口
    expect(container.querySelector('[data-action="approve"]')).toBeNull()
    expect(container.querySelector('[data-action="reject"]')).toBeNull()
  })

  it('拒绝路径零副作用判据(判定层)在组件回调形状上成立', () => {
    const onAction = vi.fn()
    const { container } = render(<BusinessFormCard kind="calendarEvent" onAction={onAction} />)
    fillField(container, 'start', '2026-09-24T10:00')
    fillField(container, 'end', '2026-09-24T11:00')
    fireEvent.click(container.querySelector('[data-action="reject"]')!)
    const payloads = onAction.mock.calls.map((c) => c[0] as BusinessFormActionPayload)
    // 只有 reject 一条,没有任何 approve/提交意图
    expect(payloads.every((p) => p.action === 'reject')).toBe(true)
    expect(payloads.every((p) => p.values === null)).toBe(true)
  })
})

describe('D77 BusinessFormCard / 多出席人折叠', () => {
  const fillFiveAttendees = (container: HTMLElement) => {
    fillField(container, 'attendees', 'a@b.com, c@d.cn; e@f.org g@h.net,i@j.kr')
    return container
  }

  it('超过阈值折叠:只显示前 3 个 chip + 展开计数入口', () => {
    const { container } = render(<BusinessFormCard kind="calendarEvent" />)
    fillFiveAttendees(container)
    const row = container.querySelector('[data-form-attendees-count="5"]')
    expect(row).not.toBeNull()
    expect(container.querySelectorAll('[data-form-attendee]')).toHaveLength(3)
    const expand = container.querySelector('[data-attendees-expand]')
    expect(expand).not.toBeNull()
    // 展开计数文案带 {count}=2
    expect(expand?.textContent).toContain('"count":2')
    expect(container.querySelector('[data-attendees-collapse]')).toBeNull()
  })

  it('展开后显示全部 5 个 + 收起入口;收起回到折叠态', () => {
    const { container } = render(<BusinessFormCard kind="calendarEvent" />)
    fillFiveAttendees(container)
    fireEvent.click(container.querySelector('[data-attendees-expand]')!)
    expect(container.querySelectorAll('[data-form-attendee]')).toHaveLength(5)
    const collapse = container.querySelector('[data-attendees-collapse]')
    expect(collapse).not.toBeNull()
    fireEvent.click(collapse!)
    expect(container.querySelectorAll('[data-form-attendee]')).toHaveLength(3)
  })

  it('阈值内(3 人)不折叠:无展开/收起入口', () => {
    const { container } = render(<BusinessFormCard kind="calendarEvent" />)
    fillField(container, 'attendees', 'a@b.com, c@d.cn, e@f.org')
    expect(container.querySelector('[data-form-attendees-count="3"]')).not.toBeNull()
    expect(container.querySelectorAll('[data-form-attendee]')).toHaveLength(3)
    expect(container.querySelector('[data-attendees-expand]')).toBeNull()
    expect(container.querySelector('[data-attendees-collapse]')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 词包:五语言键集一致 + 同批键存活 + zh-CN 逐字
// ---------------------------------------------------------------------------

type Msgs = Record<string, unknown>
function dig(obj: Msgs, path: string[]): unknown {
  let cur: unknown = obj
  for (const seg of path) {
    if (typeof cur !== 'object' || cur === null) return undefined
    cur = (cur as Msgs)[seg]
  }
  return cur
}
function collectKeys(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node as Msgs).flatMap(([k, v]) =>
    collectKeys(v, prefix ? `${prefix}.${k}` : k),
  )
}

describe('D77 词包 / 五语言 parity + 同批键存活 + zh-CN 逐字', () => {
  const packs = Object.fromEntries(
    LOCALES.map((locale) => [
      locale,
      JSON.parse(readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')) as Msgs,
    ]),
  ) as Record<(typeof LOCALES)[number], Msgs>

  it('ai.pane.businessForms 五语言键集完全一致', () => {
    const baseline = collectKeys(dig(packs['zh-CN'], ['ai', 'pane', 'businessForms'])).sort()
    expect(baseline.length).toBeGreaterThan(0)
    for (const locale of LOCALES.slice(1)) {
      const keys = collectKeys(dig(packs[locale], ['ai', 'pane', 'businessForms'])).sort()
      expect(keys, locale).toEqual(baseline)
    }
  })

  it('同批键存活:inputNotices 硬断言;cloudChatOps / modelLoad 落盘后自动转硬校验', () => {
    for (const locale of LOCALES) {
      const pane = dig(packs[locale], ['ai', 'pane']) as Msgs | undefined
      expect(pane?.inputNotices, `${locale}.inputNotices`).toBeDefined()
      // cloudChatOps(D97)/ modelLoad(D59)同批在途:存在则校验,缺席显式降级不误伤
      if (pane?.cloudChatOps !== undefined) expect(pane.cloudChatOps, `${locale}.cloudChatOps`).toBeDefined()
      if (pane?.modelLoad !== undefined) expect(pane.modelLoad, `${locale}.modelLoad`).toBeDefined()
    }
  })

  it('zh-CN 逐字:任务原文判据措辞', () => {
    const ns = dig(packs['zh-CN'], ['ai', 'pane', 'businessForms']) as Msgs
    const fields = ns.fields as Msgs
    expect(fields.to).toBe('收件人')
    expect(fields.cc).toBe('抄送')
    expect(fields.bcc).toBe('密送')
    expect(fields.subject).toBe('主题')
    expect(fields.replyTo).toBe('回复至')
    expect(fields.body).toBe('正文')
    expect(fields.start).toBe('开始')
    expect(fields.end).toBe('结束')
    expect(fields.attendees).toBe('出席人')
    const action = ns.action as Msgs
    expect(action.approve).toBe('批准')
    expect(action.reject).toBe('拒绝')
    expect(action.create).toBe('创建')
    expect(action.save).toBe('保存')
  })

  it('ja 词表无简体中文残留字(协作/概览/绑定判据字)', () => {
    const raw = JSON.stringify(dig(packs['ja'], ['ai', 'pane', 'businessForms']))
    expect(raw).not.toContain('协作')
    expect(raw).not.toContain('概览')
    expect(raw).not.toContain('绑定')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
