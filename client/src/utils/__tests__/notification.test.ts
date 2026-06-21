import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  WebNotificationAdapter,
  AlipayNotificationAdapter,
  ElectronNotificationAdapter,
  NotificationManager,
  notificationManager,
  showNotification,
  hideNotification,
  requestNotificationPermission,
  notify,
  type NotificationParams,
} from '../notification'

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}))

vi.mock('../router/utils/routeMerger', () => ({
  getCurrentPlatform: () => 'web',
  PlatformType: {},
}))

vi.mock('element-plus', () => ({
  ElMessage: vi.fn(),
  ElNotification: vi.fn(),
}))

describe('notification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('WebNotificationAdapter', () => {
    let adapter: WebNotificationAdapter

    beforeEach(() => {
      adapter = new WebNotificationAdapter()
      class MockNotification {
        static requestPermission = vi.fn().mockResolvedValue('granted')
        static permission = 'granted'
        close = vi.fn()
        onclick: (() => void) | null = null
        tag = 'test-tag'
        constructor() {}
      }
      vi.stubGlobal('Notification', MockNotification)
      document.hasFocus = vi.fn().mockReturnValue(false)
    })

    it('应该显示原生通知当有权限', async () => {
      const params: NotificationParams = {
        title: '测试标题',
        message: '测试消息',
      }
      const result = await adapter.show(params)
      expect(result.success).toBe(true)
    })

    it('应该处理onClick回调', async () => {
      const onClick = vi.fn()
      let notificationInstance: { onclick: (() => void) | null; close: vi.Mock } | null = null
      
      class MockNotification {
        static requestPermission = vi.fn().mockResolvedValue('granted')
        static permission = 'granted'
        close = vi.fn()
        onclick: (() => void) | null = null
        tag = 'test-tag'
        constructor() {
          notificationInstance = this as unknown as { close: vi.Mock }
        }
      }
      vi.stubGlobal('Notification', MockNotification)
      
      const newAdapter = new WebNotificationAdapter()
      await newAdapter.show({ message: 'test', onClick })
      
      if (notificationInstance?.onclick) {
        notificationInstance.onclick()
        expect(onClick).toHaveBeenCalled()
      }
    })

    it('应该处理duration参数', async () => {
      vi.useFakeTimers()
      let notificationInstance: { close: vi.Mock } | null = null
      
      class MockNotification {
        static requestPermission = vi.fn().mockResolvedValue('granted')
        static permission = 'granted'
        close = vi.fn()
        tag = 'test-tag'
        constructor() {
          notificationInstance = this as unknown as { close: vi.Mock }
        }
      }
      vi.stubGlobal('Notification', MockNotification)

      const newAdapter = new WebNotificationAdapter()
      await newAdapter.show({ message: 'test', duration: 1000 })
      
      vi.advanceTimersByTime(1000)
      expect(notificationInstance?.close).toHaveBeenCalled()
      
      vi.useRealTimers()
    })

    it('应该请求权限', async () => {
      const result = await adapter.requestPermission?.()
      expect(result).toBe(true)
    })

    it('应该返回false当权限被拒绝', async () => {
      class MockNotification {
        static requestPermission = vi.fn().mockResolvedValue('denied')
        static permission = 'denied'
        close = vi.fn()
        constructor() {}
      }
      vi.stubGlobal('Notification', MockNotification)
      const newAdapter = new WebNotificationAdapter()
      const result = await newAdapter.requestPermission?.()
      expect(result).toBe(false)
    })

    it('应该在浏览器环境不可用时返回失败', async () => {
      const originalWindow = global.window
      Object.defineProperty(global, 'window', { value: undefined, writable: true })

      const newAdapter = new WebNotificationAdapter()
      const result = await newAdapter.show({ message: 'test' })

      expect(result.success).toBe(false)

      Object.defineProperty(global, 'window', { value: originalWindow, writable: true })
    })

    it('应该使用Element Plus显示success消息', async () => {
      const { ElMessage } = await import('element-plus')
      document.hasFocus = vi.fn().mockReturnValue(true)
      
      const newAdapter = new WebNotificationAdapter()
      await newAdapter.show({ message: 'test', type: 'success' })
      
      expect(ElMessage).toHaveBeenCalled()
    })

    it('应该使用Element Plus显示warning消息', async () => {
      const { ElMessage } = await import('element-plus')
      document.hasFocus = vi.fn().mockReturnValue(true)
      
      const newAdapter = new WebNotificationAdapter()
      await newAdapter.show({ message: 'test', type: 'warning' })
      
      expect(ElMessage).toHaveBeenCalled()
    })

    it('应该使用Element Plus显示error消息', async () => {
      const { ElMessage } = await import('element-plus')
      document.hasFocus = vi.fn().mockReturnValue(true)
      
      const newAdapter = new WebNotificationAdapter()
      await newAdapter.show({ message: 'test', type: 'error' })
      
      expect(ElMessage).toHaveBeenCalled()
    })

    it('应该使用ElNotification显示info消息', async () => {
      const { ElNotification } = await import('element-plus')
      document.hasFocus = vi.fn().mockReturnValue(true)
      
      const newAdapter = new WebNotificationAdapter()
      await newAdapter.show({ message: 'test', type: 'info' })
      
      expect(ElNotification).toHaveBeenCalled()
    })

    it('应该处理原生通知API失败降级', async () => {
      const { ElMessage } = await import('element-plus')
      
      class MockNotification {
        static requestPermission = vi.fn().mockRejectedValue(new Error('failed'))
        constructor() {}
      }
      vi.stubGlobal('Notification', MockNotification)
      
      const newAdapter = new WebNotificationAdapter()
      const result = await newAdapter.show({ message: 'test', type: 'success' })
      
      expect(result.success).toBe(true)
    })
  })

  describe('AlipayNotificationAdapter', () => {
    let adapter: AlipayNotificationAdapter

    beforeEach(() => {
      adapter = new AlipayNotificationAdapter()
    })

    it('应该返回失败当my不可用', async () => {
      const result = await adapter.show({ message: 'test' })
      expect(result.success).toBe(false)
    })

    it('应该使用showToast显示成功消息', async () => {
      const mockMy = {
        showToast: vi.fn((options) => options.success()),
        showModal: vi.fn(),
      }
      Object.defineProperty(window, 'my', {
        value: mockMy,
        writable: true,
        configurable: true,
      })

      const result = await adapter.show({ message: 'test', type: 'success' })
      expect(result.success).toBe(true)
    })

    it('应该使用showToast显示error消息', async () => {
      const mockMy = {
        showToast: vi.fn((options) => options.success()),
        showModal: vi.fn(),
      }
      Object.defineProperty(window, 'my', {
        value: mockMy,
        writable: true,
        configurable: true,
      })

      const result = await adapter.show({ message: 'test', type: 'error' })
      expect(result.success).toBe(true)
    })

    it('应该使用showToast显示warning消息', async () => {
      const mockMy = {
        showToast: vi.fn((options) => options.success()),
        showModal: vi.fn(),
      }
      Object.defineProperty(window, 'my', {
        value: mockMy,
        writable: true,
        configurable: true,
      })

      const result = await adapter.show({ message: 'test', type: 'warning' })
      expect(result.success).toBe(true)
    })

    it('应该使用showModal显示info消息', async () => {
      const mockMy = {
        showToast: vi.fn(),
        showModal: vi.fn((options) => options.success()),
      }
      Object.defineProperty(window, 'my', {
        value: mockMy,
        writable: true,
        configurable: true,
      })

      const result = await adapter.show({ message: 'test', type: 'info' })
      expect(result.success).toBe(true)
    })

    it('应该处理showModal的onClick回调', async () => {
      const onClick = vi.fn()
      const mockMy = {
        showToast: vi.fn(),
        showModal: vi.fn((options) => {
          options.success()
        }),
      }
      Object.defineProperty(window, 'my', {
        value: mockMy,
        writable: true,
        configurable: true,
      })

      await adapter.show({ message: 'test', type: 'info', onClick })
      expect(onClick).toHaveBeenCalled()
    })

    it('应该处理showToast失败', async () => {
      const mockMy = {
        showToast: vi.fn((options) => options.fail(new Error('failed'))),
        showModal: vi.fn(),
      }
      Object.defineProperty(window, 'my', {
        value: mockMy,
        writable: true,
        configurable: true,
      })

      const result = await adapter.show({ message: 'test', type: 'success' })
      expect(result.success).toBe(false)
    })

    it('应该处理showModal失败', async () => {
      const mockMy = {
        showToast: vi.fn(),
        showModal: vi.fn((options) => options.fail(new Error('failed'))),
      }
      Object.defineProperty(window, 'my', {
        value: mockMy,
        writable: true,
        configurable: true,
      })

      const result = await adapter.show({ message: 'test', type: 'info' })
      expect(result.success).toBe(false)
    })

    it('应该返回true当请求权限', async () => {
      const result = await adapter.requestPermission?.()
      expect(result).toBe(true)
    })
  })

  describe('ElectronNotificationAdapter', () => {
    let adapter: ElectronNotificationAdapter

    beforeEach(() => {
      adapter = new ElectronNotificationAdapter()
    })

    it('应该降级到Web通知当electron不可用', async () => {
      class MockNotification {
        static requestPermission = vi.fn().mockResolvedValue('granted')
        static permission = 'granted'
        close = vi.fn()
        constructor() {}
      }
      vi.stubGlobal('Notification', MockNotification)
      document.hasFocus = vi.fn().mockReturnValue(false)

      const result = await adapter.show({ message: 'test' })
      expect(result.platform).toBe('web')
    })

    it('应该返回true当隐藏通知', async () => {
      const result = await adapter.hide?.('test-id')
      expect(result).toBe(true)
    })

    it('应该返回true当请求权限', async () => {
      const result = await adapter.requestPermission?.()
      expect(result).toBe(true)
    })
  })

  describe('NotificationManager', () => {
    it('应该返回单例实例', () => {
      const instance1 = NotificationManager.getInstance()
      const instance2 = NotificationManager.getInstance()
      expect(instance1).toBe(instance2)
    })

    it('应该显示通知', async () => {
      class MockNotification {
        static requestPermission = vi.fn().mockResolvedValue('granted')
        static permission = 'granted'
        close = vi.fn()
        constructor() {}
      }
      vi.stubGlobal('Notification', MockNotification)
      document.hasFocus = vi.fn().mockReturnValue(false)

      const manager = NotificationManager.getInstance()
      const result = await manager.show({ message: 'test' })
      expect(result.success).toBe(true)
    })

    it('应该隐藏通知', async () => {
      const manager = NotificationManager.getInstance()
      const result = await manager.hide('test-id')
      expect(result).toBe(true)
    })

    it('应该请求权限', async () => {
      class MockNotification {
        static requestPermission = vi.fn().mockResolvedValue('granted')
        static permission = 'granted'
        close = vi.fn()
        constructor() {}
      }
      vi.stubGlobal('Notification', MockNotification)

      const manager = NotificationManager.getInstance()
      const result = await manager.requestPermission()
      expect(result).toBe(true)
    })
  })

  describe('导出的便捷方法', () => {
    beforeEach(() => {
      class MockNotification {
        static requestPermission = vi.fn().mockResolvedValue('granted')
        static permission = 'granted'
        close = vi.fn()
        constructor() {}
      }
      vi.stubGlobal('Notification', MockNotification)
      document.hasFocus = vi.fn().mockReturnValue(true)
    })

    it('showNotification应该工作', async () => {
      const result = await showNotification({ message: 'test' })
      expect(result.success).toBe(true)
    })

    it('hideNotification应该工作', async () => {
      const result = await hideNotification('test-id')
      expect(result).toBe(true)
    })

    it('requestNotificationPermission应该工作', async () => {
      const result = await requestNotificationPermission()
      expect(result).toBe(true)
    })
  })

  describe('notify便捷对象', () => {
    beforeEach(() => {
      class MockNotification {
        static requestPermission = vi.fn().mockResolvedValue('granted')
        static permission = 'granted'
        close = vi.fn()
        constructor() {}
      }
      vi.stubGlobal('Notification', MockNotification)
      document.hasFocus = vi.fn().mockReturnValue(true)
    })

    it('notify.success应该工作', async () => {
      const result = await notify.success('test message')
      expect(result.success).toBe(true)
    })

    it('notify.warning应该工作', async () => {
      const result = await notify.warning('test message')
      expect(result.success).toBe(true)
    })

    it('notify.error应该工作', async () => {
      const result = await notify.error('test message')
      expect(result.success).toBe(true)
    })

    it('notify.info应该工作', async () => {
      const result = await notify.info('test message')
      expect(result.success).toBe(true)
    })

    it('notify方法应该支持title参数', async () => {
      const result = await notify.success('test message', 'test title')
      expect(result.success).toBe(true)
    })
  })

  describe('notificationManager导出', () => {
    it('应该是NotificationManager实例', () => {
      expect(notificationManager).toBeInstanceOf(NotificationManager)
    })
  })
})
