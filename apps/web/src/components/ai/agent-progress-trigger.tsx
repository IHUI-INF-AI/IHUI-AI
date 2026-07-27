'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { useAgentProgressPaneStore } from '@/stores/agent-progress-pane'

/**
 * AgentProgressTrigger — Agent 任务进度 Bottom Pane 的浮动触发按钮 + 全局快捷键
 *
 * v4 简化(2026-07-27,Codex 流式对齐):
 * - Ctrl+Shift+J:切换面板开关(Web 习惯,保留)
 * - ArrowDown:打开(未打开时)
 * - v:切换 verbose(打开时,Pane 内已处理,这里仅作为兜底)
 *
 * 移除的快捷键(v4 不再需要):
 * - 1/2/3 三栏切换(改为单栏流式)
 * - Tab 排序切换(流式不需要排序)
 * - a 归档切换(流式显示全部)
 *
 * j/k/Enter/y/n/g/G/space/?// 由 Pane 组件内部处理(需数据上下文)。
 * 焦点在输入控件时不拦截快捷键。
 */
export function AgentProgressTrigger() {
  const open = useAgentProgressPaneStore((s) => s.open)
  const toggle = useAgentProgressPaneStore((s) => s.toggle)

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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

      // Ctrl+Shift+J:切换面板开关
      if (ctrl && shift && key === 'j') {
        e.preventDefault()
        toggle()
        return
      }

      // 面板未打开时,ArrowDown 触发打开
      if (!useAgentProgressPaneStore.getState().open) {
        if (e.key === 'ArrowDown' && !ctrl && !shift && !e.altKey) {
          e.preventDefault()
          toggle()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])

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
      <span aria-hidden="true">▲</span>
    </button>
  )
}

export default AgentProgressTrigger
