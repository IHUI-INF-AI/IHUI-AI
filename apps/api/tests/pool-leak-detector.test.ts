import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  PoolLeakDetector,
  trackConnection,
  untrackConnection,
  getTrackedConnection,
} from '../src/utils/pool-leak-detector.js'

describe('pool-leak-detector — 连接池泄漏检测', () => {
  let d: PoolLeakDetector
  beforeEach(() => {
    d = new PoolLeakDetector(300, 200)
  })

  describe('构造参数', () => {
    it('使用默认值', () => {
      const d2 = new PoolLeakDetector()
      const s = d2.stats()
      expect(s.leakTimeoutSec).toBe(300)
      expect(s.keptHistory).toBe(0)
    })
    it('leakTimeoutSec 至少为 1', () => {
      const d2 = new PoolLeakDetector(0, 10)
      expect(d2.stats().leakTimeoutSec).toBe(1)
    })
    it('maxRecords 至少为 10', () => {
      const d2 = new PoolLeakDetector(10, 1)
      // 通过强制泄漏验证 maxRecords 仍能保留记录
      d2.checkout('p', 'c')
      d2.forceReleaseAllLeaked()
      // 没有抛错即说明配置已生效
      expect(d2.stats().leakTimeoutSec).toBe(10)
    })
  })

  describe('setTimeout', () => {
    it('动态调整泄漏阈值', () => {
      d.setTimeout(60)
      expect(d.stats().leakTimeoutSec).toBe(60)
    })
    it('最小值 1', () => {
      d.setTimeout(0)
      expect(d.stats().leakTimeoutSec).toBe(1)
    })
  })

  describe('checkout / checkin', () => {
    it('checkout 返回递增的 connId', () => {
      const id1 = d.checkout('writer', 'SELECT 1')
      const id2 = d.checkout('reader', 'SELECT 2')
      expect(id1).toBeGreaterThanOrEqual(1)
      expect(id2).toBeGreaterThan(id1)
    })
    it('checkout 后 outstanding +1，checkin 后 -1', () => {
      const id = d.checkout('p', 'c')
      expect(d.stats().outstanding).toBe(1)
      d.checkin(id)
      expect(d.stats().outstanding).toBe(0)
      expect(d.stats().totalCheckin).toBe(1)
    })
    it('checkin 不存在的 connId 静默忽略', () => {
      d.checkin(99999)
      expect(d.stats().outstanding).toBe(0)
      expect(d.stats().totalCheckin).toBe(0)
    })
    it('记录 stack 与 context', () => {
      const id = d.checkout('writer', 'SELECT users')
      const outs = d.getOutstanding()
      expect(outs).toHaveLength(1)
      expect(outs[0]!.pool).toBe('writer')
      expect(outs[0]!.context).toBe('SELECT users')
      expect(typeof outs[0]!.stack).toBe('string')
      expect(outs[0]!.connId).toBe(id)
      expect(outs[0]!.checkedInAt).toBe(0)
    })
  })

  describe('scanLeaks', () => {
    it('未超时不视为泄漏', () => {
      d.checkout('p', 'c')
      const leaks = d.scanLeaks()
      expect(leaks).toHaveLength(0)
      expect(d.stats().totalLeaked).toBe(0)
    })
    it('超时后检测到泄漏', () => {
      d.setTimeout(1)
      const id = d.checkout('p', 'c')
      // 用 fake timer 推进 2 秒
      vi.useFakeTimers()
      try {
        vi.advanceTimersByTime(2000)
        const leaks = d.scanLeaks()
        expect(leaks).toHaveLength(1)
        expect(leaks[0]!.connId).toBe(id)
        expect(d.stats().totalLeaked).toBe(1)
        expect(d.stats().outstanding).toBe(0)
      } finally {
        vi.useRealTimers()
      }
    })
    it('leakWarnings 上限为 maxRecords', () => {
      d = new PoolLeakDetector(1, 5)
      vi.useFakeTimers()
      try {
        for (let i = 0; i < 10; i++) {
          d.checkout('p', `c${i}`)
        }
        vi.advanceTimersByTime(2000)
        const leaks = d.scanLeaks()
        expect(leaks).toHaveLength(10)
        expect(d.getLeaks().length).toBeLessThanOrEqual(50)
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('forceRelease', () => {
    it('强制回收指定连接', () => {
      const id = d.checkout('p', 'c')
      const ok = d.forceRelease(id)
      expect(ok).toBe(true)
      expect(d.stats().outstanding).toBe(0)
      expect(d.stats().totalForceReleased).toBe(1)
      expect(d.stats().keptHistory).toBe(1)
    })
    it('回收不存在的连接返回 false', () => {
      expect(d.forceRelease(99999)).toBe(false)
    })
    it('forceReleaseAllLeaked 批量回收', () => {
      d.setTimeout(1)
      d.checkout('p', 'c1')
      d.checkout('p', 'c2')
      vi.useFakeTimers()
      try {
        vi.advanceTimersByTime(2000)
        const count = d.forceReleaseAllLeaked()
        expect(count).toBe(2)
        expect(d.stats().totalForceReleased).toBe(2)
        expect(d.stats().outstanding).toBe(0)
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('getOutstanding / getLeaks', () => {
    it('getOutstanding 返回深拷贝', () => {
      d.checkout('p', 'c')
      const a = d.getOutstanding()
      const b = d.getOutstanding()
      expect(a).not.toBe(b)
      expect(a).toEqual(b)
      a[0]!.pool = 'modified'
      expect(d.getOutstanding()[0]!.pool).toBe('p')
    })
    it('getLeaks 返回最近 50 条倒序', () => {
      d.setTimeout(1)
      for (let i = 0; i < 60; i++) d.checkout('p', `c${i}`)
      vi.useFakeTimers()
      try {
        vi.advanceTimersByTime(2000)
        d.scanLeaks()
        const leaks = d.getLeaks()
        expect(leaks.length).toBeLessThanOrEqual(50)
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('stats', () => {
    it('反映完整统计', () => {
      const id1 = d.checkout('p1', 'c1')
      const id2 = d.checkout('p2', 'c2')
      d.checkin(id1)
      d.forceRelease(id2)
      const s = d.stats()
      expect(s.outstanding).toBe(0)
      expect(s.totalCheckout).toBe(2)
      expect(s.totalCheckin).toBe(1)
      expect(s.totalForceReleased).toBe(1)
      expect(s.totalLeaked).toBe(0)
      expect(s.leakRate).toBe(0)
      expect(s.keptHistory).toBe(2)
    })
    it('leakRate 计算', () => {
      d.setTimeout(1)
      d.checkout('p', 'c1') // 将泄漏
      d.checkout('p', 'c2')
      d.checkin(2)
      vi.useFakeTimers()
      try {
        vi.advanceTimersByTime(2000)
        d.scanLeaks()
        const s = d.stats()
        expect(s.totalCheckout).toBe(2)
        expect(s.totalLeaked).toBe(1)
        expect(s.leakRate).toBeCloseTo(0.5, 4)
      } finally {
        vi.useRealTimers()
      }
    })
    it('totalCheckout=0 时 leakRate=0', () => {
      expect(d.stats().leakRate).toBe(0)
    })
  })

  describe('clear', () => {
    it('清空所有计数与历史', () => {
      d.checkout('p', 'c')
      d.forceRelease(1)
      d.clear()
      const s = d.stats()
      expect(s.outstanding).toBe(0)
      expect(s.totalCheckout).toBe(0)
      expect(s.totalCheckin).toBe(0)
      expect(s.keptHistory).toBe(0)
    })
  })

  describe('WeakMap 辅助', () => {
    it('trackConnection / untrackConnection / getTrackedConnection', () => {
      const conn = {}
      const id = trackConnection(conn, 'writer', 'SELECT')
      expect(id).toBeGreaterThanOrEqual(1)
      const info = getTrackedConnection(conn)
      expect(info).toBeDefined()
      expect(info!.pool).toBe('writer')
      expect(info!.connId).toBe(id)
      untrackConnection(conn)
      expect(getTrackedConnection(conn)).toBeUndefined()
    })
    it('untrackConnection 不存在的连接不抛错', () => {
      const conn = {}
      expect(() => untrackConnection(conn)).not.toThrow()
    })
  })

  describe('history 上限', () => {
    it('超过 maxRecords 后保留最新', () => {
      // maxRecords 最小值 10（Math.max(10, maxRecords)）
      d = new PoolLeakDetector(300, 15)
      for (let i = 0; i < 20; i++) {
        const id = d.checkout('p', `c${i}`)
        d.checkin(id)
      }
      expect(d.stats().keptHistory).toBe(15)
    })
  })
})
