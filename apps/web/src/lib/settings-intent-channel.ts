// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 设置页一次性导航意图双通道(2026-09-30 立,吸收批 74 W5)。
 *
 * 机制(中性语义重述:长驻面板的一次性跳转意图):
 *  1. sessionStorage 通道:面板**未打开**时,意图先落 sessionStorage;
 *     面板挂载时读消费(读后即删),直达目标分区。
 *  2. CustomEvent 通道:面板**已打开**时不会重新挂载,单纯写 sessionStorage 没有订阅者
 *     会响应——设意图时同窗口补发自定义事件,已挂载的面板即时跳转。
 *  3. 事件承载意图时**同步清掉 sessionStorage**:防止用户随后切到别的分区退出后,
 *     陈旧 pending 意图在下次挂载时覆盖"上次停留分区"。
 *  4. 上次停留分区 localStorage 记忆 + 旧 section id 读时迁移(别名表;未知值删除)。
 *  5. localStorage/sessionStorage 不可用(WebView/隐私容器禁用)只 warn 回退默认入口,
 *     不阻断打开设置页;无显式意图时先读上次停留分区,再让一次性意图覆盖。
 */

export type SettingsSectionId =
  | 'general'
  | 'appearance'
  | 'models'
  | 'notifications'
  | 'shortcuts'
  | 'about'

export interface SettingsSectionIntentDetail {
  section: SettingsSectionId
}

/** 旧 section id 别名表:历史偏好/旧调用读时迁移,避免继续传播历史路由语义。 */
const LEGACY_SECTION_ALIASES: Record<string, SettingsSectionId> = {
  theme: 'appearance',
  account: 'general',
  apikeys: 'models',
}

const SETTINGS_SECTION_INTENT_KEY = 'ihui:settings:section-intent'
const SETTINGS_LAST_SECTION_KEY = 'ihui:settings:last-section'
const SETTINGS_SECTION_INTENT_EVENT = 'ihui:settings-section-intent'

/** 导出供测试注入旧值;业务代码一律走本模块函数。 */
export const SETTINGS_LAST_SECTION_STORAGE_KEY = SETTINGS_LAST_SECTION_KEY
export const SETTINGS_SECTION_INTENT_STORAGE_KEY = SETTINGS_SECTION_INTENT_KEY
export const SETTINGS_SECTION_INTENT_EVENT_NAME = SETTINGS_SECTION_INTENT_EVENT

function isSettingsSectionId(value: string): value is SettingsSectionId {
  return ['general', 'appearance', 'models', 'notifications', 'shortcuts', 'about'].includes(
    value,
  )
}

/** 别名归一:旧 id 迁到当前 id;未知值交由调用方回退。 */
export function resolveSettingsSectionId(
  section: string,
  fallback: SettingsSectionId,
): SettingsSectionId {
  const aliased = LEGACY_SECTION_ALIASES[section]
  if (aliased) {
    return aliased
  }
  return isSettingsSectionId(section) ? section : fallback
}

function warnStorageUnavailable(kind: string, error: unknown): void {
  // 部分容器禁用存储:分区记忆只是 UI 偏好,回退默认入口,不阻断打开设置页。
  console.warn(`[settings-intent-channel] ${kind} 不可用`, {
    error: error instanceof Error ? error.message : String(error),
  })
}

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return window.localStorage
  } catch (error) {
    warnStorageUnavailable('localStorage', error)
    return null
  }
}

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return window.sessionStorage
  } catch (error) {
    warnStorageUnavailable('sessionStorage', error)
    return null
  }
}

/** 读"上次停留分区":旧 id 读时迁移并顺手写回;未知值删除。 */
function readLastSettingsSection(fallback: SettingsSectionId): SettingsSectionId {
  const storage = getLocalStorage()
  if (!storage) {
    return fallback
  }
  try {
    const raw = storage.getItem(SETTINGS_LAST_SECTION_KEY)
    if (raw === null) {
      return fallback
    }
    const resolved = resolveSettingsSectionId(raw, fallback)
    if (resolved === fallback && !isSettingsSectionId(raw) && !LEGACY_SECTION_ALIASES[raw]) {
      // 未知值:删除持久化残留,不让它继续传播
      storage.removeItem(SETTINGS_LAST_SECTION_KEY)
      return fallback
    }
    if (resolved !== raw) {
      // 迁移不只读时生效,还落盘
      storage.setItem(SETTINGS_LAST_SECTION_KEY, resolved)
    }
    return resolved
  } catch (error) {
    warnStorageUnavailable('读取上次设置分区', error)
    return fallback
  }
}

