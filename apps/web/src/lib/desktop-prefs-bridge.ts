// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:依赖 Tauri IPC(`window.__TAURI_INTERNALS__` 注入的 invoke 通道)与宿主事件总线,
// 只服务"桌面壳加载 apps/web"这一形态;浏览器与其他端没有对应能力,因此不进 packages/ 共享层。

import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '@/lib/tauri-bridge'

/**
 * 桌面端「托盘/关闭/徽章」偏好的唯一前端出口(2026-09-28 立,用户已批准的桌面功能)。
 *
 * 三条不可漂的写法:
 * 1. **每一次 invoke 都要过就绪闸门**。`__TAURI_INTERNALS__` 由 webview 在页面加载后异步注入
 *    (Windows 上通常 100-500ms),在它注入前发命令必然 reject —— 而本模块的函数是**非 React**
 *    出口,拿不到 `useTauriIpcReady()` 那个 hook,所以那个结论必须由 React 侧用
 *    `markDesktopPrefsIpcReady()` 递进来(见 use-desktop.ts 的两处调用点)。没递进来 ⇒ 一律走
 *    安全默认值,一次 IPC 都不发,浏览器里永不抛错。
 * 2. **有效值只认宿主回传的那一份**。`set_desktop_prefs` 返回的是宿主规范化后的**有效**偏好
 *    (例:`showTrayIcon=false` 时 `closeBehavior` 不可能是 `'hide'`,宿主会给回 `'quit'`)。
 *    前端不得自己推断这种纠正 —— 自己改一遍就等于种下第二份真相,两边一旦漂移,界面显示的
 *    和实际生效的会不是同一件事。
 * 3. **宿主契约的不变量在归一时兜底,但只兜"读法"不兜"写法"**:`normalizeDesktopPrefs` 把
 *    读不到的字段退回默认值,从不发明一个宿主没给的行为值。
 */

// ================== 契约类型(JS 面 camelCase;线上两种拼法都认,见下面 WIRE_KEY_ALIASES) ==================

/** 托盘菜单项的封闭集 —— 顺序即 UI 呈现顺序,新增档必须两侧同改。 */
export const DESKTOP_TRAY_MENU_ITEM_KEYS = [
  'new_chat',
  'show',
  'hide',
  'theme',
  'settings',
  'update',
  'quit',
] as const

export type DesktopTrayMenuItemKey = (typeof DESKTOP_TRAY_MENU_ITEM_KEYS)[number]

/** 点窗口关闭按钮时的行为:收进托盘 / 直接退出 / 每次问。 */
export type DesktopCloseBehavior = 'hide' | 'quit' | 'ask'

/** 托盘图标的单击语义。 */
export type DesktopTraySingleClick = 'menu' | 'toggle_window'

/** 关闭询问弹窗的一次答复(比偏好档位多一个 `cancel`)。 */
export type DesktopCloseChoice = DesktopCloseBehavior | 'cancel'

export interface DesktopPrefs {
  showTrayIcon: boolean
  closeBehavior: DesktopCloseBehavior
  launchMinimized: boolean
  traySingleClick: DesktopTraySingleClick
  unreadBadge: boolean
  trayMenuItems: DesktopTrayMenuItemKey[]
}

/** 补丁形态:只带要改的键;宿主按整份偏好做规范化后回传。 */
export type DesktopPrefsPatch = Partial<DesktopPrefs>

const CLOSE_BEHAVIORS: readonly DesktopCloseBehavior[] = ['hide', 'quit', 'ask']
const TRAY_SINGLE_CLICKS: readonly DesktopTraySingleClick[] = ['menu', 'toggle_window']
const CLOSE_CHOICES: readonly DesktopCloseChoice[] = ['hide', 'quit', 'cancel']

/**
 * 线上字段名的两种拼法(camelCase = JS 契约面,snake_case = 宿主实际收发的那一份)。
 *
 * 为什么必须两种都认、两种都发:`apps/desktop/src-tauri/src/desktop_prefs.rs` 里的
 * `DesktopPrefs` / `DesktopPrefsPatch` **没有** `#[serde(rename_all = "camelCase")]`
 * (落盘文件 `desktop-behavior.json` 也刻意用 snake_case,与既有 `tray-settings.json` 同一套先例),
 * 而 Tauri 只把**命令入参的最外层键**转成 camelCase —— 结构体字段不在它的改名范围内。
 * 于是只发 camelCase 的 patch 会被容器级 `#[serde(default)]` 当成未知键**静默丢弃**:
 * 现象是"开关点了弹「已保存」,宿主那边一个字节都没变",而两侧账面全绿。
 * 读侧同一型:`get_desktop_prefs` 的回复是 snake_case,只认 camelCase 就等于永远读到默认档。
 *
 * 这不是把契约改名(类型面仍是 camelCase,UI 与测试都不动),而是让**同一次调用带上两种拼法**,
 * 宿主哪天补上 `rename_all` 也不必回头改前端。
 */
