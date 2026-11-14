// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useGlobalShortcuts } from '@/hooks/use-global-shortcuts'
import {
  SHORTCUT_OVERRIDES_STORAGE_KEY,
  type ShortcutSetResult,
} from '@/lib/shortcut-overrides'

function searchCombo(result: { current: ReturnType<typeof useGlobalShortcuts> }): string | undefined {
  return result.current.shortcuts.find((item) => item.action === 'search')?.key
}

describe('useGlobalShortcuts 改键', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('改键后生效组合键变化并落盘', () => {
    const { result } = renderHook(() => useGlobalShortcuts())
    expect(searchCombo(result)).toBe('Ctrl+P')

    act(() => {
      const outcome = result.current.setShortcutOverride('search', 'ctrl+alt+f')
      expect(outcome).toEqual({ ok: true, combo: 'Ctrl+Alt+F' })
    })
    expect(searchCombo(result)).toBe('Ctrl+Alt+F')
    expect(window.localStorage.getItem(SHORTCUT_OVERRIDES_STORAGE_KEY)).toContain('Ctrl+Alt+F')
    expect(result.current.shortcuts.find((item) => item.action === 'search')?.overridden).toBe(true)
  })

  it('改键后按新组合键派发事件,旧组合键不再响应', () => {
    const { result } = renderHook(() => useGlobalShortcuts())
    const hits: string[] = []
    const onSearch = () => hits.push('search')
    window.addEventListener('global-shortcut:search', onSearch)

    act(() => {
      result.current.setShortcutOverride('search', 'Ctrl+Alt+F')
    })
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, altKey: true }))
    })
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', ctrlKey: true }))
    })

    window.removeEventListener('global-shortcut:search', onSearch)
    expect(hits).toHaveLength(1)
  })

  it('与其它动作冲突时拒绝且不改键', () => {
    const { result } = renderHook(() => useGlobalShortcuts())
    let outcome: ShortcutSetResult | undefined
    act(() => {
      outcome = result.current.setShortcutOverride('search', 'Ctrl+Shift+N')
    })
    expect(outcome).toMatchObject({ ok: false, reason: 'conflict', conflictAction: 'new-chat' })
    expect(searchCombo(result)).toBe('Ctrl+P')
  })

  it('非法组合与未知动作被拒绝', () => {
    const { result } = renderHook(() => useGlobalShortcuts())
    let invalid: ShortcutSetResult | undefined
    let unknown: ShortcutSetResult | undefined
    act(() => {
      invalid = result.current.setShortcutOverride('search', 'F')
      unknown = result.current.setShortcutOverride('not-an-action', 'Ctrl+Q')
    })
    expect(invalid).toEqual({ ok: false, reason: 'invalid-combo' })
    expect(unknown).toEqual({ ok: false, reason: 'unknown-action' })
  })

  it('改回出厂键等于删除覆盖', () => {
    const { result } = renderHook(() => useGlobalShortcuts())
    act(() => {
      result.current.setShortcutOverride('search', 'Ctrl+Alt+F')
    })
    act(() => {
      result.current.setShortcutOverride('search', 'Ctrl+P')
    })
    expect(result.current.overrides.search).toBeUndefined()
    expect(searchCombo(result)).toBe('Ctrl+P')
  })

  it('单个恢复与全部恢复', () => {
    const { result } = renderHook(() => useGlobalShortcuts())
    act(() => {
      result.current.setShortcutOverride('search', 'Ctrl+Alt+F')
      result.current.setShortcutOverride('new-chat', 'Ctrl+Alt+N')
    })
    act(() => {
      result.current.resetShortcut('search')
    })
    expect(searchCombo(result)).toBe('Ctrl+P')
    expect(result.current.overrides['new-chat']).toBe('Ctrl+Alt+N')

    act(() => {
      result.current.resetAllShortcuts()
    })
    expect(result.current.overrides).toEqual({})
    expect(window.localStorage.getItem(SHORTCUT_OVERRIDES_STORAGE_KEY)).toBeNull()
  })

  it('跨标签页 storage 事件同步改键', () => {
    const { result } = renderHook(() => useGlobalShortcuts())
    act(() => {
      window.localStorage.setItem(
        SHORTCUT_OVERRIDES_STORAGE_KEY,
        JSON.stringify({ version: 1, overrides: { search: 'Ctrl+Alt+F' } }),
      )
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: SHORTCUT_OVERRIDES_STORAGE_KEY,
          newValue: window.localStorage.getItem(SHORTCUT_OVERRIDES_STORAGE_KEY),
        }),
      )
    })
    expect(searchCombo(result)).toBe('Ctrl+Alt+F')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
