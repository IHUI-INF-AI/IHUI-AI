// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi } from 'vitest'
import {
  INPUT_LAG_MAX_SANE_MS,
  INPUT_LAG_THRESHOLD_MS,
  STARTUP_MAX_SANE_MS,
  STARTUP_STAGES,
  STREAM_STALL_THRESHOLD_MS,
  UiPerfTelemetry,
  shouldReportInputLag,
  type PerfEvent,
  type StartupStageEnds,
} from './ui-perf-telemetry'

/**
 * UI 性能遥测验收测试(2026-09-30 立,吸收批次 74 票 G-977991)。
 * 锁定验收:负段整批丢弃 / 总时长>300s 整批丢弃 / sum==total 恒等 /
 * 停顿只在正文 chunk 间触发(工具期不计) / IME 组合中 800ms 不报 /
 * 程序化改写不报 / >5s 挂起哨兵不报 / emit 抛错被吞。
 */

function collect() {
  const events: PerfEvent[] = []
  const reporter = (event: PerfEvent) => {
    events.push(event)
  }
  return { events, reporter }
}

const SESSION = 'session-1'

function stageEndsAt(startedAt: number, durations: number[]): StartupStageEnds {
  const ends = {} as StartupStageEnds
  let acc = startedAt
  STARTUP_STAGES.forEach((stage, index) => {
    acc += durations[index]!
    ends[stage] = acc
  })
  return ends
}

describe('启动分段全有或全无哨兵', () => {
  const durations = [100, 200, 150, 300, 50, 700]

  it('正常分段:total + 6 段全部上报,且 sum(6 段) == total 恒等', () => {
    const { events, reporter } = collect()
    const perf = new UiPerfTelemetry({ reporter })
    perf.reportStartupStages({
      sessionId: SESSION,
      startedAt: 1000,
      stageEnds: stageEndsAt(1000, durations),
    })

    expect(events).toHaveLength(1 + STARTUP_STAGES.length)
    expect(events[0]?.name).toBe('startup_total')
    expect(events[0]?.value).toBe(1500)
    const stageEvents = events.slice(1)
    expect(stageEvents.map((e) => e.name)).toEqual(
      STARTUP_STAGES.map((stage) => `startup_stage_${stage}`),
    )
    const stageSum = stageEvents.reduce((sum, e) => sum + e.value, 0)
    expect(stageSum).toBe(events[0]!.value)
    expect(stageEvents.map((e) => e.value)).toEqual(durations)
  })

  it('任一段为负(跨进程时钟偏移)整批丢弃', () => {
    const { events, reporter } = collect()
    const perf = new UiPerfTelemetry({ reporter })
    // view_loaded 段结束时刻早于 window_shown → 该段为负
    const badEnds = stageEndsAt(1000, durations)
    badEnds.view_loaded = badEnds.window_shown - 1
    perf.reportStartupStages({ sessionId: SESSION, startedAt: 1000, stageEnds: badEnds })

    expect(events).toHaveLength(0)
  })

  it(`总时长 > ${STARTUP_MAX_SANE_MS}ms(时钟异常/挂起)整批丢弃`, () => {
    const { events, reporter } = collect()
    const perf = new UiPerfTelemetry({ reporter })

    // 边界内:恰好 300s 可以上报
    perf.reportStartupStages({
      sessionId: SESSION,
      startedAt: 0,
      stageEnds: stageEndsAt(0, [STARTUP_MAX_SANE_MS, 0, 0, 0, 0, 0]),
    })
    expect(events).toHaveLength(7)

    // 超 1ms → 整批丢弃
    events.length = 0
    perf.reportStartupStages({
      sessionId: SESSION,
      startedAt: 0,
      stageEnds: stageEndsAt(0, [STARTUP_MAX_SANE_MS + 1, 0, 0, 0, 0, 0]),
    })
    expect(events).toHaveLength(0)
  })
})

describe('流式停顿', () => {
  it('停顿只在正文 chunk 间隔超阈时上报真实间隔', () => {
    const { events, reporter } = collect()
    const perf = new UiPerfTelemetry({ reporter })

    perf.recordContentChunk('t1', { now: 1000 }) // 首个:只记基线
    expect(events).toHaveLength(0)

    perf.recordContentChunk('t1', { now: 1000 + STREAM_STALL_THRESHOLD_MS }) // 恰在阈值:不上报
    expect(events).toHaveLength(0)

    perf.recordContentChunk('t1', { now: 4000 + 4500 }) // 距上一 chunk 4500ms → 上报
    expect(events).toHaveLength(1)
    expect(events[0]?.name).toBe('stream_stall')
    expect(events[0]?.value).toBe(4500)
    expect(events[0]?.properties.stall_ms).toBe(4500)
  })

  it('工具调用期间不计入:清追踪后首个正文 chunk 视为首个', () => {
    const { events, reporter } = collect()
    const perf = new UiPerfTelemetry({ reporter })

    perf.recordContentChunk('t1', { now: 1000 })
    perf.clearStallTracking('t1') // 工具开始
    perf.recordContentChunk('t1', { now: 9000 }) // 工具后第一个正文:基线,不与工具前比较
    expect(events).toHaveLength(0)

    perf.recordContentChunk('t1', { now: 12500 }) // 间隔 3500 → 上报
    expect(events).toHaveLength(1)
    expect(events[0]?.properties.stall_ms).toBe(3500)
  })

  it('per-task 隔离:不同 task 互不比较', () => {
    const { events, reporter } = collect()
    const perf = new UiPerfTelemetry({ reporter })
    perf.recordContentChunk('t1', { now: 1000 })
    perf.recordContentChunk('t2', { now: 9000 }) // t2 首个
    expect(events).toHaveLength(0)
  })
})

