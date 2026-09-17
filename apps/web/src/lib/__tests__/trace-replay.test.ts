// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import {
  TRACE_STEP_BASE_MS,
  TRACE_STEP_CAP_MS,
  advancePlayback,
  initialPlayback,
  traceStepDuration,
} from '../trace-replay'

/**
 * P3 #39 执行轨迹回放纯逻辑测试(2026-09-16 立)
 */
describe('traceStepDuration(节奏加权)', () => {
  it('无耗时/零耗时 → 基础节奏', () => {
    expect(traceStepDuration(undefined)).toBe(TRACE_STEP_BASE_MS)
    expect(traceStepDuration(0)).toBe(TRACE_STEP_BASE_MS)
  })

  it('长耗时温和加权且 cap 封顶(30s 的工具不会让回放卡半分钟)', () => {
    const d = traceStepDuration(30_000)
    expect(d).toBeGreaterThan(TRACE_STEP_BASE_MS)
    expect(d).toBeLessThanOrEqual(TRACE_STEP_CAP_MS)
  })

  it('任意大耗时都不超过上限', () => {
    expect(traceStepDuration(600_000)).toBeLessThanOrEqual(TRACE_STEP_CAP_MS)
  })
})

describe('initialPlayback / advancePlayback(状态机)', () => {
  it('初始:cursor=-1 停在第一步之前,未播放', () => {
    expect(initialPlayback(3)).toEqual({ cursor: -1, playing: false, finished: false })
  })

  it('空轨迹:直接 finished', () => {
    expect(initialPlayback(0)).toEqual({ cursor: 0, playing: false, finished: true })
  })

  it('逐步推进:cursor 递增,到末尾 finished=true 且停止播放', () => {
    let pb = initialPlayback(3)
    pb = advancePlayback(pb, 3)
    expect(pb).toEqual({ cursor: 0, playing: true, finished: false })
    pb = advancePlayback(pb, 3)
    pb = advancePlayback(pb, 3)
    expect(pb.cursor).toBe(2)
    expect(pb.finished).toBe(false)
    const last = advancePlayback(pb, 3)
    expect(last).toEqual({ cursor: 2, playing: false, finished: true })
    // 已结束后再推不越界
    expect(advancePlayback(last, 3)).toEqual(last)
  })

  it('空轨迹推进:返回 finished 终态', () => {
    expect(advancePlayback(initialPlayback(0), 0)).toEqual({
      cursor: 0,
      playing: false,
      finished: true,
    })
  })
})