const WIRE_KEY_ALIASES = {
  showTrayIcon: 'show_tray_icon',
  closeBehavior: 'close_behavior',
  launchMinimized: 'launch_minimized',
  traySingleClick: 'tray_single_click',
  unreadBadge: 'unread_badge',
  trayMenuItems: 'tray_menu_items',
} as const satisfies Record<keyof DesktopPrefs, string>

/** 字符串 → 偏好键名的窄化(不 cast:登记表里没有的键就是不属于本契约)。 */
function isPrefKey(value: string): value is keyof DesktopPrefs {
  return Object.prototype.hasOwnProperty.call(WIRE_KEY_ALIASES, value)
}

/** 宿主 JSON 里读一个偏好字段:camelCase 优先,回落 snake_case。 */
function readWireField(source: Record<string, unknown>, key: keyof DesktopPrefs): unknown {
  const camel = source[key]
  return camel === undefined ? source[WIRE_KEY_ALIASES[key]] : camel
}

/** patch → 线上补丁:每个填了的键同时给出两种拼法,未填的键一个都不带。 */
function toWirePatch(patch: DesktopPrefsPatch): Record<string, unknown> {
  const wire: Record<string, unknown> = {}
  for (const key of Object.keys(patch)) {
    if (!isPrefKey(key)) continue
    const value = patch[key]
    if (value === undefined) continue
    wire[key] = value
    wire[WIRE_KEY_ALIASES[key]] = value
  }
  return wire
}

/** 默认档(与 Rust 侧偏好结构体的默认值逐字同义)。 */
export function defaultDesktopPrefs(): DesktopPrefs {
  return {
    showTrayIcon: true,
    closeBehavior: 'ask',
    launchMinimized: false,
    traySingleClick: 'menu',
    unreadBadge: true,
    trayMenuItems: [...DESKTOP_TRAY_MENU_ITEM_KEYS],
  }
}

/** 未知值 → 联合成员的类型守卫(不写 cast、不用 any:membership 测试本身就是窄化证据)。 */
function isMember<T extends string>(choices: readonly T[]): (value: unknown) => value is T {
  return (value: unknown): value is T =>
    typeof value === 'string' && (choices as readonly string[]).includes(value)
}

/**
 * 宿主 JSON → `DesktopPrefs`:逐字段窄化,读不到的退回默认值。
 *
 * `trayMenuItems` 刻意按**本地封闭集的顺序**重排并丢弃未知项:宿主不会发明新键,
 * 而 UI 是照这张表渲染的,未知键进来只会得到一个没有任何说明的开关系。
 * 「退出」一项由宿主契约保证恒在(它会自行补上),这里不替它兜 —— 前端补一次就是
 * 第二份真相,而宿主那句保证是可测的。
 */
export function normalizeDesktopPrefs(raw: unknown): DesktopPrefs {
  const fallback = defaultDesktopPrefs()
  if (typeof raw !== 'object' || raw === null) return fallback
  const source = raw as Record<string, unknown>

  const rawItems = readWireField(source, 'trayMenuItems')
  const list: readonly unknown[] | null = Array.isArray(rawItems) ? rawItems : null
  const trayMenuItems = list
    ? DESKTOP_TRAY_MENU_ITEM_KEYS.filter((key) => list.includes(key))
    : fallback.trayMenuItems

  const showTrayIcon = readWireField(source, 'showTrayIcon')
  const closeBehavior = readWireField(source, 'closeBehavior')
  const launchMinimized = readWireField(source, 'launchMinimized')
  const traySingleClick = readWireField(source, 'traySingleClick')
  const unreadBadge = readWireField(source, 'unreadBadge')

  return {
    showTrayIcon: typeof showTrayIcon === 'boolean' ? showTrayIcon : fallback.showTrayIcon,
    closeBehavior: isMember(CLOSE_BEHAVIORS)(closeBehavior)
      ? closeBehavior
      : fallback.closeBehavior,
    launchMinimized:
      typeof launchMinimized === 'boolean' ? launchMinimized : fallback.launchMinimized,
    traySingleClick: isMember(TRAY_SINGLE_CLICKS)(traySingleClick)
      ? traySingleClick
      : fallback.traySingleClick,
    unreadBadge: typeof unreadBadge === 'boolean' ? unreadBadge : fallback.unreadBadge,
    trayMenuItems,
  }
}

// ================== 就绪闸门 ==================

let ipcReady = false

/** 由 React 侧(useDesktop / useDesktopEvents)在 IPC 确认注入后调用,幂等。 */
export function markDesktopPrefsIpcReady(): void {
  ipcReady = true
}

/** 现在能安全地发 IPC 吗?(浏览器恒 false) */
export function isDesktopPrefsAvailable(): boolean {
  return ipcReady && isTauri()
}

// ================== 命令出口 ==================

/**
 * 读取当前偏好。
 * @returns 浏览器/未就绪 ⇒ 默认档(可渲染,不报错);宿主报错 ⇒ **null**(读不到 ≠ 全是默认值)
 */
