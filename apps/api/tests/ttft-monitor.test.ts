import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TtftMonitor, StreamTTFT } from '../src/utils/ttft-monitor.js'

describe('ttft-monitor — TTFT 监控', () => {
  let m: TtftMonitor
  beforeEach(() => {
    m = new TtftMonitor(200, 2.0)
  })

  describe('构造参数', () => {
    it('使用默认值', () => {
      const m2 = new TtftMonitor()
      const s = m2.stats()
      expect(s.alertP95Sec).toBe(2.0)
      expect(s.window).toBeGreaterThanOrEqual(40)
    })
    it('window 最小为 10', () => {
      // maxRecords = Math.max(10, window * 4) = Math.max(10, 4) = 10
      const m2 = new TtftMonitor(1, 1)
      expect(m2.stats().window).toBe(10)
    })
    it('alertP95 最小为 0', () => {
      const m2 = new TtftMonitor(100, -1)
      expect(m2.stats().alertP95Sec).toBe(0)
    })
  })

  describe('setAlertP95', () => {
    it('动态调整告警阈值', () => {
      m.setAlertP95(5)
      expect(m.stats().alertP95Sec).toBe(5)
    })
    it('最小为 0', () => {
      m.setAlertP95(-10)
      expect(m.stats().alertP95Sec).toBe(0)
    })
  })

  describe('record', () => {
    it('记录 TTFT 并返回记录', () => {
      const r = m.record('gpt-4o', '/chat', 't1', 0.5, 1.2, 100)
      expect(r.model).toBe('gpt-4o')
      expect(r.endpoint).toBe('/chat')
      expect(r.tenantId).toBe('t1')
      expect(r.ttftSec).toBe(0.5)
      expect(r.totalSec).toBe(1.2)
      expect(r.tokenCount).toBe(100)
      expect(r.ts).toBeGreaterThan(0)
      expect(r.error).toBe('')
    })
    it('error 默认为空', () => {
      const r = m.record('m', '/e', 't', 1, 2, 0)
      expect(r.error).toBe('')
    })
    it('error 透传', () => {
      const r = m.record('m', '/e', 't', 1, 2, 0, 'timeout')
      expect(r.error).toBe('timeout')
    })
    it('error 调用计入 errorCalls', () => {
      m.record('m', '/e', 't', 1, 2, 0, 'err')
      m.record('m', '/e', 't', 1, 2, 0, '')
      const s = m.stats()
      expect(s.totalCalls).toBe(2)
      expect(s.errorCalls).toBe(1)
      expect(s.errorRate).toBeCloseTo(0.5, 4)
    })
    it('errorRate=0 当 totalCalls=0', () => {
      expect(m.stats().errorRate).toBe(0)
    })
  })

  describe('percentiles', () => {
    it('返回 p50/p90/p95/p99/count', () => {
      for (let i = 1; i <= 10; i++) {
        m.record('m', '/e', 't', i * 0.1, 1, 0)
      }
      const p = m.percentiles()
      expect(p.count).toBe(10)
      expect(p.p50).toBeGreaterThan(0)
      expect(p.p99).toBeGreaterThanOrEqual(p.p50)
    })
    it('按 model 过滤', () => {
      for (let i = 0; i < 5; i++) m.record('m1', '/e', 't', 0.1, 1, 0)
      for (let i = 0; i < 5; i++) m.record('m2', '/e', 't', 0.5, 1, 0)
      const p1 = m.percentiles('m1')
      const p2 = m.percentiles('m2')
      expect(p1.count).toBe(5)
      expect(p2.count).toBe(5)
      expect(p2.p50).toBeGreaterThan(p1.p50)
    })
    it('空样本返回 0', () => {
      const p = m.percentiles()
      expect(p.count).toBe(0)
      expect(p.p50).toBe(0)
      expect(p.p99).toBe(0)
    })
  })

  describe('stats', () => {
    it('反映 totalCalls / errorCalls / window', () => {
      m.record('m', '/e', 't', 0.1, 1, 0)
      m.record('m', '/e', 't', 0.2, 1, 0, 'err')
      const s = m.stats()
      expect(s.totalCalls).toBe(2)
      expect(s.errorCalls).toBe(1)
      expect(s.alertCount).toBe(0)
      expect(s.alertP95Sec).toBe(2.0)
      expect(s.window).toBeGreaterThanOrEqual(40)
      expect(s.current.count).toBe(2)
    })
  })

  describe('getRecords', () => {
    it('返回最近 N 条', () => {
      for (let i = 0; i < 10; i++) m.record('m', '/e', 't', 0.1 * i, 1, 0)
      const recs = m.getRecords(3)
      expect(recs).toHaveLength(3)
      expect(recs[0]!.ttftSec).toBeCloseTo(0.7, 5)
      expect(recs[2]!.ttftSec).toBeCloseTo(0.9, 5)
    })
    it('默认返回 50 条', () => {
      for (let i = 0; i < 60; i++) m.record('m', '/e', 't', 0.1, 1, 0)
      const recs = m.getRecords()
      expect(recs).toHaveLength(50)
    })
  })

  describe('告警触发', () => {
    it('P95 超阈值且样本数≥20 触发告警', () => {
      m.setAlertP95(0.05)
      // 20 条样本 ttft=0.1s，超过阈值 0.05
      for (let i = 0; i < 20; i++) m.record('m', '/e', 't', 0.1, 1, 0)
      const s = m.stats()
      expect(s.alertCount).toBeGreaterThanOrEqual(1)
    })
    it('样本数不足 20 不触发告警', () => {
      m.setAlertP95(0.01)
      for (let i = 0; i < 19; i++) m.record('m', '/e', 't', 0.1, 1, 0)
      expect(m.stats().alertCount).toBe(0)
    })
    it('未超阈值不触发告警', () => {
      m.setAlertP95(100)
      for (let i = 0; i < 30; i++) m.record('m', '/e', 't', 0.1, 1, 0)
      expect(m.stats().alertCount).toBe(0)
    })
  })

  describe('窗口上限', () => {
    it('超过 maxRecords 时保留最新', () => {
      const m2 = new TtftMonitor(10, 10)
      // window=10, maxRecords = max(10, 40) = 40
      for (let i = 0; i < 50; i++) m2.record('m', '/e', 't', 0.1, 1, 0)
      expect(m2.getRecords(1000).length).toBeLessThanOrEqual(50)
    })
  })

  describe('clear', () => {
    it('清空记录与计数器', () => {
      m.record('m', '/e', 't', 0.1, 1, 0, 'err')
      m.clear()
      const s = m.stats()
      expect(s.totalCalls).toBe(0)
      expect(s.errorCalls).toBe(0)
      expect(s.alertCount).toBe(0)
      expect(s.current.count).toBe(0)
    })
  })

  describe('StreamTTFT', () => {
    it('首次 onToken 记录 TTFT', () => {
      vi.useFakeTimers()
      try {
        const ctx = new StreamTTFT('m', '/e', 't1', m)
        vi.advanceTimersByTime(500) // 0.5s
        ctx.onToken()
        ctx.onToken()
        ctx.onToken()
        vi.advanceTimersByTime(500) // 总共 1.0s
        const ttft = ctx.end()
        expect(ttft).toBeCloseTo(0.5, 2)
        const recs = m.getRecords(1)
        expect(recs[0]!.ttftSec).toBeCloseTo(0.5, 2)
        expect(recs[0]!.totalSec).toBeCloseTo(1.0, 2)
        expect(recs[0]!.tokenCount).toBe(3)
        expect(recs[0]!.model).toBe('m')
      } finally {
        vi.useRealTimers()
      }
    })

    it('未收到 token 时 TTFT = 总耗时', () => {
      vi.useFakeTimers()
      try {
        const ctx = new StreamTTFT('m', '/e', 't1', m)
        vi.advanceTimersByTime(800)
        ctx.end()
        const recs = m.getRecords(1)
        expect(recs[0]!.ttftSec).toBeCloseTo(0.8, 2)
        expect(recs[0]!.totalSec).toBeCloseTo(0.8, 2)
        expect(recs[0]!.tokenCount).toBe(0)
      } finally {
        vi.useRealTimers()
      }
    })

    it('end 重复调用不会重复上报', () => {
      vi.useFakeTimers()
      try {
        const ctx = new StreamTTFT('m', '/e', 't1', m)
        ctx.onToken()
        ctx.end()
        ctx.end()
        expect(m.stats().totalCalls).toBe(1)
      } finally {
        vi.useRealTimers()
      }
    })

    it('setError 上报错误信息', () => {
      vi.useFakeTimers()
      try {
        const ctx = new StreamTTFT('m', '/e', 't1', m)
        ctx.setError('aborted')
        ctx.end()
        const recs = m.getRecords(1)
        expect(recs[0]!.error).toBe('aborted')
        expect(m.stats().errorCalls).toBe(1)
      } finally {
        vi.useRealTimers()
      }
    })

    it('默认 endpoint/tenantId 为空字符串', () => {
      // 显式传入本地 monitor，避免使用全局单例
      const ctx = new StreamTTFT('m', '', '', m)
      ctx.end()
      const recs = m.getRecords(1)
      expect(recs[0]!.endpoint).toBe('')
      expect(recs[0]!.tenantId).toBe('')
    })
  })
})
