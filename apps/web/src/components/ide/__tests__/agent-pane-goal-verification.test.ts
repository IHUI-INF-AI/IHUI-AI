// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// goal 模式独立校验闸门的 done 帧 → 视图模型(model.ts 的三个纯函数)。
// 立因(2026-09-25 接线票):闸门在 ai-service 已入库并把结论写进 done 帧,但 web 端
// 唯一的 `executeAgentStream` 调用方 AgentPane 的 onDone 把 success/verification/
// goal_status 三个字段全丢了 —— 结论到不了人眼,等于没有。本文件钉住"到得了而且
// 不会被读反"这一半:尤其是**反向对照**(缺字段 / 缺放行章 一律不得判成完成)。
import { describe, it, expect } from 'vitest'

import type { AgentStreamEvent, GoalVerification } from '@ihui/api-client'
import {
  HARD_CRITERIA_MAX,
  buildHardCriteria,
  resolveGoalVerificationView,
  resultToneFromGoalKind,
} from '../agent-pane/model'

function makeVerification(overrides: Partial<GoalVerification>): GoalVerification {
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

/**
 * 造 done 帧。参数刻意收 `Record<string, unknown>`:本文件一半的用例就是要造
 * **畸形帧**(缺 goal_status / 缺放行章 / 整段 verification 丢失),那正是闸门
 * 结论到端时最可能被读反的形态。
 */
function doneFrame(
  verification?: GoalVerification | Record<string, unknown> | null,
): AgentStreamEvent {
  return {
    type: 'done',
    success: true,
    verification: verification as GoalVerification | null | undefined,
  }
}

describe('buildHardCriteria — 执行前声明的硬性指标', () => {
  it('每行一条,去空白、丢空行,id 为序号且唯一', () => {
    const built = buildHardCriteria('  第一条 \n\n 第二条\n')
    expect(built).toEqual([
      { id: 'c1', statement: '第一条', required: true },
      { id: 'c2', statement: '第二条', required: true },
    ])
  })

  it('空文本 → 空数组(调用方据此不发 hard_criteria,闸门不参与)', () => {
    expect(buildHardCriteria('   \n\n')).toEqual([])
  })

  it('超出服务端 max_length 的行被丢弃,不发出会被 422 拒的请求体', () => {
    const many = Array.from({ length: HARD_CRITERIA_MAX + 10 }, (_, i) => `c ${i}`).join('\n')
    expect(buildHardCriteria(many)).toHaveLength(HARD_CRITERIA_MAX)
  })
})

describe('resolveGoalVerificationView — 六档收敛,且默认不判通过', () => {
  it('闸门判达成 + 放行章 ⇒ achieved(唯一可显示"完成"的一档)', () => {
    const view = resolveGoalVerificationView(doneFrame(makeVerification({})), true)
    expect(view.kind).toBe('achieved')
  })

  it('反向对照:写着 achieved 却缺 treat_as_complete ⇒ 不得判达成', () => {
    const forged = makeVerification({ treat_as_complete: false })
    expect(resolveGoalVerificationView(doneFrame(forged), true).kind).toBe('undetermined')
  })

  it('核心反向对照:声明了指标而 done 帧根本没有 verification 字段 ⇒ undetermined(不是 not_declared)', () => {
    expect(resolveGoalVerificationView(doneFrame(undefined), true).kind).toBe('undetermined')
    expect(resolveGoalVerificationView({ type: 'done' }, true).kind).toBe('undetermined')
  })

  it('未声明指标 + 无 verification ⇒ not_declared(普通运行,零变更)', () => {
    expect(resolveGoalVerificationView(doneFrame(undefined), false).kind).toBe('not_declared')
  })

  it('服务端自报 skipped 但调用方要求了校验 ⇒ 仍按判不了收口', () => {
    const skipped = makeVerification({ goal_status: 'skipped', treat_as_complete: false })
    expect(resolveGoalVerificationView(doneFrame(skipped), true).kind).toBe('undetermined')
    expect(resolveGoalVerificationView(doneFrame(skipped), false).kind).toBe('not_declared')
  })

  it('五档逐一分明,互不合并', () => {
    const cases: Array<[string, string]> = [
      ['not_achieved', 'unmet'],
      ['undetermined', 'undetermined'],
      ['not_run', 'undetermined'],
      ['blocked', 'blocked'],
      ['budget_limited', 'budget_limited'],
      ['某个新增的未知档位', 'undetermined'],
    ]
    for (const [goalStatus, expected] of cases) {
      const frame = doneFrame(
        makeVerification({ goal_status: goalStatus, status: goalStatus, treat_as_complete: false }),
      )
      expect(resolveGoalVerificationView(frame, true).kind).toBe(expected)
    }
  })

  it('goal_status 缺失时退回内层 status;两处都缺 ⇒ undetermined', () => {
    const onlyStatus = doneFrame({ status: 'not_achieved', criteria: [] })
    expect(resolveGoalVerificationView(onlyStatus, true).kind).toBe('unmet')
    const noStatus = doneFrame({ criteria: [] })
    expect(resolveGoalVerificationView(noStatus, true).kind).toBe('undetermined')
  })

  it('达标计数:无指标时是 null,不得显示 0/0 冒充"全条不达标"', () => {
    const withCriteria = makeVerification({
      goal_status: 'not_achieved',
      status: 'not_achieved',
      treat_as_complete: false,
      criteria: [
        {
          criterion_id: 'c1',
          statement: 's1',
          verdict: 'met',
          basis: 'machine',
          reason: 'r',
          evidence_ids: ['e1'],
          contradicted: false,
        },
        {
          criterion_id: 'c2',
          statement: 's2',
          verdict: 'unknown',
          basis: 'missing-evidence',
          reason: '',
          evidence_ids: [],
          contradicted: false,
        },
      ],
    })
    const view = resolveGoalVerificationView(doneFrame(withCriteria), true)
    expect(view.metCount).toBe(1)
    expect(view.totalCount).toBe(2)
    expect(resolveGoalVerificationView(doneFrame(makeVerification({})), true).metCount).toBeNull()
  })
})

describe('resultToneFromGoalKind — 结果区不得替闸门发"绿色对勾"', () => {
  it('只有 achieved 与"未参与校验"才是 success', () => {
    expect(resultToneFromGoalKind('achieved')).toBe('success')
    expect(resultToneFromGoalKind(null)).toBe('success')
    expect(resultToneFromGoalKind('not_declared')).toBe('success')
  })

  it('反向对照:unmet / blocked 判 failure,undetermined / budget_limited 判 warning,均非 success', () => {
    expect(resultToneFromGoalKind('unmet')).toBe('failure')
    expect(resultToneFromGoalKind('blocked')).toBe('failure')
    expect(resultToneFromGoalKind('undetermined')).toBe('warning')
    expect(resultToneFromGoalKind('budget_limited')).toBe('warning')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
