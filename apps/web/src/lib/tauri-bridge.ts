// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// tauri 桥接依赖:运行时由 Tauri WebView 注入,构建时 next.config.ts transpilePackages 解析。
// pnpm workspace 已将 @tauri-apps/api 与 @tauri-apps/plugin-dialog 链接到 web node_modules。
import { invoke, Channel } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog'
// 仅类型导入:check() 返回的 Update 对象类型(运行时仍动态 import,避免浏览器端加载插件)
import type { Update } from '@tauri-apps/plugin-updater'

export { formatFileSize } from '@ihui/shared/utils/format'

/**
 * Web 端 Tauri Bridge:在 Tauri WebView 中调用 desktop 端 Rust 命令。
 * 非 Tauri 环境(普通浏览器)下,所有函数返回安全默认值或抛出明确错误,
 * 不影响 web 端其他功能(纯浏览器场景下文件/窗口/通知能力自然失效)。
 *
 * 与 apps/desktop/src/lib/desktop.ts 的 bridge 逻辑一一对应,共享同一 Rust 后端。
 */

/** 判断当前是否在 Tauri 客户端运行(非浏览器环境)。
 *
 * Tauri 2.x 的 IPC 桥 `window.__TAURI_INTERNALS__` 在 webview 加载后注入(通常 100-500ms),
 * 是 `@tauri-apps/api` 的 `invoke` 实际依赖的内部通道,与 `withGlobalTauri` 配置无关。
 *
 * 2026-07-29 安全加固:`withGlobalTauri` 已关闭(避免 XSS 直接调原生能力),
 * `window.__TAURI__` 不再注入,只检查 `__TAURI_INTERNALS__` 即可。
 * use-desktop.ts 用 50ms 轮询 + 3 秒超时兜底注入时机,不依赖 `__TAURI__` 早注入。
 */
export function isTauri(): boolean {
  if (typeof window === 'undefined') return false
  return '__TAURI_INTERNALS__' in window
}

/**
 * 根据浏览器/系统语言返回本地化应用名称。
 * 中文环境 → 智汇AI,其他 → IHUI AI。
 * 用于前端同步显示(Rust 端已独立检测系统 UI 语言)。
 */
export function getLocalizedAppName(): string {
  if (typeof navigator !== 'undefined') {
    const lang = navigator.language.toLowerCase()
    if (lang.startsWith('zh')) return '智汇AI'
  }
  return 'IHUI AI'
}

/**
 * 设置桌面端窗口标题(仅 Tauri 环境生效,浏览器下 no-op)。
 * 2026-09-06 立:产品名本地化(用户决策:中文→智汇AI,其他→IHUI AI),
 * 应用内切换语言时由 I18nProvider 调用同步窗口标题;
 * 启动时的初始标题由 Rust 端按系统 UI 语言设置(lib.rs localized_app_name)。
 */
export async function setWindowTitle(title: string): Promise<void> {
  if (!isTauri()) return
  await getCurrentWindow().setTitle(title)
}

/** 非 Tauri 环境统一抛错(用于文件读写等无安全默认值的场景)。 */
function requireTauri(): void {
  if (!isTauri()) {
    throw new Error('Not in Tauri environment')
  }
}

// ================== 桌面 IPC 错误契约(G-715,2026-09-30 立)==================

/**
 * 桌面 IPC 错误身份档的**闭集**。
 *
 * 立因:此前 Rust 侧命令一律把失败压成纯字符串(`map_err(|e| format!("…: {e}"))`),
 * 渲染层只能拿文案猜;而本仓的错误判序是 `errorCode → HTTP status → 文案正则`,
 * 桌面端第一档永远为空 ⇒ 判序整条退化成文案正则。现在档由**发送方显式给出**。
 *
 * 与 `apps/desktop/src-tauri/src/lib.rs` 的 `IpcErrorCode`(serde `snake_case`)逐档同形,
 * 对账由 `apps/web/tests/g-715-ipc-error-contract.test.ts` 完成(逐名比对,不是相似度)。
 * 后续应把这对类型提到 `packages/types`(与 `ApiFailure.errorCode` 并列而不合并),
 * 本轮 `packages/types/src/desktop-stability.ts` 由并行会话持有,故契约暂住本模块。
 */
export const IPC_ERROR_CODES = ['not_found', 'permission', 'network', 'internal'] as const

/** 桌面 IPC 错误身份档(闭集的字面量联合)。 */
export type IpcErrorCode = (typeof IPC_ERROR_CODES)[number]

/** wire 上 Rust 侧 `IpcError` 的序列化形状:`{ code, message }`。 */
export interface IpcErrorWire {
  code: IpcErrorCode
  message: string
}

/**
 * 归一后的桌面 IPC 错误。`code` 是渲染层唯一该读的判据输入。
 *
 * 用 Error 子类而不是裸对象:bridge 各出口此前抛出去的就是字符串(rejection),
 * 消费方普遍写 `e.message` / `String(e)` —— 抛对象会让这些读数变成 `[object Object]`。
 */
export class DesktopIpcError extends Error {
  /** 身份档。宿主没给档时恒为 `'internal'`(见 `codeSource`)。 */
  readonly code: IpcErrorCode
  /**
   * `'wire'` = 宿主显式给了这一档;`'fallback'` = 该命令还没接入 `IpcError`,
   * 只回了一段文案,档是**兜底填的**而非量出来的。
   *
   * 这一维不能省:把"没判"写成"判过了"是本仓最高频的失效型。调用方若要区分
   * "宿主说 internal"与"宿主什么都没说",读 `codeSource` 而不是读 `code`。
   */
  readonly codeSource: 'wire' | 'fallback'
  /** 原始 rejection(仅用于排查与日志,不得参与判据、不得渲染给用户)。 */
  readonly raw: unknown

  constructor(
    code: IpcErrorCode,
    message: string,
    codeSource: 'wire' | 'fallback',
    raw: unknown,
  ) {
    super(message)
    this.name = 'DesktopIpcError'
    this.code = code
    this.codeSource = codeSource
    this.raw = raw
  }
}

/** 档位是不是闭集里的一个(逐字等值,不做大小写/前缀放宽)。 */
export function isIpcErrorCode(value: unknown): value is IpcErrorCode {
  return typeof value === 'string' && (IPC_ERROR_CODES as readonly string[]).includes(value)
}

/** 取 rejection 的可读文案。不看内容、只搬运,不参与档位判定。 */
function ipcRejectionText(rejected: unknown): string {
  if (typeof rejected === 'string') return rejected
  if (rejected instanceof Error) return rejected.message
  if (rejected !== null && typeof rejected === 'object') {
    const rec = rejected as Record<string, unknown>
    if (typeof rec.message === 'string') return rec.message
    try {
      return JSON.stringify(rejected)
    } catch {
      return String(rejected)
    }
  }
  return String(rejected)
}

/**
 * 把 `invoke()` 的 rejection 归一成 `DesktopIpcError`。
 *
 * 判档**只看** `code` 字段是否在闭集里,绝不看 message 文案 ——
 * 按文案猜档正是本票要消灭的形态(Windows 的 io 报错措辞还随系统语言变)。
 * 认不出档的一律 `internal` + `codeSource:'fallback'`,并保留原文可查。
 */
export function toDesktopIpcError(rejected: unknown): DesktopIpcError {
  if (rejected !== null && typeof rejected === 'object' && !Array.isArray(rejected)) {
    const rec = rejected as Record<string, unknown>
    if (isIpcErrorCode(rec.code)) {
      const message = typeof rec.message === 'string' ? rec.message : ''
      return new DesktopIpcError(
        rec.code,
        // 宿主给了档却没给文案:文案留空会比"编一段"更诚实,但 Error.message 不能空着不可读。
        message !== '' ? message : `ipc error (${rec.code})`,
        'wire',
        rejected,
      )
    }
  }
  return new DesktopIpcError('internal', ipcRejectionText(rejected), 'fallback', rejected)
}

/**
 * 按码分派:只有 `err.code` 参与,handler 缺失时返回 `undefined`(不猜默认行为)。
 * 刻意不接收 `unknown` —— 归一这一步必须显式做过,免得有人把原始 rejection 直接喂进来。
 */
export function dispatchByIpcCode<T>(
  err: DesktopIpcError,
  handlers: Partial<Record<IpcErrorCode, (e: DesktopIpcError) => T>>,
): T | undefined {
  const handler = handlers[err.code]
  return handler ? handler(err) : undefined
}

/**
 * `invoke` 的结构化失败出口:任何 rejection 先过 `toDesktopIpcError` 再抛。
 *
 * 为什么必须包这一层:Rust 侧改成返回 `IpcError` 之后,wire 上的失败就是**对象**了。
 * 未包一层的地方 `String(e)` 会变成 `[object Object]`,用户看到的是"报错比不报更糟"。
 */
async function invokeIpc<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args)
  } catch (e) {
    throw toDesktopIpcError(e)
  }
}

// ================== 自动启动 ==================

/** 启用开机自启(参数 --minimized 已在 Rust 端 plugin init 配置)。 */
export async function enableAutostart(): Promise<void> {
  if (!isTauri()) return
  await invoke('plugin:autostart|enable')
}

/** 禁用开机自启。 */
export async function disableAutostart(): Promise<void> {
  if (!isTauri()) return
  await invoke('plugin:autostart|disable')
}

