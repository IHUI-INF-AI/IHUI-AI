// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTopBarBackStore, useTopBarBack } from '../topbar-back'
import type { TopBarBackConfig } from '../topbar-back'

describe('useTopBarBackStore', () => {
  beforeEach(() => {
    useTopBarBackStore.setState({ config: null })
  })

  it('初始 config 为 null(顶栏不显示返回按钮)', () => {
    expect(useTopBarBackStore.getState().config).toBeNull()
  })

  it('setConfig 注册返回意图', () => {
    const config: TopBarBackConfig = { fallbackHref: '/agents' }
    act(() => useTopBarBackStore.getState().setConfig(config))
    expect(useTopBarBackStore.getState().config).toBe(config)
  })

  it('clearConfig 按引用比对清除,不误清他人的注册', () => {
    const configA: TopBarBackConfig = { onBack: () => {} }
    const configB: TopBarBackConfig = { fallbackHref: '/' }
    act(() => useTopBarBackStore.getState().setConfig(configA))
    act(() => useTopBarBackStore.getState().setConfig(configB))
    // A 卸载时尝试清除(存的是 B)→ 不清
    act(() => useTopBarBackStore.getState().clearConfig(configA))
    expect(useTopBarBackStore.getState().config).toBe(configB)
    // B 卸载 → 清
    act(() => useTopBarBackStore.getState().clearConfig(configB))
    expect(useTopBarBackStore.getState().config).toBeNull()
  })
})

describe('useTopBarBack', () => {
  beforeEach(() => {
    useTopBarBackStore.setState({ config: null })
  })

  it('config 非 null:挂载即注册,卸载自动清除', () => {
    const config: TopBarBackConfig = { fallbackHref: '/agents' }
    const { unmount } = renderHook(() => useTopBarBack(config))
    expect(useTopBarBackStore.getState().config).toBe(config)
    unmount()
    expect(useTopBarBackStore.getState().config).toBeNull()
  })

  it('config 为 null:不注册任何内容', () => {
    renderHook(() => useTopBarBack(null))
    expect(useTopBarBackStore.getState().config).toBeNull()
  })

  it('config 引用变化:旧的清除,新的注册(页内视图切换场景)', () => {
    const configA: TopBarBackConfig = { onBack: () => {} }
    const configB: TopBarBackConfig = { onBack: () => {} }
    const { rerender } = renderHook(({ cfg }) => useTopBarBack(cfg), {
      initialProps: { cfg: configA as TopBarBackConfig | null },
    })
    expect(useTopBarBackStore.getState().config).toBe(configA)
    rerender({ cfg: configB })
    expect(useTopBarBackStore.getState().config).toBe(configB)
    rerender({ cfg: null })
    expect(useTopBarBackStore.getState().config).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌‌‌​‌‌‌‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
