import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LogLevel, logger } from '../logger'

vi.stubEnv('VITE_LOG_LEVEL', 'DEBUG')
vi.stubEnv('DEV', true)
vi.stubEnv('MODE', 'development')

describe('logger', () => {
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>
  let consoleLogSpy: ReturnType<typeof vi.spyOn>
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('LogLevel枚举', () => {
    it('应该定义所有日志级别', () => {
      expect(LogLevel.DEBUG).toBe(0)
      expect(LogLevel.INFO).toBe(1)
      expect(LogLevel.WARN).toBe(2)
      expect(LogLevel.ERROR).toBe(3)
      expect(LogLevel.NONE).toBe(4)
    })
  })

  describe('logger singleton', () => {
    it('should export logger instance', () => {
      expect(logger).toBeDefined()
    })

    it('应该能够调用debug方法', () => {
      logger.debug('test debug')
    })

    it('应该能够调用info方法', () => {
      logger.info('test info')
    })

    it('应该能够调用warn方法', () => {
      logger.warn('test warn')
    })

    it('应该能够调用error方法', () => {
      logger.error('test error')
    })

    it('应该能够调用setLevel方法', () => {
      logger.setLevel(LogLevel.DEBUG)
    })

    it('应该能够调用getLevel方法', () => {
      const level = logger.getLevel()
      expect(typeof level).toBe('number')
    })

    it('应该处理带parameter的日志', () => {
      logger.info('test message', { key: 'value' }, 'extra parameters')
    })

    it('应该处理Error对象', () => {
      const error = new Error('测试错误')
      logger.error('Error occurred', error)
    })

    it('应该处理非Error类型的错误parameter', () => {
      logger.error('Error occurred', 'string error')
    })

    it('应该处理对象类型的错误parameter', () => {
      logger.error('Error occurred', { code: 500, message: 'server error' })
    })

    it('应该处理多个parameter', () => {
      logger.info('message', 'parameter1', 'parameter2', 'parameter3')
    })

    it('setLevel应该设置日志级别', () => {
      logger.setLevel(LogLevel.WARN)
      expect(logger.getLevel()).toBe(LogLevel.WARN)
    })

    it('getLevel应该返回当前日志级别', () => {
      const level = logger.getLevel()
      expect(typeof level).toBe('number')
    })
  })
})