export async function getDesktopPrefs(): Promise<DesktopPrefs | null> {
  if (!isDesktopPrefsAvailable()) return defaultDesktopPrefs()
  try {
    return normalizeDesktopPrefs(await invoke<unknown>('get_desktop_prefs'))
  } catch (error) {
    console.warn('[desktop-prefs] get_desktop_prefs 失败:', error)
    return null
  }
}

/**
 * 写入补丁并取回**宿主规范化后的有效偏好**。
 * @returns 有效偏好;失败/不可用 ⇒ null(调用方须保留旧状态并提示保存失败)
 */
export async function setDesktopPrefs(patch: DesktopPrefsPatch): Promise<DesktopPrefs | null> {
  if (!isDesktopPrefsAvailable()) return null
  try {
    // 线上补丁两种拼法都带(camelCase 保契约、snake_case 保宿主真读得到),见 WIRE_KEY_ALIASES
    return normalizeDesktopPrefs(await invoke<unknown>('set_desktop_prefs', { patch: toWirePatch(patch) }))
  } catch (error) {
    console.warn('[desktop-prefs] set_desktop_prefs 失败:', error)
    return null
  }
}

/**
 * 答复一次「点关闭按钮怎么办」的询问。
 *
 * 宿主等这个答复**只有 3 秒**,超时即走它自己的兜底并记一条日志 —— 所以调用方必须
 * 对每个 `desktop-close-requested` 事件恰好答复一次(少答 = 走兜底,重复答 = 语义未定义)。
 * 这里刻意不返回成功与否:调用方除了"继续等宿主兜底"没有第二种处置动作,
 * 多一个返回值只会多一个被忽略的分支。
 */
export async function resolveCloseChoice(choice: DesktopCloseChoice, remember: boolean): Promise<void> {
  if (!isMember(CLOSE_CHOICES)(choice)) {
    console.warn('[desktop-prefs] resolve_close_choice 收到未知档位,已忽略')
    return
  }
  if (!isDesktopPrefsAvailable()) {
    console.warn('[desktop-prefs] 宿主未就绪,关闭询问未被答复(将走 Rust 侧 3s 兜底)')
    return
  }
  try {
    await invoke('resolve_close_choice', { choice, remember })
  } catch (error) {
    console.warn('[desktop-prefs] resolve_close_choice 失败:', error)
  }
}

/**
 * 同步未读徽章(Windows 任务栏 overlay icon)。
 *
 * 线上参数是**条数**而不是布尔:宿主签名 `set_desktop_badge(app, unread: u32)` ——
 * 给它传 `true` 会在 serde 反序列化那一层就报"invalid type: boolean, expected u32",
 * 于是徽章永远画不出来(而 tooltip 一切正常,现象只像是"红点这功能没生效")。
 * `unreadBadge=false` 或 `unread=0` ⇒ 宿主自己清掉 overlay:要不要真的画由宿主按偏好决定,
 * 前端不再抄一份开关判断。
 * 浏览器/未就绪 ⇒ no-op,这是正常路径,不喊。
 */
export async function setDesktopBadge(unreadCount: number): Promise<void> {
  if (!isDesktopPrefsAvailable()) return
  // u32 上界钳一下:非有限值/负数按 0(清徽章),超出上限按上限(仍是"有未读")
  const unread = Number.isFinite(unreadCount) && unreadCount > 0 ? Math.min(Math.trunc(unreadCount), 0xffffffff) : 0
  try {
    await invoke('set_desktop_badge', { unread })
  } catch (error) {
    console.warn('[desktop-prefs] set_desktop_badge 失败:', error)
  }
}

// ================== 宿主 → 前端的偏好变更 ==================

/** 取 CustomEvent 的 detail(不给 `any` 开口子:只承认"有个 detail 字段")。 */
function detailOf(event: Event): unknown {
  return 'detail' in event ? (event as { detail: unknown }).detail : null
}

/**
 * 订阅「宿主侧偏好已变更」(托盘菜单改主题/在另一处改设置都会广播它)。
 *
 * 事件名在这里、在 `use-desktop.ts` 的 `listen()` 与 `new CustomEvent()` 两处逐字同形 ——
 * 这条三层链(Rust emit → 桥接端 listen + 再派发 → 消费端 addEventListener)由
 * `scripts/check-desktop-event-wiring.mjs` 对账,改名必须同时改完三处。
 * 本函数就是那个"消费端":桥接文件自己被对账排除在外,把监听写进 use-desktop.ts
 * 等于派发出去没人接(账面绿而托盘改了设置页不动)。
 */
export function subscribeDesktopPrefsChanged(onPrefs: (prefs: DesktopPrefs) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = (event: Event): void => {
    onPrefs(normalizeDesktopPrefs(detailOf(event)))
  }
  window.addEventListener('desktop-prefs-changed', handler)
  return () => window.removeEventListener('desktop-prefs-changed', handler)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
