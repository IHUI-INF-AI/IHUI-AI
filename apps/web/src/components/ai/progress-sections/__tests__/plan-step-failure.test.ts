// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 深化AC(2026-11-17):规划步骤失败计数点击定位的目标决策纯函数测试。
// 钉住:① error=true 与 status=failed 两种失败表达都识别;② 返回最靠前的首个失败;
//       ③ 运行中/完成/待开始/跳过都跳过;④ 无失败返回 null;⑤ 纯函数不改原数组。

import { describe, expect, it } from 'vitest'
import type { PlanStep } from '@/hooks/use-agent-progress'
import { firstFailedStepId, isPlanStepFailed } from '../plan-step-failure'

function makeStep(overrides: Partial<PlanStep> & { id: string }): PlanStep {
  return {
    step: '步骤',
    status: 'completed',
    ...overrides,
  } as PlanStep
}

describe('isPlanStepFailed 深化AC:失败判定单一口径', () => {
  it('status=failed 算失败', () => {
    expect(isPlanStepFailed(makeStep({ id: 'a', status: 'failed' }))).toBe(true)
  })

  it('error=true 算失败(旧事件兼容表达)', () => {
    expect(isPlanStepFailed(makeStep({ id: 'a', status: 'completed', error: true }))).toBe(true)
  })

  it('error=false 且非 failed 不算失败', () => {
    expect(isPlanStepFailed(makeStep({ id: 'a', status: 'completed', error: false }))).toBe(false)
  })

  it('运行中/待开始/已跳过都不算失败', () => {
    for (const status of ['in_progress', 'pending', 'skipped'] as const) {
      expect(isPlanStepFailed(makeStep({ id: 'a', status }))).toBe(false)
    }
  })
})

describe('firstFailedStepId 深化AC:首个失败步骤定位', () => {
  it('返回最靠前的失败步骤 id', () => {
    const steps = [
      makeStep({ id: 'ok', status: 'completed' }),
      makeStep({ id: 'bad1', status: 'failed' }),
      makeStep({ id: 'bad2', status: 'completed', error: true }),
    ]
    expect(firstFailedStepId(steps)).toBe('bad1')
  })

  it('error=true 的完成态步骤也能定位', () => {
    const steps = [
      makeStep({ id: 'ok', status: 'completed' }),
      makeStep({ id: 'bad', status: 'completed', error: true }),
    ]
    expect(firstFailedStepId(steps)).toBe('bad')
  })

  it('无失败步骤返回 null', () => {
    const steps = [
      makeStep({ id: 'a', status: 'completed' }),
      makeStep({ id: 'b', status: 'in_progress' }),
      makeStep({ id: 'c', status: 'pending' }),
    ]
    expect(firstFailedStepId(steps)).toBeNull()
  })

  it('空列表返回 null', () => {
    expect(firstFailedStepId([])).toBeNull()
  })

  it('纯函数:不修改原数组', () => {
    const steps = [
      makeStep({ id: 'a', status: 'completed' }),
      makeStep({ id: 'b', status: 'failed' }),
    ]
    const snapshot = JSON.stringify(steps)
    firstFailedStepId(steps)
    expect(JSON.stringify(steps)).toBe(snapshot)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
