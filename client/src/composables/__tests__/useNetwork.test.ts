import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useOnline, useOffline, useNetwork } from '../useNetwork'

vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    onMounted: vi.fn((fn) => fn()),
    onUnmounted: vi.fn(),
  }
})

describe('useNetwork.ts', () => {
  beforeEach(() => {
    // 每个测试前重置在线状态为 true
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true })
  })

  afterEach(() => {
    // 先恢复全局 stub，确保 navigator 存在
    vi.unstubAllGlobals()
    // 清理测试中添加的 connection
    try {
      delete (navigator as any).connection
    } catch (e) {
      // 忽略删除失败
    }
    // 恢复在线状态
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true })
  })

  describe('useOnline', () => {
    it('应该返回在线状态', () => {
      const isOnline = useOnline()
      expect(typeof isOnline.value).toBe('boolean')
    })

    it('应该根据 navigator.onLine 初始化', () => {
      // 设置为离线，验证初始值同步
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true })
      const isOnline = useOnline()
      expect(isOnline.value).toBe(false)
    })

    it('应该响应 online 事件', () => {
      const isOnline = useOnline()
      // 先置为 false，触发 online 事件后应变为 true
      isOnline.value = false
      window.dispatchEvent(new Event('online'))
      expect(isOnline.value).toBe(true)
    })

    it('应该响应 offline 事件', () => {
      const isOnline = useOnline()
      // 默认在线，触发 offline 事件后应变为 false
      window.dispatchEvent(new Event('offline'))
      expect(isOnline.value).toBe(false)
    })

    it('SSR 场景下返回默认在线值', () => {
      // 模拟 navigator 不存在（服务端渲染）
      vi.stubGlobal('navigator', undefined)
      const isOnline = useOnline()
      expect(isOnline.value).toBe(true)
    })
  })

  describe('useOffline', () => {
    it('应该返回布尔值', () => {
      const isOffline = useOffline()
      expect(typeof isOffline.value).toBe('boolean')
    })
  })

  describe('useNetwork', () => {
    it('应该返回网络信息', () => {
      const network = useNetwork()

      expect(network.isOnline).toBeDefined()
      expect(network.isOffline).toBeDefined()
      expect(network.saveData).toBeDefined()
      expect(network.effectiveType).toBeDefined()
      expect(network.downlink).toBeDefined()
      expect(network.rtt).toBeDefined()
    })

    it('isOnline应该是布尔值', () => {
      const { isOnline } = useNetwork()
      expect(typeof isOnline.value).toBe('boolean')
    })

    it('saveData应该是布尔值', () => {
      const { saveData } = useNetwork()
      expect(typeof saveData.value).toBe('boolean')
    })

    it('应该读取 connection 信息', () => {
      // 模拟 connection 对象存在
      ;(navigator as any).connection = {
        effectiveType: '4g',
        downlink: 10,
        rtt: 50,
        saveData: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }

      const network = useNetwork()
      expect(network.effectiveType.value).toBe('4g')
      expect(network.downlink.value).toBe(10)
      expect(network.rtt.value).toBe(50)
      expect(network.saveData.value).toBe(false)
    })

    it('应该响应 connection 的 change 事件', () => {
      // 收集事件处理器，用于手动触发
      const handlers: Record<string, () => void> = {}
      ;(navigator as any).connection = {
        effectiveType: '3g',
        downlink: 1.5,
        rtt: 100,
        saveData: true,
        addEventListener: vi.fn((type: string, handler: () => void) => { handlers[type] = handler }),
        removeEventListener: vi.fn(),
      }

      const network = useNetwork()
      // 修改属性后触发 change 事件
      ;(navigator as any).connection.effectiveType = '4g'
      ;(navigator as any).connection.downlink = 10
      ;(navigator as any).connection.rtt = 50
      ;(navigator as any).connection.saveData = false
      handlers.change()

      expect(network.effectiveType.value).toBe('4g')
      expect(network.downlink.value).toBe(10)
      expect(network.rtt.value).toBe(50)
      expect(network.saveData.value).toBe(false)
    })

    it('没有 connection 时返回默认 null 值', () => {
      delete (navigator as any).connection
      const network = useNetwork()
      expect(network.effectiveType.value).toBe(null)
      expect(network.downlink.value).toBe(null)
      expect(network.rtt.value).toBe(null)
    })

    it('connection 没有 addEventListener 时不报错', () => {
      // connection 存在但无 addEventListener 方法
      ;(navigator as any).connection = {
        effectiveType: '4g',
        downlink: 10,
        rtt: 50,
        saveData: false,
      }
      const network = useNetwork()
      expect(network.effectiveType.value).toBe('4g')
    })

    it('connection 属性为 falsy 值时使用默认值', () => {
      // 属性为 undefined/0 等 falsy 值，触发 || 的 falsy 分支
      ;(navigator as any).connection = {
        effectiveType: undefined,
        downlink: 0,
        rtt: 0,
        saveData: undefined,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }
      const network = useNetwork()
      expect(network.effectiveType.value).toBe(null)
      expect(network.downlink.value).toBe(null)
      expect(network.rtt.value).toBe(null)
      expect(network.saveData.value).toBe(false)
    })

    it('change 事件中属性为 falsy 值时使用默认值', () => {
      // 触发 handleChange 中 || 的 falsy 分支
      const handlers: Record<string, () => void> = {}
      ;(navigator as any).connection = {
        effectiveType: '4g',
        downlink: 10,
        rtt: 50,
        saveData: true,
        addEventListener: vi.fn((type: string, handler: () => void) => { handlers[type] = handler }),
        removeEventListener: vi.fn(),
      }
      const network = useNetwork()
      // 修改为 falsy 值后触发 change
      ;(navigator as any).connection.effectiveType = undefined
      ;(navigator as any).connection.downlink = 0
      ;(navigator as any).connection.rtt = 0
      ;(navigator as any).connection.saveData = false
      handlers.change()
      expect(network.effectiveType.value).toBe(null)
      expect(network.downlink.value).toBe(null)
      expect(network.rtt.value).toBe(null)
      expect(network.saveData.value).toBe(false)
    })

    it('SSR 场景下返回默认值', () => {
      // 模拟 navigator 不存在（服务端渲染）
      vi.stubGlobal('navigator', undefined)
      const network = useNetwork()
      expect(network.isOnline.value).toBe(true)
      expect(network.isOffline.value).toBe(false)
      expect(network.saveData.value).toBe(false)
      expect(network.effectiveType.value).toBe(null)
      expect(network.downlink.value).toBe(null)
      expect(network.rtt.value).toBe(null)
    })
  })
})
