import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('vue', () => ({
  onUnmounted: vi.fn(),
}))

describe('useEventBus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useEventBus', () => {
    it('应该创建事件总线', async () => {
      const { useEventBus } = await import('../useEventBus')
      const bus = useEventBus()
      
      expect(bus.on).toBeDefined()
      expect(bus.off).toBeDefined()
      expect(bus.emit).toBeDefined()
      expect(bus.once).toBeDefined()
      expect(bus.clear).toBeDefined()
      expect(bus.listenerCount).toBeDefined()
    })

    it('应该注册和触发事件', async () => {
      const { useEventBus } = await import('../useEventBus')
      const bus = useEventBus()
      const handler = vi.fn()
      
      bus.on('test', handler)
      bus.emit('test', 'data')
      
      expect(handler).toHaveBeenCalledWith('data')
    })

    it('应该取消注册事件', async () => {
      const { useEventBus } = await import('../useEventBus')
      const bus = useEventBus()
      const handler = vi.fn()
      
      bus.on('test', handler)
      bus.off('test', handler)
      bus.emit('test', 'data')
      
      expect(handler).not.toHaveBeenCalled()
    })

    it('on应该返回取消注册函数', async () => {
      const { useEventBus } = await import('../useEventBus')
      const bus = useEventBus()
      const handler = vi.fn()
      
      const unsubscribe = bus.on('test', handler)
      unsubscribe()
      bus.emit('test', 'data')
      
      expect(handler).not.toHaveBeenCalled()
    })

    it('once应该只触发一次', async () => {
      const { useEventBus } = await import('../useEventBus')
      const bus = useEventBus()
      const handler = vi.fn()
      
      bus.once('test', handler)
      bus.emit('test', 'data1')
      bus.emit('test', 'data2')
      
      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith('data1')
    })

    it('once应该返回取消注册函数', async () => {
      const { useEventBus } = await import('../useEventBus')
      const bus = useEventBus()
      const handler = vi.fn()
      
      const unsubscribe = bus.once('test', handler)
      unsubscribe()
      bus.emit('test', 'data')
      
      expect(handler).not.toHaveBeenCalled()
    })

    it('clear应该清除所有事件', async () => {
      const { useEventBus } = await import('../useEventBus')
      const bus = useEventBus()
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      
      bus.on('test1', handler1)
      bus.on('test2', handler2)
      bus.clear()
      bus.emit('test1', 'data')
      bus.emit('test2', 'data')
      
      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
    })

    it('listenerCount应该返回监听器数量', async () => {
      const { useEventBus } = await import('../useEventBus')
      const bus = useEventBus()
      
      expect(bus.listenerCount('test')).toBe(0)
      
      bus.on('test', vi.fn())
      expect(bus.listenerCount('test')).toBe(1)
      
      bus.on('test', vi.fn())
      expect(bus.listenerCount('test')).toBe(2)
    })

    it('应该支持多个监听器', async () => {
      const { useEventBus } = await import('../useEventBus')
      const bus = useEventBus()
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      
      bus.on('test', handler1)
      bus.on('test', handler2)
      bus.emit('test', 'data')
      
      expect(handler1).toHaveBeenCalledWith('data')
      expect(handler2).toHaveBeenCalledWith('data')
    })

    it('应该不触发不存在的事件', async () => {
      const { useEventBus } = await import('../useEventBus')
      const bus = useEventBus()
      
      expect(() => bus.emit('non-existent', 'data')).not.toThrow()
    })

    it('off应该不报错当事件不存在时', async () => {
      const { useEventBus } = await import('../useEventBus')
      const bus = useEventBus()
      
      expect(() => bus.off('non-existent', vi.fn())).not.toThrow()
    })
  })

  describe('createTypedEventBus', () => {
    it('应该创建类型化事件总线', async () => {
      const { createTypedEventBus } = await import('../useEventBus')
      const bus = createTypedEventBus<{ test: string }>()
      
      expect(bus.on).toBeDefined()
      expect(bus.off).toBeDefined()
      expect(bus.emit).toBeDefined()
      expect(bus.once).toBeDefined()
      expect(bus.useOn).toBeDefined()
      expect(bus.useOnce).toBeDefined()
    })

    it('useOn应该注册事件', async () => {
      const { createTypedEventBus } = await import('../useEventBus')
      const bus = createTypedEventBus<{ test: string }>()
      const handler = vi.fn()
      
      bus.useOn('test', handler)
      bus.emit('test', 'data')
      
      expect(handler).toHaveBeenCalledWith('data')
    })

    it('useOnce应该只触发一次', async () => {
      const { createTypedEventBus } = await import('../useEventBus')
      const bus = createTypedEventBus<{ test: string }>()
      const handler = vi.fn()
      
      bus.useOnce('test', handler)
      bus.emit('test', 'data1')
      bus.emit('test', 'data2')
      
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })
})