/** 查询当前开机自启状态。 */
export async function isAutostartEnabled(): Promise<boolean> {
  if (!isTauri()) return false
  return await invoke<boolean>('plugin:autostart|is_enabled')
}

// ================== 托盘常驻 ==================

/**
 * 查询"托盘图标常驻任务栏"开关状态(2026-09-02 #2 立)。
 * 仅 Windows 11 22H2+ 有实际效果(写 NotifyIconSettings\IsPromoted),
 * 其他平台后端恒返回 true(开关显示为开,操作为 no-op)。
 */
export async function isTrayAlwaysVisible(): Promise<boolean> {
  if (!isTauri()) return true
  return await invoke<boolean>('get_tray_always_visible')
}

/**
 * 设置"托盘图标常驻任务栏"开关(2026-09-02 #2 立)。
 * true=立即常驻任务栏;false=收入右下角隐藏溢出区,且后续启动不再强制常驻。
 */
export async function setTrayAlwaysVisible(enabled: boolean): Promise<void> {
  if (!isTauri()) return
  await invoke('set_tray_always_visible', { enabled })
}

// ================== 窗口控制 ==================

/** 显示主窗口(用于 TS 侧主动唤起,如托盘菜单的 TS 调用)。 */
export async function showMainWindow(): Promise<void> {
  if (!isTauri()) return
  const label = getCurrentWindow().label
  await invoke('plugin:window|show', { label })
}

/** 隐藏主窗口(最小化到托盘)。 */
export async function hideMainWindow(): Promise<void> {
  if (!isTauri()) return
  const label = getCurrentWindow().label
  await invoke('plugin:window|hide', { label })
}

/** 切换主窗口显示/隐藏(用于全局快捷键的 TS 侧调用,如果需要)。 */
export async function toggleMainWindow(): Promise<boolean> {
  if (!isTauri()) return false
  const label = getCurrentWindow().label
  const visible = await invoke<boolean>('plugin:window|is_visible', { label })
  if (visible) {
    await invoke('plugin:window|hide', { label })
  } else {
    await invoke('plugin:window|show', { label })
    await invoke('plugin:window|set_focus', { label })
  }
  return !visible
}

/** 最小化主窗口。非 Tauri 环境静默忽略。 */
export async function minimizeWindow(): Promise<void> {
  if (!isTauri()) return
  const label = getCurrentWindow().label
  await invoke('plugin:window|minimize', { label })
}

/** 最大化主窗口(已最大化则无变化)。非 Tauri 环境静默忽略。 */
export async function maximizeWindow(): Promise<void> {
  if (!isTauri()) return
  const label = getCurrentWindow().label
  await invoke('plugin:window|maximize', { label })
}

/** 还原最大化窗口。非 Tauri 环境静默忽略。 */
export async function unmaximizeWindow(): Promise<void> {
  if (!isTauri()) return
  const label = getCurrentWindow().label
  await invoke('plugin:window|unmaximize', { label })
}

/** 切换最大化/还原(双击标题栏等场景)。非 Tauri 环境静默忽略。 */
export async function toggleMaximizeWindow(): Promise<boolean> {
  if (!isTauri()) return false
  const label = getCurrentWindow().label
  await invoke('plugin:window|toggle_maximize', { label })
  return await invoke<boolean>('plugin:window|is_maximized', { label })
}

/** 查询主窗口是否已最大化。非 Tauri 环境返回 false。 */
export async function isWindowMaximized(): Promise<boolean> {
  if (!isTauri()) return false
  const label = getCurrentWindow().label
  return await invoke<boolean>('plugin:window|is_maximized', { label })
}

/** 关闭主窗口(实际行为由 Rust 端 on_window_event 决定:最小化到托盘而非退出)。 */
export async function closeWindow(): Promise<void> {
  if (!isTauri()) return
  const label = getCurrentWindow().label
  await invoke('plugin:window|close', { label })
}

/** 启动窗口拖拽(自定义标题栏用,鼠标按下时调用,系统接管移动)。 */
export async function startWindowDrag(): Promise<void> {
  if (!isTauri()) return
  const label = getCurrentWindow().label
  await invoke('plugin:window|start_dragging', { label })
}

/**
 * 启动窗口 resize(P0-1:8 方向边缘缩放,2026-07-27 立)。
 * direction: n/s/e/w/ne/nw/se/sw
 * 非桌面端静默忽略。
 *
 * G-715(2026-09-30):此前是"整块静默吞掉"——最大化/全屏的合理拒绝与真故障(窗口没了、
 * 契约漂了)在账面上同形。现在**按码分派**:`permission` 是宿主有意的策略拒绝 ⇒ 仍静默;
 * 其余档 ⇒ 大声 warn(不抛,免得 pointer 事件里冒出未处理 rejection)。
 */
export async function startResize(
  direction: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw',
): Promise<void> {
  if (!isTauri()) return
  const label = getCurrentWindow().label
  try {
    await invokeIpc('start_resize', { direction, label })
  } catch (e) {
    // instanceof 只当快路径:模块被打包成两份副本时它会假负 ⇒ 一律还有 toDesktopIpcError 兜底,
    // 而兜底读的是同一个 code 字段(不是文案),分档方向不会 fail-open。
    const err = e instanceof DesktopIpcError ? e : toDesktopIpcError(e)
    const intentionallyRefused = dispatchByIpcCode(err, { permission: () => true }) === true
    if (!intentionallyRefused) {
      console.warn('[window] start_resize 失败:', err.code, err.message)
    }
  }
}

/**
 * 切换窗口全屏状态(P2:桌面端标配,2026-07-27 立)。
 * @returns 切换后的全屏状态(true=全屏,false=窗口模式)
 */
export async function toggleFullscreen(): Promise<boolean> {
  if (!isTauri()) return false
  return invokeIpc<boolean>('toggle_fullscreen')
}

/**
 * 切换窗口置顶状态(P2:AI 对话悬浮场景,2026-07-27 立)。
 * @returns 切换后的置顶状态(true=置顶,false=普通)
 */
export async function toggleAlwaysOnTop(): Promise<boolean> {
  if (!isTauri()) return false
  return invokeIpc<boolean>('toggle_always_on_top')
}

/**
 * 监听窗口最大化状态变化(P0-2:最大化按钮图标切换,2026-07-27 立)。
 *
 * 2026-07-28 修复内存泄漏:
 * - 原实现 cleanup 时若 Promise 未 resolve,unlisten 仍为 undefined → 监听器泄漏
 * - 现用 ref 跟踪 Promise + cancelled flag,cleanup 时正确取消订阅
 * - 加 100ms throttle 避免频繁拖动产生大量 IPC 调用
 *
 * 返回同步清理函数。非桌面端返回 no-op。
 */
export function onMaximizeChange(callback: (maximized: boolean) => void): () => void {
  if (!isTauri()) return () => {}
  const win = getCurrentWindow()
  let cancelled = false
  let unlistenFn: (() => void) | null = null
  let lastInvokeAt = 0
  const THROTTLE_MS = 100

  const promise = win.onResized(async () => {
    if (cancelled) return
    const now = Date.now()
    if (now - lastInvokeAt < THROTTLE_MS) return
    lastInvokeAt = now
    try {
      const max = await win.isMaximized()
      if (!cancelled) callback(max)
    } catch {
      /* ignore */
    }
  })

  promise.then((fn: () => void) => {
    if (cancelled) {
      // cleanup 已先于 Promise resolve 调用 → 立即取消订阅
      try {
        fn()
      } catch {
        /* ignore */
      }
    } else {
      unlistenFn = fn
    }
  })

  return () => {
    cancelled = true
    if (unlistenFn) {
      try {
        unlistenFn()
      } catch {
        /* ignore */
      }
      unlistenFn = null
    }
  }
}

/**
 * 监听窗口系统焦点变化(2026-09-22 立:桌面端 decorations:false 时窗口失焦,
 * 自绘的 Min/Max/Close 三按钮要降亮为"非活动态",对齐 Windows caption 语义)。
 *
 * 与 onMaximizeChange 不同,**刻意不加节流** —— 切窗时必须立刻变暗,
 * 节流会让用户先看到"别的窗口已激活、本窗口按钮还全亮"的错觉。
 * 清理逻辑沿用 2026-07-28 的 cancelled flag + unlisten 泄漏兜底模板。
 *
 * 双通道,缺一不可:
 * - `desktop-window-focus`:Rust 在 WindowEvent::Focused 里显式 emit。**这是主通道** ——
 *   真机实测薄壳加载远程 URL(https://aizhs.top)时内核自带的 tauri://focus|blur 收不到,
 *   聚焦/失焦两态像素逐字相同;而 desktop-* 这条应用层通道已被托盘菜单验证可用。
 * - `onFocusChanged`:内核事件,留作兜底(若某版本可用即生效;两路同值重复回调无害)。
 *
 * 返回同步清理函数。非桌面端返回 no-op。
 */
