// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as React from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  POLISH_FIXED_KEYS,
  POLISH_PHASES,
  applyPolishResult,
  beginPolish,
  createPolishState,
  polishActionKey,
  polishFixedKey,
  polishPhaseKey,
  polishRejectionKey,
  type PromptPolishState,
} from '@ihui/shared/chat/prompt-polish'

import { PromptPolishEntry, PromptPolishNotice } from '../message-input'

// 只断言**结构与判据**(入口可见 / 保稿提示 / 重试可点 / 相位键),文案一律走 key;
// 真实文案与五语言 parity 由下面「读真实词包」那组用例守住 —— 词措辞变动不打破组件测试。
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

// message-input 的传递依赖链 brand-icon → @lobehub/icons → @lobehub/ui → emoji-mart 会在
// vitest 下崩(@emoji-mart/data 的 native.json 缺 `type: json` 导入属性,与本次被测组件无关)。
// 单独替换为空实现即可,不必拉整条模型选择器依赖树(仓内既有先例见 model-tier-utils.ts 文件头)。
vi.mock('@/components/ai/brand-icon', () => ({
  BrandIcon: () => null,
  inferVendor: () => undefined,
}))

const ORIGINAL = '帮我写个总结'
const POLISHED = '请帮我撰写一份条理清晰的总结，覆盖要点并给出结论。'

// 逐例清理 DOM(本文件查询用整文档 getByTestId),避免上一例残留节点造成多重匹配
afterEach(() => {
  cleanup()
})

const stateAt = (patch: Partial<PromptPolishState> = {}): PromptPolishState => ({
  ...createPolishState(ORIGINAL),
  ...patch,
})

/** 最小接线:入口 + 提示条 + 草稿回显,走**真实判定层**(不 mock 状态机) */
function Harness({ outcome = 'ok' as 'ok' | 'failed' }) {
  const [state, setState] = React.useState<PromptPolishState>(() => createPolishState(ORIGINAL))
  const run = () => {
    const started = beginPolish(state)
    if (started.phase !== 'polishing') {
      setState(started)
      return
    }
    setState(() =>
      outcome === 'ok'
        ? applyPolishResult(started, { kind: 'succeeded', text: POLISHED })
        : applyPolishResult(started, { kind: 'failed', error: 'boom' }),
    )
  }
  return (
    <div>
      <PromptPolishEntry state={state} onPolish={run} />
      <PromptPolishNotice state={state} onRetry={run} />
      <output data-testid="draft">{state.draft}</output>
    </div>
  )
}

describe('D82 润色入口(PromptPolishEntry)', () => {
  it('入口可见,标签 / ariaLabel 走词包键,非空草稿可点', () => {
    const onPolish = vi.fn()
    const { container } = render(<PromptPolishEntry state={stateAt()} onPolish={onPolish} />)
    const btn = container.querySelector('[data-testid="prompt-polish-entry"]') as HTMLButtonElement
    expect(btn).not.toBeNull()
    expect(btn.textContent).toContain('entryLabel')
    expect(btn.getAttribute('aria-label')).toBe('ariaLabel')
    expect(btn.disabled).toBe(false)
    expect(btn.getAttribute('data-polish-disabled-reason')).toBe('none')
    btn.click()
    expect(onPolish).toHaveBeenCalledTimes(1)
  })

  it('空 / 纯空白草稿 → 入口禁用且注明拒绝原因(与判定层 canStartPolish 同源)', () => {
    for (const empty of ['', '   \n']) {
      const { container, unmount } = render(
        <PromptPolishEntry state={stateAt({ draft: empty })} onPolish={vi.fn()} />,
      )
      const btn = container.querySelector('[data-testid="prompt-polish-entry"]') as HTMLButtonElement
      expect(btn.disabled, JSON.stringify(empty)).toBe(true)
      expect(btn.getAttribute('data-polish-disabled-reason')).toBe('emptyDraft')
      expect(btn.getAttribute('data-polish-phase')).toBe('idle')
      unmount()
    }
  })

  it('polishing 相位 → 入口禁用(防重复发起),相位键可读', () => {
    const { container } = render(
      <PromptPolishEntry state={stateAt({ phase: 'polishing' })} onPolish={vi.fn()} />,
    )
    const btn = container.querySelector('[data-testid="prompt-polish-entry"]') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(btn.getAttribute('data-polish-phase')).toBe('polishing')
    expect(btn.getAttribute('data-polish-key')).toBe('phase.polishing')
  })

  it('外部 disabled(流式中)→ 入口禁用', () => {
    const { container } = render(
      <PromptPolishEntry state={stateAt()} disabled onPolish={vi.fn()} />,
    )
    expect(
      (container.querySelector('[data-testid="prompt-polish-entry"]') as HTMLButtonElement).disabled,
    ).toBe(true)
  })
})

