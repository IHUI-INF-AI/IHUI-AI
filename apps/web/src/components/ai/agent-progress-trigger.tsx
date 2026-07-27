'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { useAgentProgressPaneStore } from '@/stores/agent-progress-pane'

/**
 * AgentProgressTrigger — Agent 任务进度触发按钮(2026-07-27 v5 内联版)
 *
 * v5 改动(用户规则):
 * - 从右下角 fixed 浮动按钮改为内联文字按钮,放到消息输入框附加栏(权限模式栏前面)
 * - 不再使用 ▲ 图标,改为文字显示:
 *   - 无进度(无 threadId 或无 planSteps):显示 "任务列表"
 *   - 有进度:显示 "01/06" 格式(当前/总数,当前 = in_progress 步骤序号,总数 = planSteps.length)
 * - 点击切换 pane 开关
 * - 快捷键保留:Ctrl+Shift+J 切换 / ArrowDown 打开(未打开时)
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

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={hasProgress ? `任务进度 ${progressCurrent}/${progressTotal}` : '任务列表'}
      title={hasProgress ? `Agent 任务进度 ${progressCurrent}/${progressTotal} (Ctrl+Shift+J)` : 'Agent 任务列表 (Ctrl+Shift+J)'}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors duration-150 ease-out',
        'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        open && 'bg-accent text-accent-foreground',
        hasProgress && 'text-primary',
      )}
      data-testid="agent-progress-trigger"
    >
      <span className="whitespace-nowrap tabular-nums">{display}</span>
    </button>
  )
}

export default AgentProgressTrigger
