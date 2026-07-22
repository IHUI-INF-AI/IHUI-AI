'use client'

import * as React from 'react'
import { Plus, X, Terminal as TerminalIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TerminalSession } from '@ihui/types'

interface TerminalTabBarProps {
  sessions: TerminalSession[]
  activeSessionId: string | null
  loading: boolean
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onNew: () => void
}

/**
 * 终端 tab bar — 多 session 切换 + 新建 + 关闭。
 *
 * 样式约束(AGENTS.md §4):
 * - border-b border-border 分隔(非 divide-x)
 * - gap-* 间距分隔
 * - 禁止 rounded-full / 蓝色发光边框
 * - active tab 用 subtle 颜色变化(text-foreground vs text-muted-foreground)
 */
export function TerminalTabBar({
  sessions,
  activeSessionId,
  loading,
  onSelect,
  onClose,
  onNew,
}: TerminalTabBarProps) {
  return (
    <div className="flex items-center gap-1 border-b border-border bg-muted/30 px-2 py-1">
      {sessions.map((session, index) => {
        const isActive = session.id === activeSessionId
        const label = `Terminal ${index + 1}`
        const cwdShort = session.cwd.split(/[\\/]/).pop() || session.cwd

        return (
          <div
            key={session.id}
            className={cn(
              'group flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
            )}
            onClick={() => onSelect(session.id)}
            role="tab"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect(session.id)
              }
            }}
          >
            <TerminalIcon className="h-3 w-3 shrink-0 opacity-60" />
            <span className="max-w-32 truncate">{label}</span>
            <span className="max-w-24 truncate text-[10px] opacity-50">{cwdShort}</span>
            {session.status === 'exited' && (
              <span className="text-[10px] text-muted-foreground/60">(已退出)</span>
            )}
            <button
              type="button"
              className={cn(
                'ml-0.5 flex h-4 w-4 items-center justify-center rounded opacity-0 transition-opacity',
                'hover:bg-destructive/15 hover:text-destructive',
                'group-hover:opacity-60',
              )}
              onClick={(e) => {
                e.stopPropagation()
                onClose(session.id)
              }}
              aria-label="关闭终端"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )
      })}

      {/* 新建按钮 */}
      <button
        type="button"
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors',
          'hover:bg-background hover:text-foreground',
          loading && 'pointer-events-none opacity-40',
        )}
        onClick={onNew}
        disabled={loading}
        aria-label="新建终端"
        title="新建终端"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>

      {loading && (
        <span className="ml-1 text-[10px] text-muted-foreground/60">创建中...</span>
      )}
    </div>
  )
}
