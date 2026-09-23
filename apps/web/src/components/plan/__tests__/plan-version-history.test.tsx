// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D93 英文过渡(词表释放后换中文键 planVersion*):断言与组件英文过渡串保持一致,
// 步骤数据中文标题(步骤A/步骤B)与 lib 层 detail(变化字段)保持原样,行为断言不变。
import * as React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlanVersionSwitcher } from '../PlanVersionSwitcher'
import { PlanVersionDiff } from '../PlanVersionDiff'
import {
  appendVersion,
  diffPlanVersions,
  loadPlanVersions,
  savePlanVersions,
  shouldRecordVersion,
  snapshotPlan,
  type PlanVersionSnapshot,
} from '@/lib/plan-version-history'
import type { PlanStep } from '@ihui/shared/plan/index'

function makeStep(partial: Partial<PlanStep> & { id: string; title: string }): PlanStep {
  return {
    description: '',
    status: 'pending',
    priority: 'medium',
    order: 0,
    ...partial,
  }
}

function makeVersions(): PlanVersionSnapshot[] {
  const v1 = snapshotPlan(
    {
      goal: 'g1',
      scope: 's1',
      constraints: 'c1',
      steps: [makeStep({ id: 'a', title: '步骤A' })],
    },
    1,
  )
  const v2 = snapshotPlan(
    {
      goal: 'g1',
      scope: 's1',
      constraints: 'c1',
      steps: [
        makeStep({ id: 'a', title: '步骤A改名', status: 'in_progress', order: 0 }),
        makeStep({ id: 'b', title: '步骤B', order: 1 }),
      ],
    },
    2,
  )
  return [v1, v2]
}

/** 版本切换接线:下拉选择某轮后,展示区只显示该轮步骤 */
function SwitchHarness({ versions }: { versions: PlanVersionSnapshot[] }) {
  const [selected, setSelected] = React.useState<number | null>(null)
  const liveSteps = ['实时步骤']
  const shown =
    selected === null
      ? liveSteps
      : (versions.find((v) => v.version === selected)?.steps.map((s) => s.title) ?? [])
  return (
    <div>
      <PlanVersionSwitcher
        versions={versions}
        selectedVersion={selected}
        onSelect={setSelected}
        onOpenDiff={() => {}}
      />
      <ul data-testid="shown-steps">
        {shown.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  )
}

beforeEach(() => {
  cleanup()
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe('D93 plan 历史版本(按轮)', () => {
  it('用例1 版本切换:下拉选第1轮后只显示该轮步骤', () => {
    render(<SwitchHarness versions={makeVersions()} />)
    expect(screen.getByText('实时步骤')).toBeTruthy()
    const select = screen.getByLabelText('Select version') as HTMLSelectElement
    fireEvent.change(select, { target: { value: '1' } })
    expect(screen.queryByText('实时步骤')).toBeNull()
    expect(screen.getByText('步骤A')).toBeTruthy()
    expect(screen.queryByText('步骤B')).toBeNull()
    expect(screen.getByText('Viewing round 1 (read-only)')).toBeTruthy()
  })

  it('用例2 跨版本 diff 入口:点击入口回调触发,对比面板渲染增删改', () => {
    const onOpenDiff = vi.fn()
    const versions = makeVersions()
    render(
      <PlanVersionSwitcher
        versions={versions}
        selectedVersion={null}
        onSelect={() => {}}
        onOpenDiff={onOpenDiff}
      />,
    )
    fireEvent.click(screen.getByLabelText('Open version diff'))
    expect(onOpenDiff).toHaveBeenCalledTimes(1)
    cleanup()

    const live = snapshotPlan(
      {
        goal: 'g1',
        scope: 's1',
        constraints: 'c1',
        steps: [
          makeStep({ id: 'a', title: '步骤A改名', status: 'in_progress', order: 0 }),
          makeStep({ id: 'b', title: '步骤B', order: 1 }),
        ],
      },
      3,
      'Latest',
    )
    const diff = diffPlanVersions(versions[0] as PlanVersionSnapshot, live)
    expect(diff.summary).toEqual({ added: 1, removed: 0, modified: 1, unchanged: 0 })

    render(
      <PlanVersionDiff
        versions={versions}
        liveSnapshot={live}
        initialFrom={1}
        initialTo={null}
        onClose={() => {}}
      />,
    )
    expect(screen.getByText('Added 1')).toBeTruthy()
    expect(screen.getByText('Modified 1')).toBeTruthy()
    expect(screen.getByText('步骤B')).toBeTruthy()
    expect(screen.getByText('变化字段:标题、状态')).toBeTruthy()
  })

  it('用例3 空态:无版本时显示空态文案且对比入口禁用', () => {
    render(
      <PlanVersionSwitcher
        versions={[]}
        selectedVersion={null}
        onSelect={() => {}}
        onOpenDiff={() => {}}
      />,
    )
    expect(screen.getByText('No history yet')).toBeTruthy()
    expect(screen.getByText('Round versions appear here after structure changes')).toBeTruthy()
    expect((screen.getByLabelText('Open version diff') as HTMLButtonElement).disabled).toBe(true)
    cleanup()

    render(
      <PlanVersionDiff
        versions={[]}
        liveSnapshot={null}
        initialFrom={null}
        initialTo={null}
        onClose={() => {}}
      />,
    )
    expect(screen.getByText('Select two versions to view the diff')).toBeTruthy()
  })

  it('结构未变不记版,变化才记版;相邻同签名去重;localStorage 往返', () => {
    const base = {
      goal: 'g',
      scope: 's',
      constraints: 'c',
      steps: [makeStep({ id: 'a', title: 'A' })],
    }
    const v1 = snapshotPlan(base, 1)
    expect(shouldRecordVersion(null, base)).toBe(true)
    expect(shouldRecordVersion(v1, base)).toBe(false)
    expect(shouldRecordVersion(v1, { ...base, steps: [makeStep({ id: 'a', title: 'A2' })] })).toBe(
      true,
    )

    const once = appendVersion([], v1)
    expect(appendVersion(once, snapshotPlan(base, 1))).toHaveLength(1)
    expect(loadPlanVersions('no-such-plan')).toEqual([])

    savePlanVersions('p-test', once)
    expect(loadPlanVersions('p-test')).toHaveLength(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
