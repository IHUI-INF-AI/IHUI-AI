// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import {
  EMPTY_HOOK_RUN_STATS,
  accumulateHookRunStats,
  hookRunStatsAverageMs,
} from './hook-run-stats'

type Entry = Parameters<typeof accumulateHookRunStats>[1]['hooks'][number]
type Frame = Parameters<typeof accumulateHookRunStats>[1]

function entry(
  name: string,
  status: Entry['status'],
  durationMs: number,
): Entry {
  return { name, kind: 'pre_tool_use', status, durationMs, error: null }
}

function frame(hooks: Entry[]): Frame {
  return {
    type: 'hook-run',
    runId: 'r1',
    toolName: 'demo',
    toolCallId: 't1',
    hooks,
    sessionId: 's1',
  }
}

describe('accumulateHookRunStats', () => {
  it('按钩子条目计数而不是按帧计数', () => {
    const once = accumulateHookRunStats(
      EMPTY_HOOK_RUN_STATS,
      frame([entry('a', 'ok', 10), entry('b', 'timeout', 30)]),
    )
    expect(once.total).toBe(2)
    expect(once.ok).toBe(1)
    expect(once.timeout).toBe(1)
    expect(once.error).toBe(0)
    expect(once.totalDurationMs).toBe(40)
    expect(once.slowestMs).toBe(30)
  })

  it('跨帧累加且保留最长耗时(FIFO 淘汰不影响累计)', () => {
    const first = accumulateHookRunStats(EMPTY_HOOK_RUN_STATS, frame([entry('a', 'ok', 5)]))
    const second = accumulateHookRunStats(first, frame([entry('a', 'error', 900)]))
    expect(second.total).toBe(2)
    expect(second.ok).toBe(1)
    expect(second.error).toBe(1)
    expect(second.slowestMs).toBe(900)
  })

  it('未知 status 兜底计入 error(解析层已 fail-closed 拒收,这里只是不把它算成功)', () => {
    const s = accumulateHookRunStats(
      EMPTY_HOOK_RUN_STATS,
      frame([{ ...entry('a', 'ok', 1), status: 'weird' as Entry['status'] }]),
    )
    expect(s.error).toBe(1)
    expect(s.ok).toBe(0)
  })

  it('均值在 total=0 时返回 0 而不是 NaN', () => {
    expect(hookRunStatsAverageMs(EMPTY_HOOK_RUN_STATS)).toBe(0)
    expect(
      hookRunStatsAverageMs({ ...EMPTY_HOOK_RUN_STATS, total: 2, totalDurationMs: 21 }),
    ).toBe(11)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
