// 测试 utils/index.ts 聚合导出
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// 模拟i18n模块，避免依赖
vi.mock('@/utils/i18n', () => ({
  t: (key: string) => {
    const map: Record<string, string> = {
      'time.never': '从未',
      'text.format.无效时间': '无效时间',
      'text.api_response_handler.未知错误': '未知错误',
    }
    return map[key] || key
  },
  default: {
    global: {
      t: (key: string) => key,
    },
  },
}))

// 模拟logger模块
vi.mock('@/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  LogLevel: { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 },
}))

// 模拟auth依赖
vi.mock('@/config/backend-paths', () => ({
  COZE_PATHS: {},
}))

describe('utils/index.ts 聚合导出测试', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  describe('TokenManager 占位符', () => {
    it('应该从localStorage读取token', async () => {
      const { TokenManager } = await import('../index')
      localStorage.setItem('token', 'abc123')
      expect(TokenManager.getToken()).toBe('abc123')
    })

    it('应该从sessionStorage读取token（当localStorage没有）', async () => {
      const { TokenManager } = await import('../index')
      // 显式清 localStorage，确保 fallback 到 sessionStorage（防止跨测试污染）
      localStorage.removeItem('token')
      sessionStorage.setItem('token', 'sess456')
      expect(TokenManager.getToken()).toBe('sess456')
    })

    it('应该同时设置localStorage和sessionStorage的token', async () => {
      const { TokenManager } = await import('../index')
      TokenManager.setToken('newtoken')
      expect(localStorage.getItem('token')).toBe('newtoken')
      expect(sessionStorage.getItem('token')).toBe('newtoken')
    })

    it('应该清除localStorage和sessionStorage的token', async () => {
      const { TokenManager } = await import('../index')
      localStorage.setItem('token', 'x')
      sessionStorage.setItem('token', 'y')
      TokenManager.removeToken()
      expect(localStorage.getItem('token')).toBeNull()
      expect(sessionStorage.getItem('token')).toBeNull()
    })
  })

  describe('ConfigManager 占位符', () => {
    it('应该从localStorage读取config', async () => {
      const { ConfigManager } = await import('../index')
      localStorage.setItem('config_theme', 'dark')
      expect(ConfigManager.getConfig('theme')).toBe('dark')
    })

    it('应该返回null当config不存在', async () => {
      const { ConfigManager } = await import('../index')
      expect(ConfigManager.getConfig('nonexistent')).toBeNull()
    })

    it('应该设置config到localStorage', async () => {
      const { ConfigManager } = await import('../index')
      ConfigManager.setConfig('lang', 'zh-CN')
      expect(localStorage.getItem('config_lang')).toBe('zh-CN')
    })
  })

  describe('retryPromise', () => {
    it('应该在第一次成功时直接返回结果', async () => {
      const { retryPromise } = await import('../index')
      const fn = vi.fn().mockResolvedValue('ok')
      const result = await retryPromise(fn)
      expect(result).toBe('ok')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('应该在失败后重试直到成功', async () => {
      const { retryPromise } = await import('../index')
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail1'))
        .mockRejectedValueOnce(new Error('fail2'))
        .mockResolvedValue('success')
      const result = await retryPromise(fn, 3)
      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('应该在重试耗尽后抛出错误', async () => {
      const { retryPromise } = await import('../index')
      const fn = vi.fn().mockRejectedValue(new Error('always fail'))
      await expect(retryPromise(fn, 2)).rejects.toThrow('always fail')
      expect(fn).toHaveBeenCalledTimes(3) // 初次 + 2次重试
    })
  })

  describe('withTimeout', () => {
    it('应该在promise解决时正常返回', async () => {
      const { withTimeout } = await import('../index')
      const result = await withTimeout(Promise.resolve('fast'), 1000)
      expect(result).toBe('fast')
    })

    it('应该在超时时抛出Timeout错误', async () => {
      const { withTimeout } = await import('../index')
      const slow = new Promise((resolve) => setTimeout(() => resolve('late'), 200))
      await expect(withTimeout(slow, 50)).rejects.toThrow('Timeout')
    })
  })

  describe('registerCleanup', () => {
    it('应该注册到beforeunload事件并返回移除函数', async () => {
      const { registerCleanup } = await import('../index')
      const addSpy = vi.spyOn(window, 'addEventListener')
      const removeSpy = vi.spyOn(window, 'removeEventListener')
      const fn = vi.fn()

      const unregister = registerCleanup(fn)
      expect(addSpy).toHaveBeenCalledWith('beforeunload', fn)

      unregister()
      expect(removeSpy).toHaveBeenCalledWith('beforeunload', fn)
    })
  })

  describe('getDateLabel', () => {
    it('应该返回"今天"当日期是今天', async () => {
      const { getDateLabel } = await import('../index')
      const now = new Date()
      expect(getDateLabel(now)).toBe('今天')
    })

    it('应该返回"昨天"当日期是昨天', async () => {
      const { getDateLabel } = await import('../index')
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      expect(getDateLabel(yesterday)).toBe('昨天')
    })

    it('应该返回"X天前"当日期在7天内', async () => {
      const { getDateLabel } = await import('../index')
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      expect(getDateLabel(threeDaysAgo)).toBe('3天前')
    })

    it('应该返回"X周前"当日期在30天内', async () => {
      const { getDateLabel } = await import('../index')
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      expect(getDateLabel(fourteenDaysAgo)).toBe('2周前')
    })

    it('应该返回"X月前"当日期超过30天', async () => {
      const { getDateLabel } = await import('../index')
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      expect(getDateLabel(ninetyDaysAgo)).toBe('3月前')
    })

    it('应该接受字符串类型的日期', async () => {
      const { getDateLabel } = await import('../index')
      const result = getDateLabel(new Date().toISOString())
      expect(result).toBe('今天')
    })
  })

  describe('exportMessagesToFile', () => {
    it('应该创建并下载JSON文件', async () => {
      const { exportMessagesToFile } = await import('../index')
      const createElementSpy = vi.spyOn(document, 'createElement')
      const clickSpy = vi.fn()
      createElementSpy.mockReturnValue({
        href: '',
        download: '',
        click: clickSpy,
      } as unknown as HTMLAnchorElement)

      const messages = [{ id: 1, content: 'hi' }]
      exportMessagesToFile(messages, 'test.json')

      expect(createElementSpy).toHaveBeenCalledWith('a')
      expect(clickSpy).toHaveBeenCalled()
    })
  })

  describe('重新导出验证', () => {
    it('应该从format导出函数', async () => {
      const mod = await import('../index')
      // 验证format相关函数
      expect(typeof mod.formatNumber).toBe('function')
      expect(typeof mod.formatDateTime).toBe('function')
      expect(typeof mod.formatPhone).toBe('function')
      expect(typeof mod.isEmpty).toBe('function')
    })

    it('应该从markRaw导出', async () => {
      const mod = await import('../index')
      expect(typeof mod.markIcon).toBe('function')
      expect(typeof mod.markIcons).toBe('function')
      expect(typeof mod.markRaw).toBe('function')
    })

    it('应该从object-utils导出', async () => {
      const mod = await import('../index')
      expect(typeof mod.deepClone).toBe('function')
      expect(typeof mod.deepEqual).toBe('function')
    })

    it('应该从logger导出', async () => {
      const mod = await import('../index')
      expect(mod.logger).toBeDefined()
      expect(mod.LogLevel).toBeDefined()
    })

    it('应该从auth导出clearAllAuthData', async () => {
      const mod = await import('../index')
      expect(typeof mod.clearAllAuthData).toBe('function')
    })

    it('应该从storage导出', async () => {
      const mod = await import('../index')
      expect(mod.StorageManager).toBeDefined()
      expect(mod.STORAGE_KEYS).toBeDefined()
    })

    it('应该从errorHandler导出', async () => {
      const mod = await import('../index')
      expect(mod.ErrorHandler).toBeDefined()
      expect(typeof mod.handleApiResponse).toBe('function')
    })

    it('应该从api-helpers导出', async () => {
      const mod = await import('../index')
      expect(typeof mod.createAbortController).toBe('function')
      expect(typeof mod.cancelRequest).toBe('function')
      expect(typeof mod.isDemoMode).toBe('function')
    })

    it('应该从event-emitter导出', async () => {
      const mod = await import('../index')
      expect(mod.EventEmitter).toBeDefined()
      expect(mod.EventBus).toBeDefined()
    })

    it('应该从speech导出', async () => {
      const mod = await import('../index')
      expect(typeof mod.isSpeechRecognitionSupported).toBe('function')
      expect(typeof mod.startSpeechRecognition).toBe('function')
      expect(typeof mod.stopSpeechRecognition).toBe('function')
      expect(typeof mod.getProviderStatus).toBe('function')
      expect(typeof mod.getCurrentProvider).toBe('function')
      expect(typeof mod.setProvider).toBe('function')
      expect(typeof mod.getBestAvailableProvider).toBe('function')
      expect(mod.SpeechProvider).toBeDefined()
      expect(mod.SpeechRecognitionError).toBeDefined()
    })

    it('应该从login-duration导出', async () => {
      const mod = await import('../index')
      expect(Array.isArray(mod.LOGIN_DURATION_OPTIONS)).toBe(true)
      expect(typeof mod.DEFAULT_LOGIN_DURATION).toBe('number')
      expect(typeof mod.getDefaultLoginDuration).toBe('function')
      expect(typeof mod.getLoginDurationLabel).toBe('function')
      expect(typeof mod.initLoginDuration).toBe('function')
    })

    it('应该从apiResponseHandler导出', async () => {
      const mod = await import('../index')
      expect(typeof mod.normalizeApiResponse).toBe('function')
      expect(typeof mod.isApiSuccess).toBe('function')
      expect(typeof mod.extractApiData).toBe('function')
      expect(typeof mod.extractApiError).toBe('function')
      expect(typeof mod.normalizePaginationResponse).toBe('function')
      expect(typeof mod.createErrorResponse).toBe('function')
      expect(typeof mod.debounceApi).toBe('function')
      expect(typeof mod.throttleApi).toBe('function')
      expect(typeof mod.withRetry).toBe('function')
      expect(mod.ApiCache).toBeDefined()
      expect(mod.ApiBatcher).toBeDefined()
      expect(typeof mod.withCache).toBe('function')
      expect(typeof mod.withApiResponseHandler).toBe('function')
    })

    it('应该从rememberMeService导出', async () => {
      const mod = await import('../index')
      expect(mod.RememberMeService).toBeDefined()
    })
  })

  describe('format函数行为测试', () => {
    it('应该格式化数字', async () => {
      const { formatNumber } = await import('../index')
      expect(formatNumber(999)).toBe('999')
      expect(formatNumber(1000)).toBe('1.0k')
      expect(formatNumber(10000)).toBe('1.0w')
    })

    it('应该格式化手机号', async () => {
      const { formatPhone, isEmpty } = await import('../index')
      expect(formatPhone('13812345678')).toBe('138****5678')
      expect(isEmpty('')).toBe(true)
      expect(isEmpty(null)).toBe(true)
      expect(isEmpty({})).toBe(true)
      expect(isEmpty('a')).toBe(false)
    })
  })

  describe('object-utils函数测试', () => {
    it('应该深拷贝对象', async () => {
      const { deepClone } = await import('../index')
      const obj = { a: 1, b: { c: 2 } }
      const cloned = deepClone(obj)
      expect(cloned).toEqual(obj)
      expect(cloned).not.toBe(obj)
      expect(cloned.b).not.toBe(obj.b)
    })

    it('应该比较深相等', async () => {
      const { deepEqual } = await import('../index')
      expect(deepEqual({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } })).toBe(true)
      expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false)
    })
  })

  describe('EventEmitter基本行为', () => {
    it('应该能创建实例并emit事件', async () => {
      const { EventEmitter } = await import('../index')
      const emitter = new EventEmitter()
      const handler = vi.fn()
      emitter.on('test', handler)
      emitter.emit('test', 'data')
      expect(handler).toHaveBeenCalledWith('data')
    })
  })
})
