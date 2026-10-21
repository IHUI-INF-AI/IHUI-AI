// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 票60 普查批(2026-10-21):ChatMode 消费面按窗格分家。
// 缺陷本体:currentMode 此前全局一个键 `ihui-mode` ⇒ pane-1 切模式把根窗格一起切走,
// 且发送链读到的档与用户在本窗格看到的档不一致。
// 成对留证:
//  ① 正向 = 两窗格 setMode 互不顶(各自实例、各自持久化键含 paneId),
//           根单例键 `ihui-mode` 的 currentMode 一个字节没被写;
//  ② 反证 = Provider 外回落根单例且恒同一引用(单窗格形态逐字不变,一处切换全体跟着切);
//  ③ 空 paneId 当场抛错(静默回落单例 = 窗格间互串回潮)。

// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook } from '@testing-library/react'

import {
  MODE_PANE_KEY_PREFIX,
  MODE_STORAGE_KEY,
  getModeStoreForPane,
  resetModePaneStores,
  useModeStore,
  usePaneModeStore,
} from '@/stores/mode'
import { ChatPaneProvider } from '@/stores/chat-pane-context'

function wrapperFor(paneId: string) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <ChatPaneProvider paneId={paneId}>{children}</ChatPaneProvider>
  )
  Wrapper.displayName = `PaneWrapper(${paneId})`
  return Wrapper
}

beforeEach(() => {
  resetModePaneStores()
  useModeStore.setState({ currentMode: 'build' })
  window.localStorage.clear()
})

afterEach(() => {
  resetModePaneStores()
  useModeStore.setState({ currentMode: 'build' })
  window.localStorage.clear()
})

describe('usePaneModeStore 窗格寻址(票60 普查批)', () => {
  it('① 正向:两窗格 setMode 互不顶,根单例键 ihui-mode 一个字节没被写', () => {
    // 根单例先落一档,拿到它此刻的持久化字节
    useModeStore.getState().setMode('build')
    const rootRawBefore = window.localStorage.getItem(MODE_STORAGE_KEY)
    expect(rootRawBefore).toContain('build')

    const a = renderHook(() => usePaneModeStore(), { wrapper: wrapperFor('pane-mode-a') })
    const b = renderHook(() => usePaneModeStore(), { wrapper: wrapperFor('pane-mode-b') })
    expect(a.result.current).not.toBe(b.result.current)

    a.result.current.getState().setMode('plan')
    b.result.current.getState().setMode('review')

    expect(a.result.current.getState().currentMode).toBe('plan')
    expect(b.result.current.getState().currentMode).toBe('review')
    // 根单例:内存态与持久化字节都纹丝不动(pane-1 切档不再把根窗格切走)
    expect(useModeStore.getState().currentMode).toBe('build')
    expect(window.localStorage.getItem(MODE_STORAGE_KEY)).toBe(rootRawBefore)
    // 各窗格写进自己的键(键含 paneId,全局键不背这份锅)
    const rawA = window.localStorage.getItem(`${MODE_PANE_KEY_PREFIX}pane-mode-a`)
    const rawB = window.localStorage.getItem(`${MODE_PANE_KEY_PREFIX}pane-mode-b`)
    expect(rawA && JSON.parse(rawA).state.currentMode).toBe('plan')
    expect(rawB && JSON.parse(rawB).state.currentMode).toBe('review')
  })

  it('② 反证:Provider 外回落根单例且恒同一引用(单窗格形态逐字不变)', () => {
    const one = renderHook(() => usePaneModeStore())
    const other = renderHook(() => usePaneModeStore())
    expect(one.result.current).toBe(useModeStore)
    expect(other.result.current).toBe(one.result.current)

    // 旧行为:一份单例,一处 setMode 全体跟着切 —— 那正是单窗格形态逐字保留的语义
    one.result.current.getState().setMode('plan')
    expect(other.result.current.getState().currentMode).toBe('plan')
    expect(useModeStore.getState().currentMode).toBe('plan')
    // 单窗格的持久化仍落原键 `ihui-mode`(原形态不变)
    const raw = window.localStorage.getItem(MODE_STORAGE_KEY)
    expect(raw && JSON.parse(raw).state.currentMode).toBe('plan')

    // 对照:Provider 内解析到该窗格实例,与根单例不是同一引用
    const inPane = renderHook(() => usePaneModeStore(), { wrapper: wrapperFor('pane-mode-in') })
    expect(inPane.result.current).toBe(getModeStoreForPane('pane-mode-in'))
    expect(inPane.result.current).not.toBe(useModeStore)
  })

  it('③ 空 paneId 当场抛错(静默回落单例 = 窗格间互串)', () => {
    expect(() => getModeStoreForPane('')).toThrow(/paneId 不能为空/)
    expect(() => getModeStoreForPane('   ')).toThrow(/paneId 不能为空/)
    expect(() => renderHook(() => usePaneModeStore(), { wrapper: wrapperFor('   ') })).toThrow(
      /paneId 不能为空/,
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
