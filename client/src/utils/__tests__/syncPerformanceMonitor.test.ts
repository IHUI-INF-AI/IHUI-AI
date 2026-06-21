import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('syncPerformanceMonitor', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetModules()
  })

  describe('startOperation', () => {
    it('应该返回操作 ID', async () => {
      const { syncPerformanceMonitor } = await import('../syncPerformanceMonitor')
      const id = syncPerformanceMonitor.startOperation('upload')
      expect(id).toBeDefined()
      expect(id.startsWith('perf-')).toBe(true)
      syncPerformanceMonitor.clearMetrics()
    })

    it('应该为不同操作返回不同 ID', async () => {
      const { syncPerformanceMonitor } = await import('../syncPerformanceMonitor')
      const id1 = syncPerformanceMonitor.startOperation('upload')
      const id2 = syncPerformanceMonitor.startOperation('download')
      expect(id1).not.toBe(id2)
      syncPerformanceMonitor.clearMetrics()
    })
  })

  describe('endOperation', () => {
    it('应该记录成功的操作', async () => {
      const { syncPerformanceMonitor } = await import('../syncPerformanceMonitor')
      const id = syncPerformanceMonitor.startOperation('upload')
      vi.advanceTimersByTime(100)
      
      const metric = syncPerformanceMonitor.endOperation(id, true, 1024)
      
      expect(metric).toBeDefined()
      expect(metric?.success).toBe(true)
      expect(metric?.dataSize).toBe(1024)
      expect(metric?.duration).toBeGreaterThanOrEqual(0)
      syncPerformanceMonitor.clearMetrics()
    })

    it('应该记录失败的操作', async () => {
      const { syncPerformanceMonitor } = await import('../syncPerformanceMonitor')
      const id = syncPerformanceMonitor.startOperation('upload')
      vi.advanceTimersByTime(50)
      
      const metric = syncPerformanceMonitor.endOperation(id, false, 0, 'Network error')
      
      expect(metric).toBeDefined()
      expect(metric?.success).toBe(false)
      expect(metric?.errorMessage).toBe('Network error')
      syncPerformanceMonitor.clearMetrics()
    })

    it('无效 ID 应返回 null', async () => {
      const { syncPerformanceMonitor } = await import('../syncPerformanceMonitor')
      const metric = syncPerformanceMonitor.endOperation('invalid-id', true, 0)
      expect(metric).toBeNull()
      syncPerformanceMonitor.clearMetrics()
    })
  })

  describe('cancelOperation', () => {
    it('应该取消当前操作', async () => {
      const { syncPerformanceMonitor } = await import('../syncPerformanceMonitor')
      const id = syncPerformanceMonitor.startOperation('upload')
      syncPerformanceMonitor.cancelOperation(id)
      
      const metric = syncPerformanceMonitor.endOperation(id, true, 0)
      expect(metric).toBeNull()
      syncPerformanceMonitor.clearMetrics()
    })
  })

  describe('getMetrics', () => {
    it('应该返回所有指标', async () => {
      const { syncPerformanceMonitor } = await import('../syncPerformanceMonitor')
      const id1 = syncPerformanceMonitor.startOperation('upload')
      syncPerformanceMonitor.endOperation(id1, true, 1024)
      
      const id2 = syncPerformanceMonitor.startOperation('download')
      syncPerformanceMonitor.endOperation(id2, true, 2048)
      
      const metrics = syncPerformanceMonitor.getMetrics()
      expect(metrics.length).toBe(2)
      syncPerformanceMonitor.clearMetrics()
    })

    it('应该限制返回数量', async () => {
      const { syncPerformanceMonitor } = await import('../syncPerformanceMonitor')
      for (let i = 0; i < 10; i++) {
        const id = syncPerformanceMonitor.startOperation('upload')
        syncPerformanceMonitor.endOperation(id, true, 1024)
      }
      
      const metrics = syncPerformanceMonitor.getMetrics(5)
      expect(metrics.length).toBe(5)
      syncPerformanceMonitor.clearMetrics()
    })
  })

  describe('getMetricsByOperation', () => {
    it('应该按操作类型过滤', async () => {
      const { syncPerformanceMonitor } = await import('../syncPerformanceMonitor')
      const id1 = syncPerformanceMonitor.startOperation('upload')
      syncPerformanceMonitor.endOperation(id1, true, 1024)
      
      const id2 = syncPerformanceMonitor.startOperation('download')
      syncPerformanceMonitor.endOperation(id2, true, 2048)
      
      const uploads = syncPerformanceMonitor.getMetricsByOperation('upload')
      expect(uploads.length).toBe(1)
      expect(uploads[0].operation).toBe('upload')
      syncPerformanceMonitor.clearMetrics()
    })
  })

  describe('getStats', () => {
    it('应该返回正确的统计信息', async () => {
      const { syncPerformanceMonitor } = await import('../syncPerformanceMonitor')
      const id1 = syncPerformanceMonitor.startOperation('upload')
      vi.advanceTimersByTime(100)
      syncPerformanceMonitor.endOperation(id1, true, 1024)
      
      const id2 = syncPerformanceMonitor.startOperation('upload')
      vi.advanceTimersByTime(50)
      syncPerformanceMonitor.endOperation(id2, false, 0)
      
      const stats = syncPerformanceMonitor.getStats()
      
      expect(stats.totalOperations).toBe(2)
      expect(stats.successfulOperations).toBe(1)
      expect(stats.failedOperations).toBe(1)
      expect(stats.successRate).toBe(50)
      syncPerformanceMonitor.clearMetrics()
    })

    it('无指标时应返回零值', async () => {
      const { syncPerformanceMonitor } = await import('../syncPerformanceMonitor')
      const stats = syncPerformanceMonitor.getStats()
      
      expect(stats.totalOperations).toBe(0)
      expect(stats.averageDuration).toBe(0)
      expect(stats.successRate).toBe(0)
      syncPerformanceMonitor.clearMetrics()
    })
  })

  describe('getRecentPerformance', () => {
    it('应该返回最近性能统计', async () => {
      const { syncPerformanceMonitor } = await import('../syncPerformanceMonitor')
      const id = syncPerformanceMonitor.startOperation('upload')
      syncPerformanceMonitor.endOperation(id, true, 1024)
      
      const stats = syncPerformanceMonitor.getRecentPerformance(60)
      
      expect(stats.totalOperations).toBe(1)
      expect(stats.successRate).toBe(100)
      syncPerformanceMonitor.clearMetrics()
    })
  })

  describe('clearMetrics', () => {
    it('应该清除所有指标', async () => {
      const { syncPerformanceMonitor } = await import('../syncPerformanceMonitor')
      const id = syncPerformanceMonitor.startOperation('upload')
      syncPerformanceMonitor.endOperation(id, true, 1024)
      
      syncPerformanceMonitor.clearMetrics()
      
      const metrics = syncPerformanceMonitor.getMetrics()
      expect(metrics.length).toBe(0)
    })
  })

  describe('exportMetrics', () => {
    it('应该导出 JSON 格式数据', async () => {
      const { syncPerformanceMonitor } = await import('../syncPerformanceMonitor')
      const id = syncPerformanceMonitor.startOperation('upload')
      syncPerformanceMonitor.endOperation(id, true, 1024)
      
      const exported = syncPerformanceMonitor.exportMetrics()
      const parsed = JSON.parse(exported)
      
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed.length).toBe(1)
      syncPerformanceMonitor.clearMetrics()
    })
  })

  describe('generateReport', () => {
    it('应该生成报告', async () => {
      const { syncPerformanceMonitor } = await import('../syncPerformanceMonitor')
      const id = syncPerformanceMonitor.startOperation('upload')
      syncPerformanceMonitor.endOperation(id, true, 1024)
      
      const report = syncPerformanceMonitor.generateReport()
      
      expect(report).toContain('同步性能报告')
      expect(report).toContain('总体统计')
      syncPerformanceMonitor.clearMetrics()
    })
  })
})
