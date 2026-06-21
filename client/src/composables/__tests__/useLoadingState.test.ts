import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useLoadingState, useNamedLoadingState, useAsyncState } from '../useLoadingState'

vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    onUnmounted: vi.fn(),
  }
})

describe('useLoadingState.ts', () => {
  describe('useLoadingState', () => {
    it('初始状态应该是false', () => {
      const { isLoading } = useLoadingState()
      expect(isLoading.value).toBe(false)
    })

    it('应该支持自定义初始状态', () => {
      const { isLoading } = useLoadingState(true)
      expect(isLoading.value).toBe(true)
    })

    it('start应该设置isLoading为true', () => {
      const { isLoading, start } = useLoadingState()
      start()
      expect(isLoading.value).toBe(true)
    })

    it('stop应该设置isLoading为false', () => {
      const { isLoading, start, stop } = useLoadingState()
      start()
      stop()
      expect(isLoading.value).toBe(false)
    })

    it('toggle应该切换状态', () => {
      const { isLoading, toggle } = useLoadingState()
      toggle()
      expect(isLoading.value).toBe(true)
      toggle()
      expect(isLoading.value).toBe(false)
    })

    it('setError应该设置错误', () => {
      const { error, setError } = useLoadingState()
      const err = new Error('test error')
      setError(err)
      expect(error.value).toBe(err)
    })

    it('clearError应该清除错误', () => {
      const { error, setError, clearError } = useLoadingState()
      setError(new Error('test'))
      clearError()
      expect(error.value).toBeNull()
    })

    it('withLoading应该自动管理加载状态', async () => {
      const { isLoading, error, withLoading } = useLoadingState()

      const fn = vi.fn().mockResolvedValue('result')
      const result = await withLoading(fn)

      expect(result).toBe('result')
      expect(isLoading.value).toBe(false)
      expect(error.value).toBeNull()
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('withLoading应该捕获错误', async () => {
      const { isLoading, error, withLoading } = useLoadingState()

      const fn = vi.fn().mockRejectedValue(new Error('async error'))

      await expect(withLoading(fn)).rejects.toThrow('async error')
      expect(isLoading.value).toBe(false)
      expect(error.value?.message).toBe('async error')
    })
  })

  describe('useNamedLoadingState', () => {
    it('应该管理多个命名加载状态', () => {
      const { isLoading, start, stop } = useNamedLoadingState()

      expect(isLoading('task1')).toBe(false)
      start('task1')
      expect(isLoading('task1')).toBe(true)
      stop('task1')
      expect(isLoading('task1')).toBe(false)
    })

    it('loadingNames应该返回正在加载的名称', () => {
      const { loadingNames, start } = useNamedLoadingState()

      start('task1')
      start('task2')
      expect(loadingNames.value).toContain('task1')
      expect(loadingNames.value).toContain('task2')
    })

    it('应该独立管理错误', () => {
      const { error, setError } = useNamedLoadingState()

      setError('task1', new Error('task1 error'))
      expect(error('task1')?.message).toBe('task1 error')
      expect(error('task2')).toBeNull()
    })

    it('withLoading应该管理命名状态', async () => {
      const { isLoading, error, withLoading } = useNamedLoadingState()

      const fn = vi.fn().mockResolvedValue('result')
      await withLoading('task1', fn)

      expect(isLoading('task1')).toBe(false)
      expect(error('task1')).toBeNull()
    })
  })

  describe('useAsyncState', () => {
    it('应该管理异步状态', async () => {
      const fn = vi.fn().mockResolvedValue('data')
      const { data, isLoading, error, execute } = useAsyncState(fn)

      const result = await execute()

      expect(result).toBe('data')
      expect(data.value).toBe('data')
      expect(isLoading.value).toBe(false)
      expect(error.value).toBeNull()
    })

    it('immediate选项应该立即执行', async () => {
      const fn = vi.fn().mockResolvedValue('data')
      useAsyncState(fn, { immediate: true })

      await vi.waitFor(() => {
        expect(fn).toHaveBeenCalledTimes(1)
      })
    })

    it('reset应该重置状态', async () => {
      const fn = vi.fn().mockResolvedValue('data')
      const { data, isLoading, error, execute, reset } = useAsyncState(fn)

      await execute()
      reset()

      expect(data.value).toBeNull()
      expect(isLoading.value).toBe(false)
      expect(error.value).toBeNull()
    })

    it('应该支持初始数据', () => {
      const fn = vi.fn().mockResolvedValue('data')
      const { data } = useAsyncState(fn, { initialData: 'initial' })

      expect(data.value).toBe('initial')
    })
  })
})
