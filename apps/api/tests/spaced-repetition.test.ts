/**
 * SM-2 间隔重复算法单元测试。
 *
 * 覆盖:
 * 1. 初始状态正确性
 * 2. 首次/二次/三次复习间隔推进(1 → 6 → 6*EF)
 * 3. quality=3 勉强回忆(推进但 EF 略降)
 * 4. quality=0/2 失败重置(repetition=0, interval=1)
 * 5. easeFactor 下限(1.3)/上限(5.0)保护
 * 6. nextReviewDate 日期计算
 * 7. quality 越界抛错
 */
import { describe, it, expect } from 'vitest'
import {
  sm2Calculate,
  createInitialSM2State,
  getDueDateThreshold,
  SM2_EASE_FACTOR_MIN,
  SM2_EASE_FACTOR_MAX,
  type SM2State,
} from '../src/services/spaced-repetition'

const DAY_MS = 24 * 60 * 60 * 1000

describe('SM-2 初始状态', () => {
  it('createInitialSM2State 返回 easeFactor=2.5 / interval=0 / repetition=0', () => {
    const state = createInitialSM2State()
    expect(state.easeFactor).toBe(2.5)
    expect(state.interval).toBe(0)
    expect(state.repetition).toBe(0)
  })

  it('getDueDateThreshold 返回当前时间', () => {
    const now = new Date('2024-06-15T08:00:00Z')
    const threshold = getDueDateThreshold(now)
    expect(threshold.getTime()).toBe(now.getTime())
  })
})

describe('SM-2 成功复习路径 (quality=5)', () => {
  it('首次复习: repetition=0 → interval=1, repetition=1, easeFactor 2.5→2.6', () => {
    const state = createInitialSM2State()
    const r = sm2Calculate(state, 5)
    expect(r.repetition).toBe(1)
    expect(r.interval).toBe(1)
    expect(r.easeFactor).toBe(2.6) // 2.5 + 0.1
    expect(r.quality).toBe(5)
  })

  it('第二次复习: repetition=1 → interval=6, repetition=2', () => {
    const state: SM2State = { easeFactor: 2.6, interval: 1, repetition: 1 }
    const r = sm2Calculate(state, 5)
    expect(r.repetition).toBe(2)
    expect(r.interval).toBe(6)
    expect(r.easeFactor).toBe(2.7) // 2.6 + 0.1
  })

  it('第三次复习: interval = round(6 * 2.7) = 16', () => {
    const state: SM2State = { easeFactor: 2.7, interval: 6, repetition: 2 }
    const r = sm2Calculate(state, 5)
    expect(r.repetition).toBe(3)
    expect(r.interval).toBe(16) // round(16.2)
    expect(r.easeFactor).toBe(2.8)
  })
})

describe('SM-2 勉强回忆 (quality=3)', () => {
  it('quality=3: repetition 推进, easeFactor 略降 (2.5 → 2.36)', () => {
    const state = createInitialSM2State()
    const r = sm2Calculate(state, 3)
    // q=3: EF' = 2.5 + (0.1 - 2*(0.08+0.04)) = 2.5 + (0.1 - 0.24) = 2.36
    expect(r.repetition).toBe(1) // 推进,不重置
    expect(r.interval).toBe(1) // rep=0 → 1
    expect(r.easeFactor).toBe(2.36)
    expect(r.easeFactor).toBeLessThan(2.5) // 略降
  })
})

