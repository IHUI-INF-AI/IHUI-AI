import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter, EventBus } from '../event-emitter'

vi.mock('../logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('event-emitter', () => {
  let emitter: EventEmitter

  beforeEach(() => {
    emitter = new EventEmitter()
    vi.clearAllMocks()
  })

  describe('EventEmitter', () => {
    it('应该创建EventEmitter实例', () => {
      expect(emitter).toBeDefined()
    })

    it('应该注册和触发事件', () => {
      const handler = vi.fn()
      emitter.on('test', handler)
      emitter.emit('test', 'payload')
      expect(handler).toHaveBeenCalledWith('payload')
    })

    it('应该返回取消订阅函数', () => {
      const handler = vi.fn()
      const unsubscribe = emitter.on('test', handler)
      unsubscribe()
      emitter.emit('test', 'payload')
      expect(handler).not.toHaveBeenCalled()
    })

    it('应该支持多个处理器', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      emitter.on('test', handler1)
      emitter.on('test', handler2)
      emitter.emit('test', 'payload')
      expect(handler1).toHaveBeenCalled()
      expect(handler2).toHaveBeenCalled()
    })

    it('once应该只触发一次', () => {
      const handler = vi.fn()
      emitter.once('test', handler)
      emitter.emit('test', 'payload1')
      emitter.emit('test', 'payload2')
      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith('payload1')
    })

    it('once应该返回取消订阅函数', () => {
      const handler = vi.fn()
      const unsubscribe = emitter.once('test', handler)
      unsubscribe()
      emitter.emit('test', 'payload')
      expect(handler).not.toHaveBeenCalled()
    })

    it('off应该移除事件处理器', () => {
      const handler = vi.fn()
      emitter.on('test', handler)
      emitter.off('test', handler)
      emitter.emit('test', 'payload')
      expect(handler).not.toHaveBeenCalled()
    })

    it('off不传handler应该移除所有处理器', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      emitter.on('test', handler1)
      emitter.on('test', handler2)
      emitter.off('test')
      emitter.emit('test', 'payload')
      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
    })

    it('应该处理不存在的事件', () => {
      emitter.emit('non-existent', 'payload')
    })

    it('应该处理没有payload的emit', () => {
      const handler = vi.fn()
      emitter.on('test', handler)
      emitter.emit('test')
      expect(handler).toHaveBeenCalledWith(undefined)
    })

    it('emitAsync应该等待所有处理器完成', async () => {
      const handler = vi.fn().mockResolvedValue(undefined)
      emitter.on('test', handler)
      await emitter.emitAsync('test', 'payload')
      expect(handler).toHaveBeenCalledWith('payload')
    })

    it('emitAsync应该处理once处理器', async () => {
      const handler = vi.fn().mockResolvedValue(undefined)
      emitter.once('test', handler)
      await emitter.emitAsync('test', 'payload')
      expect(handler).toHaveBeenCalledWith('payload')
    })

    it('listenerCount应该返回监听器数量', () => {
      emitter.on('test', vi.fn())
      emitter.on('test', vi.fn())
      emitter.once('test', vi.fn())
      expect(emitter.listenerCount('test')).toBe(3)
    })

    it('listenerCount应该返回0当没有监听器', () => {
      expect(emitter.listenerCount('non-existent')).toBe(0)
    })

    it('eventNames应该返回所有事件名', () => {
      emitter.on('test1', vi.fn())
      emitter.on('test2', vi.fn())
      emitter.once('test3', vi.fn())
      const names = emitter.eventNames()
      expect(names).toContain('test1')
      expect(names).toContain('test2')
      expect(names).toContain('test3')
    })

    it('eventNames应该返回空数组当没有事件', () => {
      expect(emitter.eventNames()).toEqual([])
    })

    it('removeAllListeners应该移除指定事件的所有监听器', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      emitter.on('test', handler1)
      emitter.on('test', handler2)
      emitter.removeAllListeners('test')
      emitter.emit('test', 'payload')
      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
    })

    it('removeAllListeners不传参数应该移除所有监听器', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      emitter.on('test1', handler1)
      emitter.on('test2', handler2)
      emitter.removeAllListeners()
      emitter.emit('test1', 'payload')
      emitter.emit('test2', 'payload')
      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
    })

    it('应该处理处理器中的错误', () => {
      const errorHandler = () => {
        throw new Error('test error')
      }
      const normalHandler = vi.fn()
      emitter.on('test', errorHandler)
      emitter.on('test', normalHandler)
      emitter.emit('test', 'payload')
      expect(normalHandler).toHaveBeenCalled()
    })

    it('应该处理once处理器中的错误', () => {
      const errorHandler = () => {
        throw new Error('test error')
      }
      emitter.once('test', errorHandler)
      emitter.emit('test', 'payload')
    })

    it('emitAsync应该处理异步错误', async () => {
      const errorHandler = vi.fn().mockRejectedValue(new Error('async error'))
      emitter.on('test', errorHandler)
      await emitter.emitAsync('test', 'payload')
      expect(errorHandler).toHaveBeenCalled()
    })
  })

  describe('EventBus', () => {
    it('应该是EventEmitter实例', () => {
      expect(EventBus).toBeInstanceOf(EventEmitter)
    })

    it('应该能够注册和触发事件', () => {
      const handler = vi.fn()
      EventBus.on('global-test', handler)
      EventBus.emit('global-test', 'payload')
      expect(handler).toHaveBeenCalledWith('payload')
      EventBus.off('global-test', handler)
    })
  })
})
