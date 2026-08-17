// tauri 桥接依赖:运行时由 Tauri WebView 注入,构建时 next.config.ts transpilePackages 解析。
// pnpm workspace 已将 @tauri-apps/api 与 @tauri-apps/plugin-dialog 链接到 web node_modules。
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog'

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

/** 非 Tauri 环境统一抛错(用于文件读写等无安全默认值的场景)。 */
function requireTauri(): void {
  if (!isTauri()) {
    throw new Error('Not in Tauri environment')
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
 * 非桌面端静默忽略。失败静默忽略(窗口最大化时 Rust 端会拒绝,不污染控制台)。
 */
export async function startResize(
  direction: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw',
): Promise<void> {
  if (!isTauri()) return
  const label = getCurrentWindow().label
  try {
    await invoke('start_resize', { direction, label })
  } catch {
    // 窗口最大化/最小化时 start_resize 会失败,静默忽略
  }
}

/**
 * 切换窗口全屏状态(P2:桌面端标配,2026-07-27 立)。
 * @returns 切换后的全屏状态(true=全屏,false=窗口模式)
 */
export async function toggleFullscreen(): Promise<boolean> {
  if (!isTauri()) return false
  return invoke<boolean>('toggle_fullscreen')
}

/**
 * 切换窗口置顶状态(P2:AI 对话悬浮场景,2026-07-27 立)。
 * @returns 切换后的置顶状态(true=置顶,false=普通)
 */
export async function toggleAlwaysOnTop(): Promise<boolean> {
  if (!isTauri()) return false
  return invoke<boolean>('toggle_always_on_top')
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
export async function openExternalUrl(url: string): Promise<void> {
  if (!isTauri()) {
    window.open(url, '_blank')
    return
  }
  try {
    await invoke('plugin:shell|open', { url })
  } catch (e) {
    console.warn('[shell] open failed:', e)
    window.open(url, '_blank')
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
 * @returns 桌面端失败(未装 Chrome 等)返回错误消息,成功返回 null;web 端恒返回 null
 */
export async function openInGoogleChrome(url: string): Promise<string | null> {
  if (!isTauri()) {
    window.open(url, '_blank')
    return null
  }
  try {
    await invoke('open_in_chrome', { url })
    return null
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[chrome] open_in_chrome failed:', msg)
    return msg
  }
}

/**
 * 启动"Chrome 登录"会话(2026-08-17 立):用 Google Chrome --app + CDP 调试端口打开登录页。
 * 返回 { port, profileDir }——后端 POST /api/browser/import-chrome 经 CDP 端口提取登录 Cookie 自动保存。
 * 仅桌面端可用;web 端(浏览器沙箱无法启动本机程序)返回 null。
 */
export interface ChromeLoginSession {
  port: number
  profileDir: string
}

export async function startChromeLogin(url: string): Promise<ChromeLoginSession | null> {
  if (!isTauri()) return null
  try {
    const session = await invoke<ChromeLoginSession>('start_chrome_login', { url })
    return session
  } catch (e) {
    console.warn('[chrome] start_chrome_login failed:', e)
    return null
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

// ================== 原生通知 ==================

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

/** 读取文本文件(UTF-8)。非 Tauri 环境抛错。 */
export async function readTextFile(path: string): Promise<ReadTextResult> {
  requireTauri()
  return await invoke<ReadTextResult>('read_text_file', { path })
}

/** 读取二进制文件,返回 base64 + MIME(用于图片/附件预览)。非 Tauri 环境抛错。 */
export async function readBinaryFile(path: string): Promise<ReadBinaryResult> {
  requireTauri()
  return await invoke<ReadBinaryResult>('read_binary_file', { path })
}

/** 写入文本文件(覆盖)。父目录不存在时自动创建。非 Tauri 环境抛错。 */
export async function writeTextFile(path: string, content: string): Promise<void> {
  requireTauri()
  await invoke('write_text_file', { path, content })
}

/** 列出目录下的文件/子目录(非递归,文件在前目录在后)。非 Tauri 环境返回空列表。 */
export async function listDir(path: string): Promise<DirListResult> {
  if (!isTauri()) return { entries: [] }
  return await invoke<DirListResult>('list_dir', { path })
}

/** 获取单个文件/目录的元信息。非 Tauri 环境抛错。 */
export async function statFile(path: string): Promise<FileInfo> {
  requireTauri()
  return await invoke<FileInfo>('stat_file', { path })
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

/**
 * 更新会话:checkForUpdates 返回的对象,持有 update 句柄用于后续下载安装。
 * 一次检查对应一个会话,downloadAndInstall 只能调用一次。
 */
export interface UpdateSession {
  info: UpdateInfo
  /** 下载并安装更新。onProgress 回调下载进度(Started/Progress/Finished 三阶段)。 */
  downloadAndInstall: (onProgress?: (p: UpdateProgress) => void) => Promise<void>
}

/**
 * 检查应用更新(非桌面端返回 null)。
 * 调用 Tauri updater plugin 的 check(),访问 tauri.conf.json 配置的 endpoints。
 * 返回 UpdateSession(含版本/说明 + 下载安装句柄)或 null(已是最新/检查失败)。
 *
 * check() 失败(网络错误/签名校验失败)会捕获后返回 null,避免调用方 try/catch。
 */
export async function checkForUpdates(): Promise<UpdateSession | null> {
  if (!isTauri()) return null
  try {
    const { check } = await import('@tauri-apps/plugin-updater')
    const update = await check()
    if (!update) return null
    return {
      info: {
        version: update.version,
        date: update.date,
        notes: update.body,
      },
      downloadAndInstall: async (onProgress) => {
        let downloaded = 0
        let total = 0
        await update.downloadAndInstall((event) => {
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
      },
    }
  } catch (e) {
    console.warn('[updater] check failed:', e)
    return null
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
 * @param onProgress 下载进度回调
 * @param onStatus 状态变化回调(checking/downloading/restarting/quitting)
 */
export async function quitAndUpdateIfNeeded(
  onProgress?: (p: UpdateProgress) => void,
  onStatus?: (status: QuitUpdateStatus) => void,
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
      await session.downloadAndInstall((p) => {
        _updateInstalledPendingRestart = true
        onProgress?.(p)
      })
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