/** 记录"上次停留分区"(面板切换分区时调用)。 */
export function writeLastSettingsSectionPreference(section: SettingsSectionId): void {
  const storage = getLocalStorage()
  if (!storage) {
    return
  }
  try {
    storage.setItem(SETTINGS_LAST_SECTION_KEY, section)
  } catch (error) {
    warnStorageUnavailable('写入上次设置分区', error)
  }
}

/** 设一次性跳转意图:sessionStorage 落底 + 同窗口补发事件(双通道)。 */
export function setPendingSettingsSection(section: SettingsSectionId): void {
  if (typeof window === 'undefined') {
    return
  }
  const sessionStorage = getSessionStorage()
  if (sessionStorage) {
    try {
      sessionStorage.setItem(SETTINGS_SECTION_INTENT_KEY, section)
    } catch {
      // 存储异常不阻断事件通道
    }
  }
  // 面板已打开时不会重新挂载,单纯写 sessionStorage 没有订阅者会响应;
  // 同窗口补发自定义事件,让已挂载的面板即时跳转。
  window.dispatchEvent(
    new CustomEvent<SettingsSectionIntentDetail>(SETTINGS_SECTION_INTENT_EVENT, {
      detail: { section },
    }),
  )
}

/** 清一次性意图(消费后/事件抵达后调用)。 */
export function clearPendingSettingsSection(): void {
  const sessionStorage = getSessionStorage()
  if (!sessionStorage) {
    return
  }
  try {
    sessionStorage.removeItem(SETTINGS_SECTION_INTENT_KEY)
  } catch {
    // 忽略存储异常
  }
}

/**
 * 面板挂载入口:先读"上次停留分区",再让一次性意图覆盖。
 * 之前把 fallback 写死成某个具体分区,导致没有跳转意图也总进那个分区——
 * 这里先读上次停留,保留"无意图落上次停留"的语义。
 */
export function consumeInitialSettingsSection(fallback: SettingsSectionId = 'general'): SettingsSectionId {
  const lastSection = readLastSettingsSection(fallback)
  return consumePendingSettingsSection(lastSection)
}

/** 读消费 sessionStorage 一次性意图(读后即删;旧 id 迁移)。 */
export function consumePendingSettingsSection(fallback: SettingsSectionId): SettingsSectionId {
  const sessionStorage = getSessionStorage()
  if (!sessionStorage) {
    return fallback
  }
  try {
    const raw = sessionStorage.getItem(SETTINGS_SECTION_INTENT_KEY)
    if (raw !== null) {
      sessionStorage.removeItem(SETTINGS_SECTION_INTENT_KEY)
    }
    if (raw !== null) {
      return resolveSettingsSectionId(raw, fallback)
    }
  } catch {
    // 忽略存储异常
  }
  return fallback
}

/**
 * 已挂载面板订阅事件通道。事件抵达时**同步清掉 sessionStorage**:
 * 事件已经承载了这次跳转意图,不清的话用户切到别的分区退出后,
 * 下次挂载会被陈旧 pending 意图覆盖"上次停留分区"。
 */
export function addPendingSettingsSectionListener(
  listener: (section: SettingsSectionId, detail?: SettingsSectionIntentDetail) => void,
): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }
  const handleIntent = (event: Event) => {
    const detail = (event as CustomEvent<SettingsSectionIntentDetail>).detail
    if (detail?.section && isSettingsSectionId(detail.section)) {
      clearPendingSettingsSection()
      listener(detail.section, detail)
    }
  }
  window.addEventListener(SETTINGS_SECTION_INTENT_EVENT, handleIntent)
  return () => {
    window.removeEventListener(SETTINGS_SECTION_INTENT_EVENT, handleIntent)
  }
}
