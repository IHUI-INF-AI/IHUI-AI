// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 快捷键自定义(2026-11-14)。
 *
 * 设计约束:
 * - 存储键按 **action id** 而不是 chord 索引。若按 chord 存,用户改键后旧 chord 会回落默认,
 *   形成"一键双绑定";action 是稳定的,默认 chord 只是它的出厂值。
 * - 只做纯逻辑(解析/规范化/冲突检测/格式化),不读 React;localStorage 读写由 hook 负责,
 *   这样同一套规则可以被帮助面板、设置页、单测共用。
 * - 录制得到的组合键统一成 `Ctrl+Alt+Shift+Key` 顺序,匹配端只认这一种形态。
 */

export const SHORTCUT_OVERRIDES_STORAGE_KEY = 'ihui.shortcut-overrides'
export const SHORTCUT_OVERRIDES_SCHEMA_VERSION = 1 as const

const MAX_OVERRIDES = 100
const MODIFIER_KEYS = new Set([
  'Control',
  'Shift',
  'Alt',
  'Meta',
  'CapsLock',
  'Dead',
  'Process',
  'Unidentified',
])

/** 物理键 → 字符:避免 Shift+/ 得到 `?` 而存不进 `Ctrl+Shift+/` 这类既有 chord。 */
const CODE_KEY_MAP: Record<string, string> = {
  Slash: '/',
  Comma: ',',
  Period: '.',
  Semicolon: ';',
  Quote: "'",
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Minus: '-',
  Equal: '=',
  Backquote: '`',
}

/** 功能键:原样保留匹配端的写法。 */
const NAMED_KEYS: Record<string, string> = {
  arrowup: 'ArrowUp',
  arrowdown: 'ArrowDown',
  arrowleft: 'ArrowLeft',
  arrowright: 'ArrowRight',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  insert: 'Insert',
  delete: 'Delete',
  backspace: 'Backspace',
  enter: 'Enter',
  tab: 'Tab',
  escape: 'Escape',
  esc: 'Escape',
}

export interface ShortcutBinding {
  /** 默认快捷键的稳定 id;组件临时注册的条目没有 action。 */
  action?: string
  key: string
}

export interface ShortcutOverrideMap {
  [action: string]: string
}

export type ShortcutSetResult =
  | { ok: true; combo: string }
  | { ok: false; reason: 'invalid-combo' | 'unknown-action' | 'conflict'; conflictKey?: string; conflictAction?: string }

export interface ConflictInput {
  action?: string
  combo: string
  bindings: ShortcutBinding[]
}

