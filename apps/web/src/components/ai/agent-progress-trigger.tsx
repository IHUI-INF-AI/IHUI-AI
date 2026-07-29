'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import {
  useAgentProgressPaneStore,
  hydrateAgentProgressPaneFromStorage,
} from '@/stores/agent-progress-pane'
import { useChatStore } from '@/stores/chat'
import { ConnectionStatusDot, deriveConnectionState } from './progress-sections/connection-status'

/**
 * AgentProgressTrigger — Agent 任务进度触发按钮(2026-07-28 v8 零窜位版)
 *
 * v8 改动(用户规则:弹窗可以覆盖内容 悬浮态,不能上下窜位):
 * - trigger 永远渲染,不再因 popover open 切换 return null。
 *   原 v6 联动(return null)会导致 message-input 上方 trigger wrapper 突然消失,
 *   周围 inline 流回流 → "开始新的任务" 内容上下窜位。
 * - popover 改用 fixed 浮层覆盖在 trigger 上方(由 store.open 联动显隐),
 *   trigger 在 popover 打开时用 invisible 占位(opacity-0 + pointer-events-none),
 *   inline 流位置完全不变 → 周围内容零窜位。
 * - v7 保留:ConnectionStatusDot 显示 SSE 连接状态。
 *
 * v5/v6 保留:
 * - 文字显示:无进度 = "任务列表";有进度 = "01/06"
 * - 快捷键:Ctrl+Shift+J 切换 / ArrowDown 打开(未打开时)
 * - 容器背景色 + 描边(bg-card + border-border),
 *   light mode 白底浅灰描边,dark mode 黑底深灰描边,subtle hover 颜色变化。
 *
 * 数据来源:从 useAgentProgressPaneStore 读取 progressCurrent/progressTotal
 * (由 AgentTaskProgressPane 组件同步,避免 trigger 启动第二个 SSE 流)
 */
export function AgentProgressTrigger() {
  const open = useAgentProgressPaneStore((s) => s.open)
  const toggle = useAgentProgressPaneStore((s) => s.toggle)
  const progressCurrent = useAgentProgressPaneStore((s) => s.progressCurrent)
  const progressTotal = useAgentProgressPaneStore((s) => s.progressTotal)

  // Phase 16: 从 useChatStore 获取 conversationId 用于推导连接状态
  const conversationId = useChatStore((s) => s.conversationId)

  // Phase 16: 推导连接状态(未打开 popover 时显示基础状态)
  // 注:trigger 不直接启动 SSE,这里仅做静态状态指示
  const connectionState = React.useMemo(
    () => deriveConnectionState(false, 0, false, conversationId),
    [conversationId],
  )

  // Phase 24(2026-07-29):客户端 mount 后同步 localStorage 中的 open/pinned,
  // 避免 SSR 用默认值 false/true,CSR 却是 true 触发 hydration 错误
  // (即使 AgentTaskProgressPane 没渲染,trigger 也需要 hydrate 才能正确显示 expanded 状态)
  React.useEffect(() => {
    hydrateAgentProgressPaneFromStorage()
  }, [])

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

  // v8 零窜位:trigger 永远渲染,popover 用 fixed 浮层覆盖在上方
  // open=true 时用 invisible 占位(opacity-0 + pointer-events-none,占位但视觉隐藏),
  // inline 流位置完全不变 → 周围内容零回流零窜位
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={hasProgress ? `任务进度 ${progressCurrent}/${progressTotal}` : '任务列表'}
      aria-expanded={open}
      title={
        hasProgress
          ? `Agent 任务进度 ${progressCurrent}/${progressTotal} (Ctrl+Shift+J)`
          : 'Agent 任务列表 (Ctrl+Shift+J)'
      }
      className={cn(
        // 尺寸 + 圆角(h-7=28px 配 rounded-md=6px,符合 user_profile 圆角与元素大小成比例)
        'inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors duration-150 ease-out',
        // 容器背景色 + 描边(用户规则:light mode 白底浅灰描边,dark mode 黑底深灰描边,无其他颜色)
        'border border-border bg-card text-foreground/80',
        // hover subtle 颜色变化(无蓝色发光边框)
        'hover:bg-accent hover:text-accent-foreground',
        // 有进度时文字用 primary 色突出
        hasProgress && 'text-primary',
        // v8:open=true 时 invisible 占位(opacity-0 + 不可点击) → inline 流位置不变
        open && 'invisible pointer-events-none',
      )}
      data-testid="agent-progress-trigger"
    >
      {/* Phase 16: 连接状态点 */}
      <ConnectionStatusDot state={connectionState} />
      <span className="whitespace-nowrap tabular-nums">{display}</span>
    </button>
  )
}

export default AgentProgressTrigger
