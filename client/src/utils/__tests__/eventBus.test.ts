import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEventBus, globalEventBus, useEventBus } from '../eventBus'

vi.mock('../logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('eventBus', () => {
  describe('createEventBus', () => {
    it('应该创建EventBus实例', () => {
      const bus = createEventBus()
      expect(bus).toBeDefined()
      expect(typeof bus.on).toBe('function')
      expect(typeof bus.once).toBe('function')
      expect(typeof bus.off).toBe('function')
      expect(typeof bus.emit).toBe('function')
      expect(typeof bus.clear).toBe('function')
    })
  })

  describe('EventBus.on', () => {
    let bus: ReturnType<typeof createEventBus>

    beforeEach(() => {
      bus = createEventBus()
    })

    it('应该注册事件处理器', () => {
      const handler = vi.fn()
      bus.on('test', handler)
      bus.emit('test', 'payload')
      expect(handler).toHaveBeenCalledWith('payload')
    })

    it('应该返回取消订阅函数', () => {
      const handler = vi.fn()
      const unsubscribe = bus.on('test', handler)
      unsubscribe()
      bus.emit('test', 'payload')
      expect(handler).not.toHaveBeenCalled()
    })

    it('应该支持多个处理器', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      bus.on('test', handler1)
      bus.on('test', handler2)
      bus.emit('test', 'payload')
      expect(handler1).toHaveBeenCalled()
      expect(handler2).toHaveBeenCalled()
    })
  })

  describe('EventBus.once', () => {
    let bus: ReturnType<typeof createEventBus>

    beforeEach(() => {
      bus = createEventBus()
    })

    it('应该只触发一次', () => {
      const handler = vi.fn()
      bus.once('test', handler)
      bus.emit('test', 'payload1')
      bus.emit('test', 'payload2')
      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith('payload1')
    })
  })

  describe('EventBus.off', () => {
    let bus: ReturnType<typeof createEventBus>

    beforeEach(() => {
      bus = createEventBus()
    })

    it('应该移除事件处理器', () => {
      const handler = vi.fn()
      bus.on('test', handler)
      bus.off('test', handler)
      bus.emit('test', 'payload')
      expect(handler).not.toHaveBeenCalled()
    })

    it('应该处理不存在的事件', () => {
      const handler = vi.fn()
      bus.off('non-existent', handler)
    })
  })

  describe('EventBus.emit', () => {
    let bus: ReturnType<typeof createEventBus>

    beforeEach(() => {
      bus = createEventBus()
    })

    it('应该触发事件', () => {
      const handler = vi.fn()
      bus.on('test', handler)
      bus.emit('test', 'payload')
      expect(handler).toHaveBeenCalledWith('payload')
    })

    it('应该处理没有payload的emit', () => {
      const handler = vi.fn()
      bus.on('test', handler)
      bus.emit('test')
      expect(handler).toHaveBeenCalledWith(undefined)
    })

    it('应该处理不存在的事件', () => {
      bus.emit('non-existent', 'payload')
    })
  })

  describe('EventBus.clear', () => {
    let bus: ReturnType<typeof createEventBus>

    beforeEach(() => {
      bus = createEventBus()
    })

    it('应该清除指定事件的所有处理器', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      bus.on('test', handler1)
      bus.on('test', handler2)
      bus.clear('test')
      bus.emit('test', 'payload')
      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
    })

    it('应该清除所有事件', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      bus.on('test1', handler1)
      bus.on('test2', handler2)
      bus.clear()
      bus.emit('test1', 'payload')
      bus.emit('test2', 'payload')
      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
    })
  })

  describe('globalEventBus', () => {
    it('应该是EventBus实例', () => {
      expect(globalEventBus).toBeDefined()
      expect(typeof globalEventBus.on).toBe('function')
      expect(typeof globalEventBus.emit).toBe('function')
    })
  })

  describe('useEventBus', () => {
    it('应该返回事件操作方法', () => {
      const { on, once, off, emit, cleanup } = useEventBus()
      expect(typeof on).toBe('function')
      expect(typeof once).toBe('function')
      expect(typeof off).toBe('function')
      expect(typeof emit).toBe('function')
      expect(typeof cleanup).toBe('function')
    })

    it('应该支持订阅和发布事件', () => {
      const { on, emit } = useEventBus()
      const handler = vi.fn()
      on('test', handler)
      emit('test', 'payload')
      expect(handler).toHaveBeenCalledWith('payload')
    })

    it('cleanup应该清除所有订阅', () => {
      const { on, emit, cleanup } = useEventBus()
      const handler = vi.fn()
      on('test', handler)
      cleanup()
      emit('test', 'payload')
      expect(handler).not.toHaveBeenCalled()
    })

    it('应该支持自定义EventBus', () => {
      const customBus = createEventBus()
      const { on, emit } = useEventBus(customBus)
      const handler = vi.fn()
      on('test', handler)
      emit('test', 'payload')
      expect(handler).toHaveBeenCalledWith('payload')
    })
  })
})