function normalizeKeyName(key: string): string {
  const trimmed = key.trim()
  if (!trimmed) return ''
  const lower = trimmed.toLowerCase()
  if (NAMED_KEYS[lower]) return NAMED_KEYS[lower]
  if (/^f\d{1,2}$/.test(lower)) return lower.toUpperCase()
  if (trimmed.length === 1) return trimmed.toUpperCase()
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

/**
 * 归一化组合键:`ctrl/cmd/meta` 一律写成 `Ctrl`,修饰键顺序固定 `Ctrl+Alt+Shift`。
 * 无法识别(空串/只有修饰键)时返回空串。
 */
export function normalizeCombo(combo: string): string {
  const parts = combo.split('+').map((part) => part.trim()).filter(Boolean)
  if (parts.length < 2) return ''
  const key = parts.pop()
  if (!key) return ''
  if (/^(ctrl|control|shift|alt|meta|cmd|command|option|opt)$/i.test(key.trim())) return ''
  const modifiers = new Set<string>()
  for (const part of parts) {
    switch (part.toLowerCase()) {
      case 'ctrl':
      case 'control':
      case 'cmd':
      case 'meta':
      case 'command':
        modifiers.add('Ctrl')
        break
      case 'alt':
      case 'option':
      case 'opt':
        modifiers.add('Alt')
        break
      case 'shift':
        modifiers.add('Shift')
        break
      default:
        return ''
    }
  }
  const ordered = ['Ctrl', 'Alt', 'Shift'].filter((modifier) => modifiers.has(modifier))
  if (ordered.length === 0) return ''
  const normalizedKey = normalizeKeyName(key)
  if (!normalizedKey) return ''
  return [...ordered, normalizedKey].join('+')
}

/** 展示形态:Mac 上 `Ctrl` 显示为 `⌘`;其余保持规范形态。 */
export function formatCombo(combo: string, isMac = false): string {
  const normalized = normalizeCombo(combo)
  if (!normalized) return combo
  return normalized
    .split('+')
    .map((part) => (isMac && part === 'Ctrl' ? '⌘' : part))
    .join(isMac ? '' : '+')
}

/** 从 keydown 事件生成组合键;只有 Shift 或只有裸键时返回 null(拒绝单键改键)。 */
export function comboFromKeyEvent(event: {
  key: string
  code?: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
  isComposing?: boolean
}): string | null {
  if (event.isComposing) return null
  if (MODIFIER_KEYS.has(event.key)) return null
  if (!event.ctrlKey && !event.metaKey && !event.altKey) return null

  let key = ''
  if (event.code && CODE_KEY_MAP[event.code]) {
    key = CODE_KEY_MAP[event.code] ?? ''
  } else if (event.key === ' ') {
    key = 'Space'
  } else if (/^[a-z0-9]$/i.test(event.key)) {
    key = event.key.toUpperCase()
  } else if (/^F\d{1,2}$/i.test(event.key)) {
    key = event.key.toUpperCase()
  } else if (NAMED_KEYS[event.key.toLowerCase()]) {
    key = NAMED_KEYS[event.key.toLowerCase()] ?? ''
  } else if (event.key.length === 1) {
    key = event.key.toUpperCase()
  }
  if (!key) return null

  const modifiers: string[] = []
  if (event.ctrlKey || event.metaKey) modifiers.push('Ctrl')
  if (event.altKey) modifiers.push('Alt')
  if (event.shiftKey) modifiers.push('Shift')
  return normalizeCombo([...modifiers, key].join('+'))
}

/**
 * 解析持久化值。任何坏数据(非 JSON / 版本不符 / 值非字符串)都回落空表,
 * 不允许一个损坏的 localStorage 让全站快捷键失效。
 */
export function parseStoredOverrides(raw: string | null): ShortcutOverrideMap {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const candidate =
      'overrides' in parsed
        ? (parsed as { overrides?: unknown }).overrides
        : (parsed as Record<string, unknown>)
    if (!candidate || typeof candidate !== 'object') return {}
    const result: ShortcutOverrideMap = {}
    for (const [action, value] of Object.entries(candidate as Record<string, unknown>)) {
      if (Object.keys(result).length >= MAX_OVERRIDES) break
      if (typeof value !== 'string') continue
      const combo = normalizeCombo(value)
      if (!action || !combo) continue
      result[action] = combo
    }
    return result
  } catch {
    return {}
  }
}

/** 序列化为带版本号的稳定结构。 */
export function serializeOverrides(overrides: ShortcutOverrideMap): string {
  return JSON.stringify({
    version: SHORTCUT_OVERRIDES_SCHEMA_VERSION,
    overrides,
  })
}

/** 读取 localStorage(SSR/隐私模式下返回空表)。 */
export function readStoredOverrides(): ShortcutOverrideMap {
  if (typeof window === 'undefined') return {}
  try {
    return parseStoredOverrides(window.localStorage.getItem(SHORTCUT_OVERRIDES_STORAGE_KEY))
  } catch {
    return {}
  }
}

/** 写入 localStorage;失败(配额/隐私模式)时静默,内存态仍生效。 */
export function writeStoredOverrides(overrides: ShortcutOverrideMap): void {
  if (typeof window === 'undefined') return
  try {
    if (Object.keys(overrides).length === 0) {
      window.localStorage.removeItem(SHORTCUT_OVERRIDES_STORAGE_KEY)
    } else {
      window.localStorage.setItem(SHORTCUT_OVERRIDES_STORAGE_KEY, serializeOverrides(overrides))
    }
  } catch {
    // 忽略:不可写环境不应让改键交互报错
  }
}

/** 取得某个 action 的生效组合键。 */
export function effectiveCombo(
  defaultKey: string,
  action: string,
  overrides: ShortcutOverrideMap,
): string {
  return overrides[action] ?? defaultKey
}

/**
 * 冲突检测:同一作用域内(默认快捷键全部 global)不允许两个动作共用一个组合键。
 * 与自身 action 的同值不算冲突(用户可"改成默认值")。
 */
export function findShortcutConflict(input: ConflictInput): ShortcutBinding | null {
  const combo = normalizeCombo(input.combo)
  if (!combo) return null
  for (const binding of input.bindings) {
    if (input.action && binding.action === input.action) continue
    if (normalizeCombo(binding.key) === combo) return binding
  }
  return null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
