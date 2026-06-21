import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockStore: Record<string, string> = {}

vi.stubGlobal('localStorage', {
  getItem: (key: string) => mockStore[key] || null,
  setItem: (key: string, value: string) => { mockStore[key] = value },
  removeItem: (key: string) => { delete mockStore[key] },
  clear: () => { Object.keys(mockStore).forEach(k => delete mockStore[k]) }
})

describe('themePerformance', () => {
  beforeEach(async () => {
    vi.useFakeTimers()
    Object.keys(mockStore).forEach(k => delete mockStore[k])
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('themePerformanceMonitor 单例', () => {
    it('应该导出单例实例', async () => {
      vi.resetModules()
      const { themePerformanceMonitor } = await import('../themePerformance')
      expect(themePerformanceMonitor).toBeDefined()
    })

    it('应该有setThresholds方法', async () => {
      vi.resetModules()
      const { themePerformanceMonitor } = await import('../themePerformance')
      themePerformanceMonitor.setThresholds({ good: 50, warning: 100, poor: 200 })
      expect(themePerformanceMonitor).toBeDefined()
    })

    it('应该有setAlertHandler方法', async () => {
      vi.resetModules()
      const { themePerformanceMonitor } = await import('../themePerformance')
      const handler = vi.fn()
      themePerformanceMonitor.setAlertHandler(handler)
      expect(themePerformanceMonitor).toBeDefined()
    })

    it('应该能清除告警处理器', async () => {
      vi.resetModules()
      const { themePerformanceMonitor } = await import('../themePerformance')
      themePerformanceMonitor.setAlertHandler(null)
      expect(themePerformanceMonitor).toBeDefined()
    })
  })

  describe('startSwitch 和 endSwitch', () => {
    it('应该记录主题切换', async () => {
      vi.resetModules()
      const { themePerformanceMonitor } = await import('../themePerformance')
      themePerformanceMonitor.clearMetrics()
      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(100)

      vi.spyOn(document, 'querySelectorAll').mockReturnValue([] as unknown as Element[])

      themePerformanceMonitor.startSwitch('light')
      const metric = themePerformanceMonitor.endSwitch('dark')

      expect(metric.fromMode).toBe('light')
      expect(metric.toMode).toBe('dark')
      expect(metric.duration).toBe(100)
    })

    it('应该触发poor告警', async () => {
      vi.resetModules()
      const { themePerformanceMonitor } = await import('../themePerformance')
      themePerformanceMonitor.clearMetrics()
      const handler = vi.fn()
      themePerformanceMonitor.setAlertHandler(handler)
      themePerformanceMonitor.setThresholds({ good: 10, warning: 50, poor: 100 })

      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(200)

      vi.spyOn(document, 'querySelectorAll').mockReturnValue([] as unknown as Element[])

      themePerformanceMonitor.startSwitch('light')
      themePerformanceMonitor.endSwitch('dark')

      expect(handler).toHaveBeenCalled()
    })

    it('不应该在性能良好时触发告警', async () => {
      vi.resetModules()
      const { themePerformanceMonitor } = await import('../themePerformance')
      themePerformanceMonitor.clearMetrics()
      const handler = vi.fn()
      themePerformanceMonitor.setAlertHandler(handler)
      themePerformanceMonitor.setThresholds({ good: 500, warning: 1000, poor: 2000 })

      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(50)

      vi.spyOn(document, 'querySelectorAll').mockReturnValue([] as unknown as Element[])

      themePerformanceMonitor.startSwitch('light')
      themePerformanceMonitor.endSwitch('dark')

      expect(handler).not.toHaveBeenCalled()
    })

    it('应该记录内存使用', async () => {
      vi.resetModules()
      const { themePerformanceMonitor } = await import('../themePerformance')
      themePerformanceMonitor.clearMetrics()
      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(100)

      Object.defineProperty(performance, 'memory', {
        value: { usedJSHeapSize: 12345678 },
        writable: true,
        configurable: true
      })

      vi.spyOn(document, 'querySelectorAll').mockReturnValue([] as unknown as Element[])

      themePerformanceMonitor.startSwitch('light')
      const metric = themePerformanceMonitor.endSwitch('dark')

      expect(metric.memoryUsage).toBe(12345678)
      delete (performance as unknown as { memory?: any }).memory
    })
  })

  describe('getReport', () => {
    it('应该返回报告', async () => {
      vi.resetModules()
      const { themePerformanceMonitor } = await import('../themePerformance')
      themePerformanceMonitor.clearMetrics()
      const report = themePerformanceMonitor.getReport()
      expect(report).toBeDefined()
      expect(report.totalSwitches).toBeDefined()
    })
  })

  describe('getMetrics', () => {
    it('应该返回指标数组', async () => {
      vi.resetModules()
      const { themePerformanceMonitor } = await import('../themePerformance')
      themePerformanceMonitor.clearMetrics()
      const metrics = themePerformanceMonitor.getMetrics()
      expect(Array.isArray(metrics)).toBe(true)
    })
  })

  describe('clearMetrics', () => {
    it('应该清除所有指标', async () => {
      vi.resetModules()
      const { themePerformanceMonitor } = await import('../themePerformance')
      themePerformanceMonitor.clearMetrics()
      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(100)

      vi.spyOn(document, 'querySelectorAll').mockReturnValue([] as unknown as Element[])

      themePerformanceMonitor.startSwitch('light')
      themePerformanceMonitor.endSwitch('dark')

      themePerformanceMonitor.clearMetrics()
      expect(themePerformanceMonitor.getMetrics()).toHaveLength(0)
    })
  })

  describe('isPerformanceGood', () => {
    it('应该返回布尔值', async () => {
      vi.resetModules()
      const { themePerformanceMonitor } = await import('../themePerformance')
      themePerformanceMonitor.clearMetrics()
      const result = themePerformanceMonitor.isPerformanceGood()
      expect(typeof result).toBe('boolean')
    })
  })

  describe('getPerformanceScore', () => {
    it('应该返回分数', async () => {
      vi.resetModules()
      const { themePerformanceMonitor } = await import('../themePerformance')
      themePerformanceMonitor.clearMetrics()
      const score = themePerformanceMonitor.getPerformanceScore()
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    })
  })

  describe('getPerformanceRating', () => {
    it('应该返回评级', async () => {
      vi.resetModules()
      const { themePerformanceMonitor } = await import('../themePerformance')
      themePerformanceMonitor.clearMetrics()
      const rating = themePerformanceMonitor.getPerformanceRating()
      expect(['good', 'warning', 'poor']).toContain(rating)
    })
  })

  describe('exportReport', () => {
    it('应该导出报告', async () => {
      vi.resetModules()
      const { themePerformanceMonitor } = await import('../themePerformance')
      themePerformanceMonitor.clearMetrics()
      const report = themePerformanceMonitor.exportReport()
      expect(typeof report).toBe('string')
      const parsed = JSON.parse(report)
      expect(parsed).toHaveProperty('score')
      expect(parsed).toHaveProperty('rating')
    })
  })

  describe('getStatistics', () => {
    it('应该返回统计数据', async () => {
      vi.resetModules()
      const { themePerformanceMonitor } = await import('../themePerformance')
      themePerformanceMonitor.clearMetrics()
      const stats = themePerformanceMonitor.getStatistics()
      expect(stats).toBeDefined()
      expect(stats.minDuration).toBeDefined()
      expect(stats.maxDuration).toBeDefined()
    })
  })

  describe('服务器端渲染', () => {
    it('应该处理undefined window', async () => {
      const originalWindow = global.window
      Object.defineProperty(global, 'window', { value: undefined, writable: true })
      vi.resetModules()
      const { themePerformanceMonitor } = await import('../themePerformance')
      expect(themePerformanceMonitor).toBeDefined()
      Object.defineProperty(global, 'window', { value: originalWindow, writable: true })
    })
  })

  // 补充测试：setThresholds 部分更新
  describe('setThresholds 部分更新', () => {
    it('部分更新应该保留其他字段为默认值', async () => {
      vi.resetModules()
      const { themePerformanceMonitor } = await import('../themePerformance')
      themePerformanceMonitor.clearMetrics()
      themePerformanceMonitor.setThresholds({ good: 5 })
      const handler = vi.fn()
      themePerformanceMonitor.setAlertHandler(handler)
      // duration=50 > 5(已改) 且 <= 200(默认warning)，应触发 warning
      vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(50)
      vi.spyOn(document, 'querySelectorAll').mockReturnValue([] as unknown as Element[])
      themePerformanceMonitor.startSwitch('light')
      themePerformanceMonitor.endSwitch('dark')
      expect(handler.mock.calls[0][0].type).toBe('warning')
    })
  })

  // 补充测试：endSwitch 性能指标详细
  describe('endSwitch 性能指标', () => {
    // 应该记录paintTime
    it('应该记录paintTime', async () => {
      vi.resetModules()
      const { themePerformanceMonitor } = await import('../themePerformance')
      themePerformanceMonitor.clearMetrics()
      vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(100)
      vi.spyOn(performance, 'getEntriesByType').mockReturnValue([
        { name: 'first-paint', entryType: 'paint', startTime: 30, duration: 0, toJSON: () => ({}) }
      ] as unknown as PerformanceEntry[])
      vi.spyOn(document, 'querySelectorAll').mockReturnValue([] as unknown as Element[])
      themePerformanceMonitor.startSwitch('light')
      const metric = themePerformanceMonitor.endSwitch('dark')
      expect(metric.paintTime).toBe(30)
    })

    // 应该记录renderTime
    it('应该记录renderTime', async () => {
      vi.resetModules()
      const { themePerformanceMonitor } = await import('../themePerformance')
      themePerformanceMonitor.clearMetrics()
      vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(100)
      vi.spyOn(performance, 'getEntriesByName').mockReturnValue([
        { name: 'theme-switch-x', entryType: 'measure', startTime: 0, duration: 25, toJSON: () => ({}) }
      ] as unknown as PerformanceEntry[])
      vi.spyOn(document, 'querySelectorAll').mockReturnValue([] as unknown as Element[])
      themePerformanceMonitor.startSwitch('light')
      const metric = themePerformanceMonitor.endSwitch('dark')
      expect(metric.renderTime).toBe(25)
    })

    // 超过最大数量时截断
    it('应该截断超过最大数量的指标', async () => {
      vi.resetModules()
      const { themePerformanceMonitor } = await import('../themePerformance')
      themePerformanceMonitor.clearMetrics()
      vi.spyOn(performance, 'now').mockReturnValue(100)
      vi.spyOn(document, 'querySelectorAll').mockReturnValue([] as unknown as Element[])
      for (let i = 0; i < 105; i++) {
        themePerformanceMonitor.startSwitch('light')
        themePerformanceMonitor.endSwitch('dark')
      }
      expect(themePerformanceMonitor.getMetrics().length).toBe(100)
    })
  })

  // 补充测试：triggerAlert 警告级别
  describe('triggerAlert 警告级别', () => {
    it('应该触发warning告警', async () => {
      vi.resetModules()
      const { themePerformanceMonitor } = await import('../themePerformance')
      themePerformanceMonitor.clearMetrics()
      const handler = vi.fn()
      themePerformanceMonitor.setAlertHandler(handler)
      themePerformanceMonitor.setThresholds({ good: 10, warning: 50, poor: 100 })
      // duration=30 > 10(good) 且 <= 50(warning)
      vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(30)
      vi.spyOn(document, 'querySelectorAll').mockReturnValue([] as unknown as Element[])
      themePerformanceMonitor.startSwitch('light')
      themePerformanceMonitor.endSwitch('dark')
      expect(handler).toHaveBeenCalled()
      expect(handler.mock.calls[0][0].type).toBe('warning')
      expect(handler.mock.calls[0][0].message).toContain('需要优化')
    })
  })

  // 补充测试：localStorage 加载和保存错误处理
  describe('存储加载与保存', () => {
    // 从localStorage加载已保存的指标
    it('应该从localStorage加载已保存的指标', async () => {
      mockStore['theme-performance-metrics'] = JSON.stringify([{
        timestamp: 1000, fromMode: 'light', toMode: 'dark',
        duration: 50, renderTime: 10, paintTime: 20, domElements: 100
      }])
      vi.resetModules()
      const { themePerformanceMonitor } = await import('../themePerformance')
      const metrics = themePerformanceMonitor.getMetrics()
      expect(metrics).toHaveLength(1)
      expect(metrics[0].fromMode).toBe('light')
      expect(metrics[0].duration).toBe(50)
    })

    // JSON解析失败时回退到空数组
    it('JSON解析失败时应该回退到空数组', async () => {
      mockStore['theme-performance-metrics'] = '{ invalid json'
      vi.resetModules()
      const { themePerformanceMonitor } = await import('../themePerformance')
      expect(themePerformanceMonitor.getMetrics()).toHaveLength(0)
    })

    // 存储满时降级
    it('存储满时应该降级到一半数量', async () => {
      vi.resetModules()
      const { themePerformanceMonitor } = await import('../themePerformance')
      themePerformanceMonitor.clearMetrics()
      const setItemSpy = vi.spyOn(localStorage, 'setItem')
        .mockImplementationOnce(() => { throw new Error('quota exceeded') })
      vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(100)
      vi.spyOn(document, 'querySelectorAll').mockReturnValue([] as unknown as Element[])
      themePerformanceMonitor.startSwitch('light')
      themePerformanceMonitor.endSwitch('dark')
      // 外层 setItem 抛错后降级，内层 setItem 会再次调用
      expect(setItemSpy.mock.calls.length).toBeGreaterThanOrEqual(2)
    })
  })

  // 补充测试：getReport 有数据
  describe('getReport 有数据', () => {
    it('应该正确计算平均值和最后切换', async () => {
      vi.resetModules()
      const { themePerformanceMonitor } = await import('../themePerformance')
      themePerformanceMonitor.clearMetrics()
      vi.spyOn(performance, 'now').mockReturnValue(100)
      vi.spyOn(document, 'querySelectorAll').mockReturnValue([] as unknown as Element[])
      for (let i = 0; i < 3; i++) {
        themePerformanceMonitor.startSwitch('light')
        themePerformanceMonitor.endSwitch('dark')
      }
      const report = themePerformanceMonitor.getReport()
      expect(report.totalSwitches).toBe(3)
      expect(report.lastSwitch).not.toBeNull()
      expect(report.lastSwitch?.fromMode).toBe('light')
      expect(report.metrics).toHaveLength(3)
    })
  })

  // 补充测试：isPerformanceGood 多次切换判断
  describe('isPerformanceGood 多次切换', () => {
    it('平均耗时低于warning阈值应该返回true', async () => {
      vi.resetModules()
      const { themePerformanceMonitor } = await import('../themePerformance')
      themePerformanceMonitor.clearMetrics()
      themePerformanceMonitor.setThresholds({ good: 10, warning: 100, poor: 200 })
      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(0).mockReturnValueOnce(10)
        .mockReturnValueOnce(0).mockReturnValueOnce(20)
        .mockReturnValueOnce(0).mockReturnValueOnce(30)
      vi.spyOn(document, 'querySelectorAll').mockReturnValue([] as unknown as Element[])
      for (let i = 0; i < 3; i++) {
        themePerformanceMonitor.startSwitch('light')
        themePerformanceMonitor.endSwitch('dark')
      }
      expect(themePerformanceMonitor.isPerformanceGood()).toBe(true)
    })

    it('平均耗时高于warning阈值应该返回false', async () => {
      vi.resetModules()
      const { themePerformanceMonitor } = await import('../themePerformance')
      themePerformanceMonitor.clearMetrics()
      themePerformanceMonitor.setThresholds({ good: 10, warning: 50, poor: 200 })
      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(0).mockReturnValueOnce(500)
        .mockReturnValueOnce(0).mockReturnValueOnce(500)
        .mockReturnValueOnce(0).mockReturnValueOnce(500)
      vi.spyOn(document, 'querySelectorAll').mockReturnValue([] as unknown as Element[])
      for (let i = 0; i < 3; i++) {
        themePerformanceMonitor.startSwitch('light')
        themePerformanceMonitor.endSwitch('dark')
      }
      expect(themePerformanceMonitor.isPerformanceGood()).toBe(false)
    })
  })

  // 补充测试：getPerformanceScore 有数据
  describe('getPerformanceScore 有数据', () => {
    it('应该基于耗时计算分数', async () => {
      vi.resetModules()
      const { themePerformanceMonitor } = await import('../themePerformance')
      themePerformanceMonitor.clearMetrics()
      // duration=500: durationScore = max(0, 100-50) = 50
      // renderTime=0: renderScore = 100
      // score = round((50+100)/2) = 75
      vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(500)
      vi.spyOn(document, 'querySelectorAll').mockReturnValue([] as unknown as Element[])
      themePerformanceMonitor.startSwitch('light')
      themePerformanceMonitor.endSwitch('dark')
      expect(themePerformanceMonitor.getPerformanceScore()).toBe(75)
    })
  })

  // 补充测试：getPerformanceRating warning/poor 级别
  describe('getPerformanceRating 级别', () => {
    it('中等耗时应该返回warning', async () => {
      vi.resetModules()
      const { themePerformanceMonitor } = await import('../themePerformance')
      themePerformanceMonitor.clearMetrics()
      // duration=700: durationScore = 30
      // renderTime=0: renderScore = 100
      // score = 65, 介于 50-80 之间，应为 warning
      vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(700)
      vi.spyOn(document, 'querySelectorAll').mockReturnValue([] as unknown as Element[])
      themePerformanceMonitor.startSwitch('light')
      themePerformanceMonitor.endSwitch('dark')
      expect(themePerformanceMonitor.getPerformanceRating()).toBe('warning')
    })

    it('高耗时应该返回poor', async () => {
      vi.resetModules()
      const { themePerformanceMonitor } = await import('../themePerformance')
      themePerformanceMonitor.clearMetrics()
      // duration=2000: durationScore = 0
      // renderTime=1000: renderScore = 0
      // score = 0, 应为 poor
      vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(2000)
      vi.spyOn(performance, 'getEntriesByName').mockReturnValue([
        { name: 'theme-switch-x', entryType: 'measure', startTime: 0, duration: 1000, toJSON: () => ({}) }
      ] as unknown as PerformanceEntry[])
      vi.spyOn(document, 'querySelectorAll').mockReturnValue([] as unknown as Element[])
      themePerformanceMonitor.startSwitch('light')
      themePerformanceMonitor.endSwitch('dark')
      expect(themePerformanceMonitor.getPerformanceRating()).toBe('poor')
    })
  })

  // 补充测试：exportReport 完整结构
  describe('exportReport 完整结构', () => {
    it('导出报告应该包含所有字段', async () => {
      vi.resetModules()
      const { themePerformanceMonitor } = await import('../themePerformance')
      themePerformanceMonitor.clearMetrics()
      vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(100)
      vi.spyOn(document, 'querySelectorAll').mockReturnValue([] as unknown as Element[])
      themePerformanceMonitor.startSwitch('light')
      themePerformanceMonitor.endSwitch('dark')
      const parsed = JSON.parse(themePerformanceMonitor.exportReport())
      expect(parsed).toHaveProperty('metrics')
      expect(parsed).toHaveProperty('averageDuration')
      expect(parsed).toHaveProperty('totalSwitches')
      expect(parsed).toHaveProperty('score')
      expect(parsed).toHaveProperty('rating')
      expect(parsed).toHaveProperty('thresholds')
      expect(parsed).toHaveProperty('exportedAt')
    })
  })

  // 补充测试：getStatistics 有数据
  describe('getStatistics 有数据', () => {
    it('应该正确计算min/max/median/p95', async () => {
      vi.resetModules()
      const { themePerformanceMonitor } = await import('../themePerformance')
      themePerformanceMonitor.clearMetrics()
      // 构造 5 个不同 duration：10,20,30,40,50
      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(0).mockReturnValueOnce(10)
        .mockReturnValueOnce(0).mockReturnValueOnce(20)
        .mockReturnValueOnce(0).mockReturnValueOnce(30)
        .mockReturnValueOnce(0).mockReturnValueOnce(40)
        .mockReturnValueOnce(0).mockReturnValueOnce(50)
      vi.spyOn(document, 'querySelectorAll').mockReturnValue([] as unknown as Element[])
      for (let i = 0; i < 5; i++) {
        themePerformanceMonitor.startSwitch('light')
        themePerformanceMonitor.endSwitch('dark')
      }
      const stats = themePerformanceMonitor.getStatistics()
      expect(stats.minDuration).toBe(10)
      expect(stats.maxDuration).toBe(50)
      expect(stats.medianDuration).toBe(30)
    })

    it('偶数个数据时中位数应该取中间两个的平均', async () => {
      vi.resetModules()
      const { themePerformanceMonitor } = await import('../themePerformance')
      themePerformanceMonitor.clearMetrics()
      // 构造 4 个：10,20,30,40
      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(0).mockReturnValueOnce(10)
        .mockReturnValueOnce(0).mockReturnValueOnce(20)
        .mockReturnValueOnce(0).mockReturnValueOnce(30)
        .mockReturnValueOnce(0).mockReturnValueOnce(40)
      vi.spyOn(document, 'querySelectorAll').mockReturnValue([] as unknown as Element[])
      for (let i = 0; i < 4; i++) {
        themePerformanceMonitor.startSwitch('light')
        themePerformanceMonitor.endSwitch('dark')
      }
      const stats = themePerformanceMonitor.getStatistics()
      // (20+30)/2 = 25
      expect(stats.medianDuration).toBe(25)
    })
  })

  // 补充测试：SSR 下 endSwitch 调用 saveMetrics 早返回
  describe('SSR 下保存指标', () => {
    it('window未定义时saveMetrics应该直接返回', async () => {
      const originalWindow = global.window
      Object.defineProperty(global, 'window', { value: undefined, writable: true, configurable: true })
      try {
        vi.resetModules()
        const { themePerformanceMonitor } = await import('../themePerformance')
        vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(100)
        vi.spyOn(document, 'querySelectorAll').mockReturnValue([] as unknown as Element[])
        themePerformanceMonitor.startSwitch('light')
        // 不应抛出错误
        expect(() => themePerformanceMonitor.endSwitch('dark')).not.toThrow()
      } finally {
        Object.defineProperty(global, 'window', { value: originalWindow, writable: true, configurable: true })
      }
    })
  })
})
