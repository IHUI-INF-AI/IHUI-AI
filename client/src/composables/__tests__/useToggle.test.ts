import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useToggle, useBoolean, useCounter, useClamp, useCycleList, useStep } from '../useToggle'

vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    onUnmounted: vi.fn(),
  }
})

describe('useToggle.ts', () => {
  describe('useToggle', () => {
    it('初始值应该是false', () => {
      const [value] = useToggle()
      expect(value.value).toBe(false)
    })

    it('应该支持自定义初始值', () => {
      const [value] = useToggle(true)
      expect(value.value).toBe(true)
    })

    it('toggle应该切换值', () => {
      const [value, toggle] = useToggle(false)
      toggle()
      expect(value.value).toBe(true)
      toggle()
      expect(value.value).toBe(false)
    })

    it('toggle应该设置指定值', () => {
      const [value, toggle] = useToggle(false)
      toggle(true)
      expect(value.value).toBe(true)
      toggle(false)
      expect(value.value).toBe(false)
    })
  })

  describe('useBoolean', () => {
    it('初始值应该是false', () => {
      const { value } = useBoolean()
      expect(value.value).toBe(false)
    })

    it('setTrue应该设置为true', () => {
      const { value, setTrue } = useBoolean(false)
      setTrue()
      expect(value.value).toBe(true)
    })

    it('setFalse应该设置为false', () => {
      const { value, setFalse } = useBoolean(true)
      setFalse()
      expect(value.value).toBe(false)
    })

    it('toggle应该切换值', () => {
      const { value, toggle } = useBoolean(false)
      toggle()
      expect(value.value).toBe(true)
    })

    it('set应该设置指定值', () => {
      const { value, set } = useBoolean(false)
      set(true)
      expect(value.value).toBe(true)
    })
  })

  describe('useCounter', () => {
    it('初始值应该是0', () => {
      const { count } = useCounter()
      expect(count.value).toBe(0)
    })

    it('应该支持自定义初始值', () => {
      const { count } = useCounter(10)
      expect(count.value).toBe(10)
    })

    it('inc应该增加计数', () => {
      const { count, inc } = useCounter(0)
      inc()
      expect(count.value).toBe(1)
      inc(5)
      expect(count.value).toBe(6)
    })

    it('dec应该减少计数', () => {
      const { count, dec } = useCounter(10)
      dec()
      expect(count.value).toBe(9)
      dec(5)
      expect(count.value).toBe(4)
    })

    it('应该支持最小值限制', () => {
      const { count, dec } = useCounter(0, { min: 0 })
      dec()
      expect(count.value).toBe(0)
    })

    it('应该支持最大值限制', () => {
      const { count, inc } = useCounter(10, { max: 10 })
      inc()
      expect(count.value).toBe(10)
    })

    it('reset应该重置计数', () => {
      const { count, inc, reset } = useCounter(5)
      inc(10)
      reset()
      expect(count.value).toBe(5)
    })
  })

  describe('useClamp', () => {
    it('应该限制值在范围内', () => {
      const value = useClamp(5, 0, 10)
      expect(value.value).toBe(5)
    })

    it('应该限制最小值', () => {
      const value = useClamp(-5, 0, 10)
      expect(value.value).toBe(0)
    })

    it('应该限制最大值', () => {
      const value = useClamp(15, 0, 10)
      expect(value.value).toBe(10)
    })

    it('设置值时应该限制范围', () => {
      const value = useClamp(5, 0, 10)
      value.value = 20
      expect(value.value).toBe(10)
    })
  })

  describe('useCycleList', () => {
    it('应该循环遍历列表', () => {
      const { state, next } = useCycleList(['a', 'b', 'c'])
      expect(state.value).toBe('a')
      next()
      expect(state.value).toBe('b')
      next()
      expect(state.value).toBe('c')
      next()
      expect(state.value).toBe('a')
    })

    it('prev应该反向遍历', () => {
      const { state, prev } = useCycleList(['a', 'b', 'c'])
      prev()
      expect(state.value).toBe('c')
    })

    it('go应该跳转到指定索引', () => {
      const { state, go } = useCycleList(['a', 'b', 'c'])
      go(2)
      expect(state.value).toBe('c')
    })
  })

  describe('useStep', () => {
    it('应该管理步骤', () => {
      const { current, next, prev } = useStep(3)
      expect(current.value).toBe(0)
      next()
      expect(current.value).toBe(1)
      next()
      expect(current.value).toBe(2)
      next()
      expect(current.value).toBe(2)
    })

    it('isFirst和isLast应该正确', () => {
      const { isFirst, isLast, next } = useStep(3)
      expect(isFirst.value).toBe(true)
      expect(isLast.value).toBe(false)
      next()
      next()
      expect(isFirst.value).toBe(false)
      expect(isLast.value).toBe(true)
    })
  })
})
