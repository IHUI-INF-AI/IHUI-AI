import { describe, it, expect, vi } from 'vitest'
import { AlertDeduplicator, DEFAULT_ALERT_CONFIG } from '../src/utils/alert-dedup.js'

describe('alert-dedup — 告警去重聚合', () => {
  describe('DEFAULT_ALERT_CONFIG', () => {
    it('windowSec=60', () => expect(DEFAULT_ALERT_CONFIG.windowSec).toBe(60))
    it('maxCount=1000', () => expect(DEFAULT_ALERT_CONFIG.maxCount).toBe(1000))
    it('sameSeverityOnly=true', () => expect(DEFAULT_ALERT_CONFIG.sameSeverityOnly).toBe(true))
  })

  describe('fingerprint', () => {
    it('相同输入产生相同 fingerprint', () => {
      const a = AlertDeduplicator.fingerprint('crit', { k: 'v' }, 'msg')
      const b = AlertDeduplicator.fingerprint('crit', { k: 'v' }, 'msg')
      expect(a).toBe(b)
    })
    it('labels 顺序不影响 fingerprint', () => {
      const a = AlertDeduplicator.fingerprint('crit', { a: '1', b: '2' }, 'msg')
      const b = AlertDeduplicator.fingerprint('crit', { b: '2', a: '1' }, 'msg')
      expect(a).toBe(b)
    })
    it('不同 severity 产生不同 fingerprint', () => {
      const a = AlertDeduplicator.fingerprint('crit', { k: 'v' }, 'msg')
      const b = AlertDeduplicator.fingerprint('warn', { k: 'v' }, 'msg')
      expect(a).not.toBe(b)
    })
    it('msg 前 64 字符相同则 fingerprint 相同', () => {
      const long1 = 'x'.repeat(64) + 'a'
      const long2 = 'x'.repeat(64) + 'b'
      const a = AlertDeduplicator.fingerprint('crit', {}, long1)
      const b = AlertDeduplicator.fingerprint('crit', {}, long2)
      expect(a).toBe(b)
    })
    it('返回 16 字符 hex', () => {
      const fp = AlertDeduplicator.fingerprint('crit', {}, 'msg')
      expect(fp).toMatch(/^[0-9a-f]{16}$/)
    })
  })

  describe('push 聚合', () => {
    it('首次 push 创建新桶 count=1', () => {
      const d = new AlertDeduplicator()
      const a = d.push('crit', { k: 'v' }, 'msg')
      expect(a.count).toBe(1)
      expect(a.fp).toBeTruthy()
      expect(a.sampleMsg).toBe('msg')
    })
    it('相同 fp 第二次 push count=2', () => {
      const d = new AlertDeduplicator()
      d.push('crit', { k: 'v' }, 'msg')
      const a = d.push('crit', { k: 'v' }, 'msg')
      expect(a.count).toBe(2)
    })
    it('push 时调用 onEmit 回调', () => {
      const calls: number[] = []
      const d = new AlertDeduplicator({}, (a) => calls.push(a.count))
      d.push('crit', {}, 'm1')
      d.push('crit', {}, 'm1')
      expect(calls).toEqual([1, 2])
    })
    it('sameSeverityOnly=true 时不同 severity 覆盖 severity', () => {
      const d = new AlertDeduplicator()
      d.push('warn', {}, 'msg')
      const a = d.push('crit', {}, 'msg')
      expect(a.severity).toBe('crit')
    })
    it('lastTs 更新为最新时间', () => {
      vi.useFakeTimers()
      try {
        const d = new AlertDeduplicator()
        const t1 = Date.now() / 1000
        d.push('crit', {}, 'msg')
        vi.advanceTimersByTime(2000) // 2 秒，超过秒精度
        const a2 = d.push('crit', {}, 'msg')
        const t2 = Date.now() / 1000
        expect(a2.lastTs).toBeGreaterThanOrEqual(t1)
        expect(a2.lastTs).toBe(t2)
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('forceFlush', () => {
    it('返回所有桶并清空', () => {
      const d = new AlertDeduplicator()
      d.push('crit', { a: '1' }, 'm1')
      d.push('crit', { a: '2' }, 'm2')
      const out = d.forceFlush()
      expect(out).toHaveLength(2)
      expect(d.stats().activeBuckets).toBe(0)
    })
  })

  describe('stats', () => {
    it('反映 activeBuckets 与 totalEmitted', () => {
      const d = new AlertDeduplicator()
      d.push('crit', { a: '1' }, 'm1')
      d.push('crit', { a: '1' }, 'm1')
      d.push('crit', { a: '2' }, 'm2')
      const s = d.stats()
      expect(s.activeBuckets).toBe(2)
      expect(s.totalEmitted).toBe(3)
    })
  })

  describe('maxCount 限制', () => {
    it('emitted 数组不超过 maxCount', () => {
      const d = new AlertDeduplicator({ maxCount: 3 })
      d.push('crit', { a: '1' }, 'm1')
      d.push('crit', { a: '2' }, 'm2')
      d.push('crit', { a: '3' }, 'm3')
      d.push('crit', { a: '4' }, 'm4')
      expect(d.stats().totalEmitted).toBe(3)
    })
  })
})
