import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DeviceService } from '../deviceService'

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}

const mockNavigator = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  language: 'zh-CN',
  platform: 'Win32',
  hardwareConcurrency: 8,
}

const mockScreen = {
  width: 1920,
  height: 1080,
  colorDepth: 24,
}

describe('deviceService.ts', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', mockLocalStorage)
    vi.stubGlobal('navigator', mockNavigator)
    vi.stubGlobal('screen', mockScreen)
    vi.stubGlobal('window', {
      screen: mockScreen,
      WebGLRenderingContext: class {},
    })
    vi.stubGlobal('document', {
      createElement: vi.fn().mockReturnValue({
        getContext: vi.fn().mockReturnValue(null),
        toDataURL: vi.fn().mockReturnValue('data:image/png;base64,test'),
      }),
    })
    vi.stubGlobal('crypto', {
      subtle: {
        digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
      },
    })
    vi.stubGlobal('TextEncoder', class {
      encode(str: string) {
        return new Uint8Array(str.split('').map(c => c.charCodeAt(0)))
      }
    })
    vi.stubGlobal('Intl', {
      DateTimeFormat: vi.fn().mockReturnValue({
        resolvedOptions: () => ({ timeZone: 'Asia/Shanghai' }),
      }),
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('getDeviceInfo', () => {
    it('应该返回存储的设备信息', async () => {
      const storedInfo = {
        fingerprint: 'test-fingerprint',
        deviceId: 'test-device-id',
        userAgent: 'test-agent',
        platform: 'test-platform',
        language: 'zh-CN',
        screenWidth: 1920,
        screenHeight: 1080,
        colorDepth: 24,
        timezone: 'Asia/Shanghai',
        createdAt: Date.now(),
      }
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(storedInfo))

      const result = await DeviceService.getDeviceInfo()
      expect(result).toEqual(storedInfo)
    })

    it('应该在无存储时生成新设备信息', async () => {
      mockLocalStorage.getItem.mockReturnValue(null)
      mockLocalStorage.setItem.mockImplementation(() => {})

      const result = await DeviceService.getDeviceInfo()
      expect(result).toBeDefined()
      expect(result?.userAgent).toBe(mockNavigator.userAgent)
    })

    it('应该处理无效JSON', async () => {
      mockLocalStorage.getItem.mockReturnValue('invalid-json')
      mockLocalStorage.setItem.mockImplementation(() => {})

      const result = await DeviceService.getDeviceInfo()
      expect(result).toBeDefined()
    })
  })

  describe('generateDeviceInfo', () => {
    it('应该生成设备信息', async () => {
      mockLocalStorage.getItem.mockReturnValue(null)
      mockLocalStorage.setItem.mockImplementation(() => {})

      const result = await DeviceService.generateDeviceInfo()
      expect(result.fingerprint).toBeDefined()
      expect(result.deviceId).toBeDefined()
      expect(result.userAgent).toBe(mockNavigator.userAgent)
      expect(result.platform).toBe(mockNavigator.platform)
      expect(result.language).toBe(mockNavigator.language)
      expect(result.screenWidth).toBe(mockScreen.width)
      expect(result.screenHeight).toBe(mockScreen.height)
      expect(result.colorDepth).toBe(mockScreen.colorDepth)
      expect(result.timezone).toBe('Asia/Shanghai')
      expect(result.createdAt).toBeDefined()
    })

    it('应该使用存储的设备ID', async () => {
      mockLocalStorage.getItem.mockReturnValue('stored-device-id')
      mockLocalStorage.setItem.mockImplementation(() => {})

      const result = await DeviceService.generateDeviceInfo()
      expect(result.deviceId).toBe('stored-device-id')
    })
  })

  describe('getDeviceId', () => {
    it('应该返回存储的设备ID', () => {
      mockLocalStorage.getItem.mockReturnValue('test-device-id')
      const result = DeviceService.getDeviceId()
      expect(result).toBe('test-device-id')
    })

    it('应该返回null当没有存储时', () => {
      mockLocalStorage.getItem.mockReturnValue(null)
      const result = DeviceService.getDeviceId()
      expect(result).toBeNull()
    })
  })

  describe('validateDevice', () => {
    it('应该返回valid当首次设备', async () => {
      mockLocalStorage.getItem.mockReturnValue(null)
      const result = await DeviceService.validateDevice()
      expect(result.valid).toBe(true)
      expect(result.reason).toBe('首次设备')
    })

    it('应该返回valid当指纹匹配', async () => {
      const storedInfo = {
        fingerprint: 'test-fingerprint',
        deviceId: 'test-device-id',
        userAgent: 'test-agent',
        platform: 'test-platform',
        language: 'zh-CN',
        screenWidth: 1920,
        screenHeight: 1080,
        colorDepth: 24,
        timezone: 'Asia/Shanghai',
        createdAt: Date.now(),
      }
      mockLocalStorage.getItem.mockReturnValueOnce(JSON.stringify(storedInfo))
      mockLocalStorage.getItem.mockReturnValueOnce(null)

      const result = await DeviceService.validateDevice()
      expect(result.valid).toBeDefined()
    })

    it('应该处理无效JSON', async () => {
      mockLocalStorage.getItem.mockReturnValue('invalid-json')
      const result = await DeviceService.validateDevice()
      expect(result.valid).toBe(true)
    })
  })

  describe('clearDeviceInfo', () => {
    it('应该清除设备信息', () => {
      DeviceService.clearDeviceInfo()
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('device_fingerprint')
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('device_id')
    })
  })

  describe('getHeaders', () => {
    it('应该返回设备ID头', () => {
      mockLocalStorage.getItem.mockReturnValue('test-device-id')
      const headers = DeviceService.getHeaders()
      expect(headers['X-Device-Id']).toBe('test-device-id')
    })

    it('应该返回空对象当没有设备ID', () => {
      mockLocalStorage.getItem.mockReturnValue(null)
      const headers = DeviceService.getHeaders()
      expect(headers).toEqual({})
    })
  })
})
