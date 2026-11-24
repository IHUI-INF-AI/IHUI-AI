// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// AgentPane ↔ 独立校验闸门的**接线**取证(不是判据取证,判据在 agent-pane-goal-verification)。
// 这一档必须存在的原因:本票的立因就是"闸门已入库、api-client 已透传、而唯一 UI 调用方
// 的 onDone 把三个字段全丢了"。前两层各自有测试,却没有人证明**第三段线接上了** ——
// 所以这里用假流喂真实 done 帧,断言结论真的落到 DOM。
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, cleanup, screen, fireEvent, act } from '@testing-library/react'
import type { AgentStreamCallbacks } from '@ihui/api-client'

vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string, values?: Record<string, unknown>): string =>
      `[${key.split('.').pop()}]${values ? JSON.stringify(values) : ''}`,
}))

// 进度区依赖整条 progress-sections 链,与本票要证的接线段无关 → 桩掉以隔离渲染成本
vi.mock('../agent-pane/AgentProgressArea', () => ({
  AgentProgressArea: () => null,
}))

const stream = vi.hoisted(() => ({
  calls: [] as unknown[],
  callbacks: undefined as AgentStreamCallbacks | undefined,
}))

vi.mock('@ihui/api-client', () => ({
  executeAgentStream: vi.fn(async (params: unknown, callbacks: AgentStreamCallbacks) => {
    stream.calls.push(params)
    stream.callbacks = callbacks
  }),
  cancelAgent: vi.fn(async () => ({})),
}))

import { AgentPane } from '../agent-pane/AgentPane'
import type { GoalVerification } from '@ihui/api-client'

function verification(overrides: Partial<GoalVerification> = {}): GoalVerification {
  return {
    status: 'not_achieved',
    goal_status: 'not_achieved',
    treat_as_complete: false,
    criteria: [
      {
        criterion_id: 'c1',
        statement: 'typecheck 必须 0 错误',
        verdict: 'unknown',
        basis: 'missing-evidence',
        reason: '没采到证据',
        evidence_ids: [],
        contradicted: false,
      },
    ],
    independent_request_made: true,
    judge_model: 'judge-x',
    unavailable_reason: null,
    independence_warnings: [],
    consecutive_failures: 0,
    max_consecutive_failures: 3,
    ...overrides,
  }
}

/** 填任务 → 点执行(假流只捕获回调,不真的发请求) */
async function startRun(criteria = '') {
  render(<AgentPane />)
  fireEvent.change(screen.getByTestId('agent-pane-goal-input'), {
    target: { value: '把闸门结论显示出来' },
  })
  if (criteria) {
    fireEvent.change(screen.getByTestId('agent-pane-criteria-input'), { target: { value: criteria } })
  }
  await act(async () => {
    fireEvent.click(screen.getByTestId('agent-pane-run-btn'))
  })
  return stream.callbacks
}

beforeEach(() => {
  stream.calls.length = 0
  stream.callbacks = undefined
})

afterEach(cleanup)

describe('AgentPane 接线:声明指标 → 请求体 → done 帧 → 页面', () => {
  it('填了硬性指标 → 请求体真的带 hard_criteria(否则闸门永远不跑)', async () => {
    await startRun('退出码 0\n测试全绿')
    expect(stream.calls[0]).toMatchObject({
      goal: '把闸门结论显示出来',
      hard_criteria: [
        { id: 'c1', statement: '退出码 0', required: true },
        { id: 'c2', statement: '测试全绿', required: true },
      ],
    })
  })

  it('没填指标 → 请求体不含 hard_criteria(普通运行零变更)', async () => {
    await startRun('')
    const params = stream.calls[0] as Record<string, unknown>
    expect('hard_criteria' in params).toBe(false)
  })

  it('闸门判未达成 → 页面出现 unmet 区块,且结果区色调是 failure(不再是绿勾)', async () => {
    const callbacks = await startRun('退出码 0')
    await act(async () => {
      callbacks?.onDone?.({ type: 'done', result: '我做完了', verification: verification() })
    })
    expect(screen.getByTestId('agent-goal-verification').getAttribute('data-goal-status')).toBe(
      'unmet',
    )
    expect(screen.getByTestId('agent-pane-result').getAttribute('data-tone')).toBe('failure')
  })

  it('核心反向对照:要求了校验而 done 帧**缺** verification → 显示"判不了",且结果区不给 success 色调', async () => {
    const callbacks = await startRun('退出码 0')
    await act(async () => {
      callbacks?.onDone?.({ type: 'done', result: '我做完了' })
    })
    expect(screen.getByTestId('agent-goal-verification').getAttribute('data-goal-status')).toBe(
      'undetermined',
    )
    expect(screen.getByTestId('agent-pane-result').getAttribute('data-tone')).toBe('warning')
  })

  it('闸门判达成 → achieved + 结果区回到 success', async () => {
    const callbacks = await startRun('退出码 0')
    await act(async () => {
      callbacks?.onDone?.({
        type: 'done',
        result: '我做完了',
        verification: verification({
          status: 'achieved',
          goal_status: 'achieved',
          treat_as_complete: true,
        }),
      })
    })
    expect(screen.getByTestId('agent-goal-status').textContent).toBe('[goalAchieved]')
    expect(screen.getByTestId('agent-pane-result').getAttribute('data-tone')).toBe('success')
  })

  it('普通运行(未声明指标、帧无 verification)→ 不出现校验区块,结果区维持既有绿勾', async () => {
    const callbacks = await startRun('')
    await act(async () => {
      callbacks?.onDone?.({ type: 'done', result: '我做完了' })
    })
    expect(screen.queryByTestId('agent-goal-verification')).toBeNull()
    expect(screen.getByTestId('agent-pane-result').getAttribute('data-tone')).toBe('success')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
