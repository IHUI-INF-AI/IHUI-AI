// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * 桌面端(Desktop)本地偏好的跨设备漫游形状 —— 唯一真相源。
 *
 * 分工:偏好的**语义**只由桌面端(Rust 侧那份本地文件)解释;服务端只搬运这个对象,
 * 因此它不得在别处被第二次描述。`packages/database` 的 jsonb 列刻意不带 `$type`
 * (那需要在 schema 包里再抄一份形状),读回来时统一过本文件的 `checkDesktopPrefs`。
 *
 * 校验住在这一侧而不是端内:AGENTS §3 的"unknown + 类型守卫"口径,且 `@ihui/types`
 * 不依赖 zod(见其 package.json),端内 zod 只负责信封(见 apps/api 的 desktop-prefs 路由)。
 */

/** 关闭按钮的行为档位。 */
export const DESKTOP_CLOSE_BEHAVIORS = ['hide', 'quit', 'ask'] as const

/** 托盘单击的行为档位。 */
export const DESKTOP_TRAY_SINGLE_CLICKS = ['menu', 'toggle_window'] as const

export type DesktopCloseBehavior = (typeof DESKTOP_CLOSE_BEHAVIORS)[number]
export type DesktopTraySingleClick = (typeof DESKTOP_TRAY_SINGLE_CLICKS)[number]

/** 桌面端可漫游的那六个偏好项(与 Rust 侧本地文件里的键位一一对应)。 */
export type DesktopPrefs = {
  showTrayIcon: boolean
  closeBehavior: DesktopCloseBehavior
  launchMinimized: boolean
  traySingleClick: DesktopTraySingleClick
  unreadBadge: boolean
  trayMenuItems: string[]
}

/**
 * `GET/PUT /api/desktop/prefs` 的响应载荷。
 *
 * `enabled:false` 时 `prefs` 一律为 `null` —— 漫游关着的行**不是**权威值,
 * 端上必须回落到本地那份(契约写在这里,免得各端各自"顺手"读那个对象)。
 */
export type DesktopPrefsPayload = {
  enabled: boolean
  prefs: DesktopPrefs | null
}

/** 校验结果:成功带回**归一后**的对象,失败带回可直接进响应体的原因。 */
export type DesktopPrefsCheck = { ok: true; value: DesktopPrefs } | { ok: false; reason: string }

/** 允许出现的键位清单(拒绝多余键用;新增字段时这里与下方构造必须同笔改)。 */
export const DESKTOP_PREFS_KEYS = [
  'showTrayIcon',
  'closeBehavior',
  'launchMinimized',
  'traySingleClick',
  'unreadBadge',
  'trayMenuItems',
] as const satisfies readonly (keyof DesktopPrefs)[]

const CLOSE_BEHAVIOR_SET: ReadonlySet<string> = new Set<string>(DESKTOP_CLOSE_BEHAVIORS)
const TRAY_SINGLE_CLICK_SET: ReadonlySet<string> = new Set<string>(DESKTOP_TRAY_SINGLE_CLICKS)

// Set 判据只收窄到 string,得用类型谓词把档位带回来(否则下面构造对象时类型对不上)
const isCloseBehavior = (raw: string): raw is DesktopCloseBehavior => CLOSE_BEHAVIOR_SET.has(raw)
const isTraySingleClick = (raw: string): raw is DesktopTraySingleClick =>
  TRAY_SINGLE_CLICK_SET.has(raw)

const rejected = (reason: string): DesktopPrefsCheck => ({ ok: false, reason })

/**
 * 任意输入 → 已校验的 `DesktopPrefs`,或拒绝原因。
 *
 * 三条刻意的口径:
 * 1. **严格对象**:多余键与缺键都拒。半吊子载荷写进库之后,下一次读的人会以为自己
 *    那份默认值生效了 —— 那正是本仓最高频的"账面绿、实际没人知道发生了什么"。
 * 2. **不做任何强转**:`"true"` / 数字 / null 都不算布尔,不给默认值兜底。
 * 3. 返回值是**新建的对象**而非入参引用,调用方拿到的东西不会随入参被外部改写。
 */
export function checkDesktopPrefs(value: unknown): DesktopPrefsCheck {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return rejected('prefs 必须是一个对象')
  }
  const raw = value as Record<string, unknown>

  for (const key of Object.keys(raw)) {
    if (!(DESKTOP_PREFS_KEYS as readonly string[]).includes(key)) {
      return rejected(`prefs 含未知字段: ${key}`)
    }
  }

  if (typeof raw.showTrayIcon !== 'boolean') return rejected('prefs.showTrayIcon 必须是布尔值')
  const closeBehavior = raw.closeBehavior
  if (typeof closeBehavior !== 'string' || !isCloseBehavior(closeBehavior)) {
    return rejected(`prefs.closeBehavior 必须是 ${DESKTOP_CLOSE_BEHAVIORS.join(' / ')} 之一`)
  }
  if (typeof raw.launchMinimized !== 'boolean') {
    return rejected('prefs.launchMinimized 必须是布尔值')
  }
  const traySingleClick = raw.traySingleClick
  if (typeof traySingleClick !== 'string' || !isTraySingleClick(traySingleClick)) {
    return rejected(`prefs.traySingleClick 必须是 ${DESKTOP_TRAY_SINGLE_CLICKS.join(' / ')} 之一`)
  }
  if (typeof raw.unreadBadge !== 'boolean') return rejected('prefs.unreadBadge 必须是布尔值')
  if (!Array.isArray(raw.trayMenuItems)) return rejected('prefs.trayMenuItems 必须是字符串数组')
  // 单趟边验边拷:既拒绝了非字符串元素,又不会把调用方数组的引用留在返回值里。
  const trayMenuItems: string[] = []
  for (const item of raw.trayMenuItems) {
    if (typeof item !== 'string') return rejected('prefs.trayMenuItems 必须是字符串数组')
    trayMenuItems.push(item)
  }

  // 返回类型标注为 DesktopPrefs:给类型加字段而这里没跟着补 ⇒ tsc 直接红,
  // 不需要再造一层"清单↔类型"断言去兜。
  const value6: DesktopPrefs = {
    showTrayIcon: raw.showTrayIcon,
    closeBehavior,
    launchMinimized: raw.launchMinimized,
    traySingleClick,
    unreadBadge: raw.unreadBadge,
    trayMenuItems,
  }
  return { ok: true, value: value6 }
}

/**
 * `checkDesktopPrefs` 的布尔投影(只问"像不像",不要原因时用)。
 *
 * 单点实现不复制:它是上面那个函数的降格投影,判据变了这里跟着变,不存在第二份真相。
 */
export function isDesktopPrefs(value: unknown): value is DesktopPrefs {
  return checkDesktopPrefs(value).ok
}

/**
 * 库里读出的一行(或没有行)→ 响应载荷。
 *
 * `enabled` 为假 ⇒ `prefs` 恒 null(非权威);行存在但载荷已不合法 ⇒ 同样回 null,
 * 但**不**替用户把 enabled 翻成 false(那是端上的开关,不是服务端该做的决定)。
 */
export function projectDesktopPrefsPayload(
  row: { enabled: boolean; prefs: unknown } | undefined,
): DesktopPrefsPayload {
  if (!row || !row.enabled) return { enabled: false, prefs: null }
  const check = checkDesktopPrefs(row.prefs)
  return { enabled: true, prefs: check.ok ? check.value : null }
}
