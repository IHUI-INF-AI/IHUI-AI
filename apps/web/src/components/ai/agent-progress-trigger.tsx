'use client'

import * as React from 'react'
import { Activity, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgentProgressDrawerStore } from '@/stores/agent-progress-drawer'

/**
 * AgentProgressTrigger — Agent 任务进度 Drawer 的浮动触发按钮(2026-07-27 立)
 *
 * 设计:
 * - 固定在右下角(z-sticky 层级,避开 modal/PWA 提示层 z-modal)
 * - 支持点击切换 Drawer 开关
 * - 支持 Ctrl+Shift+J 全局快捷键(与 Chrome DevTools 风格一致)
 * - 已打开时按钮图标变为 X,提示再次点击关闭
 *
 * 位置策略:
 * - bottom-4 right-4(与 PWA 提示同区域,但偏移避开)
 * - 实际放 bottom-16 避开 PWA 提示(bottom-4)
 */
export function AgentProgressTrigger() {
  const open = useAgentProgressDrawerStore((s) => s.open)
  const toggle = useAgentProgressDrawerStore((s) => s.toggle)

  // Ctrl+Shift+J 全局快捷键
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
      if (ctrl && shift && key === 'j') {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={open ? '关闭 Agent 任务进度' : '打开 Agent 任务进度'}
      title={open ? '关闭 (Ctrl+Shift+J)' : 'Agent 任务进度 (Ctrl+Shift+J)'}
      className={cn(
        'pointer-events-auto fixed bottom-16 right-4 z-sticky',
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
