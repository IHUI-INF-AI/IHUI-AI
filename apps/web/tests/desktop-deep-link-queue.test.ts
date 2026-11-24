// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 深链就绪闸门的前端半边(A10C-1,2026-09-26 立)—— useDesktopDeepLink 的投递契约判据。
 *
 * 这里判的是**前端这一侧**的五件事(队列侧的语义由 Rust `#[cfg(test)] mod deep_link_gate_tests`
 * 判:入队/去重/溢出计数/取即清/清账):
 *   ① 顺序:必须先 `listen('desktop-deep-link')` 注册成功,再 invoke 取回积压
 *      —— 反过来就等于"投给还不存在的监听",正是冷启动丢登录码的成因;
 *   ② 幂等:积压被补投一次后不再重复(取即清 ⇒ 第二次取回为空,同一个 sso_code 只换一次 token);
 *   ③ 多 URL 不丢:取回几条就处理几条(旧实现只取 first);
 *   ④ 只在真成功后 dispatch `desktop-sso-success`;
 *   ⑤ 失败必须响:exchange 失败 / 取回失败都要留一行 warn,不得静默。
 *
 * `pending` 这份内存数组是对 Rust 侧 pending 槽的**契约仿真**(取即清 + 只投 main),
 * 不是对我方实现的复刻 —— 真队列行为的判据在 lib.rs 的单元测试里。
 */
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fakes = vi.hoisted(() => {
  const order: string[] = []
  /** 模拟 Rust 侧 pending 队列(取即清) */
  const pending: string[] = []
  const handlerRef: { current: ((event: { payload: string }) => void) | null } = { current: null }
  const handleDesktopDeepLink = vi.fn(async (_url: string) => true)
  const warn = vi.fn()
  const invokeMode = { reject: false }
  return { order, pending, handlerRef, handleDesktopDeepLink, warn, invokeMode }
})

vi.mock('@/lib/tauri-bridge', () => ({
  isTauri: () => true,
  getDesktopAppInfo: vi.fn(async () => null),
  isWindowMaximized: vi.fn(async () => false),
  minimizeWindow: vi.fn(async () => {}),
  toggleMaximizeWindow: vi.fn(async () => false),
  closeWindow: vi.fn(async () => {}),
  isAutostartEnabled: vi.fn(async () => false),
  enableAutostart: vi.fn(async () => {}),
  disableAutostart: vi.fn(async () => {}),
  isTrayAlwaysVisible: vi.fn(async () => true),
  setTrayAlwaysVisible: vi.fn(async () => {}),
  resetWindowState: vi.fn(async () => {}),
  sendDesktopNotification: vi.fn(async () => {}),
  getSystemTheme: vi.fn(async () => undefined),
  onSystemThemeChange: vi.fn(async () => () => {}),
  setTrayStatus: vi.fn(async () => {}),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: () => {},
    info: () => {},
    warn: (...args: unknown[]) => fakes.warn(...args),
    error: () => {},
  },
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (_event: string, cb: (event: { payload: string }) => void) => {
    fakes.order.push('listen')
    fakes.handlerRef.current = cb
    return () => {
      fakes.handlerRef.current = null
    }
  }),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (cmd: string) => {
    // 本 hook 在深链这一路上只应调用取回命令;调了别的 = 悄悄开了第二条投递路径
    if (cmd !== 'take_pending_deep_links') {
      throw new Error(`意外的 invoke 命令: ${cmd}`)
    }
    fakes.order.push('take')
    if (fakes.invokeMode.reject) throw new Error('IPC denied: origin not in capability list')
    // 取即清:splice 而非 slice —— 第二次取回必须为空
    return fakes.pending.splice(0)
  }),
}))

vi.mock('@/lib/sso-desktop-bridge', () => ({
  handleDesktopDeepLink: fakes.handleDesktopDeepLink,
}))

import { useDesktopDeepLink } from '@/hooks/use-desktop'

