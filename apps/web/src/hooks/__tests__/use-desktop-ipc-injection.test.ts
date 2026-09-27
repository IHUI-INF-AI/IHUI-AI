// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

/**
 * 桌面端 IPC 注入竞态回归(2026-09-27 立,O86)。
 *
 * 被测事实:`window.__TAURI_INTERNALS__` 由 webview 在页面加载后**异步**注入。
 * 修复前 useDesktopEvents 等四个 hook 各写一句同步 `if (!isTauri()) return`,
 * 在注入完成前的那一帧挂载就**整个会话不再注册托盘监听** —— 真机表现是
 * 点托盘「退出」后前端毫无反应(截图里连退出遮罩都没有),只能等 Rust 侧兜底看门狗。
 *
 * 因此本文件的核心是第 1 条用例:先挂载、后注入。它对着旧实现必须红,
 * 对着新实现必须绿 —— 只有反向对照的那条(浏览器端永不注入)不算证据。
 */

const listenCalls: string[] = []
let listenImpl: (event: string) => Promise<() => void>

vi.mock('@/lib/tauri-bridge', () => ({
  isTauri: () => '__TAURI_INTERNALS__' in globalThis.window,
  getDesktopAppInfo: vi.fn(async () => null),
  isWindowMaximized: vi.fn(async () => false),
  minimizeWindow: vi.fn(async () => {}),
  toggleMaximizeWindow: vi.fn(async () => {}),
  closeWindow: vi.fn(async () => {}),
  isAutostartEnabled: vi.fn(async () => false),
  enableAutostart: vi.fn(async () => {}),
  disableAutostart: vi.fn(async () => {}),
  isTrayAlwaysVisible: vi.fn(async () => true),
  setTrayAlwaysVisible: vi.fn(async () => {}),
  resetWindowState: vi.fn(async () => {}),
  sendDesktopNotification: vi.fn(async () => {}),
  getSystemTheme: vi.fn(async () => 'light'),
  onSystemThemeChange: vi.fn(() => () => {}),
  setTrayStatus: vi.fn(async () => {}),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: (event: string) => listenImpl(event),
}))

import { useDesktopEvents, useTauriIpcReady } from '../use-desktop'

function injectIpc() {
  ;(globalThis.window as Record<string, unknown>).__TAURI_INTERNALS__ = {
    transformCallback: () => {},
  }
}
function ejectIpc() {
  delete (globalThis.window as Record<string, unknown>).__TAURI_INTERNALS__
}

describe('useTauriIpcReady — 等待异步注入,不是一帧定终身', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    listenCalls.length = 0
    listenImpl = async (event: string) => {
      listenCalls.push(event)
      return () => {}
    }
    ejectIpc()
  })
  afterEach(() => {
    vi.useRealTimers()
    ejectIpc()
  })

  it('注入晚于挂载时仍要变 true(旧实现这一条必红)', async () => {
    const { result } = renderHook(() => useTauriIpcReady())
    expect(result.current).toBe(false)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120)
      injectIpc()
      await vi.advanceTimersByTimeAsync(120)
    })
    expect(result.current).toBe(true)
  })

  it('浏览器端永不注入 ⇒ 3s 后停止轮询并保持 false,不得注册任何东西', async () => {
    const { result } = renderHook(() => useTauriIpcReady())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(result.current).toBe(false)
    expect(listenCalls).toEqual([])
  })
})

describe('useDesktopEvents — 托盘监听必须真注册', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    listenCalls.length = 0
    listenImpl = async (event: string) => {
      listenCalls.push(event)
      return () => {}
    }
    ejectIpc()
  })
  afterEach(() => {
    vi.useRealTimers()
    ejectIpc()
  })

  it('IPC 已就位时挂载 ⇒ 立刻注册 desktop-tray-action', async () => {
    injectIpc()
    renderHook(() => useDesktopEvents())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10)
    })
    expect(listenCalls).toContain('desktop-tray-action')
  })

  it('IPC 晚到(真机首启的那一帧)⇒ 注入后仍要补注册', async () => {
    renderHook(() => useDesktopEvents())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })
    expect(listenCalls).toEqual([])

    await act(async () => {
      injectIpc()
      await vi.advanceTimersByTimeAsync(200)
    })
    expect(listenCalls).toContain('desktop-tray-action')
    expect(listenCalls).toContain('desktop-shortcut')
  })

  it('卸载后补到的监听必须被 unlisten,不得留下幽灵注册', async () => {
    let unlistenCount = 0
    listenImpl = async (event: string) => {
      listenCalls.push(event)
      return () => {
        unlistenCount += 1
      }
    }
    const { unmount } = renderHook(() => useDesktopEvents())
    await act(async () => {
      injectIpc()
      await vi.advanceTimersByTimeAsync(200)
    })
    expect(listenCalls.length).toBeGreaterThan(0)
    unlistenCount = 0
    unmount()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50)
    })
    expect(unlistenCount).toBeGreaterThan(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
