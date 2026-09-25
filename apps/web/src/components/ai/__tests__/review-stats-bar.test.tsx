// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * D85(G-116)自动审查统计条 —— 票面欠的验收用例
 *
 * 装车点(不是"造好没装车"):
 *   `apps/web/src/components/ai/agent-task-progress-pane.tsx:1781`
 *   `<ReviewStatsBar steps={runtimePlanSteps} />`,与同文件 :1783-1784 的逐条徽章
 *   `RuntimeStepRow`(未导出,故本用例改用两者共同调用的 `stepDecisionState`)同吃一份 steps。
 *
 * 钉住的三件事:
 *  1. 统计计数与逐条徽章**同源** —— 「已接受 N / 已拒绝 N」= 用 `@ihui/shared/chat` 的
 *     `stepDecisionState` 对同一组 steps 独立分类的计数,且 = 展开区里 `[data-decision-state=…]`
 *     逐条徽章的枚数;换了 steps 统计必须跟着变。
 *  2. `自动审查未提供理由` 显式缺省 —— 决策项无 reason 时界面必须出现词表键
 *     `ai.pane.reviewStats.noReasonText` 的**取值**,不得留空、不得吐键名、不得回退英文码名。
 *  3. 负向对照 —— 未过闸门(decision 为 null / 空串)与认不出的取值都不得计入已接受/已拒绝。
 *
 * 文案一律从真实词包(`packages/i18n/messages/{web,shared}/zh-CN.json`)取,
 * 用例里不写任何中文字面量 —— 界面直出键名或硬编码都会当场判红。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { stepDecisionState } from '@ihui/shared/chat'
import type { AgentPlanStepEvent } from '@/hooks/use-agent-runtime'

/** 词包 + 取词器:hoisted 让 vi.mock 工厂与用例体共用同一份真相 */
const { makeT, tPane, escapeRe } = await vi.hoisted(async () => {
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
  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  /** 与 next-intl 同形:缺键返回键名本身(组件的回落链依赖这一行为) */
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

  return { makeT, tPane: makeT('ai.pane'), escapeRe }
})

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => makeT(ns),
}))

import { fireEvent, render, screen, cleanup } from '@testing-library/react'
import { ReviewStatsBar, deriveReviewStats } from '../agent-task-progress-pane'

function step(over: Partial<AgentPlanStepEvent> & { stepIndex: number }): AgentPlanStepEvent {
  return {
    runId: 'run-1',
    toolName: `tool_${over.stepIndex}`,
    status: 'completed',
    decision: null,
    reason: null,
    ts: 1_700_000_000_000 + over.stepIndex,
    ...over,
  }
}

/** 从统计条 DOM 里读出某个计数标签的数值(标签模板取自词包,不写中文字面量) */
function numberRenderedInBar(key: string): number | null {
  const template = tPane(key)
  const [pre = '', post = ''] = template.split('{n}')
  const re = new RegExp(`^${escapeRe(pre)}(\\d+)${escapeRe(post)}$`)
  const bar = screen.getByTestId('review-stats-bar')
  const nums = [
    ...new Set(
      Array.from(bar.querySelectorAll('span'))
        .map((el) => (el.textContent ?? '').trim())
        .filter((text) => re.test(text))
        .map((text) => Number(re.exec(text)?.[1])),
    ),
  ]
  if (nums.length === 0) return null
  expect(nums.length, `标签 ${key} 在统计条里出现多个不同数值: ${nums.join(',')}`).toBe(1)
  return nums[0] ?? null
}

/** 独立分类器:逐条徽章与统计条共用的 @ihui/shared/chat 判据(组件内不得有第二套) */
function classify(steps: readonly AgentPlanStepEvent[]) {
  const decided = steps.filter((s) => typeof s.decision === 'string' && s.decision !== '')
  const count = (state: ReturnType<typeof stepDecisionState>) =>
    decided.filter((s) => stepDecisionState(s.decision) === state).length
  return {
    hasDecision: decided.length,
    accepted: count('approved'),
    rejected: count('rejected'),
    needsUser: count('needsUser'),
    unknown: count('unknown'),
    noReason: decided.filter((s) => !s.reason).length,
  }
}