/** 让 hook 内那条 async 链(并行 import → listen → invoke → 逐条补投)跑完 */
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('useDesktopDeepLink — 就绪后补投(A10C-1)', () => {
  let ssoSuccessCount = 0
  const onSsoSuccess = () => {
    ssoSuccessCount += 1
  }

  beforeEach(() => {
    fakes.order.length = 0
    fakes.pending.length = 0
    fakes.handlerRef.current = null
    fakes.warn.mockClear()
    fakes.handleDesktopDeepLink.mockClear()
    fakes.invokeMode.reject = false
    ssoSuccessCount = 0
    window.addEventListener('desktop-sso-success', onSsoSuccess)
  })

  it('① 先注册监听、后取回积压 —— 顺序颠倒即判红', async () => {
    fakes.pending.push('ihui://sso?sso_code=early')
    renderHook(() => useDesktopDeepLink())
    await flush()
    expect(fakes.order).toEqual(['listen', 'take'])
    expect(fakes.handleDesktopDeepLink).toHaveBeenCalledWith('ihui://sso?sso_code=early')
  })

  it('② 积压取即清:第二次挂载取回为空 ⇒ 同一个 code 只换一次 token', async () => {
    fakes.pending.push('ihui://sso?sso_code=once')
    const first = renderHook(() => useDesktopDeepLink())
    await flush()
    expect(fakes.handleDesktopDeepLink).toHaveBeenCalledTimes(1)

    first.unmount()
    // 队列已被取空(取即清),再挂一次不得重复处理同一条
    const second = renderHook(() => useDesktopDeepLink())
    await flush()
    expect(fakes.handleDesktopDeepLink).toHaveBeenCalledTimes(1)
    second.unmount()
  })

  it('③ 一次取回多条全部补投,不丢(旧实现只取 first)', async () => {
    fakes.pending.push('ihui://sso?sso_code=a', 'ihui://sso?sso_code=b', 'ihui://oauth?auth_code=c')
    renderHook(() => useDesktopDeepLink())
    await flush()
    expect(fakes.handleDesktopDeepLink.mock.calls.map((c) => c[0])).toEqual([
      'ihui://sso?sso_code=a',
      'ihui://sso?sso_code=b',
      'ihui://oauth?auth_code=c',
    ])
  })

  it('就绪后的实时事件仍走同一条处理链', async () => {
    const { unmount } = renderHook(() => useDesktopDeepLink())
    await flush()
    expect(fakes.handleDesktopDeepLink).not.toHaveBeenCalled()
    expect(fakes.handlerRef.current).toBeTruthy()
    await act(async () => {
      fakes.handlerRef.current?.({ payload: 'ihui://sso?sso_code=live' })
      await Promise.resolve()
    })
    expect(fakes.handleDesktopDeepLink).toHaveBeenCalledWith('ihui://sso?sso_code=live')
    unmount()
  })

  it('④ 只有真成功才 dispatch desktop-sso-success;失败留 warn 不静默', async () => {
    fakes.handleDesktopDeepLink.mockImplementationOnce(async () => false)
    fakes.pending.push('ihui://sso?sso_code=bad')
    renderHook(() => useDesktopDeepLink())
    await flush()
    expect(ssoSuccessCount).toBe(0)
    expect(fakes.warn).toHaveBeenCalledTimes(1)

    fakes.handlerRef.current?.({ payload: 'ihui://sso?sso_code=good' })
    await flush()
    expect(ssoSuccessCount).toBe(1)
  })

  it('⑤ 取回失败必须喊出来(否则积压里的 code 静默烂在队列里)', async () => {
    fakes.pending.push('ihui://sso?sso_code=stuck')
    fakes.invokeMode.reject = true
    renderHook(() => useDesktopDeepLink())
    await flush()
    expect(fakes.order).toEqual(['listen', 'take'])
    expect(fakes.handleDesktopDeepLink).not.toHaveBeenCalled()
    expect(fakes.warn).toHaveBeenCalled()
  })

  it('空 payload / 全空白 payload 不打扰处理链', async () => {
    const { unmount } = renderHook(() => useDesktopDeepLink())
    await flush()
    await act(async () => {
      fakes.handlerRef.current?.({ payload: '' })
      fakes.handlerRef.current?.({ payload: '   ' })
      fakes.handlerRef.current?.({ payload: undefined as unknown as string })
      await Promise.resolve()
    })
    expect(fakes.handleDesktopDeepLink).not.toHaveBeenCalled()
    unmount()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
