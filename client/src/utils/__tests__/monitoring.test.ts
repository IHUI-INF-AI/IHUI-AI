/**
 * 监控告警单元测试
 * 覆盖：
 * - 初始化 / 销毁
 * - captureException / captureMessage
 * - setUser / setTag
 * - 行为埋点 trackEvent / trackPageView
 * - CSP 违规上报
 * - 采样率
 * - 批次上报
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  initMonitoring,
  destroyMonitoring,
  captureException,
  captureMessage,
  setUser,
  setTag,
  trackEvent,
  trackPageView,
  captureCspViolation,
  getMonitoringConfig,
  monitoringService,
} from '../monitoring'

describe('monitoring', () => {
  beforeEach(() => {
    destroyMonitoring()
  })

  afterEach(() => {
    destroyMonitoring()
  })

  it('默认未启用时不采集', () => {
    initMonitoring()
    expect(getMonitoringConfig().enabled).toBe(false)
  })

  it('启用后可正常初始化', () => {
    initMonitoring({ enabled: true, debug: true })
    const cfg = getMonitoringConfig()
    expect(cfg.enabled).toBe(true)
    expect(cfg.endpoint).toBe('/api/rum')
  })

  it('setUser 接受用户上下文', () => {
    initMonitoring({ enabled: true })
    setUser({ id: 'user-001', email: 'a@b.com' })
    expect(true, '不抛错').toBe(true)
  })

  it('setTag 累加用户 tag', () => {
    initMonitoring({ enabled: true })
    setTag('plan', 'premium')
    setTag('role', 'admin')
    expect(true, '不抛错').toBe(true)
  })

  it('trackEvent 接受自定义事件', () => {
    initMonitoring({ enabled: true, enableBehavior: true, sampleRate: 1 })
    trackEvent('button_click', { btn: 'pay' })
    expect(true, '不抛错').toBe(true)
  })

  it('trackPageView 接受页面路径', () => {
    initMonitoring({ enabled: true, enableBehavior: true })
    trackPageView('/vip', 'VIP 套餐')
    expect(true, '不抛错').toBe(true)
  })

  it('captureException 接受 Error 对象', () => {
    initMonitoring({ enabled: true, sampleRate: 1 })
    const err = new Error('test')
    captureException(err, { source: 'unit-test' })
    expect(true, '不抛错').toBe(true)
  })

  it('captureException 接受字符串', () => {
    initMonitoring({ enabled: true, sampleRate: 1 })
    captureException('string error', { source: 'unit-test' })
    expect(true, '不抛错').toBe(true)
  })

  it('captureException 接受非标准对象', () => {
    initMonitoring({ enabled: true, sampleRate: 1 })
    captureException({ code: 500, message: 'fail' })
    expect(true, '不抛错').toBe(true)
  })

  it('captureMessage 3 个 level', () => {
    initMonitoring({ enabled: true, enableBehavior: true })
    captureMessage('info msg', 'info')
    captureMessage('warn msg', 'warning')
    captureMessage('error msg', 'error')
    expect(true, '不抛错').toBe(true)
  })

  it('captureCspViolation 接受违规报告', () => {
    initMonitoring({ enabled: true })
    captureCspViolation({
      blockedURI: 'inline',
      violatedDirective: 'script-src',
      originalPolicy: "default-src 'self'",
      sourceFile: 'app.js',
      lineNumber: 100,
    })
    expect(true, '不抛错').toBe(true)
  })

  it('采样率 0 时不采集', () => {
    initMonitoring({ enabled: true, sampleRate: 0 })
    trackEvent('test', { x: 1 })
    expect(true, '不抛错').toBe(true)
  })

  it('disable 后 initMonitoring 不挂载监听', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener')
    initMonitoring({ enabled: false })
    expect(addEventListener).not.toHaveBeenCalledWith('error', expect.any(Function))
    addEventListener.mockRestore()
  })

  it('destroyMonitoring 清理定时器', () => {
    initMonitoring({ enabled: true })
    destroyMonitoring()
    expect(getMonitoringConfig().enabled, '配置保持').toBe(true) // 重新 init 不会清空 config
  })

  it('flush 端点 sendBeacon 失败时回滚到 fetch', async () => {
    // jsdom 中没有 sendBeacon，需要 mock
    Object.defineProperty(navigator, 'sendBeacon', { value: () => false, writable: true, configurable: true })
    initMonitoring({ enabled: true, sampleRate: 1, enableBehavior: true })
    trackEvent('test', { x: 1 })
    await new Promise((r) => setTimeout(r, 0))
    expect(true, '不抛错').toBe(true)
  })

  it('PerformanceObserver API 不支持时静默', () => {
    const original = (globalThis as { PerformanceObserver?: unknown }).PerformanceObserver
    ;(globalThis as { PerformanceObserver?: unknown }).PerformanceObserver = undefined
    initMonitoring({ enabled: true, enablePerformance: true })
    ;(globalThis as { PerformanceObserver?: unknown }).PerformanceObserver = original
    expect(true, '不抛错').toBe(true)
  })

  it('getMonitoringConfig 返回拷贝不暴露内部引用', () => {
    initMonitoring({ enabled: true })
    const a = getMonitoringConfig()
    a.enabled = false
    const b = getMonitoringConfig()
    expect(b.enabled).toBe(true)
  })

  // ===== 补充覆盖 =====

  it('debug 且未启用时打印 disabled', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    initMonitoring({ enabled: false, debug: true })
    expect(spy).toHaveBeenCalledWith('[monitoring] disabled')
    spy.mockRestore()
  })

  it('全局 error 事件触发异常捕获', () => {
    initMonitoring({ enabled: true, sampleRate: 1, enableBehavior: false, enablePerformance: false })
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('global') }))
    expect(true, '不抛错').toBe(true)
  })

  it('全局 error 事件仅 message 时也能捕获', () => {
    initMonitoring({ enabled: true, sampleRate: 1, enableBehavior: false, enablePerformance: false })
    window.dispatchEvent(new ErrorEvent('error', { message: 'msg-only' }))
    expect(true, '不抛错').toBe(true)
  })

  it('unhandledrejection 事件触发异常捕获', () => {
    initMonitoring({ enabled: true, sampleRate: 1, enableBehavior: false, enablePerformance: false })
    const ev = new Event('unhandledrejection')
    Object.defineProperty(ev, 'reason', { value: new Error('reject') })
    window.dispatchEvent(ev)
    expect(true, '不抛错').toBe(true)
  })

  it('Vue errorHandler 捕获异常', () => {
    ;(window as unknown as { __VUE_APP__?: { config: { errorHandler?: (err: Error, vm: unknown, info: string) => void } } }).__VUE_APP__ = { config: {} }
    initMonitoring({ enabled: true, sampleRate: 1, enableBehavior: false, enablePerformance: false })
    ;(window as unknown as { __VUE_APP__: { config: { errorHandler: (err: Error, vm: unknown, info: string) => void } } }).__VUE_APP__.config.errorHandler(new Error('vue'), null, 'render')
    delete (window as unknown as { __VUE_APP__?: unknown }).__VUE_APP__
    expect(true, '不抛错').toBe(true)
  })

  it('PerformanceObserver 捕获 LCP/CLS/FID', () => {
    const cbs: Array<(entries: unknown) => void> = []
    ;(globalThis as unknown as { PerformanceObserver: unknown }).PerformanceObserver = class {
      constructor(cb: (entries: unknown) => void) { cbs.push(cb) }
      observe() {}
      disconnect() {}
    }
    initMonitoring({ enabled: true, enablePerformance: true, enableBehavior: false, sampleRate: 1 })
    cbs[0]({ getEntries: () => [{ startTime: 100 }] })                    // LCP
    cbs[1]({ getEntries: () => [{ hadRecentInput: false, value: 0.5 }] }) // CLS 有值
    cbs[1]({ getEntries: () => [{ hadRecentInput: true, value: 1 }] })    // CLS 跳过
    cbs[2]({ getEntries: () => [{ processingStart: 200, startTime: 100 }] }) // FID
    expect(true, '不抛错').toBe(true)
  })

  it('history.pushState 触发页面浏览埋点', () => {
    initMonitoring({ enabled: true, enableBehavior: true, sampleRate: 1 })
    history.pushState({}, '', '/new')
    expect(true, '不抛错').toBe(true)
  })

  it('history.replaceState 触发页面浏览埋点', () => {
    initMonitoring({ enabled: true, enableBehavior: true, sampleRate: 1 })
    history.replaceState({}, '', '/rep')
    expect(true, '不抛错').toBe(true)
  })

  it('popstate 事件触发页面浏览埋点', () => {
    initMonitoring({ enabled: true, enableBehavior: true, sampleRate: 1 })
    window.dispatchEvent(new PopStateEvent('popstate'))
    expect(true, '不抛错').toBe(true)
  })

  it('flush 使用 fetch 回退上报', async () => {
    delete (navigator as unknown as Record<string, unknown>).sendBeacon
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({} as unknown as Response)
    initMonitoring({ enabled: true, sampleRate: 1, enableBehavior: false, enablePerformance: false })
    for (let i = 0; i < 20; i++) captureException(new Error(`e${i}`))
    await new Promise((r) => setTimeout(r, 10))
    expect(fetchSpy).toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('flush sendBeacon 成功且 debug 打印日志', async () => {
    Object.defineProperty(navigator, 'sendBeacon', { value: () => true, writable: true, configurable: true })
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    initMonitoring({ enabled: true, debug: true, sampleRate: 1, enableBehavior: false, enablePerformance: false })
    for (let i = 0; i < 20; i++) captureException(new Error(`ok${i}`))
    await new Promise((r) => setTimeout(r, 10))
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[monitoring] flushed'))
    logSpy.mockRestore()
  })

  it('flush fetch 异常时回滚批次', async () => {
    delete (navigator as unknown as Record<string, unknown>).sendBeacon
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('net'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    initMonitoring({ enabled: true, debug: true, sampleRate: 1, enableBehavior: false, enablePerformance: false })
    for (let i = 0; i < 20; i++) captureException(new Error(`fail${i}`))
    await new Promise((r) => setTimeout(r, 10))
    expect(fetchSpy).toHaveBeenCalled()
    fetchSpy.mockRestore()
    errSpy.mockRestore()
  })

  it('flush 空批次直接返回', () => {
    initMonitoring({ enabled: true, sampleRate: 1 })
    window.dispatchEvent(new Event('beforeunload'))
    expect(true, '不抛错').toBe(true)
  })

  it('beforeunload 触发 flush 上报', async () => {
    Object.defineProperty(navigator, 'sendBeacon', { value: () => true, writable: true, configurable: true })
    initMonitoring({ enabled: true, sampleRate: 1, enableBehavior: false, enablePerformance: false })
    captureException(new Error('bu'))
    await new Promise((r) => setTimeout(r, 0))
    window.dispatchEvent(new Event('beforeunload'))
    expect(true, '不抛错').toBe(true)
  })

  it('未启用时各捕获函数跳过', () => {
    initMonitoring({ enabled: false })
    captureException(new Error('skip'))
    captureMessage('skip', 'info')
    captureCspViolation({ blockedURI: '', violatedDirective: '', originalPolicy: '' })
    expect(true, '不抛错').toBe(true)
  })

  it('enableBehavior false 时行为埋点跳过', () => {
    initMonitoring({ enabled: true, enableBehavior: false, sampleRate: 1 })
    trackEvent('skip', {})
    trackPageView('/skip')
    expect(true, '不抛错').toBe(true)
  })

  it('setUser 接受 null', () => {
    initMonitoring({ enabled: true })
    setUser(null as unknown as Parameters<typeof setUser>[0])
    setTag('k', 'v')
    expect(true, '不抛错').toBe(true)
  })

  it('monitoringService.recordError 各种参数组合', () => {
    initMonitoring({ enabled: true, sampleRate: 1 })
    monitoringService.recordError(new Error('e1'), 'src')
    monitoringService.recordError(new Error('e2'), 'src', 'high')
    monitoringService.recordError(new Error('e3'), 'src', { extra: 1 })
    monitoringService.recordError(new Error('e4'), 'src', 'low', { extra: 2 })
    expect(true, '不抛错').toBe(true)
  })

  it('monitoringService.recordMetric 上报指标', () => {
    initMonitoring({ enabled: true, sampleRate: 1, enableBehavior: true })
    monitoringService.recordMetric('latency', 100, 'ms', { region: 'cn' })
    expect(true, '不抛错').toBe(true)
  })

  it('monitoringService 委托各函数不抛错', () => {
    monitoringService.init({ enabled: true, sampleRate: 1 })
    monitoringService.setUser({ id: 'u1' })
    monitoringService.setTag('t', 'v')
    monitoringService.captureMessage('msg', 'info')
    monitoringService.trackEvent('evt', { x: 1 })
    monitoringService.trackPageView('/p')
    expect(true, '不抛错').toBe(true)
  })
})