describe('D85 ReviewStatsBar —— 自动审查统计条', () => {
  beforeEach(() => {
    // 断言"计数不是恒定值"依赖用例自带夹具,这里只确保干净容器
    cleanup()
  })
  afterEach(() => cleanup())

  const mixedSteps: AgentPlanStepEvent[] = [
    step({ stepIndex: 0, decision: 'execute_tool', reason: 'read ok' }),
    step({ stepIndex: 1, decision: 'security_blocked', reason: 'blocked' }),
    step({ stepIndex: 2, decision: 'auto_skip_approval', reason: null }),
    step({ stepIndex: 3, decision: 'rejected_by_user', reason: '' }),
    step({ stepIndex: 4, decision: null, status: 'started' }),
    step({ stepIndex: 5, decision: '', status: 'started' }),
    step({ stepIndex: 6, decision: 'not_in_vocabulary', reason: 'as-is' }),
    step({ stepIndex: 7, decision: 'exec_policy_approved', reason: 'policy ok' }),
  ]

  it('统计计数与逐条徽章同源(已接受/已拒绝 == 独立分类计数 == 徽章枚数)', () => {
    render(<ReviewStatsBar steps={mixedSteps} />)
    const expected = classify(mixedSteps)

    // 夹具必须是"多步不同状态",否则这条断言会退化成空转
    expect(expected.accepted).toBe(3)
    expect(expected.rejected).toBe(2)
    expect(expected.accepted).not.toBe(expected.rejected)

    expect(numberRenderedInBar('reviewStats.accepted')).toBe(expected.accepted)
    expect(numberRenderedInBar('reviewStats.rejected')).toBe(expected.rejected)
    expect(numberRenderedInBar('reviewStats.noReason')).toBe(expected.noReason)

    // 展开后逐条徽章的分类枚数必须与统计条一致(同一组 steps 的唯一一份分类)
    fireEvent.click(screen.getByTestId('review-stats-toggle'))
    const history = screen.getByTestId('review-stats-history')
    expect(history.querySelectorAll('[data-decision-state="approved"]').length).toBe(
      expected.accepted,
    )
    expect(history.querySelectorAll('[data-decision-state="rejected"]').length).toBe(
      expected.rejected,
    )
    // 纯函数派生结果与 DOM 读数同源(排除"渲染层又算一遍"的第二真相源)
    expect(deriveReviewStats(mixedSteps)).toEqual(expected)
  })

  it('换了 steps 统计必须跟着变(rerender 后重算,不缓存旧值)', () => {
    const { rerender } = render(<ReviewStatsBar steps={mixedSteps} />)
    const before = classify(mixedSteps)
    expect(numberRenderedInBar('reviewStats.accepted')).toBe(before.accepted)
    expect(numberRenderedInBar('reviewStats.rejected')).toBe(before.rejected)

    const nextSteps: AgentPlanStepEvent[] = [
      step({ stepIndex: 0, decision: 'rejected_by_user', reason: 'user said no' }),
      step({ stepIndex: 1, decision: 'plan_blocked', reason: null }),
      step({ stepIndex: 2, decision: 'exec_policy_approved', reason: 'policy ok' }),
      step({ stepIndex: 3, decision: 'approval_policy_never', reason: 'forbidden' }),
      step({ stepIndex: 4, decision: null, status: 'started' }),
    ]
    rerender(<ReviewStatsBar steps={nextSteps} />)
    const next = classify(nextSteps)
    expect(next.accepted).not.toBe(before.accepted)
    expect(next.rejected).not.toBe(before.rejected)
    expect(numberRenderedInBar('reviewStats.accepted')).toBe(next.accepted)
    expect(numberRenderedInBar('reviewStats.rejected')).toBe(next.rejected)
    expect(numberRenderedInBar('reviewStats.noReason')).toBe(next.noReason)
  })

  it('决策项缺 reason → 显示词表缺省文案(非空白、非键名、非英文码)', () => {
    const noReasonSteps: AgentPlanStepEvent[] = [
      step({ stepIndex: 0, decision: 'auto_skip_approval', reason: null }),
      step({ stepIndex: 1, decision: 'execute_tool', reason: '' }),
      step({ stepIndex: 2, decision: 'execute_tool', reason: 'REAL_REASON_MARKER' }),
    ]
    render(<ReviewStatsBar steps={noReasonSteps} />)
    const fallback = tPane('reviewStats.noReasonText')
    // 词包键必须真命中(取不到就把回落形态暴露成红)
    expect(fallback).not.toBe('reviewStats.noReasonText')
    expect(fallback.trim().length > 0).toBe(true)

    fireEvent.click(screen.getByTestId('review-stats-toggle'))
    const items = screen.getAllByRole('listitem')
    expect(items.length).toBe(noReasonSteps.length)

    const withFallback = items.filter((el) => (el.textContent ?? '').includes(fallback))
    expect(withFallback.length).toBe(2)
    // 有 reason 的那条必须显示 reason,不得被缺省文案顶掉
    expect(items[2]?.textContent ?? '').toContain('REAL_REASON_MARKER')

    for (const el of withFallback) {
      const text = (el.textContent ?? '').trim()
      expect(text.length > 0).toBe(true)
      expect(text).not.toContain('noReasonText')
      expect(text).not.toContain('reviewStats.')
    }
    const historyText = screen.getByTestId('review-stats-history').textContent ?? ''
    expect(historyText).not.toMatch(/decision\.[A-Za-z]/)
    expect(historyText).not.toMatch(/\b(auto_skip_approval|execute_tool)\b/)
    expect(historyText).not.toMatch(/(^|[\s(])unknown([\s)]|$)/)
  })

  it('负向对照:未过闸门与未知取值都不计入已接受/已拒绝', () => {
    const gated: AgentPlanStepEvent[] = [
      step({ stepIndex: 0, decision: 'execute_tool', reason: 'a' }),
      step({ stepIndex: 1, decision: null, status: 'started' }),
      step({ stepIndex: 2, decision: '', status: 'started' }),
      step({ stepIndex: 3, decision: 'security_blocked', reason: 'b' }),
      step({ stepIndex: 4, decision: 'not_in_vocabulary', reason: 'c' }),
    ]
    render(<ReviewStatsBar steps={gated} />)
    const g = classify(gated)
    expect(g.hasDecision).toBe(3)
    expect(g.accepted).toBe(1)
    expect(g.rejected).toBe(1)
    expect(g.unknown).toBe(1)
    expect(numberRenderedInBar('reviewStats.accepted')).toBe(1)
    expect(numberRenderedInBar('reviewStats.rejected')).toBe(1)
    // 5 步里只有 3 步发生了自动审查 → 展开区逐条徽章也只 3 枚
    fireEvent.click(screen.getByTestId('review-stats-toggle'))
    expect(screen.getAllByRole('listitem').length).toBe(3)
    expect(deriveReviewStats(gated)).toEqual(g)

    cleanup()

    // 完全没发生决策 → 不吐任何计数,显示"暂无记录"文案
    render(<ReviewStatsBar steps={[]} />)
    expect(numberRenderedInBar('reviewStats.accepted')).toBeNull()
    expect(numberRenderedInBar('reviewStats.rejected')).toBeNull()
    expect(screen.getByTestId('review-stats-bar').textContent).toContain(
      tPane('reviewStats.noDecision'),
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
