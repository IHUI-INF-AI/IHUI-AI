// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * IDE Agent 面板的耗时取值(D49② / G-61②,2026-09-24 立)。
 *
 * 面板此前对 tool_result / terminal_end 一律 `Date.now() - Date.parse(startedAt)`,
 * 后端明明有的值(terminal_end.durationMs 是契约必填、llm.py 真下发)被忽略。
 * 这里钉住两条分支:后端下发优先 / 未下发回退本地时钟。
 */

import { describe, it, expect } from 'vitest'
import type { AgentStreamEvent } from '@ihui/api-client'
import { pickToolServerDurationMs, resolveDurationMs } from '../agent-pane/AgentPane'

function ev(extra: Record<string, unknown>): AgentStreamEvent {
  return { type: 'tool_result', ...extra }
}

describe('resolveDurationMs:后端值优先', () => {
  it('分支① 后端下发 → 直接用后端值,不再看本地 startedAt', () => {
    expect(resolveDurationMs(1234, '2026-09-24T00:00:00.000Z', 9_999_999)).toBe(1234)
  })

  it('分支② 后端未下发(null)→ 回退本地时钟差', () => {
    const startedAt = '2026-09-24T00:00:00.000Z'
    const now = Date.parse(startedAt) + 1_500
    expect(resolveDurationMs(null, startedAt, now)).toBe(1_500)
  })

  it('startedAt 不可解析且后端无值 → null(不给假耗时)', () => {
    expect(resolveDurationMs(null, 'not-a-date', 1_000)).toBeNull()
  })

  it('后端下发 0 是合法值(去重跳过的命令),不被当成"缺失"', () => {
    expect(resolveDurationMs(0, '2026-09-24T00:00:00.000Z', 9_999_999)).toBe(0)
  })
})

describe('pickToolServerDurationMs:只取逐工具明细', () => {
  it('顶层 camel durationMs 命中(对话流契约形态)', () => {
    expect(pickToolServerDurationMs(ev({ durationMs: 777 }), 'tool-1', 'read_file')).toBe(777)
  })

  it('payload.tool_results[] 按工具名配对命中 snake 明细值', () => {
    const event = ev({
      payload: {
        duration_ms: 5_000, // 整轮批量耗时 —— 绝不能摊给单条卡
        tool_results: [
          { id: 'call_a', name: 'read_file', duration_ms: 120.4 },
          { id: 'call_b', name: 'run_command', duration_ms: 900 },
        ],
      },
    })
    expect(pickToolServerDurationMs(event, 'tool-7', 'run_command')).toBe(900)
    // 面板本地 id(tool-7)与后端 id 对不上时按工具名配对,取到的是本条的 900 而非帧级 5000
    expect(pickToolServerDurationMs(event, 'tool-7', 'read_file')).toBe(120.4)
  })

  it('id 命中优先于名字命中', () => {
    const event = ev({
      payload: {
        tool_results: [
          { id: 'tool-1', name: 'read_file', duration_ms: 11 },
          { id: 'call_x', name: 'read_file', duration_ms: 22 },
        ],
      },
    })
    expect(pickToolServerDurationMs(event, 'tool-1', 'read_file')).toBe(11)
  })

  it('无 payload / 无明细 / 明细缺 duration → null(交给本地回退)', () => {
    expect(pickToolServerDurationMs(ev({}), 'tool-1', 'read_file')).toBeNull()
    expect(pickToolServerDurationMs(ev({ payload: {} }), 'tool-1', 'read_file')).toBeNull()
    expect(
      pickToolServerDurationMs(
        ev({ payload: { tool_results: [{ id: 'a', name: 'read_file' }] } }),
        'tool-1',
        'read_file',
      ),
    ).toBeNull()
  })

  it('非法明细值(NaN / 负数 / 字符串)不采用', () => {
    const event = ev({
      payload: {
        tool_results: [
          { name: 'read_file', duration_ms: Number.NaN },
          { name: 'read_file', duration_ms: -1 },
          { name: 'read_file', duration_ms: '120' },
        ],
      },
    })
    expect(pickToolServerDurationMs(event, 'tool-1', 'read_file')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
