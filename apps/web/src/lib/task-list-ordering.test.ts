// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import { compareTaskRows, type TaskListSortableRow } from './task-list-ordering'

interface Row extends TaskListSortableRow {
  label: string
}

function row(taskId: string, createdAt: number, updatedAt: number): Row {
  return { taskId, createdAt, updatedAt, label: taskId }
}

const ALWAYS_ACTIVE = () => true
const NEVER_ACTIVE = () => false

function sortRows(rows: Row[], isActive: (row: Row) => boolean, sortKey: 'created-at' | 'updated-at'): Row[] {
  return [...rows].sort((left, right) =>
    compareTaskRows(left, right, { sortKey, isActive }),
  )
}

describe('compareTaskRows running-first 稳定排序', () => {
  it('两个运行中行交替 touch updatedAt,排序输出不变(禁止 updatedAt 决胜)', () => {
    const a = row('task-a', 1_000, 5_000)
    const b = row('task-b', 1_000, 6_000)
    const ctxAFirst = { sortKey: 'updated-at' as const, isActive: ALWAYS_ACTIVE }

    // a 的 updatedAt 落后 → a 在前
    const first = sortRows([a, b], ALWAYS_ACTIVE, 'updated-at')
    expect(first.map((item) => item.taskId)).toEqual(['task-b', 'task-a'])

    // 事件流让 b 的 updatedAt 落后 → 输出必须逐位不变(taskId 稳定决胜)
    const bTouchedDown = row('task-b', 1_000, 4_000)
    const second = sortRows([a, bTouchedDown], ALWAYS_ACTIVE, 'updated-at')
    expect(second.map((item) => item.taskId)).toEqual(['task-b', 'task-a'])

    // 判据锁定:同 createdAt 的运行行,比较结果与 updatedAt 无关
    expect(
      Math.sign(compareTaskRows(a, bTouchedDown, ctxAFirst)),
    ).toBe(Math.sign(compareTaskRows(a, b, ctxAFirst)))
  })

  it('运行层整体排在非运行层之前,即使非运行行 updatedAt 更新', () => {
    const running = row('running', 1_000, 1_000)
    const idle = row('idle', 500, 99_999)
    const sorted = sortRows([idle, running], (item) => item.taskId === 'running', 'updated-at')
    expect(sorted.map((item) => item.taskId)).toEqual(['running', 'idle'])
  })

  it('挂后台工作的任务经 isActive 注入后同样进运行层置顶', () => {
    const backgroundWork = row('bg', 1_000, 1_000)
    const freshIdle = row('idle', 2_000, 50_000)
    // 回合已收口但后台事件仍推进 updatedAt:isActive 判其活跃 → 置顶
    const sorted = sortRows(
      [freshIdle, backgroundWork],
      (item) => item.taskId === 'bg',
      'updated-at',
    )
    expect(sorted[0]!.taskId).toBe('bg')
  })

  it('非运行层按传入偏好键(updatedAt)降序排序', () => {
    const rows = [row('old', 1_000, 3_000), row('new', 2_000, 9_000), row('mid', 3_000, 6_000)]
    const sorted = sortRows(rows, NEVER_ACTIVE, 'updated-at')
    expect(sorted.map((item) => item.taskId)).toEqual(['new', 'mid', 'old'])
  })

  it('非运行层同 updatedAt 键按 createdAt、再按 taskId 稳定决胜', () => {
    const a = row('task-a', 1_000, 5_000)
    const b = row('task-b', 2_000, 5_000)
    const sorted = sortRows([a, b], NEVER_ACTIVE, 'updated-at')
    expect(sorted.map((item) => item.taskId)).toEqual(['task-b', 'task-a'])
  })

  it('非运行层 sortKey=created-at 时按 createdAt 降序', () => {
    const rows = [row('old', 1_000, 9_000), row('new', 3_000, 1_000), row('mid', 2_000, 5_000)]
    const sorted = sortRows(rows, NEVER_ACTIVE, 'created-at')
    expect(sorted.map((item) => item.taskId)).toEqual(['new', 'mid', 'old'])
  })

  it('混合三层全排序:运行层(按 createdAt)→ 非运行层(按偏好键)', () => {
    const runningNew = row('run-new', 3_000, 3_000)
    const runningOld = row('run-old', 1_000, 8_000)
    const idleNew = row('idle-new', 2_500, 7_000)
    const idleOld = row('idle-old', 1_500, 2_000)
    const sorted = sortRows(
      [idleOld, runningOld, idleNew, runningNew],
      (item) => item.taskId.startsWith('run-'),
      'updated-at',
    )
    expect(sorted.map((item) => item.taskId)).toEqual([
      'run-new',
      'run-old',
      'idle-new',
      'idle-old',
    ])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
