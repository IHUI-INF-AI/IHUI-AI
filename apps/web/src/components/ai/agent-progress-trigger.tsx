'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { useAgentProgressPaneStore } from '@/stores/agent-progress-pane'

/**
 * AgentProgressTrigger — Agent 任务进度触发按钮(2026-07-27 v6 联动版)
 *
 * v6 改动(用户规则):
 * - 与 popover 联动:popover 显示时(open=true)trigger 隐藏,把空间让给 popover;
 *   popover 隐藏时(open=false)trigger 显示,作为再次打开的入口。
 *   点击 popover 右上角"最小化"按钮 → toggle → open=false → trigger 显示。
 *   点击 trigger → toggle → open=true → trigger 隐藏 + popover 显示。
 * - button 容器加背景色 + 描边(bg-card + border-border),
 *   light mode 白底浅灰描边,dark mode 黑底深灰描边,subtle hover 颜色变化。
 *
 * v5 保留:
 * - 文字显示:无进度 = "任务列表";有进度 = "01/06"
 * - 快捷键:Ctrl+Shift+J 切换 / ArrowDown 打开(未打开时)
 *
 * 数据来源:从 useAgentProgressPaneStore 读取 progressCurrent/progressTotal
 * (由 AgentTaskProgressPane 组件同步,避免 trigger 启动第二个 SSE 流)
 */
export function AgentProgressTrigger() {
  const open = useAgentProgressPaneStore((s) => s.open)
  const toggle = useAgentProgressPaneStore((s) => s.toggle)
  const progressCurrent = useAgentProgressPaneStore((s) => s.progressCurrent)
  const progressTotal = useAgentProgressPaneStore((s) => s.progressTotal)

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

  // 显示逻辑:有进度显示 "01/06",无进度显示 "任务列表"
  const hasProgress = progressTotal > 0
  const display = hasProgress
    ? `${String(progressCurrent).padStart(2, '0')}/${String(progressTotal).padStart(2, '0')}`
    : '任务列表'

  // 联动:popover 显示时(open=true)trigger 隐藏,把空间让给 popover;
  // popover 隐藏时(open=false)trigger 显示,作为再次打开的入口。
  if (open) return null

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={hasProgress ? `任务进度 ${progressCurrent}/${progressTotal}` : '任务列表'}
      title={hasProgress ? `Agent 任务进度 ${progressCurrent}/${progressTotal} (Ctrl+Shift+J)` : 'Agent 任务列表 (Ctrl+Shift+J)'}
      className={cn(
        // 尺寸 + 圆角(h-7=28px 配 rounded-md=6px,符合 user_profile 圆角与元素大小成比例)
        'inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors duration-150 ease-out',
        // 容器背景色 + 描边(用户规则:light mode 白底浅灰描边,dark mode 黑底深灰描边,无其他颜色)
        'border border-border bg-card text-foreground/80',
        // hover subtle 颜色变化(无蓝色发光边框)
        'hover:bg-accent hover:text-accent-foreground',
        // 有进度时文字用 primary 色突出
        hasProgress && 'text-primary',
      )}
      data-testid="agent-progress-trigger"
    >
      <span className="whitespace-nowrap tabular-nums">{display}</span>
    </button>
  )
}

export default AgentProgressTrigger
