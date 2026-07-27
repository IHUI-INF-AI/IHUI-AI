'use client'

import * as React from 'react'
import { Activity, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgentProgressPaneStore } from '@/stores/agent-progress-pane'

/**
 * AgentProgressTrigger — Agent 任务进度 Bottom Pane 的浮动触发按钮 + 全局快捷键
 *
 * Codex CLI TUI 对齐快捷键:
 * - Down(ArrowDown):打开底部面板(Codex 标准快捷键)
 * - Tab:切换排序模式(recent → duration → status)
 * - a:切换 active/archived 视图
 * - v:切换 verbose 模式(显示原始 ID)
 * - Ctrl+Shift+J:切换面板开关(保留,Web 习惯)
 *
 * 焦点在输入控件时(Input/Textarea/Select/contentEditable)不拦截快捷键,
 * 避免影响用户正常输入(Tab 在表单中用于焦点切换)。
 *
 * 位置策略:
 * - fixed bottom-4 right-4(z-sticky 层级,避开 modal/PWA 提示层 z-modal)
 * - 已打开时按钮图标变为 X,提示再次点击关闭
 */
export function AgentProgressTrigger() {
  const open = useAgentProgressPaneStore((s) => s.open)
  const toggle = useAgentProgressPaneStore((s) => s.toggle)
  const cycleSortMode = useAgentProgressPaneStore((s) => s.cycleSortMode)
  const toggleShowArchived = useAgentProgressPaneStore((s) => s.toggleShowArchived)
  const toggleVerbose = useAgentProgressPaneStore((s) => s.toggleVerbose)

  // 全局快捷键
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 焦点在输入控件时不拦截(Tab/Down/a/v 都可能在表单中使用)
      const el = e.target as HTMLElement | null
      if (el) {
        const tag = el.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) {
          return
        }
      }

      const ctrl = e.ctrlKey || e.metaKey
      const shift = e.shiftKey
      const key = e.key.toLowerCase()

      // Ctrl+Shift+J:切换面板开关(Web 习惯,保留)
      if (ctrl && shift && key === 'j') {
        e.preventDefault()
        toggle()
        return
      }

      // 面板未打开时,仅 ArrowDown 触发打开(其他快捷键无意义)
      if (!useAgentProgressPaneStore.getState().open) {
        if (e.key === 'ArrowDown' && !ctrl && !shift && !e.altKey) {
          e.preventDefault()
          toggle()
        }
        return
      }

      // 面板已打开时的快捷键
      // Tab:切换排序模式
      if (e.key === 'Tab' && !ctrl && !shift && !e.altKey) {
        e.preventDefault()
        cycleSortMode()
        return
      }

      // a:切换 active/archived
      if (key === 'a' && !ctrl && !shift && !e.altKey) {
        e.preventDefault()
        toggleShowArchived()
        return
      }

      // v:切换 verbose
      if (key === 'v' && !ctrl && !shift && !e.altKey) {
        e.preventDefault()
        toggleVerbose()
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle, cycleSortMode, toggleShowArchived, toggleVerbose])

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={open ? '关闭 Agent 任务进度' : '打开 Agent 任务进度'}
      title={open ? '关闭 (Ctrl+Shift+J 或 Esc)' : 'Agent 任务进度 (↓ 或 Ctrl+Shift+J)'}
      className={cn(
        'pointer-events-auto fixed bottom-4 right-4 z-sticky',
        'inline-flex h-10 w-10 items-center justify-center',
        'rounded-lg border border-border bg-card text-foreground shadow-md',
        'transition-colors hover:bg-accent hover:text-accent-foreground',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      )}
      data-testid="agent-progress-trigger"
    >
      {open ? <X className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
    </button>
  )
}

export default AgentProgressTrigger
