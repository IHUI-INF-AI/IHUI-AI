import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RouteDiagnostics, routeDiagnostics, logGuardStart, logGuardEnd, logRedirect, logStateChange, logRouteError, logRouteWarning, detectRedirectLoop, printRouteDiagnostics, exportRouteDiagnostics } from '../routeDiagnostics'
import type { RouteLocationNormalized } from 'vue-router'

vi.mock('@/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('routeDiagnostics', () => {
  let diagnostics: RouteDiagnostics

  const mockRoute = {
    path: '/test',
    name: 'test',
    query: { q: 'test' },
    params: { id: '123' },
    matched: [],
    fullPath: '/test?q=test',
    hash: '',
    redirectedFrom: null,
    meta: {},
  } as unknown as RouteLocationNormalized

  const mockFromRoute = {
    path: '/from',
    name: 'from',
    query: {},
    params: {},
    matched: [],
    fullPath: '/from',
    hash: '',
    redirectedFrom: null,
    meta: {},
  } as unknown as RouteLocationNormalized

  beforeEach(() => {
    diagnostics = new RouteDiagnostics()
    vi.useFakeTimers()
  })

  afterEach(() => {
    diagnostics.clearLogs()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('RouteDiagnostics', () => {
    describe('log', () => {
      it('应该记录日志', () => {
        diagnostics.log('guard', { action: 'test' })
        const logs = diagnostics.getLogs()
        expect(logs.length).toBe(1)
        expect(logs[0].type).toBe('guard')
        expect(logs[0].data).toEqual({ action: 'test' })
      })

      it('应该限制日志数量', () => {
        for (let i = 0; i < 150; i++) {
          diagnostics.log('guard', { index: i })
        }
        const logs = diagnostics.getLogs()
        expect(logs.length).toBe(100)
      })

      it('应该记录时间戳', () => {
        const before = Date.now()
        diagnostics.log('guard', { action: 'test' })
        const logs = diagnostics.getLogs()
        expect(logs[0].timestamp).toBeGreaterThanOrEqual(before)
      })
    })

    describe('logGuardStart', () => {
      it('应该记录守卫开始', () => {
        diagnostics.logGuardStart(mockRoute, mockFromRoute)
        const logs = diagnostics.getLogs()
        expect(logs.length).toBe(1)
        expect(logs[0].type).toBe('guard')
        expect(logs[0].data.action).toBe('start')
      })
    })

    describe('logGuardEnd', () => {
      it('应该记录守卫结束', () => {
        diagnostics.logGuardStart(mockRoute, mockFromRoute)
        vi.advanceTimersByTime(100)
        diagnostics.logGuardEnd(mockRoute, mockFromRoute, 'next')
        const logs = diagnostics.getLogs()
        expect(logs.length).toBe(2)
        expect(logs[1].type).toBe('guard')
        expect(logs[1].data.action).toBe('end')
        expect(logs[1].data.result).toBe('next')
      })

      it('应该记录重定向结果', () => {
        diagnostics.logGuardStart(mockRoute, mockFromRoute)
        diagnostics.logGuardEnd(mockRoute, mockFromRoute, 'redirect', '/target')
        const logs = diagnostics.getLogs()
        expect(logs[1].data.result).toBe('redirect')
        expect(logs[1].data.target).toBe('/target')
      })
    })

    describe('logRedirect', () => {
      it('应该记录重定向', () => {
        diagnostics.logRedirect('/from', '/to', 'test reason')
        const logs = diagnostics.getLogs()
        expect(logs.length).toBe(1)
        expect(logs[0].type).toBe('redirect')
        expect(logs[0].data).toEqual({ from: '/from', to: '/to', reason: 'test reason' })
      })
    })

    describe('logStateChange', () => {
      it('应该记录状态变化', () => {
        diagnostics.logStateChange('testKey', 'oldValue', 'newValue')
        const logs = diagnostics.getLogs()
        expect(logs.length).toBe(1)
        expect(logs[0].type).toBe('state_change')
        expect(logs[0].data).toEqual({ key: 'testKey', oldValue: 'oldValue', newValue: 'newValue' })
      })
    })

    describe('logError', () => {
      it('应该记录错误字符串', () => {
        diagnostics.logError('test error')
        const logs = diagnostics.getLogs()
        expect(logs.length).toBe(1)
        expect(logs[0].type).toBe('error')
        expect(logs[0].data.error).toBe('test error')
      })

      it('应该记录Error对象', () => {
        const error = new Error('test error')
        diagnostics.logError(error)
        const logs = diagnostics.getLogs()
        expect(logs[0].data.error).toBe('test error')
        expect(logs[0].data.stack).toBeDefined()
      })

      it('应该记录上下文', () => {
        diagnostics.logError('test error', { context: 'value' })
        const logs = diagnostics.getLogs()
        expect(logs[0].data.context).toBe('value')
      })
    })

    describe('logWarning', () => {
      it('应该记录警告', () => {
        diagnostics.logWarning('test warning')
        const logs = diagnostics.getLogs()
        expect(logs.length).toBe(1)
        expect(logs[0].type).toBe('warning')
        expect(logs[0].data.message).toBe('test warning')
      })
    })

    describe('getLogsByType', () => {
      it('应该按类型过滤日志', () => {
        diagnostics.log('guard', { action: 'test1' })
        diagnostics.log('redirect', { action: 'test2' })
        diagnostics.log('guard', { action: 'test3' })
        
        const guardLogs = diagnostics.getLogsByType('guard')
        expect(guardLogs.length).toBe(2)
        
        const redirectLogs = diagnostics.getLogsByType('redirect')
        expect(redirectLogs.length).toBe(1)
      })
    })

    describe('getRecentLogs', () => {
      it('应该返回最近的日志', () => {
        for (let i = 0; i < 20; i++) {
          diagnostics.log('guard', { index: i })
        }
        
        const recentLogs = diagnostics.getRecentLogs(5)
        expect(recentLogs.length).toBe(5)
        expect(recentLogs[0].data.index).toBe(15)
        expect(recentLogs[4].data.index).toBe(19)
      })
    })

    describe('getLogsByTimeRange', () => {
      it('应该返回时间范围内的日志', () => {
        const start = Date.now()
        diagnostics.log('guard', { index: 1 })
        vi.advanceTimersByTime(1000)
        diagnostics.log('guard', { index: 2 })
        vi.advanceTimersByTime(1000)
        diagnostics.log('guard', { index: 3 })
        
        const logs = diagnostics.getLogsByTimeRange(start, start + 1500)
        expect(logs.length).toBe(2)
      })
    })

    describe('exportLogs', () => {
      it('应该导出JSON格式日志', () => {
        diagnostics.log('guard', { action: 'test' })
        const exported = diagnostics.exportLogs()
        const parsed = JSON.parse(exported)
        expect(parsed.logs.length).toBe(1)
        expect(parsed.stats).toBeDefined()
      })
    })

    describe('exportLogsAsCsv', () => {
      it('应该导出CSV格式日志', () => {
        diagnostics.log('guard', { action: 'test' })
        const csv = diagnostics.exportLogsAsCsv()
        expect(csv).toContain('Timestamp')
        expect(csv).toContain('Type')
        expect(csv).toContain('guard')
      })
    })

    describe('clearLogs', () => {
      it('应该清除所有日志', () => {
        diagnostics.log('guard', { action: 'test' })
        diagnostics.log('redirect', { action: 'test' })
        diagnostics.clearLogs()
        expect(diagnostics.getLogs().length).toBe(0)
      })
    })

    describe('getStats', () => {
      it('应该返回统计信息', () => {
        diagnostics.log('guard', { action: 'test' })
        diagnostics.log('redirect', { action: 'test' })
        diagnostics.log('error', { error: 'test' })
        diagnostics.log('warning', { message: 'test' })
        
        const stats = diagnostics.getStats()
        expect(stats.totalLogs).toBe(4)
        expect(stats.logsByType.guard).toBe(1)
        expect(stats.logsByType.redirect).toBe(1)
        expect(stats.logsByType.error).toBe(1)
        expect(stats.logsByType.warning).toBe(1)
      })

      it('应该计算守卫平均耗时', () => {
        diagnostics.logGuardStart(mockRoute, mockFromRoute)
        vi.advanceTimersByTime(100)
        diagnostics.logGuardEnd(mockRoute, mockFromRoute, 'next')
        
        const stats = diagnostics.getStats()
        expect(stats.averageGuardDuration).toBeGreaterThanOrEqual(0)
      })
    })

    describe('detectRedirectLoop', () => {
      it('应该检测循环重定向', () => {
        for (let i = 0; i < 3; i++) {
          diagnostics.logRedirect('/from', '/to', 'loop')
        }
        
        expect(diagnostics.detectRedirectLoop()).toBe(true)
      })

      it('应该返回false当没有循环时', () => {
        diagnostics.logRedirect('/from', '/to1', 'reason1')
        diagnostics.logRedirect('/from', '/to2', 'reason2')
        
        expect(diagnostics.detectRedirectLoop()).toBe(false)
      })
    })

    describe('getRedirectLoopDetails', () => {
      it('应该返回循环详情', () => {
        for (let i = 0; i < 3; i++) {
          diagnostics.logRedirect('/from', '/to', 'loop')
        }
        
        const details = diagnostics.getRedirectLoopDetails()
        expect(details).not.toBeNull()
        expect(details?.length).toBeGreaterThan(0)
      })

      it('应该返回null当没有循环时', () => {
        diagnostics.logRedirect('/from', '/to', 'reason')
        
        const details = diagnostics.getRedirectLoopDetails()
        expect(details).toBeNull()
      })
    })

    describe('setRouter', () => {
      it('应该设置路由实例', () => {
        const mockRouter = {
          currentRoute: { value: mockRoute },
        } as unknown as ReturnType<typeof import('vue-router').createRouter>
        
        diagnostics.setRouter(mockRouter)
        diagnostics.log('guard', { action: 'test' })
        
        const logs = diagnostics.getLogs()
        expect(logs[0].route.path).toBe('/test')
      })
    })

    describe('printSummary', () => {
      it('应该打印摘要', async () => {
        const { logger } = await import('@/utils/logger')
        diagnostics.log('guard', { action: 'test' })
        diagnostics.printSummary()
        
        expect(logger.info).toHaveBeenCalled()
      })
    })
  })

  describe('便捷函数', () => {
    beforeEach(() => {
      routeDiagnostics.clearLogs()
    })

    afterEach(() => {
      routeDiagnostics.clearLogs()
    })

    it('logGuardStart应该工作', () => {
      logGuardStart(mockRoute, mockFromRoute)
      expect(routeDiagnostics.getLogs().length).toBe(1)
    })

    it('logGuardEnd应该工作', () => {
      logGuardStart(mockRoute, mockFromRoute)
      logGuardEnd(mockRoute, mockFromRoute, 'next')
      expect(routeDiagnostics.getLogs().length).toBe(2)
    })

    it('logRedirect应该工作', () => {
      logRedirect('/from', '/to', 'reason')
      expect(routeDiagnostics.getLogs().length).toBe(1)
    })

    it('logStateChange应该工作', () => {
      logStateChange('key', 'old', 'new')
      expect(routeDiagnostics.getLogs().length).toBe(1)
    })

    it('logRouteError应该工作', () => {
      logRouteError('error')
      expect(routeDiagnostics.getLogs().length).toBe(1)
    })

    it('logRouteWarning应该工作', () => {
      logRouteWarning('warning')
      expect(routeDiagnostics.getLogs().length).toBe(1)
    })

    it('detectRedirectLoop应该工作', () => {
      for (let i = 0; i < 3; i++) {
        logRedirect('/from', '/to', 'loop')
      }
      expect(detectRedirectLoop()).toBe(true)
    })

    it('printRouteDiagnostics应该工作', async () => {
      const { logger } = await import('@/utils/logger')
      printRouteDiagnostics()
      expect(logger.info).toHaveBeenCalled()
    })

    it('exportRouteDiagnostics应该工作', () => {
      const exported = exportRouteDiagnostics()
      expect(typeof exported).toBe('string')
      expect(JSON.parse(exported)).toBeDefined()
    })
  })
})
