import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock http 客户端
vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

import http from '@/utils/request'
import { useBi } from '../useBi'

describe('useBi.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('初始化', () => {
    it('应返回空数组与 null 状态', () => {
      const bi = useBi()
      expect(bi.metrics.value).toEqual([])
      expect(bi.dimensions.value).toEqual([])
      expect(bi.lastReport.value).toBeNull()
      expect(bi.lastDrilldown.value).toBeNull()
      expect(bi.anomalies.value).toEqual([])
      expect(bi.anomalyMeta.value).toBeNull()
      expect(bi.loading.value).toBe(false)
      expect(bi.error.value).toBeNull()
    })
  })

  describe('fetchMetrics', () => {
    it('成功时应写入指标列表', async () => {
      const mockMetrics = [
        { name: 'orders', label: '订单数', unit: '单', aggregator: 'sum' },
        { name: 'gmv_cents', label: '交易额', unit: '分', aggregator: 'sum' },
      ]
      ;(http.get as any).mockResolvedValue({ code: 0, data: mockMetrics })

      const bi = useBi()
      await bi.fetchMetrics()

      expect(http.get).toHaveBeenCalledWith('/api/v1/bi/metrics')
      expect(bi.metrics.value).toEqual(mockMetrics)
      expect(bi.loading.value).toBe(false)
    })

    it('失败时应记录错误信息', async () => {
      ;(http.get as any).mockRejectedValue(new Error('网络异常'))

      const bi = useBi()
      await bi.fetchMetrics()

      expect(bi.error.value).toBe('网络异常')
      expect(bi.loading.value).toBe(false)
    })
  })

  describe('fetchDimensions', () => {
    it('成功时应写入维度列表', async () => {
      const mockDims = [
        { name: 'channel', label: '渠道', value_count: 5 },
        { name: 'category', label: '品类', value_count: 8 },
      ]
      ;(http.get as any).mockResolvedValue({ code: 0, data: mockDims })

      const bi = useBi()
      await bi.fetchDimensions()

      expect(http.get).toHaveBeenCalledWith('/api/v1/bi/dimensions')
      expect(bi.dimensions.value).toEqual(mockDims)
    })
  })

  describe('runReport', () => {
    it('成功时应返回结果并写入 lastReport', async () => {
      const result = {
        columns: ['channel', 'value'],
        rows: [
          { channel: 'app', value: 100 },
          { channel: 'web', value: 50 },
        ],
        total: 2,
        metric: 'orders',
        metric_label: '订单数',
        unit: '单',
        dimensions: ['channel'],
        days: 7,
        limit: 50,
        generated_at: '2026-06-18T00:00:00Z',
      }
      ;(http.post as any).mockResolvedValue({ code: 0, data: result })

      const bi = useBi()
      const out = await bi.runReport({
        metric: 'orders',
        dimensions: ['channel'],
        filters: [],
        days: 7,
        limit: 50,
        order_by: 'value',
        order_dir: 'desc',
      })

      expect(out).toEqual(result)
      expect(bi.lastReport.value).toEqual(result)
    })

    it('业务失败时应返回 null 并写入错误', async () => {
      ;(http.post as any).mockResolvedValue({ code: 1, message: '指标不存在' })

      const bi = useBi()
      const out = await bi.runReport({
        metric: 'unknown',
        dimensions: [],
        filters: [],
        days: 7,
        limit: 50,
        order_by: 'value',
        order_dir: 'desc',
      })

      expect(out).toBeNull()
      expect(bi.error.value).toBe('指标不存在')
    })

    it('网络异常时应返回 null', async () => {
      ;(http.post as any).mockRejectedValue(new Error('超时'))

      const bi = useBi()
      const out = await bi.runReport({
        metric: 'orders',
        dimensions: ['channel'],
        filters: [],
        days: 7,
        limit: 50,
        order_by: 'value',
        order_dir: 'desc',
      })

      expect(out).toBeNull()
      expect(bi.error.value).toBe('超时')
    })
  })

  describe('drilldown', () => {
    it('成功时应返回下钻数据并写入 lastDrilldown', async () => {
      const result = {
        metric: 'orders',
        metric_label: '订单数',
        unit: '单',
        dimension: 'channel',
        value: 'app',
        days: 7,
        series: [
          { date: '2026-06-12', value: 10 },
          { date: '2026-06-13', value: 12 },
        ],
        sub_dimensions: [
          { name: 'category', label: '品类', top: [{ name: 'A', value: 5 }] },
        ],
        total: 22,
        generated_at: '2026-06-18T00:00:00Z',
      }
      ;(http.get as any).mockResolvedValue({ code: 0, data: result })

      const bi = useBi()
      const out = await bi.drilldown('orders', 'channel', 'app', 7)

      expect(http.get).toHaveBeenCalledWith('/api/v1/bi/drilldown', {
        params: { metric: 'orders', dimension: 'channel', value: 'app', days: 7 },
      })
      expect(out).toEqual(result)
      expect(bi.lastDrilldown.value).toEqual(result)
    })
  })

  describe('fetchAnomalies', () => {
    it('成功时应写入异常与元数据', async () => {
      const anomalies = [
        {
          date: '2026-06-10',
          value: 200,
          expected: 100,
          z_score: 3.5,
          direction: 'up',
          severity: 'critical',
          contribution: 100,
          attribution: [],
        },
      ]
      ;(http.get as any).mockResolvedValue({
        code: 0,
        data: { anomalies, metric: 'orders', days: 30, z_threshold: 2.0, count: 1 },
      })

      const bi = useBi()
      const out = await bi.fetchAnomalies('orders', 30, 2.0)

      expect(out).toBeTruthy()
      expect(bi.anomalies.value).toEqual(anomalies)
      expect(bi.anomalyMeta.value).toEqual({
        metric: 'orders',
        days: 30,
        z_threshold: 2.0,
        count: 1,
      })
    })

    it('失败时应返回 null', async () => {
      ;(http.get as any).mockRejectedValue(new Error('服务不可用'))

      const bi = useBi()
      const out = await bi.fetchAnomalies('orders', 30, 2.0)

      expect(out).toBeNull()
      expect(bi.error.value).toBe('服务不可用')
    })
  })

  describe('共享状态', () => {
    it('共享的 loading 应在请求结束后回到 false', async () => {
      ;(http.get as any).mockResolvedValue({ code: 0, data: [] })

      const bi = useBi()
      const p = bi.fetchMetrics()
      expect(bi.loading.value).toBe(true)
      await p
      expect(bi.loading.value).toBe(false)
    })

    it('共享的 error 应在错误请求后写入', async () => {
      ;(http.get as any).mockRejectedValue(new Error('连接失败'))

      const bi = useBi()
      await bi.fetchMetrics()
      expect(bi.error.value).toBe('连接失败')
    })
  })
})
