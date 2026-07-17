/**
 * DoomLoopDetector 单元测试 — 滑动窗口检测 LLM 重复调用相同工具相同参数。
 *
 * 覆盖任务要求的 8 个场景:
 *   1. 无重复调用不报警
 *   2. 重复 2 次不报警(阈值 3)
 *   3. 重复 3 次报警
 *   4. 不同工具不互相影响
 *   5. 相同工具不同参数不报警
 *   6. 窗口外的不算重复
 *   7. reset 清空历史
 *   8. getStats 正确
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { DoomLoopDetector } from '../src/doom-loop-detector.js'

describe('DoomLoopDetector 滑动窗口死循环检测', () => {
  let detector: DoomLoopDetector

  beforeEach(() => {
    detector = new DoomLoopDetector()
  })

  it('无重复调用不报警', () => {
    expect(detector.record('read', { path: 'a.txt' })).toBeNull()
    expect(detector.record('read', { path: 'b.txt' })).toBeNull()
    expect(detector.record('read', { path: 'c.txt' })).toBeNull()
  })

  it('重复 2 次不报警(默认阈值 3)', () => {
    const input = { path: 'same.txt' }
    expect(detector.record('read', input)).toBeNull()
    expect(detector.record('read', input)).toBeNull()
  })

  it('重复 3 次报警(默认阈值 3)', () => {
    const input = { path: 'same.txt' }
    expect(detector.record('read', input)).toBeNull()
    expect(detector.record('read', input)).toBeNull()
    const alert = detector.record('read', input)
    expect(alert).not.toBeNull()
    expect(alert!.toolName).toBe('read')
    expect(alert!.repeatCount).toBe(3)
    expect(alert!.message).toContain('read')
    expect(alert!.message).toContain('3')
    expect(alert!.suggestion).toContain('检查工具返回值')
  })

  it('不同工具不互相影响', () => {
    const input = { path: 'same.txt' }
    expect(detector.record('read', input)).toBeNull()
    expect(detector.record('write', input)).toBeNull()
    expect(detector.record('read', input)).toBeNull()
    expect(detector.record('write', input)).toBeNull()
    // 各自只有 2 次,未达阈值 3
    expect(detector.record('read', input)).not.toBeNull()
    expect(detector.record('write', input)).not.toBeNull()
  })

  it('相同工具不同参数不报警', () => {
    expect(detector.record('read', { path: 'a.txt' })).toBeNull()
    expect(detector.record('read', { path: 'b.txt' })).toBeNull()
    expect(detector.record('read', { path: 'c.txt' })).toBeNull()
    expect(detector.record('read', { path: 'd.txt' })).toBeNull()
  })

  it('窗口外的不算重复', () => {
    // 自定义窗口大小 3,阈值 3
    const d = new DoomLoopDetector({ windowSize: 3, repeatThreshold: 3 })
    const inputX = { path: 'x.txt' }
    const inputY = { path: 'y.txt' }
    // 2 次 X(窗口内 [X, X])
    expect(d.record('read', inputX)).toBeNull()
    expect(d.record('read', inputX)).toBeNull()
    // 2 次 Y 把最早的 X 挤出窗口([X, X, Y] → [X, Y, Y])
    expect(d.record('read', inputY)).toBeNull()
    expect(d.record('read', inputY)).toBeNull()
    // 再加 X:窗口 [Y, Y, X],X 计数=1(前 2 次 X 已挤出窗口),不报警
    // 若无窗口限制,X 计数会是 3 → 报警;窗口外的不算重复
    expect(d.record('read', inputX)).toBeNull()
  })

  it('reset 清空历史', () => {
    const input = { path: 'same.txt' }
    detector.record('read', input)
    detector.record('read', input)
    detector.reset()
    // reset 后重新计数,前 2 次不报警
    expect(detector.record('read', input)).toBeNull()
    expect(detector.record('read', input)).toBeNull()
    expect(detector.record('read', input)).not.toBeNull()
  })

  it('getStats 正确', () => {
    // 初始状态
    expect(detector.getStats()).toEqual({ totalCalls: 0, uniqueCalls: 0, repeatRate: 0 })
    // 3 次不同调用
    detector.record('read', { path: 'a.txt' })
    detector.record('read', { path: 'b.txt' })
    detector.record('write', { path: 'c.txt' })
    const stats1 = detector.getStats()
    expect(stats1.totalCalls).toBe(3)
    expect(stats1.uniqueCalls).toBe(3)
    expect(stats1.repeatRate).toBe(0)
    // 2 次重复调用
    detector.record('read', { path: 'a.txt' })
    detector.record('read', { path: 'a.txt' })
    const stats2 = detector.getStats()
    expect(stats2.totalCalls).toBe(5)
    expect(stats2.uniqueCalls).toBe(3)
    expect(stats2.repeatRate).toBeCloseTo(1 - 3 / 5, 5)
  })
})