export function onWindowFocusChange(callback: (focused: boolean) => void): () => void {
  if (!isTauri()) return () => {}
  const win = getCurrentWindow()
  let cancelled = false
  const cleanups: Array<() => void> = []

  const track = (promise: Promise<() => void>) => {
    promise
      .then((fn) => {
        // cleanup 已先于 Promise resolve → 立即取消订阅,不留悬挂监听
        if (cancelled) fn()
        else cleanups.push(fn)
      })
      .catch(() => {
        /* 单个通道注册失败不影响另一通道 */
      })
  }

  track(win.listen<boolean>('desktop-window-focus', ({ payload }) => callback(payload)))
  track(win.onFocusChanged(({ payload }) => callback(payload)))

  return () => {
    cancelled = true
    for (const fn of cleanups.splice(0)) {
      try {
        fn()
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * 当前窗口是否持有系统焦点(用于挂载时取初值,事件只报变化不报现状)。
 * 失败/非桌面端一律返回 true:主窗口以 visible:false 创建、由 auto_refresh 才 show,
 * 拿不到结论时宁可"亮着"也不要一打开就死灰。
 */
export async function isWindowFocused(): Promise<boolean> {
  if (!isTauri()) return true
  try {
    return await getCurrentWindow().isFocused()
  } catch {
    return true
  }
}

/**
 * 获取系统主题(P1-7:主题跟随,2026-07-27 立)。
 * 返回 'light' | 'dark' | undefined(非 Tauri 或失败)。
 * 2026-08-16 修复:此前 invoke('plugin:os|theme') 命令不存在(tauri-plugin-os
 * 无 theme 命令,theme 是 window API),catch 后恒 undefined → 主题跟随从未生效。
 * 改用 getCurrentWindow().theme()。
 */
export async function getSystemTheme(): Promise<'light' | 'dark' | undefined> {
  if (!isTauri()) return undefined
  try {
    const theme = await getCurrentWindow().theme()
    return theme ?? undefined
  } catch {
    return undefined
  }
}

/**
 * 监听系统主题变化(P1-7:主题跟随,2026-07-27 立)。
 * 返回同步清理函数。非桌面端返回 no-op。
 */
export function onSystemThemeChange(callback: (theme: 'light' | 'dark') => void): () => void {
  if (!isTauri()) return () => {}
  const win = getCurrentWindow()
  // 2026-08-16 修复竞态:cleanup 先于 onThemeChanged Promise resolve 时,
  // unlisten 仍为 undefined 会泄漏监听器(pendingPromise 模式,与 useDesktopEvents 一致)。
  let cancelled = false
  let unlisten: (() => void) | undefined
  win
    .onThemeChanged(async () => {
      const theme = await getSystemTheme()
      if (theme) callback(theme)
    })
    .then((fn: () => void) => {
      if (cancelled) {
        fn()
      } else {
        unlisten = fn
      }
    })
  return () => {
    cancelled = true
    unlisten?.()
  }
}

// ================== 应用信息 ==================

export interface DesktopAppInfo {
  name: string
  version: string
  platform: string
}

/** 获取客户端应用信息(名称/版本/平台)。非 Tauri 环境返回 null。 */
export async function getDesktopAppInfo(): Promise<DesktopAppInfo | null> {
  if (!isTauri()) return null
  try {
    return await invoke<DesktopAppInfo>('get_app_info')
  } catch {
    return null
  }
}

// ================== 外部链接 ==================

/**
 * 打开外部 URL(2026-08-01 立,SSO deep-link 闭环 outbound 入口)。
 *
 * Desktop(Tauri webview)中用 shell plugin 的 open() 唤起系统默认浏览器,
 * 用于 SSO 登录等需要在外部浏览器完成的流程。
 * 非桌面端(普通浏览器)用 window.open 新开标签页。
 *
 * Rust 端 tauri_plugin_shell 已在 lib.rs 注册,
 * capabilities/default.json 已授权 shell:allow-open。
 */
export async function openExternalUrl(url: string, windowName = '_blank'): Promise<boolean> {
  if (!isTauri()) {
    // 2026-09-16:① 返回是否真的打开 —— 浏览器会拦截"非用户手势"的 window.open,
    // 调用方需据此给用户明确提示;② 支持传 windowName 复用同一标签(批量队列只用一个
    // 标签轮流导航,既符合"排队扫码"的语义,也避开后续打开被拦截)。
    return window.open(url, windowName) !== null
  }
  try {
    await invoke('plugin:shell|open', { url })
    return true
  } catch (e) {
    console.warn('[shell] open failed:', e)
    return window.open(url, '_blank') !== null
  }
}

/**
 * 用系统 Google Chrome 以 --app 模式打开 URL(2026-08-17 立,用户要求"内置浏览器要谷歌")。
 *
 * - 桌面端:调 Rust 端 open_in_chrome(command 已注册)——Chrome --app 模式弹出
 *   无地址栏/无标签的独立窗口,100% Google Chrome 本体,登录/点击/输入/视频全支持,
 *   不受网站 X-Frame-Options / 反自动化拦截。
 * - web 端(普通浏览器):降级为 window.open 新标签页(浏览器沙箱无法启动本机程序)。
 *
 * @returns 桌面端返回 CDP 端口号,失败返回错误消息;web 端恒返回 null
 */
export async function openInGoogleChrome(url: string): Promise<number | string | null> {
  if (!isTauri()) {
    window.open(url, '_blank')
    return null
  }
  try {
    return await invokeIpc<number>('open_in_chrome', { url })
  } catch (e) {
    const err = e instanceof DesktopIpcError ? e : toDesktopIpcError(e)
    // 带上档名再喊:Chrome 没装(not_found)/ 端口没抢到(network)/ 别的(internal)是三种处置。
    console.warn('[chrome] open_in_chrome failed:', err.code, err.message)
    return err.message
  }
}

// ================== 应用菜单(2026-07-25 立) ==================

/** 原生菜单 ID 联合类型(HTML 顶栏 + web 端快捷键共用,前端 dispatcher 严格 switch)。 */
export type MenuActionId =
  | 'file.open_admin'
  | 'file.quit'
  | 'view.reload'
  | 'view.devtools'
  | 'view.fullscreen'
  | 'view.always_on_top'
  | 'help.about'

/** 唤起 / 创建 admin 窗口(Rust 端 open_admin_window)。已存在则 show + focus。 */
export async function openAdminWindow(): Promise<void> {
  if (!isTauri()) return
  await invoke('open_admin_window')
}

/** 切换 webview 开发者工具(Rust 端 toggle_devtools)。 */
export async function toggleDevtools(): Promise<void> {
  if (!isTauri()) return
  await invoke('toggle_devtools')
}

/** 真正退出应用(Rust 端 quit_app,绕过 closeWindow 的"隐藏到托盘"语义)。 */
export async function quitApp(): Promise<void> {
  if (!isTauri()) return
  await invoke('quit_app')
}


/**
 * 发送系统原生通知(标题 + 正文)。
 * 自动处理权限请求(首次调用时请求,已授权则直接发送)。
 * 非 Tauri 环境或权限被拒时静默忽略。
 */
export async function sendDesktopNotification(title: string, body: string): Promise<void> {
  if (!isTauri()) return
  try {
    let granted = await invoke<boolean>('plugin:notification|is_permission_granted')
    if (!granted) {
      const permission = await invoke<string>('plugin:notification|request_permission')
      granted = permission === 'granted'
    }
    if (granted) {
      await invoke('plugin:notification|notify', { options: { title, body } })
    }
  } catch {
    // 权限被拒或调用失败,静默忽略
  }
}

// ================== 本地文件访问 ==================

export interface FileInfo {
  path: string
  name: string
  size: number
  isDir: boolean
  extension: string
}

export interface ReadTextResult {
  content: string
  size: number
}

export interface ReadBinaryResult {
  base64: string
  size: number
  mime: string
}

export interface DirListResult {
  entries: FileInfo[]
}

/** 文件选择过滤器(常用类型,Web 端没有)。 */
export const FILE_FILTERS = {
  images: { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'] },
  text: {
    name: '文本',
    extensions: ['txt', 'md', 'log', 'csv', 'json', 'xml', 'yml', 'yaml', 'toml'],
  },
  pdf: { name: 'PDF', extensions: ['pdf'] },
  all: { name: '所有文件', extensions: ['*'] },
} as const

/** 读取文本文件(UTF-8)。非 Tauri 环境抛错。失败抛 `DesktopIpcError`(档由宿主给出)。 */
export async function readTextFile(path: string): Promise<ReadTextResult> {
  requireTauri()
  return await invokeIpc<ReadTextResult>('read_text_file', { path })
}

/** 读取二进制文件,返回 base64 + MIME(用于图片/附件预览)。非 Tauri 环境抛错。 */
export async function readBinaryFile(path: string): Promise<ReadBinaryResult> {
  requireTauri()
  return await invokeIpc<ReadBinaryResult>('read_binary_file', { path })
}

/** 写入文本文件(覆盖)。父目录不存在时自动创建。非 Tauri 环境抛错。 */
export async function writeTextFile(path: string, content: string): Promise<void> {
  requireTauri()
  await invokeIpc('write_text_file', { path, content })
}

/** 列出目录下的文件/子目录(非递归,文件在前目录在后)。非 Tauri 环境返回空列表。 */
export async function listDir(path: string): Promise<DirListResult> {
  if (!isTauri()) return { entries: [] }
  return await invokeIpc<DirListResult>('list_dir', { path })
}

/** 获取单个文件/目录的元信息。非 Tauri 环境抛错。 */
export async function statFile(path: string): Promise<FileInfo> {
  requireTauri()
  return await invokeIpc<FileInfo>('stat_file', { path })
}

/**
 * 打开文件选择对话框(单选)。
 * @param filters 文件类型过滤(默认所有文件)
 * @returns 选中文件路径,取消或非 Tauri 环境返回 null
 */
export async function pickFile(
  filters: ReadonlyArray<{ name: string; extensions: ReadonlyArray<string> }> = [FILE_FILTERS.all],
): Promise<string | null> {
  if (!isTauri()) return null
  try {
    const result = await openDialog({
      multiple: false,
      filters: filters.map((f) => ({
        name: f.name,
        extensions: [...f.extensions],
      })),
    })
    return typeof result === 'string' ? result : null
  } catch {
    return null
  }
}

/**
 * 打开多文件选择对话框。
 * @param filters 文件类型过滤
 * @returns 选中文件路径数组,取消或非 Tauri 环境返回空数组
 */
export async function pickFiles(
  filters: ReadonlyArray<{ name: string; extensions: ReadonlyArray<string> }> = [FILE_FILTERS.all],
): Promise<string[]> {
  if (!isTauri()) return []
  try {
    const result = await openDialog({
      multiple: true,
      filters: filters.map((f) => ({
        name: f.name,
        extensions: [...f.extensions],
      })),
    })
    if (result === null) return []
    return Array.isArray(result) ? result : [result]
  } catch {
    return []
  }
}

/**
 * 打开目录选择对话框。
 * @returns 选中目录路径,取消或非 Tauri 环境返回 null
 */
export async function pickDirectory(): Promise<string | null> {
  if (!isTauri()) return null
  try {
    const result = await openDialog({ directory: true, multiple: false })
    return typeof result === 'string' ? result : null
  } catch {
    return null
  }
}

/**
 * 打开保存文件对话框。
 * @param defaultName 默认文件名
 * @param filters 文件类型过滤
 * @returns 用户选择的保存路径,取消或非 Tauri 环境返回 null
 */
export async function pickSavePath(
  defaultName: string,
  filters: ReadonlyArray<{ name: string; extensions: ReadonlyArray<string> }> = [FILE_FILTERS.all],
): Promise<string | null> {
  if (!isTauri()) return null
  try {
    const result = await saveDialog({
      defaultPath: defaultName,
      filters: filters.map((f) => ({
        name: f.name,
        extensions: [...f.extensions],
      })),
    })
    return result ?? null
  } catch {
    return null
  }
}

// ================== 窗口状态持久化 ==================

/** 保存当前主窗口位置/尺寸/最大化状态(下次启动时恢复)。 */
export async function saveWindowState(): Promise<void> {
  if (!isTauri()) return
  try {
    const label = getCurrentWindow().label
    await invoke('save_window_state', { label })
  } catch {
    // 非 Tauri 环境或调用失败,静默忽略
  }
}

/** 从 store 恢复主窗口状态(应用启动时由 Rust 端自动调用)。 */
export async function restoreWindowState(): Promise<void> {
  if (!isTauri()) return
  try {
    const label = getCurrentWindow().label
    await invoke('restore_window_state', { label })
  } catch {
    // 非 Tauri 环境或调用失败,静默忽略
  }
}

/** 重置窗口状态(清除 store 中的窗口记录,下次启动用默认尺寸)。 */
export async function resetWindowState(): Promise<void> {
  if (!isTauri()) return
  try {
    const label = getCurrentWindow().label
    await invoke('reset_window_state', { label })
  } catch {
    // 非 Tauri 环境或调用失败,静默忽略
  }
}

/**
 * 清理 WebView2 缓存(Windows:EBWebView 目录,2026-07-29 #6 立)。
 * prod 模式下该目录会无限增长(可达数百 MB),供前端设置项"清理缓存"调用。
 * 清理后建议重启应用。
 * @returns { ok: boolean } 非桌面端静默返回 { ok: false }
 */
export async function clearWebViewCache(): Promise<OkResult> {
  if (!isTauri()) return { ok: false }
  return await invoke<OkResult>('clear_webview_cache')
}

/**
 * 设置托盘状态(2026-07-29 #10):切换 tooltip 表示新消息/AI 思考中。
 * @param status 'idle' | 'new_message' | 'thinking'
 * 非桌面端静默忽略。
 */
export async function setTrayStatus(status: 'idle' | 'new_message' | 'thinking'): Promise<void> {
  if (!isTauri()) return
  try {
    await invoke('set_tray_status', { status })
  } catch {
    // 非桌面端或 tray 未初始化,静默忽略
  }
}

// ================== 应用更新 ==================
// Tauri 2 updater 插件封装(2026-07-31 立,平台独占:仅桌面端)。
// Rust 端 tauri-plugin-updater 已注册 + capabilities/default.json 已授权 updater:default
// + tauri.conf.json 已配 endpoints(https://github.com/.../latest.json)+ pubkey。
// 前端通过 @tauri-apps/plugin-updater 的 check()/downloadAndInstall() 调用。

/** 可用更新元信息(来自 updater endpoint 返回的 latest.json)。 */
export interface UpdateInfo {
  /** 新版本号(SemVer,如 "0.2.0")。 */
  version: string
  /** 更新发布日期(RFC 3339,可能为空)。 */
  date?: string
  /** 更新说明(release notes,可能为空)。 */
  notes?: string
}

/** 下载进度回调参数。 */
export interface UpdateProgress {
  /** 已下载字节数。 */
  downloaded: number
  /** 总字节数(未知时为 0)。 */
  total: number
}

/** downloadAndInstall 的可选控制项(2026-09-29 立,P1 残余①:第二条卡死路径)。 */
export interface DownloadInstallOptions {
  /**
   * 主动取消信号。注意:updater 插件的 `downloadAndInstall()` **不接受** signal,
   * 所以取消的语义是「调用方不再等这个结论」—— 本函数立刻以
   * `UPDATE_DOWNLOAD_CANCELLED_REASON` 拒绝,让 UI 拿到终态;底层那次下载仍会自己
   * 跑完或失败(它已挂到 Promise.race 上,迟到的 rejection 不会变成 unhandled)。
   * 不谎称"能中断字节流"。
   */
  signal?: AbortSignal
  /** 本次等待的超时预算(ms),缺省 = DOWNLOAD_INSTALL_TIMEOUT_MS。 */
  timeoutMs?: number
}

/**
 * 更新会话:checkForUpdates 返回的对象,持有 update 句柄用于后续下载安装。
 * 一次检查对应一个会话,downloadAndInstall 只能调用一次。
 */
export interface UpdateSession {
  info: UpdateInfo
  /**
   * 下载并安装更新。onProgress 回调下载进度(Started/Progress/Finished 三阶段)。
   *
   * 必有终态(2026-09-29,P1 残余①):到点未返回即 reject
   * `Error(UPDATE_DOWNLOAD_TIMEOUT_REASON)`;传入的 signal 被 abort 即 reject
   * `Error(UPDATE_DOWNLOAD_CANCELLED_REASON)`。两者都是**拒绝**,不是"悄悄返回"——
   * 因为消费方(useUpdater.startDownload / quitAndUpdateIfNeeded)靠 catch 分支退出
   * "正在更新…"的进行中态,而一个永悬的 promise 让 catch 结构上无从触发。
   */
  downloadAndInstall: (
    onProgress?: (p: UpdateProgress) => void,
    opts?: DownloadInstallOptions,
  ) => Promise<void>
}

/**
 * 检查应用更新(非桌面端返回 null)。
 * 调用 Tauri updater plugin 的 check(),访问 tauri.conf.json 配置的 endpoints。
 * 返回 UpdateSession(含版本/说明 + 下载安装句柄)或 null(已是最新)。
 *
 * 检查失败(网络错误/超时/签名校验失败)抛 Error('check_failed'|'check_timeout'),
 * 调用方据此区分「失败」与「已是最新」(2026-09-21 根治"托盘检查更新点了没反应")。
 *
 * 2026-09-01 修复"检查更新一直转圈":
 * 之前 check() 无超时——updater endpoint 指向 GitHub,国内网络下请求可永久挂起
 * (TCP 层黑洞),前端 useUpdater 状态卡在 checking 转圈永不结束。
 * 现在用 withTimeout 兜底:CHECK_UPDATE_TIMEOUT_MS 内未返回即视为检查失败,
 * 返回 null 并告警,前端据此退出转圈进入"检查失败"提示。
 */
const CHECK_UPDATE_TIMEOUT_MS = 15_000

/**
 * 后台「下载并安装」的超时预算(P1 残余①,2026-09-29 立)。
 *
 * 数字依据(现读,不是拍的):`docs/RELEASE.md:699` 写明桌面安装包 **~230MB**,
 * 20 分钟对应 ~196 KB/s ≈ 1.6 Mbps 的下行地板 —— 低于这个速率的 GitHub 直连
 * 就是本次要防的那种挂起(feed 指向 GitHub,国内 TCP 层黑洞,同 CHECK 那条根因)。
 * 这一档刻意取宽:走这一档的是 useUpdater 的**后台自动安装**,误杀一次只是一轮重试
 * (use-updater 自带最多 3 次),而把真在慢慢下的包判死等于用户永远更不上。
 */
const DOWNLOAD_INSTALL_TIMEOUT_MS = 20 * 60_000

/**
 * 退出链上的下载预算(quitAndUpdateIfNeeded 专用)。
 *
 * 与上一档不同形是**因为阻塞方不同**:走这一档时用户已经被全屏遮罩挡住(点不动、
 * 退不出),20 分钟的"必然收口"仍然等于一次长卡死。既有契约写明该链
 * "任何错误 → quitApp(不阻塞退出)",所以 90s 到点就放弃更新、照常退出,
 * 是把"退不掉"这条 bug 收口成"这次没更新上"。
 */
const QUIT_DOWNLOAD_INSTALL_TIMEOUT_MS = 90_000

/** 超时终态的原因串(导出给消费方做区分,不得在端内重拼字面量)。 */
export const UPDATE_DOWNLOAD_TIMEOUT_REASON = 'update_download_timeout'

/** 取消终态的原因串(与「失败」分开,UI 才能说"已取消"而不是"更新失败")。 */
export const UPDATE_DOWNLOAD_CANCELLED_REASON = 'update_download_cancelled'

/** withTimeout 超时哨兵:与「Promise 正常返回 null」(updater 无更新)区分。 */
const TIMEOUT_SENTINEL = Symbol('withTimeoutTimeout')

/** withTimeout 取消哨兵:与超时、与正常 settle 三者都区分(三种终态不同义)。 */
const ABORT_SENTINEL = Symbol('withTimeoutAborted')

/**
 * 给 Promise 加超时(不抛异常,靠哨兵区分终态),settle 后清理计时器。
 *
 * 2026-09-29 加可选 `signal` 一档(P1 残余①)。**两档签名分开是刻意的**:
 * 只把返回类型放宽成含 ABORT_SENTINEL 的话,`checkForUpdates()` 里
 * `const result = await withTimeout(check(), …)` 之后 `result` 会带着
 * ABORT_SENTINEL 这个不可能的分支,赋值给 `Update | null` 直接 TS2322 ——
 * 也就是"为了加取消而被迫改动 check() 那一档"。用重载把两档的返回类型
 * 钉死,check() 的调用形态与类型**逐字不变**(由测试 §check 行为不变 钉住)。
 *
 * 不新造第二套超时:超时、取消共用这一个出口,差别只在多一个哨兵。
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | typeof TIMEOUT_SENTINEL>
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  signal: AbortSignal | undefined,
): Promise<T | typeof TIMEOUT_SENTINEL | typeof ABORT_SENTINEL>
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  signal?: AbortSignal,
): Promise<T | typeof TIMEOUT_SENTINEL | typeof ABORT_SENTINEL> {
  let timer: ReturnType<typeof setTimeout> | undefined
  let onAbort: (() => void) | undefined
  const timeout = new Promise<typeof TIMEOUT_SENTINEL>((resolve) => {
    timer = setTimeout(() => resolve(TIMEOUT_SENTINEL), ms)
  })
  // 竞速集合按 signal 有无分档:没传 signal 时,race 的输入数组与加 signal 之前
  // **逐项相同**([promise, timeout]),不往 check() 那条既有路径里塞第三个 promise。
  const racers: Array<Promise<T | typeof TIMEOUT_SENTINEL | typeof ABORT_SENTINEL>> = [
    promise,
    timeout,
  ]
  if (signal) {
    const aborted = new Promise<typeof ABORT_SENTINEL>((resolve) => {
      onAbort = () => resolve(ABORT_SENTINEL)
      if (signal.aborted) onAbort()
      else signal.addEventListener('abort', onAbort, { once: true })
    })
    racers.push(aborted)
  }
  return Promise.race(racers).finally(() => {
    if (timer) clearTimeout(timer)
    if (signal && onAbort) signal.removeEventListener('abort', onAbort)
  })
}

export async function checkForUpdates(): Promise<UpdateSession | null> {
  if (!isTauri()) return null
  let update: Update | null
  try {
    const { check } = await import('@tauri-apps/plugin-updater')
    const result = await withTimeout(check(), CHECK_UPDATE_TIMEOUT_MS)
    if (result === TIMEOUT_SENTINEL) {
      // 2026-09-01 修复"检查更新一直转圈":updater endpoint 国内网络下请求可永久挂起,
      // 超时视为检查失败(与「无更新返回 null」区分,2026-09-21 起上抛)。
      console.warn(
        `[updater] check() 超过 ${CHECK_UPDATE_TIMEOUT_MS}ms 未返回(网络挂起),按检查失败处理`,
      )
      throw new Error('check_timeout')
    }
    update = result
  } catch (e) {
    // 2026-09-21 根治"托盘检查更新点了没反应":检查失败(网络/权限/插件异常)必须
    // 与「已是最新」(check() 正常返回 null)区分——此前一律吞成 null,上层无法给出
    // 失败反馈。调用方:useUpdater.checkForUpdate(按 error 状态展示)、
    // quitAndUpdateIfNeeded(已有 catch 兜底,失败→正常退出,行为不变)。
    if (e instanceof Error && (e.message === 'check_timeout' || e.message === 'check_failed')) {
      throw e
    }
    console.warn('[updater] check failed:', e)
    throw new Error('check_failed')
  }
  if (!update) return null
  return {
    info: {
      version: update.version,
      date: update.date,
      notes: update.body,
    },
    downloadAndInstall: async (onProgress, opts) => {
      let downloaded = 0
      let total = 0
      // 全仓唯一一次真下载在这一行(两个消费方都经由它:useUpdater.startDownload
      // 调 session.downloadAndInstall、quitAndUpdateIfNeeded 也调同一个 session)。
      // 所以超时/取消**只加在这里一处**就够了 —— 在 quit 链那一侧再包一层,等于给同一件
      // 事写第二份超时(两处实现必漂移,本仓记过最多次的失效型)。
      const install = update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started': {
            const d = event.data as { contentLength?: number }
            total = d.contentLength ?? 0
            onProgress?.({ downloaded: 0, total })
            break
          }
          case 'Progress': {
            const d = event.data as { chunkLength?: number }
            downloaded += d.chunkLength ?? 0
            onProgress?.({ downloaded, total })
            break
          }
          case 'Finished':
            onProgress?.({ downloaded: total || downloaded, total })
            break
        }
      })
      // 必有终态(P1 残余①):此前这一句是 `await update.downloadAndInstall(…)`,
      // 挂起时**既不 reject 也不 resolve** —— useUpdater 停在 downloading、
      // quit 链停在 downloading 遮罩,账面零错误。现在三种结局各自有名:
      //   正常 resolve → 原样返回(返回值/时序与修前逐字同形,见测试 ②);
      //   插件自身失败 → 原样上抛(不折叠、不改写 message,见测试 ②b);
      //   到点未返回 / signal 被 abort → 各抛一条**可诊断**的具名 reason(①/③)。
      const outcome = await withTimeout(
        install,
        opts?.timeoutMs ?? DOWNLOAD_INSTALL_TIMEOUT_MS,
        opts?.signal,
      )
      if (outcome === TIMEOUT_SENTINEL) {
        console.warn(
          `[updater] downloadAndInstall 超过 ${opts?.timeoutMs ?? DOWNLOAD_INSTALL_TIMEOUT_MS}ms ` +
            `未返回(GitHub feed 下载挂起),按 ${UPDATE_DOWNLOAD_TIMEOUT_REASON} 收口`,
        )
        throw new Error(UPDATE_DOWNLOAD_TIMEOUT_REASON)
      }
      if (outcome === ABORT_SENTINEL) {
        // 取消不是失败:UI/退出链据此说"已取消",不得与人话里的"更新失败"混成一档。
        console.warn(
          `[updater] downloadAndInstall 被调用方取消(${UPDATE_DOWNLOAD_CANCELLED_REASON});` +
            `底层那次下载仍在继续(插件无 cancel 语义),但本次调用已交出终态`,
        )
        throw new Error(UPDATE_DOWNLOAD_CANCELLED_REASON)
      }
    },
  }
}

/**
 * 重启应用(2026-07-31 立,updater 安装完成后调用)。
 * 调用 Rust 端 restart_app 命令(app.restart()),终止当前进程并拉起新版本。
 * 非桌面端静默忽略。
 */
export async function restartApp(): Promise<void> {
  if (!isTauri()) return
  try {
    await invoke('restart_app')
  } catch (e) {
    console.warn('[updater] restart failed:', e)
  }
}

// ================== 退出时自动更新(2026-07-31 立)==================
// 模块级状态镜像:让退出流程(非 React 上下文)能读取 useUpdater 的最新状态,
// 避免退出时重复检查 / 重复下载。

/** 更新已下载安装完成,等待重启(useUpdater.downloadAndInstall 成功后设为 true)。 */
let _updateInstalledPendingRestart = false

/** 有可用更新会话但尚未下载(useUpdater.checkForUpdate 发现更新后缓存)。 */
let _availableSession: UpdateSession | null = null

/** 标记更新已安装待重启(由 useUpdater 调用)。 */
export function markUpdateInstalled(): void {
  _updateInstalledPendingRestart = true
}

/** 设置 / 清除可用更新会话(由 useUpdater 调用)。 */
export function setAvailableUpdateSession(session: UpdateSession | null): void {
  _availableSession = session
}

/** 退出时自动更新状态回调。 */
export type QuitUpdateStatus = 'checking' | 'downloading' | 'restarting' | 'quitting'

/**
 * 退出应用前检查并自动更新(2026-07-31 立,平台独占:仅桌面端)。
 *
 * 流程:
 * 1. 若已有更新安装完成(待重启) → 直接 restartApp(拉起新版本)
 * 2. 若有可用更新会话(已检查未下载)/ 重新检查发现更新 → downloadAndInstall → restartApp
 * 3. 无更新 → quitApp(正常退出)
 * 任何错误 → quitApp(不阻塞退出)
 *
 * 2026-09-29(P1 残余①):第 2 步的那次下载此前**既无超时也无取消**,挂起时全屏遮罩
 * 停在 downloading、账面零错误 —— 即"quitting 之外的第二条卡死路径"。现在它走同一个
 * `withTimeout` 出口(不新造第二套超时),预算用 QUIT_DOWNLOAD_INSTALL_TIMEOUT_MS
 * (被遮罩阻塞的一方不能拿后台那 20 分钟当兜底),超时/取消都落到既有 catch → 'quitting'。
 *
 * @param onProgress 下载进度回调
 * @param onStatus 状态变化回调(checking/downloading/restarting/quitting)
 * @param signal 取消本次"等更新"的信号。abort 之后仍会照常 quitApp —— 在这一条链上
 *               "取消"只可能是"别等了,直接退",所以取消的终态是 quitting 而不是卡住;
 *               区分依据是 `UPDATE_DOWNLOAD_CANCELLED_REASON`(已被 onStatus 序列测出)。
 */
export async function quitAndUpdateIfNeeded(
  onProgress?: (p: UpdateProgress) => void,
  onStatus?: (status: QuitUpdateStatus) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!isTauri()) return

  try {
    // 1. 已安装待重启 — 直接重启(瞬时操作)
    if (_updateInstalledPendingRestart) {
      onStatus?.('restarting')
      await restartApp()
      return
    }

    // 2. 有可用更新会话(来自 useUpdater 的缓存)或重新检查
    onStatus?.('checking')
    const session = _availableSession ?? (await checkForUpdates())
    _availableSession = null

    if (session) {
      onStatus?.('downloading')
      // 不在这里再包一层超时:唯一一份超时实现住在 session 里(见 checkForUpdates 的
      // downloadAndInstall)。这里只声明**本条链**的预算与取消信号。
      await session.downloadAndInstall(
        (p) => {
          _updateInstalledPendingRestart = true
          onProgress?.(p)
        },
        { signal, timeoutMs: QUIT_DOWNLOAD_INSTALL_TIMEOUT_MS },
      )
      _updateInstalledPendingRestart = true
      onStatus?.('restarting')
      await restartApp()
      return
    }

    // 3. 无更新,正常退出
    onStatus?.('quitting')
    await quitApp()
  } catch (e) {
    console.warn('[updater] quit-and-update failed, quitting normally:', e)
    onStatus?.('quitting')
    await quitApp()
  }
}

// ================== Computer Control ==================

/** 截图结果(base64 PNG)。 */
export interface ScreenshotResult {
  screenshot: string
}

/** 通用操作结果。 */
export interface OkResult {
  ok: boolean
}

/** 窗口信息(与 Rust WindowInfo 对齐,camelCase)。 */
export interface WindowInfo {
  title: string
  appName: string
  windowId: string
  /** 窗口在屏幕上的 [x, y, width, height](物理像素),2026-08-16 Rust 端已返回真实值 */
  bounds: [number, number, number, number]
}

/** 活动窗口查询结果。 */
export interface ActiveWindowResult {
  window: WindowInfo
}

/** 截图区域参数 [x, y, width, height]。 */
export type ScreenshotRegion = [number, number, number, number]

/** 鼠标按钮类型。 */
export type MouseButton = 'left' | 'right' | 'middle'

/**
 * 截取屏幕截图,返回 base64 编码的 PNG。
 * @param displayIndex 显示器索引(默认 0 主屏幕)
 * @param region 截取区域 [x, y, width, height],不传则截取全屏
 * @returns base64 PNG 字符串,非 Tauri 环境抛错
 */
export async function screenshotScreen(
  displayIndex?: number,
  region?: ScreenshotRegion,
): Promise<ScreenshotResult> {
  requireTauri()
  return await invoke<ScreenshotResult>('screenshot_screen', {
    displayIndex: displayIndex ?? null,
    region: region ?? null,
  })
}

/**
 * 移动鼠标到指定坐标。
 * @param x X 坐标(屏幕像素)
 * @param y Y 坐标(屏幕像素)
 * @param absolute true=绝对定位(默认),false=相对移动
 */
export async function mouseMove(x: number, y: number, absolute?: boolean): Promise<OkResult> {
  requireTauri()
  return await invoke<OkResult>('mouse_move', { x, y, absolute: absolute ?? null })
}

/**
 * 在指定坐标点击鼠标。
 * @param x X 坐标
 * @param y Y 坐标
 * @param button 按钮类型(默认 left)
 * @param count 点击次数(默认 1,上限 10)
 */
export async function mouseClick(
  x: number,
  y: number,
  button?: MouseButton,
  count?: number,
): Promise<OkResult> {
  requireTauri()
  return await invoke<OkResult>('mouse_click', {
    x,
    y,
    button: button ?? null,
    count: count ?? null,
  })
}

/**
 * 滚动鼠标滚轮。
 * @param deltaY 滚动量(正值向上,负值向下)
 * @param x 可选,先移动到指定 X 坐标再滚动
 * @param y 可选,先移动到指定 Y 坐标再滚动
 */
export async function mouseScroll(deltaY: number, x?: number, y?: number): Promise<OkResult> {
  requireTauri()
  return await invoke<OkResult>('mouse_scroll', {
    deltaY,
    x: x ?? null,
    y: y ?? null,
  })
}

/**
 * 输入文本(逐字符输入,支持延迟)。
 * @param text 要输入的文本(上限 10000 字符)
 * @param delay 每个字符间的延迟(毫秒),不传则一次性输入
 */
export async function keyboardType(text: string, delay?: number): Promise<OkResult> {
  requireTauri()
  return await invoke<OkResult>('keyboard_type', { text, delay: delay ?? null })
}

/**
 * 按下并释放单个按键。
 * @param key 按键名(如 'Enter', 'Escape', 'a', 'F1')
 */
export async function keyboardPress(key: string): Promise<OkResult> {
  requireTauri()
  return await invoke<OkResult>('keyboard_press', { key })
}

/**
 * 按下组合快捷键(如 Ctrl+C)。
 * @param keys 按键列表(如 ['Control', 'c']),上限 10 个
 */
export async function keyboardHotkey(keys: string[]): Promise<OkResult> {
  requireTauri()
  return await invoke<OkResult>('keyboard_hotkey', { keys })
}

/**
 * 获取当前活动窗口信息(标题 + 应用名 + 窗口 ID)。
 * 仅 Windows 平台可用,其他平台抛错。
 */
export async function getActiveWindow(): Promise<ActiveWindowResult> {
  requireTauri()
  return await invoke<ActiveWindowResult>('active_window')
}

/** 剪贴板读取结果。 */
export interface ClipboardResult {
  clipboard: string
}

/**
 * 读取剪贴板内容。
 * @param format 'text'(默认)或 'image'(返回 base64 dataURL)
 */
export async function clipboardGet(format?: 'text' | 'image'): Promise<ClipboardResult> {
  requireTauri()
  return await invoke<ClipboardResult>('clipboard_get', { format: format ?? null })
}

/**
 * 写入剪贴板。
 * @param content 文本内容(format='text')或 base64 image dataURL(format='image')
 * @param format 'text'(默认)或 'image'
 */
export async function clipboardSet(content: string, format?: 'text' | 'image'): Promise<OkResult> {
  requireTauri()
  return await invoke<OkResult>('clipboard_set', { content, format: format ?? null })
}

// ================== 桌面宿主 git 通道(2026-09-28 V3 #72) ==================

/**
 * git_channel_ipc.rs `StatusReply` 的 TS 投影(字段名 snake_case 原样 —— serde 默认
 * 命名,前端不做二次转写,免得两份字段表漂移)。三态语义见该文件头注:
 * `facts`(结论成立)/ `command_failed`(git 命令失败)/ `undetermined`(判不了;
 * 此时 entries 恒为空 —— **空 entries ≠ 干净**,渲染侧必须按 state 分格)。
 */
export interface GitWorkspaceStatusEntry {
  kind: string
  index_status: string
  worktree_status: string
  path: string
  old_path: string | null
}

export interface GitWorkspaceStatusReply {
  state: 'facts' | 'command_failed' | 'undetermined'
  /** facts:clean|dirty;undetermined:失明名;command_failed:exit=<code|none> */
  verdict: string
  reason: string
  root: string
  git_binary: string
  scope: string | null
  total: number
  by_kind: Array<[string, number]>
  entries: GitWorkspaceStatusEntry[]
}

/** git_channel_info 的回包(camelCase,与 Rust json! 键原样对齐)。 */
export interface GitChannelInfoReply {
  authorizedRoot: string | null
  gitBinary: string | null
  candidates: string[]
  bases: string[]
  timeoutMs: number
  boundary: string
}

/** 授权一个工作区根(幂等;root 由宿主 bases + rev-parse 双证,前端无从越界)。 */
export async function gitAuthorizeWorkspace(root: string): Promise<GitWorkspaceStatusReply> {
  requireTauri()
  return await invokeIpc<GitWorkspaceStatusReply>('git_authorize_workspace', { root })
}

/** 取已授权根的本地仓库状态(未授权时宿主回 undetermined,不抛错)。 */
export async function gitWorkspaceStatus(scope?: string): Promise<GitWorkspaceStatusReply> {
  requireTauri()
  return await invokeIpc<GitWorkspaceStatusReply>('git_workspace_status', { scope: scope ?? null })
}

/** 通道自述(git 二进制解析结果 / 允许 base / 边界说明),无需授权即可取。 */
export async function gitChannelInfo(): Promise<GitChannelInfoReply> {
  requireTauri()
  return await invokeIpc<GitChannelInfoReply>('git_channel_info')
}
// ================== 签到助手本地通道(2026-10-09 WP-C 立) ==================
// 对齐参考项目(Trae-workbuddyAssistant)的桌面专属能力:本机 JWT 捕获 / 设备重置 / 快照管理。
// Rust 侧实现在 apps/desktop/src-tauri/src/checkin_capture.rs,字段名 serde snake_case 原样投影。

/** 本机捕获到的 TRAE 账号(与 Rust `CapturedAccount` 逐字段对齐)。 */
export interface CapturedTraeAccount {
  user_id: string
  jwt: string
  /** 人类可读出处:`cookies:<host>(<相对路径>)` / `leveldb:<文件名>`。 */
  source: string
}

/** 设备重置单层结果(与 Rust `ResetLayerReport` 对齐)。 */
export interface CheckinResetLayerReport {
  layer: number
  name: string
  ok: boolean
  detail: string
}

/** 设备重置总报告(与 Rust `ResetReport` 对齐)。 */
export interface CheckinResetReport {
  layers: CheckinResetLayerReport[]
}

/** 快照备份结果(与 Rust `BackupReport` 对齐)。 */
export interface CheckinBackupReport {
  user_id: string
  /** 已备份的相对路径(TRAE 数据目录坐标)。 */
  copied: string[]
  /** TRAE 现场不存在而跳过的相对路径。 */
  missing: string[]
}

/** 快照恢复结果(与 Rust `RestoreReport` 对齐)。 */
export interface CheckinRestoreReport {
  user_id: string
  restored: string[]
  missing_in_backup: string[]
}

/** 快照概要(与 Rust `SnapshotSummary` 对齐;kinds 是 9 类里完整存在的 kind 名)。 */
export interface CheckinSnapshotSummary {
  user_id: string
  kinds: string[]
}

/** 探测本机 TRAE 数据目录;未找到返回 null。非 Tauri 环境抛错(调用方须先 isTauri())。 */
export async function checkinDetectTraeDir(): Promise<string | null> {
  requireTauri()
  return await invokeIpc<string | null>('checkin_detect_trae_dir')
}

/** 从本机 TRAE 数据目录捕获 JWT(DPAPI 解 Cookies + leveldb 扫描),按 user_id 去重。 */
export async function checkinCaptureJwts(): Promise<CapturedTraeAccount[]> {
  requireTauri()
  return await invokeIpc<CapturedTraeAccount[]>('checkin_capture_jwts')
}

/** 本机捕获到的 Qoder 会话(与 Rust `CapturedQoderSession` 逐字段对齐,2026-10-10)。
 *  token 从 `%APPDATA%` 下 `com.qoder[cn].app.*` 目录的 auth.v1.dat 解密
 *  (v10 AES-GCM,密钥走 Local State + DPAPI,需同一 Windows 用户);
 *  refreshToken 用于服务端自刷新;machine_* 字段组装引擎所需的
 *  Cosy-* 风控头(录账时整体并入 device_map)。 */
export interface CapturedQoderSession {
  app_dir: string
  /** "cn" | "intl" */
  edition: string
  uid: string
  /** Qoder accessToken(录入时填进 jwt 字段;引擎按 Bearer 头使用) */
  access_token: string
  refreshToken: string
  /** 客户端声明的过期(epoch 秒,缺失 0) */
  expires_at: number
  /** JWT payload exp(epoch 秒,缺失 0) */
  jwt_exp: number
  machine_id: string
  machine_os: string
  machine_hostname: string
  version: string
  machine_token: string
  machine_code: string
  machine_type: string
}

/** 从本机 Qoder 客户端捕获会话(解密 auth.v1.dat),多目录命中按 uid 去重。 */
export async function checkinCaptureQoder(): Promise<CapturedQoderSession[]> {
  requireTauri()
  return await invokeIpc<CapturedQoderSession[]>('checkin_capture_qoder')
}

/** 十四层设备标识重置;includeMachineGuid=true 额外尝试注册表 MachineGuid(需 UAC);
 *  cleanBrowserCookies=true 额外清理 Chrome/Edge 中 TRAE 域 Cookie(浏览器运行中该层会失败并报告);
 *  deepReset=true 额外执行深度扩面层(TRAE webview Cookies 库本体/state.vscdb 身份凭据键/日志缓存/
 *  ahanet·monitor 等指纹目录/traereset_bak 旧备份)
 *  ——这是"不卸载达到重装级干净"的补全,执行前须完全退出 TRAE;
 *  resetMac=true 额外改写物理网卡 MAC 地址(硬件指纹层,需管理员权限,网络会闪断数秒,
 *  旧 MAC 自动备份到 %TEMP%\ihui-mac-backup-*.txt 可还原)。 */
export async function checkinResetDeviceIds(
  includeMachineGuid: boolean,
  cleanBrowserCookies: boolean,
  deepReset: boolean,
  resetMac?: boolean,
): Promise<CheckinResetReport> {
  requireTauri()
  return await invokeIpc<CheckinResetReport>('checkin_reset_device_ids', {
    includeMachineGuid,
    cleanBrowserCookies,
    deepReset,
    resetMac: resetMac ?? false,
  })
}

/** 一键解决风控(傻瓜式向导主入口):全 14 层全开(MachineGuid 自动备份后改写),
 *  可选层环境不允许时降级记录不拦流程。 */
export async function checkinOneClickReset(): Promise<CheckinResetReport> {
  requireTauri()
  return await invokeIpc<CheckinResetReport>('checkin_one_click_reset')
}

/** 一键解决风控 Step1.5(2026-10-10 立):拿"重置前记录的旧身份值黑名单"回扫当前
 *  全部 TRAE 现场,给出残留命中数——回答"到底重置干净了没有"。
 *  返回字段与 Rust `ResidualAuditReport` 逐字段同形(serde snake_case)。 */
export interface CheckinResidualHit {
  file: string
  count: number
  sample: string
}
export interface CheckinResidualAuditReport {
  ok: boolean
  message: string
  blacklist_size: number
  scanned_files: number
  scanned_mb: number
  sites_present: number
  hard_hits: number
  hard_hit_files: CheckinResidualHit[]
  suspect_hits: number
  registry: string[]
  hardware: string[]
}
export async function checkinAuditTraeResidual(): Promise<CheckinResidualAuditReport> {
  requireTauri()
  return await invokeIpc<CheckinResidualAuditReport>('checkin_audit_trae_residual')
}

/** 当前直连公网出口 IP + 归属地(一键向导 Step2 换网络验证用)。 */
export async function checkinGetPublicIp(): Promise<{
  ip: string
  location: string
}> {
  requireTauri()
  return await invokeIpc<{ ip: string; location: string }>('checkin_get_public_ip')
}

// ================== WorkBuddy 程序一键重置(2026-10-10 立) ==================
// 目标=WorkBuddy Desktop(Electron)本地状态;三档能力与 Rust workbuddy_reset.rs 一一对应。
// 边界:只做本地状态清理;服务端设备解绑/限制解除走 WorkBuddy 官方渠道,不做指纹伪造。

export interface WbLayerReport {
  layer: number
  name: string
  ok: boolean
  detail: string
}
export interface WbResetReport {
  layers: WbLayerReport[]
}
export interface WbProbeEntry {
  path: string
  /** maintenance | webview_logout | device_identity | user_asset | never */
  tier: string
  size_mb: number
}
export interface WbProbeReport {
  root: string
  workbuddy_running: boolean
  total_mb: number
  reclaimable_mb: number
  entries: WbProbeEntry[]
}

/** 探针:扫描 ~/.workbuddy 顶层条目,分类(可再生缓存/登录态/设备身份/用户资产)并算体量。重 I/O,后端 spawn_blocking。 */
export async function workbuddyResetProbe(): Promise<WbProbeReport> {
  requireTauri()
  return await invokeIpc<WbProbeReport>('workbuddy_reset_probe')
}

/** 执行进度事件(逐条目经 Tauri Channel 回传)。 */
export interface WbProgressEvent {
  layer: number
  done: number
  total: number
  item: string
}
export type WbProgressHandler = (ev: WbProgressEvent) => void

/** 计划预览单条动作。 */
export interface WbPlanAction {
  path: string
  /** delete_file | delete_dir | quarantine */
  action: string
  size_mb: number
}
export interface WbPlanReport {
  mode: string
  include_device_id: boolean
  actions: WbPlanAction[]
  total_mb: number
}

/** 隔离区信息(列表)。 */
export interface WbQuarantineInfo {
  name: string
  path: string
  created_unix: number
  /** factory | logout | unknown */
  mode: string
  original_root: string
  entries: number
  size_mb: number
}

/** 历史台账条目。 */
export interface WbHistoryItem {
  file: string
  ts_unix: number
  mode: string
  ok: boolean
  summary: string
}

function progressChannel(onProgress?: WbProgressHandler): Channel<WbProgressEvent> | undefined {
  if (!onProgress) return undefined
  const ch = new Channel<WbProgressEvent>()
  ch.onmessage = onProgress
  return ch
}

/** 计划预览:与执行层共用同一份判据,返回"会动什么/多大"的精确清单(执行前展示给用户)。 */
export async function workbuddyResetPlan(
  mode: 'maintenance' | 'logout' | 'factory',
  includeDeviceId: boolean,
): Promise<WbPlanReport> {
  requireTauri()
  return await invokeIpc<WbPlanReport>('workbuddy_reset_plan', {
    mode,
    includeDeviceId: includeDeviceId ?? false,
  })
}

/** 维护清理:只删可再生缓存与日志(logs/traces/tmp/webview 缓存/Crashpad 等,本机实测 ~12.4GB),
 *  保留登录态、记忆、技能、连接器、工作区。kill_running=true 时先强杀 WorkBuddy 进程。
 *  onProgress 逐条目回传执行进度。 */
export async function workbuddyResetMaintenance(
  killRunning: boolean,
  onProgress?: WbProgressHandler,
): Promise<WbResetReport> {
  requireTauri()
  return await invokeIpc<WbResetReport>('workbuddy_reset_maintenance', {
    killRunning: killRunning ?? false,
    onProgress: progressChannel(onProgress),
  })
}

/** 登出重置:app/session 搬入隔离区(下次启动回登录页,可一键恢复);includeDeviceId=true
 *  连带隔离 device-id(本地清除→应用自行重新注册,不做指纹伪造;服务端限制不受影响)。 */
export async function workbuddyResetLogout(
  killRunning: boolean,
  includeDeviceId: boolean,
  onProgress?: WbProgressHandler,
): Promise<WbResetReport> {
  requireTauri()
  return await invokeIpc<WbResetReport>('workbuddy_reset_logout', {
    killRunning: killRunning ?? false,
    includeDeviceId: includeDeviceId ?? false,
    onProgress: progressChannel(onProgress),
  })
}

/** 出厂重置:~/.workbuddy 顶层条目整体搬移到同卷隔离目录(rename,秒级、零数据丢失、可逆),
 *  应用下次启动按首次安装重建。manifest 记录全部条目——隔离区管理卡一键恢复。 */
export async function workbuddyResetFactory(
  killRunning: boolean,
  onProgress?: WbProgressHandler,
): Promise<WbResetReport> {
  requireTauri()
  return await invokeIpc<WbResetReport>('workbuddy_reset_factory', {
    killRunning: killRunning ?? false,
    onProgress: progressChannel(onProgress),
  })
}

/** 隔离区列表:扫描用户根目录同卷的全部 .workbuddy-quarantine-<ts>(出厂后根目录为空壳也能列)。 */
export async function workbuddyQuarantineList(): Promise<WbQuarantineInfo[]> {
  requireTauri()
  return await invokeIpc<WbQuarantineInfo[]>('workbuddy_quarantine_list')
}

/** 从隔离区一键恢复:按 manifest 原样搬回;目标已存在拒绝覆盖(绝不静默覆盖现有数据)。 */
export async function workbuddyQuarantineRestore(quarantinePath: string): Promise<WbResetReport> {
  requireTauri()
  return await invokeIpc<WbResetReport>('workbuddy_quarantine_restore', { quarantinePath })
}

/** 删除隔离区(数据确认不要后的人工清理出口;护栏:目录名格式+父目录必须匹配用户根)。 */
export async function workbuddyQuarantineDelete(quarantinePath: string): Promise<WbResetReport> {
  requireTauri()
  return await invokeIpc<WbResetReport>('workbuddy_quarantine_delete', { quarantinePath })
}

/** 历史台账:每次重置操作留档(reset-history/*.json,按时间倒序)。 */
export async function workbuddyResetHistory(): Promise<WbHistoryItem[]> {
  requireTauri()
  return await invokeIpc<WbHistoryItem[]>('workbuddy_reset_history')
}

// ================== Qoder 程序一键重置(2026-10-10 立) ==================
// 目标=Qoder CN 双根:~/.qoder-cn(agent 核心)+ %APPDATA%/com.qodercn.app.stable(Electron 壳)。
// 报告类型与 WorkBuddy 重置共用(Wb* 系列);边界同款:本地清理+官方渠道,不做指纹伪造。

/** Qoder 探针:双根逐条目分类(维护/登录态/设备身份/用户资产)并算体量。 */
export async function qoderResetProbe(): Promise<WbProbeReport> {
  requireTauri()
  return await invokeIpc<WbProbeReport>('qoder_reset_probe')
}

/** Qoder 计划预览:与执行层共用判据,执行前精确列出"会动什么/多大"。 */
export async function qoderResetPlan(
  mode: 'maintenance' | 'logout' | 'factory',
  includeDeviceId: boolean,
): Promise<WbPlanReport> {
  requireTauri()
  return await invokeIpc<WbPlanReport>('qoder_reset_plan', {
    mode,
    includeDeviceId: includeDeviceId ?? false,
  })
}

/** Qoder 维护清理:清 logs/tmp/file-history(可再生编辑历史)/shell-snapshots 等子条目 +
 *  壳面 Cache/Code Cache/GPUCache;登录态(.auth)、聊天记录(main.sqlite)、项目不动。 */
export async function qoderResetMaintenance(
  killRunning: boolean,
  onProgress?: WbProgressHandler,
): Promise<WbResetReport> {
  requireTauri()
  return await invokeIpc<WbResetReport>('qoder_reset_maintenance', {
    killRunning: killRunning ?? false,
    onProgress: progressChannel(onProgress),
  })
}

/** Qoder 登出重置:.auth + Partitions(webview 登录态)搬入隔离区(可一键恢复);
 *  includeDeviceId=true 连带隔离 installation_id + umid-cache.json(本地清除→应用自行重注册)。 */
export async function qoderResetLogout(
  killRunning: boolean,
  includeDeviceId: boolean,
  onProgress?: WbProgressHandler,
): Promise<WbResetReport> {
  requireTauri()
  return await invokeIpc<WbResetReport>('qoder_reset_logout', {
    killRunning: killRunning ?? false,
    includeDeviceId: includeDeviceId ?? false,
    onProgress: progressChannel(onProgress),
  })
}

/** Qoder 出厂重置:两根顶层条目分别整体搬移到各自同卷隔离目录(rename,秒级、零丢失、可逆)。 */
export async function qoderResetFactory(
  killRunning: boolean,
  onProgress?: WbProgressHandler,
): Promise<WbResetReport> {
  requireTauri()
  return await invokeIpc<WbResetReport>('qoder_reset_factory', {
    killRunning: killRunning ?? false,
    onProgress: progressChannel(onProgress),
  })
}

/** Qoder 隔离区列表:扫描两根各自同卷的 .qoder-quarantine-<ts>(同父去重)。 */
export async function qoderQuarantineList(): Promise<WbQuarantineInfo[]> {
  requireTauri()
  return await invokeIpc<WbQuarantineInfo[]>('qoder_quarantine_list')
}

/** Qoder 从隔离区一键恢复(按 manifest 原样搬回;目标已存在拒绝覆盖)。 */
export async function qoderQuarantineRestore(quarantinePath: string): Promise<WbResetReport> {
  requireTauri()
  return await invokeIpc<WbResetReport>('qoder_quarantine_restore', { quarantinePath })
}

/** Qoder 删除隔离区(护栏:目录名格式+父目录必须匹配两根之一)。 */
export async function qoderQuarantineDelete(quarantinePath: string): Promise<WbResetReport> {
  requireTauri()
  return await invokeIpc<WbResetReport>('qoder_quarantine_delete', { quarantinePath })
}

/** Qoder 历史台账(根① reset-history/*.json,按时间倒序,上限 50)。 */
export async function qoderResetHistory(): Promise<WbHistoryItem[]> {
  requireTauri()
  return await invokeIpc<WbHistoryItem[]>('qoder_reset_history')
}


/** 备份指定账号的 9 类 TRAE 现场文件到应用数据目录快照区。 */
export async function checkinSnapshotBackup(userId: string): Promise<CheckinBackupReport> {
  requireTauri()
  return await invokeIpc<CheckinBackupReport>('checkin_snapshot_backup', { userId })
}

/** 从快照区恢复指定账号的现场文件(覆盖 TRAE 现有同名)。 */
export async function checkinSnapshotRestore(userId: string): Promise<CheckinRestoreReport> {
  requireTauri()
  return await invokeIpc<CheckinRestoreReport>('checkin_snapshot_restore', { userId })
}

/** 列出现有快照(按 user_id)。 */
export async function checkinSnapshotList(): Promise<CheckinSnapshotSummary[]> {
  requireTauri()
  return await invokeIpc<CheckinSnapshotSummary[]>('checkin_snapshot_list')
}

/** 删除指定账号的快照目录。 */
export async function checkinSnapshotDelete(userId: string): Promise<void> {
  requireTauri()
  await invokeIpc('checkin_snapshot_delete', { userId })
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
