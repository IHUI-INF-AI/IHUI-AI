import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { logger, setFastify, type FastifyLogInstance } from '../src/utils/logger.js'

describe('logger — 统一日志工具', () => {
  beforeEach(() => {
    setFastify(null as unknown as FastifyLogInstance)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('未注入 fastify：回退 console', () => {
    it('info 调用 console.info 带 [INFO] 前缀', () => {
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
      logger.info('hello')
      expect(spy).toHaveBeenCalledWith('[INFO] hello')
    })
    it('info 带 meta 对象', () => {
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
      logger.info('hello', { user: 'u1' })
      expect(spy).toHaveBeenCalledWith('[INFO] hello', { user: 'u1' })
    })
    it('warn 调用 console.warn', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      logger.warn('w')
      expect(spy).toHaveBeenCalledWith('[WARN] w')
    })
    it('error 调用 console.error', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      logger.error('e')
      expect(spy).toHaveBeenCalledWith('[ERROR] e')
    })
    it('debug 调用 console.info', () => {
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
      logger.debug('d')
      expect(spy).toHaveBeenCalledWith('[DEBUG] d')
    })
    it('无 meta 时不传第二个参数', () => {
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
      logger.info('only-msg')
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy).toHaveBeenCalledWith('[INFO] only-msg')
    })
  })

  describe('已注入 fastify：调用 pino', () => {
    function makeFastify() {
      return {
        log: {
          debug: vi.fn(),
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        },
      }
    }
    it('info 调用 fastify.log.info(meta, msg)', () => {
      const f = makeFastify()
      setFastify(f as unknown as FastifyLogInstance)
      logger.info('hello', { k: 1 })
      expect(f.log.info).toHaveBeenCalledWith({ k: 1 }, 'hello')
    })
    it('无 meta 时传入空对象', () => {
      const f = makeFastify()
      setFastify(f as unknown as FastifyLogInstance)
      logger.info('hello')
      expect(f.log.info).toHaveBeenCalledWith({}, 'hello')
    })
    it('各 level 路由正确', () => {
      const f = makeFastify()
      setFastify(f as unknown as FastifyLogInstance)
      logger.debug('d')
      logger.info('i')
      logger.warn('w')
      logger.error('e')
      expect(f.log.debug).toHaveBeenCalledWith({}, 'd')
      expect(f.log.info).toHaveBeenCalledWith({}, 'i')
      expect(f.log.warn).toHaveBeenCalledWith({}, 'w')
      expect(f.log.error).toHaveBeenCalledWith({}, 'e')
    })
  })
})
