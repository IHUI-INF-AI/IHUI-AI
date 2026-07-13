import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AvalancheGuard, DEFAULT_AVALANCHE_CONFIG } from '../src/utils/cache-avalanche-guard.js'

describe('cache-avalanche-guard — 缓存雪崩防护', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('DEFAULT_AVALANCHE_CONFIG', () => {
    it('baseTtl=300', () => expect(DEFAULT_AVALANCHE_CONFIG.baseTtl).toBe(300))
    it('jitterPct=0.2', () => expect(DEFAULT_AVALANCHE_CONFIG.jitterPct).toBe(0.2))
    it('maxTtlJitterSec=60', () => expect(DEFAULT_AVALANCHE_CONFIG.maxTtlJitterSec).toBe(60))
    it('preloadAheadSec=30', () => expect(DEFAULT_AVALANCHE_CONFIG.preloadAheadSec).toBe(30))
  })

  describe('ttl 抖动计算', () => {
    it('返回值在 base±20% 范围内', () => {
      const g = new AvalancheGuard({
        ...DEFAULT_AVALANCHE_CONFIG,
        baseTtl: 100,
        maxTtlJitterSec: 60,
      })
      for (let i = 0; i < 100; i++) {
        const t = g.ttl('k1')
        expect(t).toBeGreaterThanOrEqual(80)
        expect(t).toBeLessThanOrEqual(120)
      }
    })
    it('jitterPct=0 时返回 base', () => {
      const g = new AvalancheGuard({ ...DEFAULT_AVALANCHE_CONFIG, jitterPct: 0 })
      expect(g.ttl('k1')).toBe(DEFAULT_AVALANCHE_CONFIG.baseTtl)
    })
    it('base 自定义覆盖默认', () => {
      const g = new AvalancheGuard({ ...DEFAULT_AVALANCHE_CONFIG, jitterPct: 0 })
      expect(g.ttl('k1', 50)).toBe(50)
    })
    it('maxTtlJitterSec 限制抖动上限', () => {
      const g = new AvalancheGuard({
        ...DEFAULT_AVALANCHE_CONFIG,
        baseTtl: 10000,
        jitterPct: 0.2,
        maxTtlJitterSec: 60,
      })
      for (let i = 0; i < 100; i++) {
        const t = g.ttl('k1')
        expect(t).toBeGreaterThanOrEqual(10000 - 60)
        expect(t).toBeLessThanOrEqual(10000 + 60)
      }
    })
    it('返回值至少为 1', () => {
      const g = new AvalancheGuard({
        ...DEFAULT_AVALANCHE_CONFIG,
        baseTtl: 1,
        jitterPct: 1,
        maxTtlJitterSec: 100,
      })
      expect(g.ttl('k1')).toBeGreaterThanOrEqual(1)
    })
  })

  describe('register + tick', () => {
    it('register 追踪 key 过期时间', () => {
      const g = new AvalancheGuard()
      g.register('k1', 300)
      expect(g.getStats().tracked).toBe(1)
    })
    it('tick 在 preloadAheadSec 内触发预热', () => {
      const g = new AvalancheGuard({ ...DEFAULT_AVALANCHE_CONFIG, preloadAheadSec: 30 })
      g.register('k1', 10) // 10 秒后过期，在 30 秒预热窗口内
      const keys = g.tick()
      expect(keys).toEqual(['k1'])
      expect(g.getStats().tracked).toBe(0)
    })
    it('tick 在 preloadAheadSec 外不触发', () => {
      const g = new AvalancheGuard({ ...DEFAULT_AVALANCHE_CONFIG, preloadAheadSec: 30 })
      g.register('k1', 300) // 300 秒后过期，远超 30 秒
      expect(g.tick()).toEqual([])
    })
    it('tick 调用 onPreload 回调', () => {
      const cb = vi.fn()
      const g = new AvalancheGuard({ ...DEFAULT_AVALANCHE_CONFIG, preloadAheadSec: 30 }, cb)
      g.register('k1', 10)
      g.tick()
      expect(cb).toHaveBeenCalledWith('k1')
    })
    it('onPreload 抛错不影响其他 key', () => {
      const cb = vi.fn(() => {
        throw new Error('preload failed')
      })
      const g = new AvalancheGuard({ ...DEFAULT_AVALANCHE_CONFIG, preloadAheadSec: 30 }, cb)
      g.register('k1', 10)
      g.register('k2', 10)
      const keys = g.tick()
      expect(keys).toHaveLength(2)
      expect(g.getStats().prewarmedTotal).toBe(2)
    })
    it('prewarmedTotal 累计', () => {
      const g = new AvalancheGuard({ ...DEFAULT_AVALANCHE_CONFIG, preloadAheadSec: 30 })
      g.register('k1', 10)
      g.tick()
      g.register('k2', 10)
      g.tick()
      expect(g.getStats().prewarmedTotal).toBe(2)
    })
  })

  describe('unregister', () => {
    it('移除追踪的 key', () => {
      const g = new AvalancheGuard()
      g.register('k1', 300)
      g.unregister('k1')
      expect(g.getStats().tracked).toBe(0)
    })
    it('不存在 key 不抛错', () => {
      const g = new AvalancheGuard()
      expect(() => g.unregister('missing')).not.toThrow()
    })
  })
})