describe('输入卡顿', () => {
  it.each([
    {
      lagMs: 800,
      isProgrammatic: false,
      isComposing: true,
      want: false,
      why: 'IME 组合中 800ms 不报',
    },
    { lagMs: 800, isProgrammatic: true, isComposing: false, want: false, why: '程序化改写不报' },
    {
      lagMs: INPUT_LAG_THRESHOLD_MS,
      isProgrammatic: false,
      isComposing: false,
      want: false,
      why: '恰好阈值不报(严格大于)',
    },
    {
      lagMs: INPUT_LAG_THRESHOLD_MS + 1,
      isProgrammatic: false,
      isComposing: false,
      want: true,
      why: '阈值 +1 上报',
    },
    {
      lagMs: INPUT_LAG_MAX_SANE_MS,
      isProgrammatic: false,
      isComposing: false,
      want: true,
      why: '恰好 5s 仍上报(含端点)',
    },
    {
      lagMs: INPUT_LAG_MAX_SANE_MS + 1,
      isProgrammatic: false,
      isComposing: false,
      want: false,
      why: '>5s 挂起/休眠哨兵不报',
    },
  ])(
    'lagMs=$lagMs programmatic=$isProgrammatic composing=$isComposing → $why',
    ({ lagMs, isProgrammatic, isComposing, want }) => {
      expect(shouldReportInputLag({ lagMs, isProgrammatic, isComposing })).toBe(want)
    },
  )

  it('recordInputLag 按判定上报,IME 组合中 800ms 不报', () => {
    const { events, reporter } = collect()
    const perf = new UiPerfTelemetry({ reporter })

    perf.recordInputLag({ lagMs: 800, textLength: 42, isProgrammatic: false, isComposing: true })
    perf.recordInputLag({ lagMs: 800, textLength: 42, isProgrammatic: true, isComposing: false })
    expect(events).toHaveLength(0)

    perf.recordInputLag({
      lagMs: 800.4,
      textLength: 42,
      isProgrammatic: false,
      isComposing: false,
      taskId: 't1',
    })
    expect(events).toHaveLength(1)
    expect(events[0]?.name).toBe('input_lag')
    expect(events[0]?.value).toBe(800)
    expect(events[0]?.properties.lag_ms).toBe(800)
    expect(events[0]?.properties.text_length).toBe(42)
    expect(events[0]?.properties.task_id).toBe('t1')
  })
})

describe('唯一 emit 出口', () => {
  it('model 属性统一卫生化(trim,空值不下发)', () => {
    const { events, reporter } = collect()
    const perf = new UiPerfTelemetry({ reporter })

    perf.recordContentChunk('t1', { now: 0 }) // 首个:只记基线,不产生事件
    perf.recordContentChunk('t1', { now: 4000, model: '  glm-x  ' }) // 间隔 4000 → 停顿事件
    perf.recordContentChunk('t1', { now: 9000, model: '   ' }) // 间隔 5000 → 停顿事件
    expect(events).toHaveLength(2)
    // 非空 model:trim 后下发
    expect(events[0]?.properties.model).toBe('glm-x')
    // 空 model:不下发(undefined),而非空字符串
    expect(events[1]?.properties.model).toBeUndefined()
  })

  it('reporter 缺失时整组静默', () => {
    const perf = new UiPerfTelemetry()
    expect(() =>
      perf.reportStartupStages({
        sessionId: SESSION,
        startedAt: 0,
        stageEnds: stageEndsAt(0, durations0),
      }),
    ).not.toThrow()
    expect(() => perf.recordContentChunk('t1', { now: 0 })).not.toThrow()
    expect(() =>
      perf.recordInputLag({ lagMs: 800, textLength: 1, isProgrammatic: false, isComposing: false }),
    ).not.toThrow()
  })

  it('emit 抛错被吞:reporter 同步抛错与异步 reject 都不冒泡进 UI 主流程', async () => {
    const onWarn = vi.fn()
    const syncThrow = new UiPerfTelemetry({
      reporter: () => {
        throw new Error('sync boom')
      },
      onWarn,
    })
    expect(() => syncThrow.recordContentChunk('t1', { now: 0 })).not.toThrow() // 首个:只记基线,未触发 emit
    expect(() => syncThrow.recordContentChunk('t1', { now: 5000 })).not.toThrow() // 停顿事件:同步抛错被吞
    expect(() =>
      syncThrow.recordInputLag({
        lagMs: 800,
        textLength: 1,
        isProgrammatic: false,
        isComposing: false,
      }),
    ).not.toThrow() // 卡顿事件:同步抛错被吞

    const asyncReject = new UiPerfTelemetry({
      reporter: () => Promise.reject(new Error('async boom')),
      onWarn,
    })
    expect(() => asyncReject.recordContentChunk('t1', { now: 0 })).not.toThrow() // 首个:基线
    expect(() => asyncReject.recordContentChunk('t1', { now: 5000 })).not.toThrow() // 停顿事件:异步 reject 被吞
    // 等一拍让异步 catch 走完
    await Promise.resolve()
    await Promise.resolve()
    expect(onWarn).toHaveBeenCalledTimes(3)
  })
})

const durations0 = [10, 20, 30, 40, 50, 60]
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
