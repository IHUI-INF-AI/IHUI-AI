// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-816014 成对测试:压缩时间线的中断收敛(recoverInterruptedCompactTimelines)。
 *
 * 票面验收三断言(逐条对应):
 *   ① 有 boundary 记录 ⇒ 收敛 completed;
 *   ② 无 boundary ⇒ 收敛 **interrupted** 且**可审计**(报告里有 outcome / 最后活动时刻 / kind 计数);
 *   ③ 已是终态的条目不得被改写(反向锁,防把成功的历史重判成中断)。
 *
 * 走包公开面(../src/index.js)import:同时验证 index.ts 的 re-export 通畅
 * (消费方不得深读内部路径)。
 */

import { describe, expect, it } from 'vitest'

import {
  isTerminalTimelineKind,
  recoverInterruptedCompactTimelines,
  type CompactTimelineRecord,
} from '../src/index.js'

const NOW_MS = 1_700_000_000_000

function rec(timelineId: string, kind: CompactTimelineRecord['kind'], atMs: number): CompactTimelineRecord {
  return { timelineId, kind, atMs }
}

describe('G-816014 三断言', () => {
  it('① 有 boundary 记录 ⇒ 收敛 completed(补一条终态,原记录原样在前)', () => {
    const before = [
      rec('t1', 'started', 100),
      rec('t1', 'retrying', 200),
      rec('t1', 'boundary', 300),
    ]
    const { records, report } = recoverInterruptedCompactTimelines(before, NOW_MS)

    expect(report.appended).toHaveLength(1)
    expect(report.appended[0]).toEqual({ timelineId: 't1', kind: 'completed', atMs: NOW_MS })
    expect(report.groups[0].outcome).toBe('completed')
    // append-only:原 3 条原样保留在前,补记的终态在后
    expect(records).toHaveLength(4)
    expect(records.slice(0, 3)).toEqual(before)
    expect(records[3]).toEqual({ timelineId: 't1', kind: 'completed', atMs: NOW_MS })
    // 入参未被 mutate
    expect(before).toHaveLength(3)
  })

  it('② 无 boundary ⇒ 收敛 interrupted 且可审计(outcome / 最后活动时刻 / kind 计数都在报告里)', () => {
    const before = [
      rec('t2', 'started', 500),
      rec('t2', 'retrying', 800),
    ]
    const { records, report } = recoverInterruptedCompactTimelines(before, NOW_MS)

    expect(report.appended).toEqual([{ timelineId: 't2', kind: 'interrupted', atMs: NOW_MS }])
    expect(report.groups[0].outcome).toBe('interrupted')
    // 可审计:判据可重放 —— 组内 started×1、retrying×1、无 boundary,最后活动 800
    expect(report.groups[0].kinds).toEqual({ started: 1, retrying: 1 })
    expect(report.groups[0].lastActivityAtMs).toBe(800)
    expect(records).toHaveLength(3)
  })

  it('③ 已是终态的条目不得被改写:completed 历史原样保留、零追加、outcome=skipped-terminal', () => {
    const finalRec = rec('t3', 'completed', 900)
    const before = [rec('t3', 'started', 100), rec('t3', 'boundary', 300), finalRec]
    const { records, report } = recoverInterruptedCompactTimelines(before, NOW_MS)

    expect(report.appended).toHaveLength(0)
    expect(report.groups[0].outcome).toBe('skipped-terminal')
    // 账面逐字未动:长度不变,终态仍是原对象(引用相等,不是重建的)
    expect(records).toHaveLength(3)
    expect(records[2]).toBe(finalRec)
    expect(records.map((r) => r.kind)).toEqual(['started', 'boundary', 'completed'])
  })

  it('③(补)interrupted 终态同样受反向锁保护', () => {
    const finalRec = rec('t4', 'interrupted', 700)
    const before = [rec('t4', 'started', 100), finalRec]
    const { records, report } = recoverInterruptedCompactTimelines(before, NOW_MS)

    expect(report.appended).toHaveLength(0)
    expect(report.groups[0].outcome).toBe('skipped-terminal')
    expect(records).toHaveLength(2)
    expect(records[1]).toBe(finalRec)
  })
})

describe('G-816014 对账口径补充', () => {
  it('多条时间线交错时逐条独立对账,互不串账', () => {
    const before = [
      rec('a', 'started', 100),
      rec('b', 'started', 110),
      rec('a', 'boundary', 200),
      rec('b', 'retrying', 210),
    ]
    const { records, report } = recoverInterruptedCompactTimelines(before, NOW_MS)

    expect(report.groups.map((g) => g.timelineId)).toEqual(['a', 'b'])
    expect(report.groups[0].outcome).toBe('completed')
    expect(report.groups[1].outcome).toBe('interrupted')
    expect(report.appended.map((r) => r.timelineId)).toEqual(['a', 'b'])
    expect(records).toHaveLength(6)
  })

  it('空账面 ⇒ 空收敛(零追加、零报告)', () => {
    const { records, report } = recoverInterruptedCompactTimelines([], NOW_MS)
    expect(records).toEqual([])
    expect(report.appended).toEqual([])
    expect(report.groups).toEqual([])
  })

  it('终态判定闭集:completed / interrupted 是终态,悬挂态一律不是', () => {
    expect(isTerminalTimelineKind('completed')).toBe(true)
    expect(isTerminalTimelineKind('interrupted')).toBe(true)
    expect(isTerminalTimelineKind('started')).toBe(false)
    expect(isTerminalTimelineKind('retrying')).toBe(false)
    expect(isTerminalTimelineKind('boundary')).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
