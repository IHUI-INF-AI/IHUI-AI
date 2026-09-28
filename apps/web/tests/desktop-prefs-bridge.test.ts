// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * desktop-prefs-bridge 契约测试(2026-09-28 立)。
 *
 * 钉的是「浏览器里绝不能碰 IPC」与「宿主回传才是有效值」两件事:
 * - 未注入 `__TAURI_INTERNALS__` / 未打就绪标记 ⇒ 所有出口走安全默认值,**一次 invoke 都不发**
 *   (阳性对照:两道闸都放开后确实按契约的命令名与参数发出去 —— 只留负向就是"门永远不响"而已)。
 * - `normalizeDesktopPrefs` 对残缺/未知/非对象入参一律回落默认档,不猜行为值。
 * - 线上字段名的**两种拼法**都收:宿主(desktop_prefs.rs)没做 camelCase 改名,回复是 snake_case;
 *   只认 camelCase 的话读回来全是默认档、写回去的 patch 会被 `#[serde(default)]` 静默丢弃,
 *   两侧账面全绿而设置永不生效 —— 那一条由"宿主回的是 snake_case"这一用例钉住。
 *
 * 每个用例用 `vi.resetModules()` + 动态 import 取**新的模块实例**:`ipcReady` 是模块级状态,
 * 共用一个实例会让"未就绪"这一支在第二个用例起永远测不到(顺序依赖型假绿)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const invokeMock = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}))

// 与 src/hooks/__tests__/use-desktop-ipc-injection.test.ts 同一套形状:
// 桥接模块自己判环境靠 isTauri(),而 isTauri 读的是 window 上的注入标记。
vi.mock('@/lib/tauri-bridge', () => ({
  isTauri: () => '__TAURI_INTERNALS__' in globalThis.window,
}))

// 类型面用 `import type * as` 拿同一份声明(eslint 的 consistent-type-imports 禁止
// `typeof import('…')` 这种标注,同 src/components/media/office-preview.tsx 的写法);
// 值面仍走下面 freshBridge() 的动态 import —— 否则模块级就绪标记会跨用例残留。
import type * as DesktopPrefsBridge from '@/lib/desktop-prefs-bridge'

type Bridge = typeof DesktopPrefsBridge

async function freshBridge(): Promise<Bridge> {
  vi.resetModules()
  return await import('@/lib/desktop-prefs-bridge')
}

function ipcHost(): { __TAURI_INTERNALS__?: unknown } {
  return globalThis.window as unknown as { __TAURI_INTERNALS__?: unknown }
}

beforeEach(() => {
  invokeMock.mockReset()
  delete ipcHost().__TAURI_INTERNALS__
})

describe('未就绪 / 浏览器环境 ⇒ 安全默认值,一次 invoke 都不发', () => {
  it('getDesktopPrefs 返回默认档,setDesktopPrefs 返回 null,徽章与关闭答复静默', async () => {
    const bridge = await freshBridge()
    expect(bridge.isDesktopPrefsAvailable()).toBe(false)

    await expect(bridge.getDesktopPrefs()).resolves.toEqual({
      showTrayIcon: true,
      closeBehavior: 'ask',
      launchMinimized: false,
      traySingleClick: 'menu',
      unreadBadge: true,
      trayMenuItems: [
        'new_chat',
        'show',
        'hide',
        'theme',
        'settings',
        'update',
        'quit',
      ],
    })
    await expect(bridge.setDesktopPrefs({ closeBehavior: 'quit' })).resolves.toBeNull()
    await bridge.resolveCloseChoice('hide', true)
    await bridge.setDesktopBadge(3)

    expect(invokeMock).not.toHaveBeenCalled()
  })

  it('打了就绪标记但 window 上没有注入痕迹 ⇒ 仍不可用(两道闸缺一不可)', async () => {
    const bridge = await freshBridge()
    bridge.markDesktopPrefsIpcReady()
    expect(bridge.isDesktopPrefsAvailable()).toBe(false)
    await bridge.setDesktopBadge(0)
    await bridge.resolveCloseChoice('cancel', false)
    expect(invokeMock).not.toHaveBeenCalled()
  })
})

