// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CI_CHECK_STATES, CI_CHECKS_SUMMARIES, type CiCheck } from '@ihui/shared/chat'

import { PrChecksCard } from '../pr-checks-card'

// 只断言**结构与判据**(六态/聚合/动作可见性),文案一律走 key,
// 真实文案覆盖由下面「读真实词包」那组用例守住 —— 这样组件测试不依赖文案措辞变动。
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}(${JSON.stringify(values)})` : key,
}))

vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
}))

const check = (name: string, state: CiCheck['state']): CiCheck => ({ name, state })

const here = dirname(fileURLToPath(import.meta.url))
const MESSAGES_ROOT = join(here, '../../../../../../../packages/i18n/messages/web')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

describe('D105 PrChecksCard / 聚合态与六态渲染', () => {
  it('空检查 → 空态 none,且不渲染检查列表', () => {
    const { container } = render(<PrChecksCard checks={[]} />)
    expect(container.querySelector('[data-checks-summary="none"]')).not.toBeNull()
    expect(container.querySelectorAll('[data-check-state]').length).toBe(0)
  })

  it('无 checks prop(老后端缺省)→ 同样落空态,不崩', () => {
    const { container } = render(<PrChecksCard />)
    expect(container.querySelector('[data-checks-summary="none"]')).not.toBeNull()
  })

  it('有失败 → failing', () => {
    const { container } = render(
      <PrChecksCard checks={[check('a', 'passed'), check('b', 'failed')]} />,
    )
    expect(container.querySelector('[data-checks-summary="failing"]')).not.toBeNull()
  })

  it('无失败但有 pending → pending', () => {
    const { container } = render(<PrChecksCard checks={[check('a', 'pending')]} />)
    expect(container.querySelector('[data-checks-summary="pending"]')).not.toBeNull()
  })

  it('全部 passed/skipped/neutral → successful', () => {
    const { container } = render(
      <PrChecksCard checks={[check('a', 'passed'), check('b', 'skipped'), check('c', 'neutral')]} />,
    )
    expect(container.querySelector('[data-checks-summary="successful"]')).not.toBeNull()
  })

  it('unknown 归 pending(状态未知不得宣称成功)', () => {
    const { container } = render(<PrChecksCard checks={[check('a', 'passed'), check('b', 'unknown')]} />)
    expect(container.querySelector('[data-checks-summary="pending"]')).not.toBeNull()
  })

  it('六态逐个渲染出对应 data-check-state(含极易漏掉的 neutral / unknown)', () => {
    const { container } = render(
      <PrChecksCard
        checks={[
          check('f', 'failed'),
          check('p', 'passed'),
          check('q', 'pending'),
          check('s', 'skipped'),
          check('n', 'neutral'),
          check('u', 'unknown'),
        ]}
      />,
    )
    for (const state of CI_CHECK_STATES) {
      expect(container.querySelector(`[data-check-state="${state}"]`)).not.toBeNull()
    }
    expect(container.querySelectorAll('[data-check-state]').length).toBe(6)
  })

  it('summary prop 优先于本地归并', () => {
    const { container } = render(
      <PrChecksCard checks={[check('a', 'failed')]} summary="successful" />,
    )
    expect(container.querySelector('[data-checks-summary="successful"]')).not.toBeNull()
  })

  it('计数按 passed/total 口径输出', () => {
    const { container } = render(
      <PrChecksCard checks={[check('a', 'passed'), check('b', 'passed'), check('c', 'failed')]} />,
    )
    expect(container.textContent).toContain('countLabel({"passed":2,"total":3})')
  })
})

describe('D105 PrChecksCard / 动作族可见性', () => {
  it('有失败 → 提供「修复 / 移除」', () => {
    const { container } = render(
      <PrChecksCard checks={[check('a', 'failed')]} onAction={() => {}} />,
    )
    expect(container.querySelector('[data-action="checksFix"]')).not.toBeNull()
    expect(container.querySelector('[data-action="checksRemove"]')).not.toBeNull()
  })

  it('负例:无失败时**不得**出现「修复」入口(不撒谎)', () => {
    for (const checks of [
      [check('a', 'passed')],
      [check('a', 'pending')],
      [check('a', 'unknown')],
      [] as CiCheck[],
    ]) {
      const { container } = render(<PrChecksCard checks={checks} onAction={() => {}} />)
      expect(container.querySelector('[data-action="checksFix"]')).toBeNull()
      expect(container.querySelector('[data-action="commentsAddress"]')).not.toBeNull()
    }
  })

  it('不传 onAction → 不渲染动作行(纯展示)', () => {
    const { container } = render(<PrChecksCard checks={[check('a', 'failed')]} />)
    expect(container.querySelector('[data-action]')).toBeNull()
  })

  it('动作点击回调带上动作 id', () => {
    const onAction = vi.fn()
    const { container } = render(<PrChecksCard checks={[check('a', 'failed')]} onAction={onAction} />)
    const btn = container.querySelector('[data-action="checksFix"]') as HTMLButtonElement
    btn.click()
    expect(onAction).toHaveBeenCalledWith('checksFix')
  })
})

describe('D105 词包覆盖(读真实词包,不 mock)', () => {
  const flat = (obj: Record<string, unknown>, prefix = ''): string[] =>
    Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === 'object' ? flat(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
    )

  const readPrChecks = (locale: string): Record<string, unknown> => {
    const raw = readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')
    const parsed = JSON.parse(raw) as { ai?: { pane?: { prChecks?: Record<string, unknown> } } }
    const node = parsed.ai?.pane?.prChecks
    if (!node) throw new Error(`missing ai.pane.prChecks in ${locale}.json`)
    return node
  }

  it('五语言键集完全一致(parity)', () => {
    const base = flat(readPrChecks('zh-CN')).sort()
    for (const locale of LOCALES) {
      expect(flat(readPrChecks(locale)).sort(), locale).toEqual(base)
    }
  })

  it('六态 / 四聚合 / 四动作文案键全齐', () => {
    for (const locale of LOCALES) {
      const keys = flat(readPrChecks(locale))
      for (const state of CI_CHECK_STATES) expect(keys, `${locale} state.${state}`).toContain(`state.${state}`)
      for (const summary of CI_CHECKS_SUMMARIES) {
        expect(keys, `${locale} summary.${summary}`).toContain(`summary.${summary}`)
      }
      for (const action of ['checksFix', 'checksRemove', 'commentsAddress', 'commentsRemove']) {
        expect(keys, `${locale} action.${action}`).toContain(`action.${action}`)
      }
    }
  })

  it('zh-CN 文案与台账原文逐字一致(防自创措辞)', () => {
    const node = readPrChecks('zh-CN') as {
      summary: Record<string, string>
      state: Record<string, string>
    }
    expect(node.state.failed).toBe('测试失败')
    expect(node.state.passed).toBe('测试已通过')
    expect(node.state.pending).toBe('待测试')
    expect(node.state.skipped).toBe('已跳过的测试')
    expect(node.state.neutral).toBe('中性测试')
    expect(node.state.unknown).toBe('测试状态未知')
    expect(node.summary.failing).toBe('检查未通过')
    expect(node.summary.pending).toBe('检查待处理')
    expect(node.summary.successful).toBe('检查已通过')
    expect(node.summary.none).toBe('无 CI 检查')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
