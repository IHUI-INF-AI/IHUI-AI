import { describe, it, expect, vi } from 'vitest'

/**
 * 金丝雀发布测试 — 用 mock 模拟请求路由 / 健康检查 / 自动回滚.
 *
 * 覆盖: 路由规则(header/cookie)、实例健康、回滚阈值(错误率>5%)、流量比例(10/50/100).
 */

// ---------- mock: 金丝雀路由器 ----------
interface RouteRequest {
  headers: Record<string, string>
  cookies: Record<string, string>
  ip: string
}

/** 根据header/cookie决定路由到 canary 还是 stable. */
function routeCanary(req: RouteRequest, percentage: number): 'canary' | 'stable' {
  // 强制标签优先
  if (req.headers['x-canary-tag'] === 'canary') return 'canary'
  if (req.headers['x-canary-tag'] === 'stable') return 'stable'
  if (req.cookies['canary'] === '1') return 'canary'
  // 按 IP hash 决定百分比
  let h = 0
  for (const ch of req.ip) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h % 100 < percentage ? 'canary' : 'stable'
}

// ---------- mock: 金丝雀实例健康检查 ----------
interface CanaryHealth {
  healthy: boolean
  errorRate: number
}

function checkHealth(errorRate: number): CanaryHealth {
  // 错误率 > 5% 视为不健康(与回滚阈值 > 5% 保持一致, 5% 为健康边界)
  return { healthy: errorRate <= 0.05, errorRate }
}

// ---------- mock: 自动回滚评估器 ----------
function shouldRollback(health: CanaryHealth): boolean {
  // 错误率 > 5% 自动回滚
  return health.errorRate > 0.05
}

// ---------- mock: 流量比例分配 ----------
function distributeTraffic(percentage: number, total = 100): { canary: number; stable: number } {
  return {
    canary: Math.round((total * percentage) / 100),
    stable: Math.round((total * (100 - percentage)) / 100),
  }
}

describe('canary — 金丝雀发布', () => {
  describe('路由规则', () => {
    it('header x-canary-tag=canary 强制走金丝雀', () => {
      const r = routeCanary(
        { headers: { 'x-canary-tag': 'canary' }, cookies: {}, ip: '1.1.1.1' },
        0,
      )
      expect(r).toBe('canary')
    })
    it('header x-canary-tag=stable 强制走稳定版', () => {
      const r = routeCanary(
        { headers: { 'x-canary-tag': 'stable' }, cookies: {}, ip: '1.1.1.1' },
        100,
      )
      expect(r).toBe('stable')
    })
    it('cookie canary=1 走金丝雀', () => {
      const r = routeCanary({ headers: {}, cookies: { canary: '1' }, ip: '2.2.2.2' }, 0)
      expect(r).toBe('canary')
    })
    it('无标识按百分比路由 (percentage=0 全稳定)', () => {
      const r = routeCanary({ headers: {}, cookies: {}, ip: '3.3.3.3' }, 0)
      expect(r).toBe('stable')
    })
  })

  describe('实例健康检查', () => {
    it('错误率 < 5% 标记为健康', () => {
      expect(checkHealth(0.03).healthy).toBe(true)
    })
    it('错误率 = 5% 仍健康(边界<5%)', () => {
      expect(checkHealth(0.05).healthy).toBe(true)
    })
    it('错误率 > 5% 不健康', () => {
      expect(checkHealth(0.08).healthy).toBe(false)
    })
  })

  describe('自动回滚 (错误率 > 5%)', () => {
    it('错误率 6% 触发回滚', () => {
      expect(shouldRollback(checkHealth(0.06))).toBe(true)
    })
    it('错误率 4% 不回滚', () => {
      expect(shouldRollback(checkHealth(0.04))).toBe(false)
    })
    it('记录失败调用回滚函数', () => {
      const rollback = vi.fn()
      if (shouldRollback(checkHealth(0.1))) rollback()
      expect(rollback).toHaveBeenCalledTimes(1)
    })
  })

  describe('流量比例 (10% / 50% / 100%)', () => {
    it('10% 流量 → 10 canary / 90 stable', () => {
      const r = distributeTraffic(10, 100)
      expect(r.canary).toBe(10)
      expect(r.stable).toBe(90)
    })
    it('50% 流量 → 50/50', () => {
      const r = distributeTraffic(50, 100)
      expect(r.canary).toBe(50)
      expect(r.stable).toBe(50)
    })
    it('100% 流量 → 全部 canary', () => {
      const r = distributeTraffic(100, 100)
      expect(r.canary).toBe(100)
      expect(r.stable).toBe(0)
    })
    it('percentage=0 全部 stable', () => {
      const r = distributeTraffic(0, 100)
      expect(r.canary).toBe(0)
      expect(r.stable).toBe(100)
    })
  })
})
