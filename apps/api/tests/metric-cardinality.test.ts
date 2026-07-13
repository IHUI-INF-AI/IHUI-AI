import { describe, it, expect } from 'vitest'
import { MetricRegistry, DEFAULT_CARDINALITY_CONFIG } from '../src/utils/metric-cardinality.js'

describe('metric-cardinality — 指标基数控制', () => {
  describe('DEFAULT_CARDINALITY_CONFIG', () => {
    it('maxLabelValues=1000', () => {
      expect(DEFAULT_CARDINALITY_CONFIG.maxLabelValues).toBe(1000)
    })
    it('highCardKeys 包含 user_id/phone/email', () => {
      expect(DEFAULT_CARDINALITY_CONFIG.highCardKeys.has('user_id')).toBe(true)
      expect(DEFAULT_CARDINALITY_CONFIG.highCardKeys.has('phone')).toBe(true)
      expect(DEFAULT_CARDINALITY_CONFIG.highCardKeys.has('email')).toBe(true)
    })
    it('bucketCount=64', () => {
      expect(DEFAULT_CARDINALITY_CONFIG.bucketCount).toBe(64)
    })
    it('truncateValue=128', () => {
      expect(DEFAULT_CARDINALITY_CONFIG.truncateValue).toBe(128)
    })
  })

  describe('observe 桶化', () => {
    it('高基数 label 被桶化为 bucket_N', () => {
      const r = new MetricRegistry()
      r.observe('req_count', { user_id: 'u1' }, 1)
      r.observe('req_count', { user_id: 'u2' }, 1)
      // 两个不同 user_id 可能映射到同一桶或不同桶，但 series 数 <= 2
      expect(r.seriesCount('req_count')).toBeLessThanOrEqual(2)
    })
    it('非高基数 label 原值存储', () => {
      const r = new MetricRegistry()
      r.observe('req_count', { method: 'GET' }, 1)
      r.observe('req_count', { method: 'POST' }, 1)
      expect(r.seriesCount('req_count')).toBe(2)
    })
    it('黑名单 label 被丢弃不计入 series', () => {
      const r = new MetricRegistry({ blacklist: new Set(['secret']) })
      r.observe('req_count', { secret: 's1' }, 1)
      expect(r.seriesCount('req_count')).toBe(0)
      expect(r.stats().dropped.secret).toBe(1)
    })
    it('value 过长被截断', () => {
      const r = new MetricRegistry({ truncateValue: 5, highCardKeys: new Set() })
      r.observe('m', { k: 'abcdefghij' }, 1)
      // 截断后 'abcde' 作为存储 key
      expect(r.seriesCount('m')).toBe(1)
    })
  })

  describe('seriesCount', () => {
    it('不存在 metric 返回 0', () => {
      const r = new MetricRegistry()
      expect(r.seriesCount('missing')).toBe(0)
    })
    it('反映当前 series 数量', () => {
      const r = new MetricRegistry({ highCardKeys: new Set() })
      r.observe('m', { k: 'a' }, 1)
      r.observe('m', { k: 'b' }, 1)
      r.observe('m', { k: 'a' }, 1) // 已存在
      expect(r.seriesCount('m')).toBe(2)
    })
  })

  describe('驱逐机制', () => {
    it('超过 maxLabelValues 时驱逐最久未更新', () => {
      const r = new MetricRegistry({
        maxLabelValues: 3,
        highCardKeys: new Set(),
        evictWindowSec: 0, // 每次都检查
      })
      r.observe('m', { k: 'a' }, 1)
      r.observe('m', { k: 'b' }, 1)
      r.observe('m', { k: 'c' }, 1)
      r.observe('m', { k: 'd' }, 1) // 触发驱逐
      expect(r.seriesCount('m')).toBeLessThanOrEqual(3)
      expect(r.stats().dropped.k).toBeGreaterThan(0)
    })
    it('未超限不驱逐', () => {
      const r = new MetricRegistry({
        maxLabelValues: 10,
        highCardKeys: new Set(),
        evictWindowSec: 0,
      })
      r.observe('m', { k: 'a' }, 1)
      r.observe('m', { k: 'b' }, 1)
      expect(r.seriesCount('m')).toBe(2)
      expect(r.stats().dropped.k ?? 0).toBe(0)
    })
  })

  describe('stats', () => {
    it('反映 trackedMetrics 与 dropped', () => {
      const r = new MetricRegistry({ blacklist: new Set(['secret']) })
      r.observe('m1', { k: 'a' }, 1)
      r.observe('m2', { k: 'b' }, 1)
      r.observe('m1', { secret: 'x' }, 1)
      const s = r.stats()
      expect(s.trackedMetrics).toBe(2)
      expect(s.dropped.secret).toBe(1)
    })
  })

  describe('桶化分布', () => {
    it('高基数 label 桶化后 series 数 <= bucketCount', () => {
      const r = new MetricRegistry({ bucketCount: 8 })
      for (let i = 0; i < 1000; i++) {
        r.observe('m', { user_id: `u${i}` }, 1)
      }
      expect(r.seriesCount('m')).toBeLessThanOrEqual(8)
    })
  })
})
