'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { useAgentProgressPaneStore } from '@/stores/agent-progress-pane'

/**
 * AgentProgressTrigger — Agent 任务进度 Bottom Pane 的浮动触发按钮 + 全局快捷键
 *
 * Codex CLI TUI 对齐快捷键:
 * - Down(ArrowDown):打开底部面板(Codex 标准快捷键)
 * - 1/2/3:切换 Tasks/Subagents/Terminals 栏(Codex 标准三栏切换)
 * - Tab:切换排序模式(recent → duration → status)
 * - a:切换 active/archived 视图
 * - v:切换 verbose 模式(显示原始 ID)
 * - Ctrl+Shift+J:切换面板开关(保留,Web 习惯)
 *
 * Codex 视觉对齐:
 * - 文本字符图标(替代 lucide):■ 收起态 / ▲ 展开态
 * - pane 打开时隐藏 trigger(pane 自身有 ResizeHandle + 关闭快捷键 Esc/q)
 * - 仅在 pane 关闭时显示 trigger
 *
 * j/k/Enter/y/n/g/G/space/?// 由 Pane 组件内部处理(需数据上下文确定 cursor/审批目标)。
 * 焦点在输入控件时(Input/Textarea/Select/contentEditable)不拦截快捷键,
 * 避免影响用户正常输入(Tab 在表单中用于焦点切换,1/2/3 可能是输入内容)。
 */
export function AgentProgressTrigger() {
  const open = useAgentProgressPaneStore((s) => s.open)
  const toggle = useAgentProgressPaneStore((s) => s.toggle)
  const setActiveColumn = useAgentProgressPaneStore((s) => s.setActiveColumn)
  const cycleSortMode = useAgentProgressPaneStore((s) => s.cycleSortMode)
  const toggleShowArchived = useAgentProgressPaneStore((s) => s.toggleShowArchived)
  const toggleVerbose = useAgentProgressPaneStore((s) => s.toggleVerbose)

  // 全局快捷键
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 焦点在输入控件时不拦截
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

      // 面板未打开时,仅 ArrowDown 触发打开
      if (!useAgentProgressPaneStore.getState().open) {
        if (e.key === 'ArrowDown' && !ctrl && !shift && !e.altKey) {
          e.preventDefault()
          toggle()
        }
        return
      }

      // 面板已打开时的快捷键
      // 1/2/3:切换栏(Codex 标准三栏切换)— 智能保持 cursor(传 undefined 保持原 cursor)
      if ((e.key === '1' || e.key === '2' || e.key === '3') && !ctrl && !shift && !e.altKey) {
        e.preventDefault()
        const col = e.key === '1' ? 'tasks' : e.key === '2' ? 'subagents' : 'terminals'
        // 不传 newColumnCount,由 pane 的 handleColumnSwitch 在点击时传
        // 这里走 trigger 快捷键路径,保持原 cursor(若新栏条目不足,pane 的 visibleCount 会自然 clamp)
        setActiveColumn(col)
        return
      }

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
  }, [toggle, setActiveColumn, cycleSortMode, toggleShowArchived, toggleVerbose])

  // Codex:pane 打开时隐藏 trigger(pane 自身有 ResizeHandle 在顶部 + Esc/q 关闭)
  if (open) return null

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="打开 Agent 任务进度"
      title="Agent 任务进度 (↓ 或 Ctrl+Shift+J)"
      className={cn(
        'pointer-events-auto fixed bottom-4 right-4 z-sticky',
        'inline-flex h-10 w-10 items-center justify-center',
        'rounded-lg border border-border bg-card text-foreground shadow-md',
        'font-mono text-base',
        'transition-colors hover:bg-accent hover:text-accent-foreground',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      )}
      data-testid="agent-progress-trigger"
    >
      {/* Codex 风格文本字符图标:▲ 表示"展开底部面板" */}
      <span aria-hidden="true">▲</span>
    </button>
  )
}

export default AgentProgressTrigger
