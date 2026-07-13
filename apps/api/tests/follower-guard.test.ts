import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FollowerGuard, DEFAULT_FOLLOWER_GUARD_CONFIG } from '../src/utils/follower-guard.js'

describe('follower-guard — 从库过载保护', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('DEFAULT_FOLLOWER_GUARD_CONFIG', () => {
    it('maxLagSec=5', () => expect(DEFAULT_FOLLOWER_GUARD_CONFIG.maxLagSec).toBe(5))
    it('maxInflight=100', () => expect(DEFAULT_FOLLOWER_GUARD_CONFIG.maxInflight).toBe(100))
    it('recoverySec=10', () => expect(DEFAULT_FOLLOWER_GUARD_CONFIG.recoverySec).toBe(10))
    it('cooldownSec=30', () => expect(DEFAULT_FOLLOWER_GUARD_CONFIG.cooldownSec).toBe(30))
  })

  describe('reportLag', () => {
    it('lagSec 在阈值内返回 true', () => {
      const g = new FollowerGuard()
      expect(g.reportLag('s1', 3)).toBe(true)
    })
    it('lagSec 超阈值返回 false 并拉黑', () => {
      const g = new FollowerGuard()
      expect(g.reportLag('s1', 10)).toBe(false)
      expect(g.status().s1.blocked).toBe(true)
      expect(g.status().s1.blockReason).toBe('lag')
    })
  })

  describe('acquire/release', () => {
    it('未拉黑时 acquire 返回 true 并增加 inflight', () => {
      const g = new FollowerGuard()
      expect(g.acquire('s1')).toBe(true)
      expect(g.acquire('s1')).toBe(true)
    })
    it('release 减少 inflight', () => {
      const g = new FollowerGuard()
      g.acquire('s1')
      g.acquire('s1')
      g.release('s1')
      // 仍可获取（inflight=1）
      expect(g.acquire('s1')).toBe(true)
    })
    it('超过 maxInflight 时拉黑并返回 false', () => {
      const g = new FollowerGuard({ ...DEFAULT_FOLLOWER_GUARD_CONFIG, maxInflight: 2 })
      expect(g.acquire('s1')).toBe(true)
      expect(g.acquire('s1')).toBe(true)
      expect(g.acquire('s1')).toBe(false)
      expect(g.status().s1.blockReason).toBe('inflight')
    })
    it('被拉黑时 acquire 返回 false', () => {
      const g = new FollowerGuard()
      g.reportLag('s1', 100) // 拉黑
      expect(g.acquire('s1')).toBe(false)
    })
    it('release 不会让 inflight 变负', () => {
      const g = new FollowerGuard()
      g.release('s1')
      g.release('s1')
      expect(g.acquire('s1')).toBe(true)
    })
  })

  describe('tick 恢复检测', () => {
    it('冷却期 + recoverySec 后恢复', () => {
      const g = new FollowerGuard({
        ...DEFAULT_FOLLOWER_GUARD_CONFIG,
        cooldownSec: 30,
        recoverySec: 10,
      })
      g.reportLag('s1', 100)
      expect(g.status().s1.blocked).toBe(true)
      // 推进 30 秒（cooldown 结束）+ 10 秒（recovery）
      vi.advanceTimersByTime(41 * 1000)
      g.tick()
      expect(g.status().s1).toBeUndefined()
    })
    it('仅过 cooldown 未过 recovery 不恢复', () => {
      const g = new FollowerGuard({
        ...DEFAULT_FOLLOWER_GUARD_CONFIG,
        cooldownSec: 30,
        recoverySec: 10,
      })
      g.reportLag('s1', 100)
      vi.advanceTimersByTime(35 * 1000) // cooldown 过但 recovery 未过
      g.tick()
      expect(g.status().s1).toBeDefined()
    })
  })

  describe('status', () => {
    it('返回所有被拉黑节点状态', () => {
      const g = new FollowerGuard()
      g.reportLag('s1', 100)
      g.reportLag('s2', 100)
      const s = g.status()
      expect(Object.keys(s).sort()).toEqual(['s1', 's2'])
    })
    it('未拉黑节点不出现在 status', () => {
      const g = new FollowerGuard()
      g.acquire('s1')
      expect(g.status().s1).toBeUndefined()
    })
  })

  describe('getEvents', () => {
    it('记录拉黑事件', () => {
      const g = new FollowerGuard()
      g.reportLag('s1', 100)
      const events = g.getEvents()
      expect(events.some((e) => e.nodeId === 's1' && e.reason === 'lag')).toBe(true)
    })
    it('记录恢复事件', () => {
      const g = new FollowerGuard({
        ...DEFAULT_FOLLOWER_GUARD_CONFIG,
        cooldownSec: 1,
        recoverySec: 1,
      })
      g.reportLag('s1', 100)
      vi.advanceTimersByTime(3 * 1000)
      g.tick()
      const events = g.getEvents()
      expect(events.some((e) => e.reason === 'recovered')).toBe(true)
    })
  })
})
