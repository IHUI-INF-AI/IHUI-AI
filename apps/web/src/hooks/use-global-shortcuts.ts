'use client'

import * as React from 'react'

// ============================================================================
// 类型定义
// ============================================================================

export interface ShortcutEntry {
  handler: () => void
  scope: string
  description?: string
}

export interface ShortcutInfo {
  key: string
  scope: string
  description?: string
  active: boolean
}

export interface UseGlobalShortcutsReturn {
  /** 注册快捷键，返回取消注册函数 */
  registerShortcut: (key: string, handler: () => void, scope?: string) => () => void
  /** 取消注册快捷键 */
  unregisterShortcut: (key: string) => void
  /** 设置当前作用域 */
  setScope: (scope: string) => void
  /** 当前作用域 */
  scope: string
  /** 帮助面板是否展开 */
  showHelpPanel: boolean
  /** 切换帮助面板 */
  toggleHelpPanel: () => void
  /** 所有已注册快捷键（用于帮助面板展示） */
  shortcuts: ShortcutInfo[]
}

// ============================================================================
// 默认快捷键
// ============================================================================

interface DefaultShortcut {
  key: string
  description: string
  /** 自定义事件名；`__toggle_help__` 为内置帮助面板切换 */
  event: string
}

const DEFAULT_SHORTCUTS: DefaultShortcut[] = [
  { key: 'Ctrl+K', description: '打开对话', event: 'global-shortcut:open-chat' },
  { key: 'Ctrl+P', description: '搜索', event: 'global-shortcut:search' },
  { key: 'Ctrl+Shift+N', description: '新建对话', event: 'global-shortcut:new-chat' },
  { key: 'Ctrl+/', description: '快捷键帮助', event: '__toggle_help__' },
  { key: 'Ctrl+Shift+D', description: '短剧编辑器', event: 'global-shortcut:open-drama' },
]

// ============================================================================
// 快捷键匹配
// ============================================================================

/** 判断键盘事件是否匹配快捷键组合（格式如 "Ctrl+K"、"Ctrl+Shift+N"） */
function matchShortcut(event: KeyboardEvent, keyCombo: string): boolean {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)

  const parts = keyCombo.toLowerCase().split('+')
  const targetKey = parts.pop()
  if (!targetKey) return false

  const wantCtrl = parts.includes('ctrl')
  const wantCmd = parts.includes('cmd') || parts.includes('meta')
  const wantShift = parts.includes('shift')
  const wantAlt = parts.includes('alt')
  const wantMod = parts.includes('mod')

  if (wantMod) {
    if (isMac ? !event.metaKey : !event.ctrlKey) return false
  }
  if (wantCtrl && !event.ctrlKey) return false
  if (wantCmd && !event.metaKey) return false
  if (wantShift && !event.shiftKey) return false
  if (wantAlt && !event.altKey) return false

  return event.key.toLowerCase() === targetKey
}

// ============================================================================
// Hook
// ============================================================================

/**
 * 全局快捷键管理器
 *
 * - 支持作用域过滤（global 作用域始终生效）
 * - 内置 5 个默认快捷键
 * - 帮助面板状态管理
 *
 * 用法：
 *   const { registerShortcut, setScope, showHelpPanel, toggleHelpPanel } = useGlobalShortcuts()
 */
export function useGlobalShortcuts(): UseGlobalShortcutsReturn {
  const [scope, setScopeState] = React.useState('global')
  const [showHelpPanel, setHelpPanel] = React.useState(false)

  const shortcutsRef = React.useRef<Map<string, ShortcutEntry>>(new Map())
  const toggleHelpPanelRef = React.useRef<() => void>(() => {})
  const listenersRef = React.useRef(new Set<() => void>())
  const versionRef = React.useRef(0)

  const subscribe = React.useCallback((cb: () => void) => {
    listenersRef.current.add(cb)
    return () => {
      listenersRef.current.delete(cb)
    }
  }, [])

  const emitChange = React.useCallback(() => {
    versionRef.current++
    listenersRef.current.forEach((l) => l())
  }, [])

  const version = React.useSyncExternalStore(
    subscribe,
    () => versionRef.current,
    () => versionRef.current,
  )

  const toggleHelpPanel = React.useCallback(() => {
    setHelpPanel((v) => !v)
  }, [])
  toggleHelpPanelRef.current = toggleHelpPanel

  const setScope = React.useCallback((s: string) => {
    setScopeState(s)
  }, [])

  const registerShortcut = React.useCallback(
    (key: string, handler: () => void, sc?: string): (() => void) => {
      shortcutsRef.current.set(key, { handler, scope: sc ?? 'global' })
      emitChange()
      return () => {
        shortcutsRef.current.delete(key)
        emitChange()
      }
    },
    [emitChange],
  )

  const unregisterShortcut = React.useCallback(
    (key: string) => {
      shortcutsRef.current.delete(key)
      emitChange()
    },
    [emitChange],
  )

  // 注册默认快捷键
  React.useEffect(() => {
    for (const def of DEFAULT_SHORTCUTS) {
      const handler = () => {
        if (def.event === '__toggle_help__') {
          toggleHelpPanelRef.current()
        } else if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(def.event))
        }
      }
      shortcutsRef.current.set(def.key, {
        handler,
        scope: 'global',
        description: def.description,
      })
    }
    emitChange()
    // 默认快捷键在组件卸载时由 GC 回收，无需手动清理
  }, [emitChange])

  // 全局 keydown 监听
  React.useEffect(() => {
    if (typeof window === 'undefined') return

    const onKeyDown = (event: KeyboardEvent) => {
      for (const [keyCombo, entry] of shortcutsRef.current) {
        // 作用域过滤：global 始终生效，其余需匹配当前作用域
        if (entry.scope !== 'global' && entry.scope !== scope) continue
        if (matchShortcut(event, keyCombo)) {
          event.preventDefault()
          entry.handler()
          break
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [scope])

  const shortcuts = React.useMemo<ShortcutInfo[]>(
    () =>
      Array.from(shortcutsRef.current.entries()).map(([key, entry]) => ({
        key,
        scope: entry.scope,
        description: entry.description,
        active: entry.scope === 'global' || entry.scope === scope,
      })),
    [version, scope],
  )

  return {
    registerShortcut,
    unregisterShortcut,
    setScope,
    scope,
    showHelpPanel,
    toggleHelpPanel,
    shortcuts,
  }
}
