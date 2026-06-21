import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getCurrentPlatform,
  registerPlatformRoutes,
  mergeRoutes,
  getPlatformRoutes,
} from '../routeMerger'
import type { RouteRecordRaw } from 'vue-router'

describe('routeMerger', () => {
  const originalWindow = global.window
  const originalNavigator = global.navigator
  const originalProcess = global.process

  beforeEach(() => {
    vi.resetModules()
    registerPlatformRoutes('web', [])
    registerPlatformRoutes('h5', [])
    registerPlatformRoutes('electron', [])
    registerPlatformRoutes('alipay', [])
  })

  afterEach(() => {
    global.window = originalWindow
    global.navigator = originalNavigator
    global.process = originalProcess
    registerPlatformRoutes('web', [])
    registerPlatformRoutes('h5', [])
    registerPlatformRoutes('electron', [])
    registerPlatformRoutes('alipay', [])
  })

  describe('getCurrentPlatform', () => {
    it('应该返回electron当在Electron环境', () => {
      Object.defineProperty(global, 'process', {
        value: { versions: { electron: '1.0.0' } },
        writable: true,
        configurable: true,
      })
      expect(getCurrentPlatform()).toBe('electron')
    })

    it('应该返回alipay当在支付宝小程序环境', () => {
      Object.defineProperty(global, 'process', {
        value: undefined,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(global, 'window', {
        value: {
          my: { alert: vi.fn() },
        },
        writable: true,
        configurable: true,
      })
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Mozilla/5.0' },
        writable: true,
        configurable: true,
      })
      expect(getCurrentPlatform()).toBe('alipay')
    })

    it('应该返回h5当在移动设备', () => {
      Object.defineProperty(global, 'process', {
        value: undefined,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(global, 'window', {
        value: {},
        writable: true,
        configurable: true,
      })
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0)' },
        writable: true,
        configurable: true,
      })
      expect(getCurrentPlatform()).toBe('h5')
    })

    it('应该返回h5当在Android设备', () => {
      Object.defineProperty(global, 'process', {
        value: undefined,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(global, 'window', {
        value: {},
        writable: true,
        configurable: true,
      })
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (Linux; Android 10)' },
        writable: true,
        configurable: true,
      })
      expect(getCurrentPlatform()).toBe('h5')
    })

    it('应该返回web当在桌面浏览器', () => {
      Object.defineProperty(global, 'process', {
        value: undefined,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(global, 'window', {
        value: {},
        writable: true,
        configurable: true,
      })
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        writable: true,
        configurable: true,
      })
      expect(getCurrentPlatform()).toBe('web')
    })

    it('应该返回web当window或navigator不存在', () => {
      Object.defineProperty(global, 'process', {
        value: undefined,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(global, 'window', {
        value: undefined,
        writable: true,
        configurable: true,
      })
      expect(getCurrentPlatform()).toBe('web')
    })
  })

  describe('registerPlatformRoutes', () => {
    it('应该注册平台路由', () => {
      const routes: RouteRecordRaw[] = [
        { path: '/test', name: 'test', component: {} as any },
      ]
      registerPlatformRoutes('web', routes)
      expect(getPlatformRoutes('web')).toEqual(routes)
    })

    it('应该覆盖已注册的路由', () => {
      const routes1: RouteRecordRaw[] = [
        { path: '/test1', name: 'test1', component: {} as any },
      ]
      const routes2: RouteRecordRaw[] = [
        { path: '/test2', name: 'test2', component: {} as any },
      ]
      registerPlatformRoutes('h5', routes1)
      registerPlatformRoutes('h5', routes2)
      expect(getPlatformRoutes('h5')).toEqual(routes2)
    })
  })

  describe('getPlatformRoutes', () => {
    it('应该返回已注册的路由', () => {
      const routes: RouteRecordRaw[] = [
        { path: '/test', name: 'test', component: {} as any },
      ]
      registerPlatformRoutes('electron', routes)
      expect(getPlatformRoutes('electron')).toEqual(routes)
    })

    it('应该返回空数组当没有注册路由', () => {
      expect(getPlatformRoutes('alipay')).toEqual([])
    })
  })

  describe('mergeRoutes', () => {
    it('应该合并基础路由和平台路由', () => {
      const baseRoutes: RouteRecordRaw[] = [
        { path: '/', name: 'home', component: {} as any },
      ]
      const platformRoutes: RouteRecordRaw[] = [
        { path: '/platform', name: 'platform', component: {} as any },
      ]
      registerPlatformRoutes('web', platformRoutes)
      const merged = mergeRoutes(baseRoutes, 'web')
      expect(merged).toHaveLength(2)
    })

    it('应该过滤不匹配平台的路由', () => {
      const baseRoutes: RouteRecordRaw[] = [
        { path: '/', name: 'home', component: {} as any },
        { path: '/h5-only', name: 'h5Only', component: {} as any, meta: { platform: 'h5' } },
        { path: '/multi', name: 'multi', component: {} as any, meta: { platform: ['web', 'h5'] } },
      ]
      const merged = mergeRoutes(baseRoutes, 'web')
      expect(merged).toHaveLength(2)
      expect(merged.find(r => r.name === 'h5Only')).toBeUndefined()
      expect(merged.find(r => r.name === 'multi')).toBeDefined()
    })

    it('应该保留没有platform配置的路由', () => {
      const baseRoutes: RouteRecordRaw[] = [
        { path: '/', name: 'home', component: {} as any },
        { path: '/about', name: 'about', component: {} as any, meta: {} },
      ]
      const merged = mergeRoutes(baseRoutes, 'web')
      expect(merged).toHaveLength(2)
    })

    it('应该使用自动检测的平台当未指定', () => {
      Object.defineProperty(global, 'process', {
        value: undefined,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(global, 'window', {
        value: {},
        writable: true,
        configurable: true,
      })
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (Windows NT 10.0)' },
        writable: true,
        configurable: true,
      })
      const baseRoutes: RouteRecordRaw[] = [
        { path: '/', name: 'home', component: {} as any },
      ]
      const merged = mergeRoutes(baseRoutes)
      expect(merged).toHaveLength(1)
    })

    it('应该处理空路由数组', () => {
      registerPlatformRoutes('web', [])
      const merged = mergeRoutes([], 'web')
      expect(merged).toHaveLength(0)
    })

    it('应该处理platform数组配置', () => {
      registerPlatformRoutes('web', [])
      registerPlatformRoutes('electron', [])
      registerPlatformRoutes('h5', [])
      const baseRoutes: RouteRecordRaw[] = [
        { path: '/multi', name: 'multi', component: {} as any, meta: { platform: ['web', 'electron'] } },
      ]
      expect(mergeRoutes(baseRoutes, 'web')).toHaveLength(1)
      expect(mergeRoutes(baseRoutes, 'electron')).toHaveLength(1)
      expect(mergeRoutes(baseRoutes, 'h5')).toHaveLength(0)
    })
  })
})
