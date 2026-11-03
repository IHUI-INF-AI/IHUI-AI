// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { fireEvent, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  OPEN_IN_APPS,
  WRITING_BLOCK_ACTIONS,
  WRITING_BLOCK_PHASES,
  WRITING_BLOCK_STATUSES,
  openInLabel,
  writingBlockActionKey,
  writingBlockPhaseKey,
  writingBlockStatusKey,
  type WritingBlock,
  type WritingBlockState,
  type WritingBlockStatus,
} from '@ihui/shared/chat/writing-block'

import { WritingBlockCard } from '../writing-block'

// 只断言**结构与判据**(五态/三动作/失败态/打开方式),文案一律走 key,
// 真实文案覆盖由下面「读真实词包」那组用例守住 —— 这样组件测试不依赖文案措辞变动。
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}(${JSON.stringify(values)})` : key,
}))

// 断言「接受/撤销把定稿与原文记入**既有 canvas 版本栈**」(D96 编辑栈纪律:不新造编辑栈)
const canvasState = vi.hoisted(() => ({ pushVersion: vi.fn() }))
vi.mock('@/stores/canvas-store', () => ({
  useCanvasStore: <T,>(selector: (s: typeof canvasState) => T): T => selector(canvasState),
}))

const block = (
  id: string,
  status: WritingBlockStatus,
  original = `原文-${id}`,
  draft = `草稿-${id}`,
): WritingBlock => ({ id, status, original, draft })

const state = (...blocks: WritingBlock[]): WritingBlockState => ({ blocks })

const here = dirname(fileURLToPath(import.meta.url))
const MESSAGES_ROOT = join(here, '../../../../../../packages/i18n/messages/web')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

beforeEach(() => {
  canvasState.pushVersion.mockClear()
})

describe('D96 WritingBlockCard / 渲染与空态', () => {
  it('空批 → 渲染空态文案键,块列表为 0,不崩', () => {
    const { container } = render(<WritingBlockCard state={state()} />)
    expect(container.querySelector('[data-writing-block-empty]')).not.toBeNull()
    expect(container.querySelector('[data-writing-block-empty]')?.textContent).toBe('empty')
    expect(container.querySelector('[data-writing-block-root]')?.getAttribute('data-block-count')).toBe('0')
    expect(container.querySelectorAll('[data-writing-block]').length).toBe(0)
  })

  it('五态逐个渲染出对应 data-block-status(含极易漏掉的 reverted / failed)', () => {
    const { container } = render(
      <WritingBlockCard
        state={state(
          ...WRITING_BLOCK_STATUSES.map((s, i) => block(`b${i}`, s)),
        )}
      />,
    )
    for (const s of WRITING_BLOCK_STATUSES) {
      expect(container.querySelector(`[data-block-status="${s}"]`), s).not.toBeNull()
    }
    expect(container.querySelectorAll('[data-writing-block]').length).toBe(5)
  })

  it('失败态渲染出失败判据与文案键(无法更新此写作块同族)', () => {
    const { container } = render(<WritingBlockCard state={state(block('b1', 'failed'))} />)
    expect(container.querySelector('[data-block-error="failed"]')).not.toBeNull()
    expect(container.querySelector('[data-block-status-label="failed"]')?.textContent).toBe(
      'status.failed',
    )
  })

  it('标题 / ariaLabel 走词包键(不硬编码文案)', () => {
    const { container } = render(<WritingBlockCard state={state(block('b1', 'editing'))} />)
    expect(container.querySelector('[data-writing-block-title]')?.textContent).toBe('title')
    expect(container.querySelector('[data-writing-block-root]')?.getAttribute('aria-label')).toBe(
      'ariaLabel',
    )
  })

  it('可编辑文本块受控于调用方草稿(onDraftChange 存在即可写)', () => {
    const onDraftChange = vi.fn()
    const { container } = render(
      <WritingBlockCard state={state(block('b1', 'editing'))} onDraftChange={onDraftChange} />,
    )
    const ta = container.querySelector('[data-block-draft="b1"]') as HTMLTextAreaElement
    expect(ta.value).toBe('草稿-b1')
    expect(ta.readOnly).toBe(false)
    fireEvent.change(ta, { target: { value: '用户改写' } })
    expect(onDraftChange).toHaveBeenCalledWith('b1', '用户改写')
  })

  it('不传 onDraftChange → 只读展示(不偷偷制造第二份草稿状态)', () => {
    const { container } = render(<WritingBlockCard state={state(block('b1', 'editing'))} />)
    const ta = container.querySelector('[data-block-draft="b1"]') as HTMLTextAreaElement
    expect(ta.readOnly).toBe(true)
  })
})

describe('D96 WritingBlockCard / 三动作可点', () => {
  it('逐块「接受」可点,回调带动作 id 与块 id,并把定稿记入 canvas 版本栈', () => {
    const onAction = vi.fn()
    const { container } = render(
      <WritingBlockCard state={state(block('b1', 'editing'))} onAction={onAction} />,
    )
    const btn = container.querySelector('[data-block-action="accept"]') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    btn.click()
    expect(onAction).toHaveBeenCalledWith('accept', 'b1')
    expect(canvasState.pushVersion).toHaveBeenCalledWith('草稿-b1', 'action.accept')
  })

  it('逐块「撤销」可点(accepted 块),并把接受前原文记入 canvas 版本栈(撤销可逆)', () => {
    const onAction = vi.fn()
    const { container } = render(
      <WritingBlockCard state={state(block('b1', 'accepted', '接受前原文', '定稿'))} onAction={onAction} />,
    )
    const btn = container.querySelector('[data-block-action="revert"]') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    btn.click()
    expect(onAction).toHaveBeenCalledWith('revert', 'b1')
    expect(canvasState.pushVersion).toHaveBeenCalledWith('接受前原文', 'action.revert')
  })

  it('「全部接受」可点(整批可接受时),逐块记入版本栈', () => {
    const onAction = vi.fn()
    const { container } = render(
      <WritingBlockCard
        state={state(block('b1', 'idle'), block('b2', 'editing'))}
        onAction={onAction}
      />,
    )
    const btn = container.querySelector('[data-block-action="acceptAll"]') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    expect(btn.getAttribute('data-accept-all-reject')).toBe('none')
    btn.click()
    expect(onAction).toHaveBeenCalledWith('acceptAll', undefined)
    expect(canvasState.pushVersion).toHaveBeenCalledTimes(2)
  })

  it('未接受的块「撤销」禁用;已接受的块「接受」禁用(可行性与判定层一致)', () => {
    const { container } = render(
      <WritingBlockCard state={state(block('b1', 'editing'))} onAction={vi.fn()} />,
    )
    expect(
      (container.querySelector('[data-block-action="revert"]') as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(
      (container.querySelector('[data-block-action="accept"]') as HTMLButtonElement).disabled,
    ).toBe(false)
  })

  it('失败块:接受与撤销双双禁用,且不触发回调/不入版本栈', () => {
    const onAction = vi.fn()
    const { container } = render(
      <WritingBlockCard state={state(block('b1', 'failed'))} onAction={onAction} />,
    )
    for (const a of ['accept', 'revert'] as const) {
      const btn = container.querySelector(`[data-block-action="${a}"]`) as HTMLButtonElement
      expect(btn.disabled, a).toBe(true)
      btn.click()
    }
    expect(onAction).not.toHaveBeenCalled()
    expect(canvasState.pushVersion).not.toHaveBeenCalled()
  })

  it('存在失败块 → 「全部接受」禁用且拒绝原因可读(不得静默跳过)', () => {
    const onAction = vi.fn()
    const { container } = render(
      <WritingBlockCard
        state={state(block('b1', 'editing'), block('b2', 'failed'))}
        onAction={onAction}
      />,
    )
    const btn = container.querySelector('[data-block-action="acceptAll"]') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(btn.getAttribute('data-accept-all-reject')).toBe('failed')
    btn.click()
    expect(onAction).not.toHaveBeenCalled()
    expect(canvasState.pushVersion).not.toHaveBeenCalled()
  })

  it('不传 onAction → 不渲染任何动作按钮(纯展示)', () => {
    const { container } = render(<WritingBlockCard state={state(block('b1', 'editing'))} />)
    expect(container.querySelector('[data-block-action]')).toBeNull()
  })

  it('动作相位行按 actionPhase 渲染(三相位可取词)', () => {
    const { container } = render(
      <WritingBlockCard
        state={state(block('b1', 'failed'))}
        actionPhase={{ accept: 'failed', acceptAll: 'inProgress' }}
      />,
    )
    expect(container.querySelector('[data-action-phase="accept:failed"]')?.textContent).toBe(
      'phase.accept.failed',
    )
    expect(container.querySelector('[data-action-phase="acceptAll:inProgress"]')?.textContent).toBe(
      'phase.acceptAll.inProgress',
    )
    // 未给相位的动作不渲染
    expect(container.querySelector('[data-action-phase="revert:inProgress"]')).toBeNull()
  })
})

describe('D96 WritingBlockCard / 打开方式应用选择器', () => {
  it('选择器可见,选项覆盖 OPEN_IN_APPS,email 项文案形态即台账原文', () => {
    const { container } = render(<WritingBlockCard state={state(block('b1', 'editing'))} />)
    expect(container.querySelector('[data-open-in-select]')).not.toBeNull()
    expect(container.querySelector('[data-open-in-label]')?.textContent).toBe('openIn.label')
    const options = container.querySelectorAll('[data-open-in]')
    expect(options.length).toBe(OPEN_IN_APPS.length)
    const email = container.querySelector('[data-open-in="email"]')
    expect(email).not.toBeNull()
    expect(email?.textContent).toBe('openIn.email')
  })

  it('切换打开方式 → onOpenIn 带上应用 id(B 面数据在调用方)', () => {
    const onOpenIn = vi.fn()
    const { container } = render(
      <WritingBlockCard state={state(block('b1', 'editing'))} onOpenIn={onOpenIn} />,
    )
    const select = container.querySelector('[data-open-in-select]') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'browser' } })
    expect(onOpenIn).toHaveBeenCalledWith('browser')
  })

  it('openInApps 可覆盖候选集(缺省即判定层 OPEN_IN_APPS)', () => {
    const { container } = render(
      <WritingBlockCard state={state(block('b1', 'editing'))} openInApps={['email']} />,
    )
    expect(container.querySelectorAll('[data-open-in]').length).toBe(1)
  })
})

describe('D96 词包覆盖(读真实词包,不 mock)', () => {
  const flat = (obj: Record<string, unknown>, prefix = ''): string[] =>
    Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === 'object' ? flat(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
    )

  const readWritingBlock = (locale: string): Record<string, unknown> => {
    const raw = readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')
    const parsed = JSON.parse(raw) as {
      ai?: { pane?: { writingBlock?: Record<string, unknown> } }
    }
    const node = parsed.ai?.pane?.writingBlock
    if (!node) throw new Error(`missing ai.pane.writingBlock in ${locale}.json`)
    return node
  }

  const values = (node: Record<string, unknown>): string[] =>
    flat(node).map((k) => {
      const v = k.split('.').reduce<unknown>(
        (acc, seg) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[seg] : undefined),
        node,
      )
      return String(v)
    })

  it('五语言键集完全一致(parity)', () => {
    const base = flat(readWritingBlock('zh-CN')).sort()
    for (const locale of LOCALES) {
      expect(flat(readWritingBlock(locale)).sort(), locale).toEqual(base)
    }
  })

  it('三动作 / 五态 / 九相位 / 打开方式 键全齐(键名与判定层生成器同源)', () => {
    const base = flat(readWritingBlock('zh-CN'))
    for (const action of WRITING_BLOCK_ACTIONS) {
      expect(base, writingBlockActionKey(action)).toContain(writingBlockActionKey(action))
      for (const phase of WRITING_BLOCK_PHASES) {
        expect(base, writingBlockPhaseKey(action, phase)).toContain(
          writingBlockPhaseKey(action, phase),
        )
      }
    }
    for (const status of WRITING_BLOCK_STATUSES) {
      expect(base, writingBlockStatusKey(status)).toContain(writingBlockStatusKey(status))
    }
    for (const app of OPEN_IN_APPS) {
      expect(base, openInLabel(app)).toContain(openInLabel(app))
    }
    for (const extra of ['title', 'ariaLabel', 'empty', 'openIn.label']) {
      expect(base, extra).toContain(extra)
    }
  })

  it('zh-CN 文案与台账原文逐字一致(防自创措辞)', () => {
    const node = readWritingBlock('zh-CN') as {
      action: Record<string, string>
      status: Record<string, string>
      openIn: Record<string, string>
    }
    expect(node.action.accept).toBe('接受')
    expect(node.action.acceptAll).toBe('全部接受')
    expect(node.action.revert).toBe('撤销')
    expect(node.status.failed).toBe('无法更新此写作块')
    expect(node.openIn.email).toBe('使用默认电子邮箱应用打开电子邮件')
  })

  it('ja 不得残留简体中文词(协作/概览/绑定/无法/撤销/打开/正在/接受)', () => {
    const forbidden = ['协作', '概览', '绑定', '无法', '撤销', '打开', '正在', '接受']
    const node = readWritingBlock('ja')
    for (const [idx, v] of values(node).entries()) {
      for (const word of forbidden) {
        expect(v.includes(word), `ja 值#${idx} "${v}" 含简体词「${word}」`).toBe(false)
      }
    }
  })

  it('非英文语言的值不直接照抄 en(未翻译兜底)', () => {
    const en = values(readWritingBlock('en'))
    for (const locale of ['zh-CN', 'zh-TW', 'ja', 'ko'] as const) {
      expect(values(readWritingBlock(locale)), locale).not.toEqual(en)
    }
  })

  it('OPEN_IN_APPS 每项在五语言里都有键(选择器不出现空选项)', () => {
    for (const locale of LOCALES) {
      const base = flat(readWritingBlock(locale))
      for (const app of OPEN_IN_APPS) {
        expect(base, `${locale} ${openInLabel(app)}`).toContain(openInLabel(app))
      }
    }
  })
})
