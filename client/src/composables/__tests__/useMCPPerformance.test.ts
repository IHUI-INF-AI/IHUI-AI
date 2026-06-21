import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useMCPPerformance } from '../useMCPPerformance'

vi.mock('vue', () => ({
  ref: vi.fn((value: any) => ({ value })),
  computed: vi.fn((fn: () => unknown) => ({ value: fn() })),
}))

describe('useMCPPerformance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('状态', () => {
    it('应该返回metrics', () => {
      const { metrics } = useMCPPerformance()
      expect(metrics.value instanceof Map).toBe(true)
    })

    it('应该返回callTimings', () => {
      const { callTimings } = useMCPPerformance()
      expect(callTimings.value instanceof Map).toBe(true)
    })
  })

  describe('recordCallStart', () => {
    it('应该记录调用开始', () => {
      const { recordCallStart, callTimings } = useMCPPerformance()
      
      const startTime = recordCallStart('server1', 'tool1')
      
      expect(typeof startTime).toBe('number')
      expect(callTimings.value.has('server1-tool1')).toBe(true)
    })

    it('应该支持多次调用', () => {
      const { recordCallStart, callTimings } = useMCPPerformance()
      
      recordCallStart('server1', 'tool1')
      recordCallStart('server1', 'tool1')
      
      const timings = callTimings.value.get('server1-tool1')
      expect(timings?.length).toBe(2)
    })
  })

  describe('recordCallEnd', () => {
    it('应该记录成功调用', () => {
      const { recordCallStart, recordCallEnd, metrics } = useMCPPerformance()
      
      const startTime = recordCallStart('server1', 'tool1')
      recordCallEnd('server1', 'tool1', { success: true, data: 'ok' }, startTime)
      
      const metric = metrics.value.get('server1-tool1')
      expect(metric?.callCount).toBe(1)
      expect(metric?.successCount).toBe(1)
      expect(metric?.failureCount).toBe(0)
    })

    it('应该记录失败调用', () => {
      const { recordCallStart, recordCallEnd, metrics } = useMCPPerformance()
      
      const startTime = recordCallStart('server1', 'tool1')
      recordCallEnd('server1', 'tool1', { success: false, error: 'failed' }, startTime)
      
      const metric = metrics.value.get('server1-tool1')
      expect(metric?.callCount).toBe(1)
      expect(metric?.successCount).toBe(0)
      expect(metric?.failureCount).toBe(1)
    })

    it('应该计算响应时间', () => {
      const { recordCallStart, recordCallEnd, metrics } = useMCPPerformance()
      
      const startTime = recordCallStart('server1', 'tool1')
      recordCallEnd('server1', 'tool1', { success: true, data: 'ok' }, startTime)
      
      const metric = metrics.value.get('server1-tool1')
      expect(metric?.averageResponseTime).toBeGreaterThanOrEqual(0)
    })
  })

  describe('getToolMetrics', () => {
    it('应该返回特定工具的指标', () => {
      const { recordCallStart, recordCallEnd, getToolMetrics } = useMCPPerformance()
      
      const startTime = recordCallStart('server1', 'tool1')
      recordCallEnd('server1', 'tool1', { success: true, data: 'ok' }, startTime)
      
      const metric = getToolMetrics('server1', 'tool1')
      expect(metric).not.toBeNull()
      expect(metric?.toolName).toBe('tool1')
    })

    it('应该返回undefined当工具没有指标时', () => {
      const { getToolMetrics } = useMCPPerformance()
      
      const metric = getToolMetrics('unknown', 'unknown')
      expect(metric).toBeUndefined()
    })
  })

  describe('clearMetrics', () => {
    it('应该清除所有指标', () => {
      const { recordCallStart, recordCallEnd, clearMetrics, metrics, callTimings } = useMCPPerformance()
      
      const startTime = recordCallStart('server1', 'tool1')
      recordCallEnd('server1', 'tool1', { success: true, data: 'ok' }, startTime)
      
      clearMetrics()
      
      expect(metrics.value.size).toBe(0)
      expect(callTimings.value.size).toBe(0)
    })
  })

  describe('exportMetrics', () => {
    it('应该导出指标', () => {
      const { exportMetrics } = useMCPPerformance()
      
      const exported = exportMetrics()
      expect(typeof exported).toBe('object')
    })
  })
})
