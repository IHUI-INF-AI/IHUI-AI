// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// AgentVerificationSection —— goal 闸门结论的三态渲染。
// 三条不可让的断言方向:
//  ① achieved / unmet / undetermined 三态**各有自己的可测形态**(颜色档 + data 属性 + 文案键),
//     任何人把 undetermined 并进"完成"那一档都会在这里变红;
//  ② undetermined **必须出现在 DOM 里**(静默 = 又一次模型自评),且不得带 achieved 的绿色;
//  ③ 逐条指标的 verdict / 判定依据 / 理由 / 证据 id 要能在折叠明细里读到。
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'

// next-intl 未接 provider:直接把键名回显成 [末段键],断言落在"用了哪个键"上而不是译文上
vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string, values?: Record<string, unknown>): string =>
      `[${key.split('.').pop()}]${values ? JSON.stringify(values) : ''}`,
}))

import { AgentVerificationSection } from '../agent-pane/AgentVerificationSection'
import { resolveGoalVerificationView } from '../agent-pane/model'
import type { GoalVerification } from '@ihui/api-client'
import type { AgentStreamEvent } from '@ihui/api-client'

/** 收 unknown 形态是为了造"闸门没回答 / 帧被拼歪"这两类畸形 done 帧 */
function frame(verification: unknown, success = true): AgentStreamEvent {
  return {
    type: 'done',
    success,
    verification: verification as GoalVerification | null | undefined,
  }
}

function verification(overrides: Partial<GoalVerification> = {}): GoalVerification {
  return {
    status: 'achieved',
    goal_status: 'achieved',
    treat_as_complete: true,
    criteria: [],
    independent_request_made: true,
    judge_model: 'judge-x',
    unavailable_reason: null,
    independence_warnings: [],
    consecutive_failures: 0,
    max_consecutive_failures: 3,
    ...overrides,
  }
}

function renderView(event: AgentStreamEvent, criteriaDeclared = true) {
  return render(
    <AgentVerificationSection
      view={resolveGoalVerificationView(event, criteriaDeclared)}
    />,
  )
}

afterEach(cleanup)

describe('AgentVerificationSection 三态可视', () => {
  it('achieved:绿档 + goalAchieved 文案 + 达标计数', () => {
    renderView(frame(verification({ criteria: [criterion({ verdict: 'met' })] })))
    const badge = screen.getByTestId('agent-goal-status')
    expect(screen.getByTestId('agent-goal-verification').getAttribute('data-goal-status')).toBe(
      'achieved',
    )
    expect(badge.textContent).toBe('[goalAchieved]')
    expect(badge.className).toContain('text-emerald-600')
    expect(screen.getByTestId('agent-goal-met-count').textContent).toBe(
      '[goalCriteriaCount]{"met":1,"total":1}',
    )
  })

  it('unmet:红档 + goalUnmet 文案,且不是绿档', () => {
    renderView(
      frame(
        verification({
          goal_status: 'not_achieved',
          status: 'not_achieved',
          treat_as_complete: false,
        }),
      ),
    )
    const badge = screen.getByTestId('agent-goal-status')
    expect(badge.textContent).toBe('[goalUnmet]')
    expect(badge.className).toContain('text-destructive')
    expect(badge.className).not.toContain('emerald')
  })

  it('undetermined:必须可见、琥珀档、文案明写不视为完成,且绝不带 achieved 的绿色', () => {
    renderView(
      frame(
        verification({
          goal_status: 'undetermined',
          status: 'undetermined',
          treat_as_complete: false,
          unavailable_reason: 'judge 端点不可达',
        }),
      ),
    )
    const section = screen.getByTestId('agent-goal-verification')
    const badge = screen.getByTestId('agent-goal-status')
    expect(section.getAttribute('data-goal-status')).toBe('undetermined')
    expect(badge.textContent).toBe('[goalUndetermined]')
    expect(badge.className).toContain('text-amber-600')
    expect(badge.className).not.toContain('emerald')
    expect(screen.getByTestId('agent-goal-unavailable').textContent).toContain('judge 端点不可达')
  })

  it('反向对照:声明了指标而 done 帧缺 verification —— 仍须渲染出"判不了",不得静默也不得判完成', () => {
    renderView(frame(undefined))
    const section = screen.getByTestId('agent-goal-verification')
    expect(section.getAttribute('data-goal-status')).toBe('undetermined')
    expect(screen.getByTestId('agent-goal-status').textContent).toBe('[goalUndetermined]')
  })

  it('not_declared(普通运行):整块不渲染,版面零变更', () => {
    const { container } = renderView(frame(undefined), false)
    expect(container.innerHTML).toBe('')
    expect(screen.queryByTestId('agent-goal-verification')).toBeNull()
  })

  it('blocked:连续未通过计数可见(§8 第 4 步的收口档位要落到人眼)', () => {
    renderView(
      frame(
        verification({
          goal_status: 'blocked',
          status: 'blocked',
          treat_as_complete: false,
          consecutive_failures: 3,
          max_consecutive_failures: 3,
        }),
      ),
    )
    expect(screen.getByTestId('agent-goal-status').textContent).toBe('[goalBlocked]')
    expect(screen.getByTestId('agent-goal-consecutive').textContent).toBe(
      '[goalConsecutive]{"failures":3,"max":3}',
    )
  })
})

describe('AgentVerificationSection 逐条指标明细', () => {
  it('每条渲染 verdict / 判定依据 / 语句 / 理由 / 证据 id,并标出与证据冲突', () => {
    renderView(
      frame(
        verification({
          goal_status: 'not_achieved',
          status: 'not_achieved',
          treat_as_complete: false,
          criteria: [
            criterion({ verdict: 'unmet', basis: 'judge', reason: '测试未跑', contradicted: true }),
            criterion({
              criterion_id: 'c2',
              verdict: 'unknown',
              basis: 'missing-evidence',
              evidence_ids: [],
            }),
          ],
          independence_warnings: ['judge 与 executor 同模型'],
        }),
      ),
    )
    const list = screen.getByTestId('agent-goal-criteria')
    expect(list.textContent).toContain('[goalVerdictUnmet]')
    expect(list.textContent).toContain('[goalBasisJudge]')
    expect(list.textContent).toContain('[goalReason]')
    expect(list.textContent).toContain('[goalEvidence]{"ids":"e1"}')
    expect(list.textContent).toContain('[goalVerdictUnknown]')
    expect(list.textContent).toContain('[goalBasisMissingEvidence]')
    expect(list.textContent).toContain('[goalNoEvidence]')
    expect(list.textContent).toContain('[goalContradicted]')
    expect(screen.getByTestId('agent-goal-warnings').textContent).toContain(
      '[goalWarnings]· judge 与 executor 同模型',
    )
    // 折叠形态复用仓库既有 details/summary,不另造组件族
    expect(list.querySelector('details')).not.toBeNull()
  })
})

function criterion(overrides: Partial<GoalVerification['criteria'][number]> = {}) {
  return {
    criterion_id: 'c1',
    statement: 'typecheck 必须 0 错误',
    verdict: 'met' as const,
    basis: 'machine' as const,
    reason: '退出码 0',
    evidence_ids: ['e1'],
    contradicted: false,
    ...overrides,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