describe('已注入且已就绪 ⇒ 按契约的命令名与参数发出(阳性对照)', () => {
  async function readyBridge(): Promise<Bridge> {
    const bridge = await freshBridge()
    ipcHost().__TAURI_INTERNALS__ = { transformCallback: () => {} }
    bridge.markDesktopPrefsIpcReady()
    expect(bridge.isDesktopPrefsAvailable()).toBe(true)
    return bridge
  }

  it('四个命令的名字与入参形状逐字对齐 Rust 侧', async () => {
    const bridge = await readyBridge()
    invokeMock.mockResolvedValue({ showTrayIcon: false, closeBehavior: 'quit' })

    await bridge.getDesktopPrefs()
    expect(invokeMock).toHaveBeenLastCalledWith('get_desktop_prefs')

    // patch 里两种拼法同带:camelCase 守 JS 契约,snake_case 才是宿主 serde 真读的那一份
    await bridge.setDesktopPrefs({ unreadBadge: false })
    expect(invokeMock).toHaveBeenLastCalledWith('set_desktop_prefs', {
      patch: { unreadBadge: false, unread_badge: false },
    })

    await bridge.resolveCloseChoice('hide', true)
    expect(invokeMock).toHaveBeenLastCalledWith('resolve_close_choice', {
      choice: 'hide',
      remember: true,
    })

    // 徽章是条数(Rust: unread: u32),布尔会在 serde 那层直接反序列化失败
    await bridge.setDesktopBadge(3)
    expect(invokeMock).toHaveBeenLastCalledWith('set_desktop_badge', { unread: 3 })
    await bridge.setDesktopBadge(0)
    expect(invokeMock).toHaveBeenLastCalledWith('set_desktop_badge', { unread: 0 })
  })

  it('宿主回的是 snake_case(它没做 camelCase 改名)⇒ 一样读得进,不落成默认档', async () => {
    const bridge = await readyBridge()
    invokeMock.mockResolvedValue({
      show_tray_icon: false,
      close_behavior: 'quit',
      launch_minimized: true,
      tray_single_click: 'toggle_window',
      unread_badge: false,
      tray_menu_items: ['theme', 'quit'],
    })
    await expect(bridge.getDesktopPrefs()).resolves.toEqual({
      showTrayIcon: false,
      closeBehavior: 'quit',
      launchMinimized: true,
      traySingleClick: 'toggle_window',
      unreadBadge: false,
      trayMenuItems: ['theme', 'quit'],
    })
  })

  it('宿主回什么就交回什么(不做本地纠正),残缺字段才回落默认档', async () => {
    const bridge = await readyBridge()
    invokeMock.mockResolvedValue({
      showTrayIcon: false,
      closeBehavior: 'quit',
      trayMenuItems: ['quit', 'bogus_key', 'theme'],
    })
    const prefs = await bridge.getDesktopPrefs()
    // 有效值直接来自宿主:两个 false/quit 同时在场也不被"修正"
    expect(prefs.showTrayIcon).toBe(false)
    expect(prefs.closeBehavior).toBe('quit')
    // 未知键被丢弃,其余按封闭集顺序呈现,未给的字段回落默认档
    expect(prefs.trayMenuItems).toEqual(['theme', 'quit'])
    expect(prefs.launchMinimized).toBe(false)
    expect(prefs.traySingleClick).toBe('menu')
  })

  it('宿主报错 ⇒ getDesktopPrefs 给 null(读不到不等于"全是默认值"),setDesktopPrefs 给 null', async () => {
    const bridge = await readyBridge()
    invokeMock.mockRejectedValue(new Error('command not found'))
    await expect(bridge.getDesktopPrefs()).resolves.toBeNull()
    await expect(bridge.setDesktopPrefs({ launchMinimized: true })).resolves.toBeNull()
  })
})

describe('normalizeDesktopPrefs 对垃圾入参不崩', () => {
  it('非对象 / null / undefined ⇒ 完整默认档;数组也按非对象处理', async () => {
    const bridge = await freshBridge()
    for (const raw of [undefined, null, 7, 'ask', [1, 2]]) {
      const prefs = bridge.normalizeDesktopPrefs(raw)
      expect(prefs.closeBehavior).toBe('ask')
      expect(prefs.showTrayIcon).toBe(true)
      expect(prefs.trayMenuItems).toHaveLength(7)
    }
  })

  it('档位值不在封闭集内 ⇒ 回落默认档,不把未知字符串透传给 UI', async () => {
    const bridge = await freshBridge()
    const prefs = bridge.normalizeDesktopPrefs({
      closeBehavior: 'reboot',
      traySingleClick: 'double',
      unreadBadge: 'yes',
    })
    expect(prefs.closeBehavior).toBe('ask')
    expect(prefs.traySingleClick).toBe('menu')
    expect(prefs.unreadBadge).toBe(true)
  })
})

describe('subscribeDesktopPrefsChanged 是 desktop-prefs-changed 的消费端', () => {
  it('收到 CustomEvent ⇒ 交归一后的偏好;卸载后不再收', async () => {
    const bridge = await freshBridge()
    const seen: string[] = []
    const off = bridge.subscribeDesktopPrefsChanged((prefs) => seen.push(prefs.closeBehavior))

    window.dispatchEvent(
      new CustomEvent('desktop-prefs-changed', { detail: { closeBehavior: 'quit' } }),
    )
    expect(seen).toEqual(['quit'])

    off()
    window.dispatchEvent(new CustomEvent('desktop-prefs-changed', { detail: {} }))
    expect(seen).toEqual(['quit'])
  })

  it('detail 缺失(宿主只发了个通知)⇒ 按默认档交出去,不抛错', async () => {
    const bridge = await freshBridge()
    const seen: Array<'hide' | 'quit' | 'ask'> = []
    const off = bridge.subscribeDesktopPrefsChanged((prefs) => seen.push(prefs.closeBehavior))
    window.dispatchEvent(new Event('desktop-prefs-changed'))
    off()
    expect(seen).toEqual(['ask'])
  })
})
