// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

import {
  NOOP_SCREEN_REAPPEAR_ADAPTER,
  useScreenReappear,
  type ScreenReappearAdapter,
} from '../use-screen-reappear'

/**
 * 回屏 / 回前台重取的共享层语义。
 *
 * 测的是**行为**(回调是否被调),不是观感:react-native-web 下几何量恒 0、H5 单测不构成
 * 观感凭据;本套件也不加载 react-native,平台原语由 fake adapter 直接派发。
 */
function createFakeAdapter() {
  let onFocusChange: ((focused: boolean) => void) | null = null
  let onActive: (() => void) | null = null
  let activeSubscriptions = 0

  const adapter: ScreenReappearAdapter = {
    useScreenFocusEffect(cb) {
      onFocusChange = cb
    },
    subscribeAppActive(cb) {
      onActive = cb
      activeSubscriptions += 1
      return () => {
        onActive = null
        activeSubscriptions -= 1
      }
    },
  }

  return {
    adapter,
    focus: () => act(() => onFocusChange?.(true)),
    blur: () => act(() => onFocusChange?.(false)),
    foreground: () => act(() => onActive?.()),
    activeSubscriptions: () => activeSubscriptions,
  }
}

describe('useScreenReappear', () => {
  it('首次挂载的焦点信号不触发(首屏由既有 useEffect 负责,避免双请求)', () => {
    const fake = createFakeAdapter()
    const onReappear = vi.fn()
    renderHook(() => useScreenReappear(fake.adapter, onReappear))

    fake.focus()
    expect(onReappear).not.toHaveBeenCalled()
  })

  it('再次回到该屏 ⇒ 触发 refetch', () => {
    const fake = createFakeAdapter()
    const onReappear = vi.fn()
    renderHook(() => useScreenReappear(fake.adapter, onReappear))

    fake.focus() // 首次:跳过
    fake.blur()
    fake.focus() // 回屏
    expect(onReappear).toHaveBeenCalledTimes(1)

    fake.blur()
    fake.focus()
    expect(onReappear).toHaveBeenCalledTimes(2)
  })

  it('屏可见时应用回前台 ⇒ 触发 refetch', () => {
    const fake = createFakeAdapter()
    const onReappear = vi.fn()
    renderHook(() => useScreenReappear(fake.adapter, onReappear))

    fake.focus()
    fake.foreground()
    expect(onReappear).toHaveBeenCalledTimes(1)
  })

  it('屏不可见时应用回前台 ⇒ 不触发(栈下屏不偷偷重取)', () => {
    const fake = createFakeAdapter()
    const onReappear = vi.fn()
    renderHook(() => useScreenReappear(fake.adapter, onReappear))

    fake.focus()
    fake.blur()
    fake.foreground()
    expect(onReappear).not.toHaveBeenCalled()
  })

  it('卸载后回前台不再触发,且订阅被取消(防泄漏)', () => {
    const fake = createFakeAdapter()
    const onReappear = vi.fn()
    const { unmount } = renderHook(() => useScreenReappear(fake.adapter, onReappear))

    fake.focus()
    expect(fake.activeSubscriptions()).toBe(1)

    unmount()
    expect(fake.activeSubscriptions()).toBe(0)

    fake.foreground()
    expect(onReappear).not.toHaveBeenCalled()
  })

  it('无平台原语时(no-op adapter)完全静默,绝不伪造事件', () => {
    const onReappear = vi.fn()
    renderHook(() => useScreenReappear(NOOP_SCREEN_REAPPEAR_ADAPTER, onReappear))

    expect(onReappear).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
