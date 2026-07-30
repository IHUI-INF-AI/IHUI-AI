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
  // Ctrl+K 区分作用域:编辑器聚焦 → inline-edit;其他 → 命令面板(open-chat)
  { key: 'Ctrl+K', description: '命令面板 / 行内编辑', event: '__cmd_k__' },
  { key: 'Ctrl+P', description: '搜索', event: 'global-shortcut:search' },
  { key: 'Ctrl+Shift+N', description: '新建对话', event: 'global-shortcut:new-chat' },
  { key: 'Ctrl+/', description: '快捷键帮助', event: '__toggle_help__' },
  { key: 'Ctrl+Shift+D', description: '短剧编辑器', event: 'global-shortcut:open-drama' },
  // 2026-07-30 用户规则:"可以做快捷键 组合键 你深度思考分析设计去做好"
  // VS Code 标准命令面板快捷键:Ctrl+Shift+P 打开 Plus 命令面板(视图/工具/设置切换)
  // 设计依据:① VS Code 用户最熟悉 ② 不与项目已有 Ctrl+P(搜索)冲突(matchShortcut 修复后严格区分 shift)
  // ③ 用户在面板内输入字符过滤 + ↑↓ 导航 + Enter 确认,完整覆盖 9 项菜单访问
  { key: 'Ctrl+Shift+P', description: '命令面板(视图切换)', event: 'global-shortcut:open-plus' },
  // VS Code 标准设置快捷键:Ctrl+, 直接打开设置页(高频入口,免命令面板搜索)
  { key: 'Ctrl+,', description: '打开设置', event: 'global-shortcut:open-settings' },
  // 对话模式切换(2026-07-28 立,补全 ChatMode 4态三通道)
  // Ctrl+1/2/3/4 切换 build/plan/review/spec,仅在 AI 面板打开时生效(由 ai-side-panel 监听 keydown)
  // 全局注册主要用于帮助面板展示 + 统一 preventDefault 阻止浏览器 tab 切换默认行为
  { key: 'Ctrl+1', description: '切换到构建模式', event: 'global-shortcut:mode-build' },
  { key: 'Ctrl+2', description: '切换到计划模式', event: 'global-shortcut:mode-plan' },
  { key: 'Ctrl+3', description: '切换到审查模式', event: 'global-shortcut:mode-review' },
  { key: 'Ctrl+4', description: '切换到规格模式', event: 'global-shortcut:mode-spec' },
]

// ============================================================================
// 快捷键匹配
// ============================================================================

/** 判断键盘事件是否匹配快捷键组合（格式如 "Ctrl+K"、"Ctrl+Shift+N"）
 *
 * 2026-07-30 严格匹配修复(用户规则:"可以做快捷键 组合键 你深度思考分析设计去做好"):
 * - 修复前:wantShift=false 时不检查 shiftKey,导致 Ctrl+P 会匹配 Ctrl+Shift+P 按键事件
 *   → 注册 Ctrl+Shift+P 永远不触发(被 Ctrl+P 先 break)
 * - 修复后:未指定的 modifier 必须为 false(严格匹配),让 Ctrl+P 与 Ctrl+Shift+P 严格区分
 * - 影响审计:现有快捷键全部 wantShift=true 或 wantShift=false 的纯 Ctrl 组合,
 *   修复后行为更精确(用户按 Ctrl+Shift+K 不再误触 Ctrl+K),无回归风险
 *
 * 2026-07-30 Mac 兼容性优化(用户规则:"继续按你的建议去做执行 完美细致完整毫无遗漏"):
 * - 优化前:wantCtrl 严格匹配 ctrlKey,Mac 用户按 Cmd+X 不触发 Ctrl+X 注册的快捷键
 *   (Tooltip 显示 ⌘⇧P 但实际监听只支持 Ctrl,UI 与行为不一致)
 * - 优化后:Mac 上 wantCtrl 接受 ctrlKey || metaKey(Cmd),与 VS Code 标准行为一致
 *   (VS Code 在 Mac 上 Cmd+P = 搜索,Cmd+Shift+P = 命令面板,跟 Win/Linux Ctrl+P 等价)
 * - 严格匹配仍保留:Mac 上 wantCtrl=true 时,"未声明 cmd 但按了 metaKey"不返回 false
 *   (因为 wantCtrl 在 Mac 上接受 metaKey,这是合法行为)
 * - 无回归风险:Windows/Linux 上 wantCtrl 仍只接受 ctrlKey,行为不变
 */
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
  // Mac 兼容性(2026-07-30):Mac 上 wantCtrl 接受 ctrlKey || metaKey(Cmd),
  // 让 Mac 用户用 Cmd+X 触发 Ctrl+X 注册的快捷键(VS Code 标准行为)
  // Windows/Linux 上 wantCtrl 仍只接受 ctrlKey
  if (wantCtrl && !wantMod) {
    if (isMac) {
      if (!event.metaKey && !event.ctrlKey) return false
    } else {
      if (!event.ctrlKey) return false
    }
  }
  if (wantCmd && !event.metaKey) return false
  if (wantShift && !event.shiftKey) return false
  if (wantAlt && !event.altKey) return false

  // 严格匹配:未在组合中声明的 modifier 必须为 false
  // (修复前缺失此约束,导致 Ctrl+P 误匹配 Ctrl+Shift+P,Ctrl+Shift+P 永不触发)
  // Mac 兼容性(2026-07-30):wantCtrl=true 时,metaKey 是合法的,不返回 false
  if (!wantCtrl && !wantMod && event.ctrlKey && !event.metaKey) return false
  if (!wantCmd && !wantMod && event.metaKey && !event.ctrlKey) {
    // Mac 上 wantCtrl=true 时,metaKey 是合法的(wantCtrl 接受 metaKey),不返回 false
    if (!(isMac && wantCtrl)) return false
  }
  if (!wantShift && event.shiftKey) return false
  if (!wantAlt && event.altKey) return false

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

  React.useSyncExternalStore(
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
        } else if (def.event === '__cmd_k__') {
          // Ctrl+K 作用域判断:
          // - Monaco 编辑器聚焦 → 不派发(由 use-ide-shortcuts 直接派发 inline-edit)
          // - 其他场景 → 派发 open-chat(命令面板,向后兼容)
          if (typeof window === 'undefined') return
          const active = document.activeElement
          const inMonaco = !!active?.closest('.monaco-editor')
          if (inMonaco) return // 交给 use-ide-shortcuts
          window.dispatchEvent(new CustomEvent('global-shortcut:open-chat'))
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
    [scope],
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
