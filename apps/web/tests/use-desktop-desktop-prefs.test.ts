// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * useDesktop 的桌面偏好接线(2026-09-28 立)。
 *
 * 钉的是这次交付里最容易写错的一格:**互斥组合的纠正只能来自宿主回传的有效值**。
 * 用例 2 与用例 3 是同一处改动的正反两读 ——
 *  - 宿主把 `closeBehavior` 改成 `quit` ⇒ 界面必须跟着显示 quit;
 *  - 宿主**没**改(仍回 hide)⇒ 界面必须仍显示 hide。
 * 只留第一条,实现里"前端自己算一遍规则"这种第二份真相照样能绿(它算出来的也是 quit),
 * 而它会在宿主哪天换了裁定方式时和宿主各说一套。
 * 另外钉死发出去的 patch **只带用户改的那一项** —— 顺手替宿主补一个 closeBehavior 就是越权。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const invokeMock = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}))

vi.mock('@/lib/tauri-bridge', () => ({
  isTauri: () => '__TAURI_INTERNALS__' in globalThis.window,
  getDesktopAppInfo: vi.fn(async () => ({ name: 'IHUI AI', version: '0.0.0', platform: 'windows' })),
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
  getSystemTheme: vi.fn(async () => 'light'),
  onSystemThemeChange: vi.fn(() => () => {}),
  setTrayStatus: vi.fn(async () => {}),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { useDesktop } from '@/hooks/use-desktop'

const HOST_BASE = {
  showTrayIcon: true,
  closeBehavior: 'hide',
  launchMinimized: false,
  traySingleClick: 'menu',
  unreadBadge: true,
  trayMenuItems: ['new_chat', 'show', 'hide', 'theme', 'settings', 'update', 'quit'],
}

function enterDesktop() {
  ;(globalThis.window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {
    transformCallback: () => {},
  }
}

async function mountPrefs(hostPrefs: Record<string, unknown>) {
  enterDesktop()
  invokeMock.mockImplementation((command: string) => {
    if (command === 'get_desktop_prefs') return Promise.resolve(hostPrefs)
    return Promise.resolve(null)
  })
  const view = renderHook(() => useDesktop())
  await waitFor(() => expect(view.result.current.desktopPrefsLoading).toBe(false))
  return view
}

beforeEach(() => {
  invokeMock.mockReset()
  delete (globalThis.window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
})

describe('useDesktop — 桌面偏好初值与写回', () => {
  it('初始值取宿主回的那一份,不是本地默认档(默认档是 ask,宿主这里给的是 hide)', async () => {
    const { result } = await mountPrefs({ ...HOST_BASE })
    expect(result.current.desktopPrefs.closeBehavior).toBe('hide')
    expect(result.current.desktopPrefs.showTrayIcon).toBe(true)
    expect(invokeMock).toHaveBeenCalledWith('get_desktop_prefs')
  })

  it('关掉托盘图标 ⇒ 只发 {showTrayIcon:false},并把宿主回传的 quit 读进状态', async () => {
    const { result } = await mountPrefs({ ...HOST_BASE })
    invokeMock.mockImplementation((command: string, args?: unknown) => {
      if (command === 'set_desktop_prefs') {
        const patch = (args as { patch: Record<string, unknown> }).patch
        return Promise.resolve({ ...HOST_BASE, ...patch, closeBehavior: 'quit' })
      }
      return Promise.resolve(null)
    })

    let effective: Awaited<ReturnType<typeof result.current.updateDesktopPrefs>> = null
    await act(async () => {
      effective = await result.current.updateDesktopPrefs({ showTrayIcon: false })
    })

    // 发出去的 patch 里不得出现 closeBehavior(前端不替宿主做裁定);
    // 同一项带 camel + snake 两种拼法(宿主 serde 只认后者,见 desktop-prefs-bridge 的 WIRE_KEY_ALIASES)
    expect(invokeMock).toHaveBeenCalledWith('set_desktop_prefs', {
      patch: { showTrayIcon: false, show_tray_icon: false },
    })
    expect(effective?.closeBehavior).toBe('quit')
    expect(result.current.desktopPrefs.closeBehavior).toBe('quit')
    expect(result.current.desktopPrefs.showTrayIcon).toBe(false)
  })

  it('宿主没做纠正时,界面照它回的说展示 —— 不自己算第二遍', async () => {
    const { result } = await mountPrefs({ ...HOST_BASE })
    invokeMock.mockImplementation((command: string, args?: unknown) => {
      if (command === 'set_desktop_prefs') {
        const patch = (args as { patch: Record<string, unknown> }).patch
        return Promise.resolve({ ...HOST_BASE, ...patch })
      }
      return Promise.resolve(null)
    })

    await act(async () => {
      await result.current.updateDesktopPrefs({ showTrayIcon: false })
    })
    expect(result.current.desktopPrefs.closeBehavior).toBe('hide')
  })

  it('写失败 ⇒ 返回 null、保留改前的值、loading 不回翻', async () => {
    const { result } = await mountPrefs({ ...HOST_BASE, launchMinimized: true })
    invokeMock.mockImplementation((command: string) => {
      if (command === 'set_desktop_prefs') return Promise.reject(new Error('宿主拒绝'))
      return Promise.resolve(null)
    })

    let returned: Awaited<ReturnType<typeof result.current.updateDesktopPrefs>> = {} as never
    await act(async () => {
      returned = await result.current.updateDesktopPrefs({ launchMinimized: false })
    })

    expect(returned).toBeNull()
    expect(result.current.desktopPrefs.launchMinimized).toBe(true)
  })

  it('宿主广播 desktop-prefs-changed ⇒ 本地状态随之刷新(在别处改了设置也不留旧值)', async () => {
    const { result } = await mountPrefs({ ...HOST_BASE })
    act(() => {
      window.dispatchEvent(
        new CustomEvent('desktop-prefs-changed', {
          detail: { ...HOST_BASE, closeBehavior: 'ask', unreadBadge: false },
        }),
      )
    })
    expect(result.current.desktopPrefs.closeBehavior).toBe('ask')
    expect(result.current.desktopPrefs.unreadBadge).toBe(false)
  })

  // ── 支持性:读不到 ≠ 支持(旧安装器上六行开关不能照常摆出去) ──

  it('宿主问不到偏好(旧安装器:命令不存在 ⇒ invoke 直接 reject)⇒ desktopPrefsSupported=false', async () => {
    enterDesktop()
    // 旧安装器的真实形态不是"回 null",而是"这条命令不存在"⇒ Tauri 侧 reject。
    // (normalizeDesktopPrefs 对 null 给完整默认档是它自己的契约,用在 patch/广播那两条路上,
    //  这里刻意不拿它当宿主应答,否则就等于替旧安装器编造一份"读成功"。)
    invokeMock.mockImplementation((command: string) =>
      command === 'get_desktop_prefs'
        ? Promise.reject(new Error('Command get_desktop_prefs not found'))
        : Promise.resolve(null),
    )
    const view = renderHook(() => useDesktop())
    await waitFor(() => expect(view.result.current.desktopPrefsLoading).toBe(false))
    expect(view.result.current.desktopPrefsSupported).toBe(false)
    // 值仍是默认档:界面靠 supported 决定"摆出去冒充"还是"明说不支持",不靠值本身
    expect(view.result.current.desktopPrefs.closeBehavior).toBe('ask')
  })

  it('反向对照:读到一份就 supported=true;读不到但写成功,也必须翻正', async () => {
    const { result } = await mountPrefs({ ...HOST_BASE })
    expect(result.current.desktopPrefsSupported).toBe(true)

    // 另起一次:先问不到(旧安装器形态),后写成功 ⇒ supported 必须翻正。
    // "首帧读不到就永远说成不支持"会把一次瞬时失败锁死成永久假阴性。
    enterDesktop()
    invokeMock.mockReset()
    invokeMock.mockImplementation((command: string) => {
      if (command === 'get_desktop_prefs') return Promise.reject(new Error('not found'))
      if (command === 'set_desktop_prefs') return Promise.resolve({ ...HOST_BASE })
      return Promise.resolve(null)
    })
    const retry = renderHook(() => useDesktop())
    await waitFor(() => expect(retry.result.current.desktopPrefsLoading).toBe(false))
    expect(retry.result.current.desktopPrefsSupported).toBe(false)
    await act(async () => {
      await retry.result.current.updateDesktopPrefs({ showTrayIcon: false })
    })
    expect(retry.result.current.desktopPrefsSupported).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 挂载锁:useTrayStatus 自 2026-07-29 立起就没有任何调用方(HEAD 面 git grep 只有定义那一行),
// 而「未读提醒」开关就挂在这条链上 —— 不接上就是「设置里能拨、永远不亮」，
// 且类型/测试/其余门全都不会红(本仓最高频失效型)。这条静态锁钉:全局宿主必须真的调它,
// 且未读数的来源必须是既有的 notification store(不得前端另算一份真值)。
describe('useTrayStatus 已挂载到全局宿主(装载证明)', () => {
  it('provider 里必须调用 useTrayStatus,且未读源取自 notification store', async () => {
    const { readFileSync, existsSync } = await import('node:fs')
    const abs = 'src/providers/global-hooks-provider.tsx'
    if (!existsSync(abs)) throw new Error(`挂载锁找不到 ${abs}(cwd 不是 apps/web?)`)
    const src = readFileSync(abs, 'utf8')
    expect(src).toMatch(/useTrayStatus\(/)
    expect(src).toMatch(/useNotificationStore\(\(s\)\s*=>\s*s\.unreadCount\)/)
    expect(src).toMatch(/useChatStore\(\(s\)\s*=>\s*s\.isStreaming\)/)
  })
})
