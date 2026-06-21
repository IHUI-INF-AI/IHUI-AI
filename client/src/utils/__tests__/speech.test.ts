import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  SpeechRecognitionError,
  SpeechProvider,
  isSpeechRecognitionSupported,
  getProviderStatus,
  getCurrentProvider,
  setProvider,
  speechManager,
  configureSpeechService,
  startSpeechRecognition,
  stopSpeechRecognition,
  getAccumulatedText,
} from '../speech'

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

describe('speech', () => {
  let mockRecognition: {
    lang: string
    continuous: boolean
    interimResults: boolean
    start: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
    abort: ReturnType<typeof vi.fn>
    onresult: ((event: any) => void) | null
    onerror: ((event: any) => void) | null
    onstart: (() => void) | null
    onend: (() => void) | null
  }

  beforeEach(() => {
    mockRecognition = {
      lang: '',
      continuous: false,
      interimResults: false,
      start: vi.fn(),
      stop: vi.fn(),
      abort: vi.fn(),
      onresult: null,
      onerror: null,
      onstart: null,
      onend: null,
    }

    Object.defineProperty(window, 'webkitSpeechRecognition', {
      value: function MockSpeechRecognition() {
        return mockRecognition
      },
      writable: true,
      configurable: true,
    })

    Object.defineProperty(window, 'SpeechRecognition', {
      value: undefined,
      writable: true,
      configurable: true,
    })

    Object.defineProperty(window, 'mozSpeechRecognition', {
      value: undefined,
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    stopSpeechRecognition()
  })

  describe('SpeechRecognitionError', () => {
    it('应该创建错误对象', () => {
      const error = new SpeechRecognitionError('测试错误', 'TEST_CODE')
      expect(error.message).toBe('测试错误')
      expect(error.code).toBe('TEST_CODE')
      expect(error.name).toBe('SpeechRecognitionError')
    })

    it('应该支持suggestion属性', () => {
      const error = new SpeechRecognitionError('测试错误')
      error.suggestion = '建议信息'
      expect(error.suggestion).toBe('建议信息')
    })
  })

  describe('isSpeechRecognitionSupported', () => {
    it('应该返回true当支持webkitSpeechRecognition', () => {
      expect(isSpeechRecognitionSupported()).toBe(true)
    })

    it('应该返回false当不支持语音识别', () => {
      Object.defineProperty(window, 'webkitSpeechRecognition', {
        value: undefined,
        writable: true,
        configurable: true,
      })
      expect(isSpeechRecognitionSupported()).toBe(false)
    })

    it('应该返回true当支持标准SpeechRecognition', () => {
      Object.defineProperty(window, 'SpeechRecognition', {
        value: function MockSpeechRecognition() {
          return mockRecognition
        },
        writable: true,
        configurable: true,
      })
      Object.defineProperty(window, 'webkitSpeechRecognition', {
        value: undefined,
        writable: true,
        configurable: true,
      })
      expect(isSpeechRecognitionSupported()).toBe(true)
    })

    it('应该返回true当支持mozSpeechRecognition', () => {
      Object.defineProperty(window, 'mozSpeechRecognition', {
        value: function MockSpeechRecognition() {
          return mockRecognition
        },
        writable: true,
        configurable: true,
      })
      Object.defineProperty(window, 'webkitSpeechRecognition', {
        value: undefined,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(window, 'SpeechRecognition', {
        value: undefined,
        writable: true,
        configurable: true,
      })
      expect(isSpeechRecognitionSupported()).toBe(true)
    })
  })

  describe('getProviderStatus', () => {
    it('应该返回提供商状态', () => {
      const status = getProviderStatus()
      expect(status).toHaveProperty(SpeechProvider.WEBKIT)
      expect(status).toHaveProperty(SpeechProvider.MOZ)
      expect(status).toHaveProperty(SpeechProvider.STANDARD)
      expect(status).toHaveProperty(SpeechProvider.BAIDU)
      expect(status).toHaveProperty(SpeechProvider.WHISPER)
    })
  })

  describe('getCurrentProvider和setProvider', () => {
    it('应该设置和获取提供商', () => {
      setProvider(SpeechProvider.BAIDU)
      expect(getCurrentProvider()).toBe(SpeechProvider.BAIDU)
    })
  })

  describe('speechManager', () => {
    it('应该包含所有管理方法', () => {
      expect(typeof speechManager.getProviderStatus).toBe('function')
      expect(typeof speechManager.getCurrentProvider).toBe('function')
      expect(typeof speechManager.setProvider).toBe('function')
      expect(typeof speechManager.getBestAvailableProvider).toBe('function')
      expect(typeof speechManager.startRecognition).toBe('function')
      expect(typeof speechManager.stopRecognition).toBe('function')
    })
  })

  describe('configureSpeechService', () => {
    it('应该配置提供商', () => {
      configureSpeechService({ provider: SpeechProvider.WHISPER })
      expect(getCurrentProvider()).toBe(SpeechProvider.WHISPER)
    })

    it('应该配置降级顺序', () => {
      configureSpeechService({
        fallbackOrder: [SpeechProvider.WEBKIT, SpeechProvider.STANDARD],
      })
    })
  })

  describe('startSpeechRecognition', () => {
    it('应该调用onStart回调', () => {
      const onStart = vi.fn()
      startSpeechRecognition({ onStart })
      mockRecognition.onstart!()
      expect(onStart).toHaveBeenCalled()
    })

    it('应该调用onEnd回调', () => {
      const onEnd = vi.fn()
      startSpeechRecognition({ onEnd })
      mockRecognition.onend!()
      expect(onEnd).toHaveBeenCalled()
    })

    it('应该调用onResult回调处理最终结果', () => {
      const onResult = vi.fn()
      startSpeechRecognition({ onResult })
      mockRecognition.onstart!()
      
      const event = {
        resultIndex: 0,
        results: [
          { isFinal: true, 0: { transcript: '你好' } }
        ]
      }
      mockRecognition.onresult!(event)
      
      expect(onResult).toHaveBeenCalledWith('你好', true)
    })

    it('应该调用onResult回调处理临时结果', () => {
      const onResult = vi.fn()
      startSpeechRecognition({ onResult })
      mockRecognition.onstart!()
      
      const event = {
        resultIndex: 0,
        results: [
          { isFinal: false, 0: { transcript: '临时' } }
        ]
      }
      mockRecognition.onresult!(event)
      
      expect(onResult).toHaveBeenCalledWith('临时', false)
    })

    it('应该调用onError回调', () => {
      const onError = vi.fn()
      startSpeechRecognition({ onError })
      
      const event = { error: 'network', message: '网络错误' }
      mockRecognition.onerror!(event)
      
      expect(onError).toHaveBeenCalled()
      const error = onError.mock.calls[0][0]
      expect(error).toBeInstanceOf(SpeechRecognitionError)
    })

    it('应该在不支持时调用onError回调', () => {
      Object.defineProperty(window, 'webkitSpeechRecognition', {
        value: undefined,
        writable: true,
        configurable: true,
      })
      
      const onError = vi.fn()
      startSpeechRecognition({ onError })
      
      expect(onError).toHaveBeenCalled()
      const error = onError.mock.calls[0][0]
      expect(error.code).toBe('NOT_SUPPORTED')
    })

    it('应该正确设置识别参数', () => {
      startSpeechRecognition({})
      expect(mockRecognition.lang).toBe('zh-CN')
      expect(mockRecognition.continuous).toBe(true)
      expect(mockRecognition.interimResults).toBe(true)
    })

    it('应该调用start方法', () => {
      startSpeechRecognition({})
      expect(mockRecognition.start).toHaveBeenCalled()
    })

    it('应该先停止之前的识别再开始新的', () => {
      const stopSpy = vi.spyOn(mockRecognition, 'stop')
      startSpeechRecognition({})
      startSpeechRecognition({})
      expect(stopSpy).toHaveBeenCalled()
    })
  })

  describe('stopSpeechRecognition', () => {
    it('应该停止识别', () => {
      startSpeechRecognition({})
      stopSpeechRecognition()
      expect(mockRecognition.stop).toHaveBeenCalled()
    })

    it('应该在没有识别实例时安全处理', () => {
      stopSpeechRecognition()
      expect(true).toBe(true)
    })
  })

  describe('getAccumulatedText', () => {
    it('应该返回累积的文本', () => {
      const onResult = vi.fn()
      startSpeechRecognition({ onResult })
      mockRecognition.onstart!()
      
      const event = {
        resultIndex: 0,
        results: [
          { isFinal: true, 0: { transcript: '测试文本' } }
        ]
      }
      mockRecognition.onresult!(event)
      
      expect(getAccumulatedText()).toBe('测试文本')
    })
  })
})