describe('SM-2 失败重置路径 (quality 0-2)', () => {
  it('quality=2: repetition=0, interval=1, easeFactor 下降 (2.5 → 2.18)', () => {
    const state: SM2State = { easeFactor: 2.5, interval: 6, repetition: 2 }
    const r = sm2Calculate(state, 2)
    // q=2: EF' = 2.5 + (0.1 - 3*(0.08+0.06)) = 2.5 + (0.1 - 0.42) = 2.18
    expect(r.repetition).toBe(0)
    expect(r.interval).toBe(1)
    expect(r.easeFactor).toBe(2.18)
  })

  it('quality=0: 完全忘记, 同样重置 (2.5 → 1.7)', () => {
    const state: SM2State = { easeFactor: 2.5, interval: 6, repetition: 2 }
    const r = sm2Calculate(state, 0)
    // q=0: EF' = 2.5 + (0.1 - 5*(0.08+0.10)) = 2.5 + (0.1 - 0.9) = 1.7
    expect(r.repetition).toBe(0)
    expect(r.interval).toBe(1)
    expect(r.easeFactor).toBe(1.7)
  })
})

describe('SM-2 easeFactor 边界保护', () => {
  it('下限保护: 连续失败后 easeFactor 不低于 1.3', () => {
    let state = createInitialSM2State()
    // 第1次 q=0: EF 2.5 → 1.7
    state = sm2Calculate(state, 0)
    expect(state.easeFactor).toBe(1.7)
    // 第2次 q=0: EF 1.7 → 0.9 → 保护 1.3
    state = sm2Calculate(state, 0)
    expect(state.easeFactor).toBe(SM2_EASE_FACTOR_MIN)
    expect(state.easeFactor).toBe(1.3)
    // 第3次 q=0: EF 1.3 → 0.5 → 保护 1.3(不继续下降)
    state = sm2Calculate(state, 0)
    expect(state.easeFactor).toBe(1.3)
  })

  it('上限保护: 连续满分后 easeFactor 不超过 5.0', () => {
    let state = createInitialSM2State()
    // 每次满分 +0.1,从 2.5 到 5.0 需 25 次,第 26 次触发上限
    for (let i = 0; i < 25; i++) {
      state = sm2Calculate(state, 5)
    }
    expect(state.easeFactor).toBe(SM2_EASE_FACTOR_MAX) // 5.0
    // 再来一次,5.0 + 0.1 = 5.1 → 保护 5.0
    state = sm2Calculate(state, 5)
    expect(state.easeFactor).toBe(5.0)
    expect(state.easeFactor).not.toBeGreaterThan(SM2_EASE_FACTOR_MAX)
  })
})

describe('SM-2 nextReviewDate 计算', () => {
  it('interval=1 → 明天 (now + 1 天)', () => {
    const now = new Date('2024-06-15T00:00:00Z')
    const r = sm2Calculate(createInitialSM2State(), 5, now)
    expect(r.interval).toBe(1)
    expect(r.nextReviewDate.getTime() - now.getTime()).toBe(1 * DAY_MS)
  })

  it('interval=6 → 6 天后', () => {
    const now = new Date('2024-06-15T00:00:00Z')
    const state: SM2State = { easeFactor: 2.6, interval: 1, repetition: 1 }
    const r = sm2Calculate(state, 5, now)
    expect(r.interval).toBe(6)
    expect(r.nextReviewDate.getTime() - now.getTime()).toBe(6 * DAY_MS)
  })

  it('不传 now 时默认使用当前时间', () => {
    const before = Date.now()
    const r = sm2Calculate(createInitialSM2State(), 5)
    const after = Date.now()
    // nextReviewDate 应在 [before+1天, after+1天] 区间内
    expect(r.nextReviewDate.getTime()).toBeGreaterThanOrEqual(before + DAY_MS)
    expect(r.nextReviewDate.getTime()).toBeLessThanOrEqual(after + DAY_MS)
  })
})

describe('SM-2 quality 越界校验', () => {
  it('quality=-1 抛 Error', () => {
    expect(() => sm2Calculate(createInitialSM2State(), -1)).toThrow(Error)
    expect(() => sm2Calculate(createInitialSM2State(), -1)).toThrow(/quality must be 0-5/)
  })

  it('quality=6 抛 Error', () => {
    expect(() => sm2Calculate(createInitialSM2State(), 6)).toThrow(Error)
    expect(() => sm2Calculate(createInitialSM2State(), 6)).toThrow(/quality must be 0-5/)
  })
})
