import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'

vi.mock('@/stores/loading', () => ({
  useLoadingStore: () => ({
    globalLoading: false,
    globalLoadingText: '加载中',
    localLoadings: {},
    localLoadingTexts: {},
    startGlobalLoading: vi.fn(),
    stopGlobalLoading: vi.fn(),
    startLocalLoading: vi.fn(),
    stopLocalLoading: vi.fn(),
    isLocalLoading: vi.fn(() => false),
    getLocalLoadingText: vi.fn(() => '加载中'),
  }),
}))

import { useLoading } from '../useLoading'

function withSetup<T>(composable: () => T): T {
  let result!: T
  const Comp = defineComponent({
    setup() {
      result = composable()
      return () => h('div')
    },
  })
  mount(Comp)
  return result
}

describe('useLoading', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('无 key 时使用全局加载', () => {
    const { start, stop, isLoading, getText, withLoading } = withSetup(() => useLoading())
    expect(start).toBeDefined()
    expect(stop).toBeDefined()
    expect(isLoading()).toBe(false)
    expect(getText()).toBe('加载中')
    expect(withLoading).toBeDefined()
  })

  it('有 key 时使用局部加载', () => {
    const loading = withSetup(() => useLoading('k1'))
    expect(loading.isLoading()).toBe(false)
    expect(loading.getText()).toBe('加载中')
  })

  it('withLoading 成功执行并自动停止', async () => {
    const loading = withSetup(() => useLoading())
    const fn = vi.fn().mockResolvedValue(42)
    const result = await loading.withLoading(fn, '正在加载')
    expect(result).toBe(42)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('withLoading 失败也自动停止并抛出错误', async () => {
    const loading = withSetup(() => useLoading())
    const fn = vi.fn().mockRejectedValue(new Error('boom'))
    await expect(loading.withLoading(fn)).rejects.toThrow('boom')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('withLoading 不传 text 也能工作', async () => {
    const loading = withSetup(() => useLoading())
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await loading.withLoading(fn)
    expect(result).toBe('ok')
  })

  it('组件卸载时自动停止局部加载', async () => {
    const Comp = defineComponent({
      setup() {
        const loading = useLoading('cleanup-key')
        loading.start('加载')
        return () => h('div')
      },
    })
    const wrapper = mount(Comp)
    await nextTick()
    wrapper.unmount()
  })
})