describe('D82 保稿提示条(PromptPolishNotice)', () => {
  it('无失败 / 无拒绝 / 无重启提示 → 零占位(不渲染)', () => {
    const { container } = render(<PromptPolishNotice state={stateAt()} onRetry={vi.fn()} />)
    expect(container.querySelector('[data-testid="prompt-polish-notice"]')).toBeNull()
  })

  it('失败 → 渲染保稿提示(草稿已保留同族文案键),且「重试」可用', () => {
    const onRetry = vi.fn()
    const failed = applyPolishResult(beginPolish(createPolishState(ORIGINAL)), {
      kind: 'failed',
      error: 'boom',
    })
    const { container } = render(<PromptPolishNotice state={failed} onRetry={onRetry} />)
    const notice = container.querySelector('[data-testid="prompt-polish-notice"]')
    expect(notice).not.toBeNull()

    const kept = container.querySelector('[data-testid="prompt-polish-failure"]')
    expect(kept?.textContent).toBe('failureDraftKept')
    expect(kept?.getAttribute('data-polish-error')).toBe('boom')

    const retry = container.querySelector('[data-testid="prompt-polish-retry"]') as HTMLButtonElement
    expect(retry).not.toBeNull()
    expect(retry.textContent).toBe('action.retry')
    retry.click()
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('空草稿被拒 → 渲染拒绝原因文案键,且不给「重试」(相位非 failed)', () => {
    const rejected = beginPolish(createPolishState(''))
    const { container } = render(<PromptPolishNotice state={rejected} onRetry={vi.fn()} />)
    expect(container.querySelector('[data-testid="prompt-polish-empty"]')?.textContent).toBe(
      'rejection.emptyDraft',
    )
    expect(container.querySelector('[data-testid="prompt-polish-retry"]')).toBeNull()
  })

  it('需重启生效 → 渲染重启保稿提示(草稿已保留)', () => {
    const hinted = applyPolishResult(beginPolish(createPolishState(ORIGINAL)), {
      kind: 'failed',
      restartReason: 'featureToggled',
    })
    const { container } = render(<PromptPolishNotice state={hinted} onRetry={vi.fn()} />)
    expect(container.querySelector('[data-testid="prompt-polish-restart"]')?.textContent).toBe(
      'restartHint',
    )
    // 重启提示与失败保稿同时存在
    expect(container.querySelector('[data-testid="prompt-polish-failure"]')).not.toBeNull()
  })
})

describe('D82 三用例联动(组件 + 判定层,实跑)', () => {
  it('① 润色成功 → 草稿被**替换**(非拼接),提示条消失', () => {
    const { container, getByTestId } = render(<Harness outcome="ok" />)
    expect(getByTestId('draft').textContent).toBe(ORIGINAL)

    fireEvent.click(container.querySelector('[data-testid="prompt-polish-entry"]') as HTMLElement)
    expect(getByTestId('draft').textContent).toBe(POLISHED)
    expect(getByTestId('draft').textContent).not.toContain(ORIGINAL)
    expect(container.querySelector('[data-testid="prompt-polish-notice"]')).toBeNull()
    expect(
      (container.querySelector('[data-testid="prompt-polish-entry"]') as HTMLElement).getAttribute(
        'data-polish-phase',
      ),
    ).toBe('succeeded')
  })

  it('② 润色失败 → 草稿**逐字节保留**,提示条与「重试」出现', () => {
    const { container, getByTestId } = render(<Harness outcome="failed" />)
    fireEvent.click(container.querySelector('[data-testid="prompt-polish-entry"]') as HTMLElement)

    expect(getByTestId('draft').textContent).toBe(ORIGINAL)
    expect(container.querySelector('[data-testid="prompt-polish-failure"]')?.textContent).toBe(
      'failureDraftKept',
    )
    expect(container.querySelector('[data-testid="prompt-polish-retry"]')).not.toBeNull()
  })

  it('③ 二次失败仍可重试 → 重试后草稿仍不变,「重试」按钮依然可用', () => {
    const { container, getByTestId } = render(<Harness outcome="failed" />)
    fireEvent.click(container.querySelector('[data-testid="prompt-polish-entry"]') as HTMLElement)
    expect(getByTestId('draft').textContent).toBe(ORIGINAL)

    const retry = () =>
      container.querySelector('[data-testid="prompt-polish-retry"]') as HTMLButtonElement
    expect(retry()).not.toBeNull()
    retry().click()
    expect(getByTestId('draft').textContent).toBe(ORIGINAL)
    // 二次失败后入口回到 failed、重试仍可用
    expect(
      (container.querySelector('[data-testid="prompt-polish-entry"]') as HTMLElement).getAttribute(
        'data-polish-phase',
      ),
    ).toBe('failed')
    expect(retry()).not.toBeNull()
  })
})

describe('D82 词包覆盖(读真实词包,不 mock)', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const MESSAGES_ROOT = join(here, '../../../../../../packages/i18n/messages/web')
  const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

  const flat = (obj: Record<string, unknown>, prefix = ''): string[] =>
    Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === 'object'
        ? flat(v as Record<string, unknown>, `${prefix}${k}.`)
        : [`${prefix}${k}`],
    )

  const readNode = (locale: string, path: string): Record<string, unknown> => {
    const raw = readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const node = path
      .split('.')
      .reduce<unknown>(
        (acc, seg) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[seg] : undefined),
        parsed,
      )
    if (!node || typeof node !== 'object') throw new Error(`missing ${path} in ${locale}.json`)
    return node as Record<string, unknown>
  }

  const valuesOf = (node: Record<string, unknown>): string[] =>
    flat(node).map((k) => {
      const v = k.split('.').reduce<unknown>(
        (acc, seg) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[seg] : undefined),
        node,
      )
      return String(v)
    })

  it('五语言 promptPolish 键集完全一致(parity)', () => {
    const base = flat(readNode('zh-CN', 'ai.pane.promptPolish')).sort()
    for (const locale of LOCALES) {
      expect(flat(readNode(locale, 'ai.pane.promptPolish')).sort(), locale).toEqual(base)
    }
  })

  it('键集覆盖四相位 / 两动作 / 拒绝原因 / 四个固定键(与判定层生成器同源)', () => {
    const base = flat(readNode('zh-CN', 'ai.pane.promptPolish'))
    for (const phase of POLISH_PHASES) {
      expect(base, polishPhaseKey(phase)).toContain(polishPhaseKey(phase))
    }
    for (const action of ['polish', 'retry'] as const) {
      expect(base, polishActionKey(action)).toContain(polishActionKey(action))
    }
    expect(base).toContain(polishRejectionKey('emptyDraft'))
    for (const key of POLISH_FIXED_KEYS) {
      expect(base, polishFixedKey(key)).toContain(polishFixedKey(key))
    }
  })

  it('zh-CN 失败保稿文案与台账原文逐字一致', () => {
    const node = readNode('zh-CN', 'ai.pane.promptPolish')
    expect(node.failureDraftKept).toBe('暂时无法润色提示词，草稿已保留。')
    expect(node.entryLabel).toBe('润色')
    expect(node.action && (node.action as Record<string, string>).retry).toBe('重试')
  })

  it('ja 不得残留简体中文词(协作/概览/绑定/无法/撤销/打开/正在/接受/保存)', () => {
    const forbidden = ['协作', '概览', '绑定', '无法', '撤销', '打开', '正在', '接受', '保存']
    for (const [idx, v] of valuesOf(readNode('ja', 'ai.pane.promptPolish')).entries()) {
      for (const word of forbidden) {
        expect(v.includes(word), `ja 值#${idx} "${v}" 含简体词「${word}」`).toBe(false)
      }
    }
  })

  it('非英文语言的值不直接照抄 en(未翻译兜底)', () => {
    const en = valuesOf(readNode('en', 'ai.pane.promptPolish'))
    for (const locale of ['zh-CN', 'zh-TW', 'ja', 'ko'] as const) {
      expect(valuesOf(readNode(locale, 'ai.pane.promptPolish')), locale).not.toEqual(en)
    }
  })

  it('同批并行任务的两批键未被破坏(worktree 17 键 / writingBlock 23 键,五语言齐)', () => {
    for (const locale of LOCALES) {
      expect(flat(readNode(locale, 'ai.pane.worktree')).length, `${locale} worktree`).toBe(17)
      expect(flat(readNode(locale, 'ai.pane.writingBlock')).length, `${locale} writingBlock`).toBe(23)
    }
  })
})
