// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * 深化AC(2026-11-17) 组件级集成测试 —— 规划步骤失败计数徽章点击定位。
 *
 * 与 plan-step-failure.test.ts(纯决策)分工:那份钉"选哪个步骤当 target";
 * 本份钉"真渲染 PlanStepsCard → 失败徽章是 button → 点击 → 展开卡片 +
 * requestAnimationFrame 后 scrollIntoView 到首个失败步骤行 + 高亮"这条 DOM 链路,
 * 以及无失败时不造徽章残标。
 *
 * mock 边界:只 mock next-intl 走真实词包(不写中文字面量断言)与 toast(避免副作用);
 * progress-jump store 走真实根单例(Provider 外自动回退,无需 mock)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'

const { makeT } = await vi.hoisted(async () => {
  const fs = await import('node:fs')
  const nodePath = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  const here = nodePath.dirname(fileURLToPath(import.meta.url))
  let messagesRoot = ''
  for (let dir = here; dir !== nodePath.parse(dir).root; dir = nodePath.dirname(dir)) {
    const candidate = nodePath.join(dir, 'packages', 'i18n', 'messages')
    if (fs.existsSync(nodePath.join(candidate, 'web', 'zh-CN.json'))) {
      messagesRoot = candidate
      break
    }
  }
  if (messagesRoot === '') throw new Error('未找到 packages/i18n/messages 词包根')
  const read = (...p: string[]) =>
    JSON.parse(fs.readFileSync(nodePath.join(messagesRoot, ...p), 'utf8')) as Record<
      string,
      unknown
    >
  const locales = [read('web', 'zh-CN.json'), read('shared', 'zh-CN.json')]
  const lookup = (ns: string, key: string): string | undefined => {
    for (const root of locales) {
      let cur: unknown = root
      let ok = true
      for (const seg of [...ns.split('.'), ...key.split('.')]) {
        if (cur !== null && typeof cur === 'object' && seg in (cur as Record<string, unknown>)) {
          cur = (cur as Record<string, unknown>)[seg]
        } else {
          ok = false
          break
        }
      }
      if (ok && typeof cur === 'string') return cur
    }
    return undefined
  }
  const makeT =
    (ns: string) =>
    (key: string, values?: Record<string, string | number>): string => {
      const raw = lookup(ns, key)
      if (raw === undefined) return key
      if (!values) return raw
      return raw.replace(/\{(\w+)\}/g, (whole, name: string) =>
        name in values ? String(values[name]) : whole,
      )
    }
  return { makeT }
})

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => makeT(ns),
}))

const { noopToast } = vi.hoisted(() => ({
  noopToast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('@/components/common', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, toast: noopToast }
})

import { fireEvent, render, screen, cleanup } from '@testing-library/react'
import { PlanStepsCard } from '../progress-sections/plan-steps-card'
import type { PlanStep } from '@/hooks/use-agent-progress'

function makeStep(id: string, over: Partial<PlanStep> = {}): PlanStep {
  return { id, step: `步骤 ${id}`, status: 'completed', ...over } as PlanStep
}

describe('深化AC 规划步骤失败计数徽章点击定位', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('失败徽章渲染为 button；点击展开并滚动到首个失败步骤行 + 高亮', () => {
    const steps = [
      makeStep('s-ok', { status: 'completed' }),
      makeStep('s-bad', { status: 'failed' }),
      makeStep('s-err', { status: 'completed', error: true }),
    ]
    render(<PlanStepsCard steps={steps} data-testid="plan-test" />)

    // 徽章在折叠体内:先点折叠头展开(真实用户路径),再点失败徽章
    const header = screen.getByRole('button', { name: '执行计划' })
    fireEvent.click(header)

    const badge = screen.getByTestId('plan-test-failed-jump')
    expect(badge.tagName).toBe('BUTTON')
    expect(badge.getAttribute('aria-label')).toBeTruthy()

    fireEvent.click(badge)

    const failedRow = screen.getByTestId('plan-test-item-s-bad')
    expect(failedRow.classList.contains('animate-flash-highlight')).toBe(true)
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
    })
  })

  it('error=true 的完成态步骤也能被定位（首个失败是它）', () => {
    const steps = [
      makeStep('s-ok', { status: 'completed' }),
      makeStep('s-flag', { status: 'completed', error: true }),
    ]
    render(<PlanStepsCard steps={steps} data-testid="plan-test2" />)
    fireEvent.click(screen.getByTestId('plan-test2-failed-jump'))
    expect(
      screen.getByTestId('plan-test2-item-s-flag').classList.contains('animate-flash-highlight'),
    ).toBe(true)
  })

  it('无失败步骤时不渲染徽章（不造残标）', () => {
    const steps = [
      makeStep('s-ok', { status: 'completed' }),
      makeStep('s-run', { status: 'in_progress' }),
    ]
    render(<PlanStepsCard steps={steps} data-testid="plan-test3" />)
    expect(screen.queryByTestId('plan-test3-failed-jump')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
