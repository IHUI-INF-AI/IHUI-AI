'use client'

import * as React from 'react'
import { Plus, Terminal as TerminalIcon, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TerminalSession, TerminalSessionStatus } from '@ihui/types'

interface TerminalSessionListProps {
  sessions: TerminalSession[]
  activeSessionId: string | null
  loading: boolean
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onNew: () => void
}

/** 格式化时间戳为 HH:MM */
function formatTime(ts: number): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(ts)
  } catch {
    return '--:--'
  }
}

/** 状态徽章颜色映射(draft 灰 / published 绿 → active 绿 / exited 灰 / closed 红) */
function statusBadgeClass(status: TerminalSessionStatus): string {
  switch (status) {
    case 'active':
      return 'bg-green-500/15 text-green-600 dark:text-green-400'
    case 'exited':
      return 'bg-muted text-muted-foreground'
    case 'closed':
      return 'bg-destructive/15 text-destructive'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

function statusLabel(status: TerminalSessionStatus): string {
  switch (status) {
    case 'active':
      return '运行中'
    case 'exited':
      return '已退出'
    case 'closed':
      return '已关闭'
    default:
      return status
  }
}

/**
 * 终端会话列表侧边栏 — 显示 cwd / createdAt / 状态。
 *
 * 样式约束(AGENTS.md §4):
 * - 容器完整描边 border border-border(非单边分割线)
 * - 间距分隔 gap-*(非 divide-y)
 * - 禁止 rounded-full / 蓝色发光边框
 */
export function TerminalSessionList({
  sessions,
  activeSessionId,
  loading,
  onSelect,
  onClose,
  onNew,
}: TerminalSessionListProps) {
  return (
    <div className="flex h-full w-full flex-col gap-2 overflow-hidden border border-border bg-card p-2">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-medium text-foreground">终端会话</span>
        <button
          type="button"
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors',
            'hover:bg-background hover:text-foreground',
            loading && 'pointer-events-none opacity-40',
          )}
          onClick={onNew}
          disabled={loading}
          aria-label="新建终端"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 会话列表 */}
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-3 py-4 text-xs text-muted-foreground">
            {loading ? '加载中...' : '暂无终端会话'}
          </div>
        ) : (
          sessions.map((session, index) => {
            const isActive = session.id === activeSessionId
            const cwdShort = session.cwd.split(/[\\/]/).pop() || session.cwd

            return (
              <div
                key={session.id}
                className={cn(
                  'group cursor-pointer rounded-md border px-2 py-1.5 transition-colors',
                  isActive
                    ? 'border-border bg-background'
                    : 'border-transparent hover:bg-background/60',
                )}
                onClick={() => onSelect(session.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(session.id)
                  }
                }}
              >
                <div className="flex items-center gap-1.5">
                  <TerminalIcon className="h-3 w-3 shrink-0 opacity-50" />
                  <span className="truncate text-xs font-medium">Terminal {index + 1}</span>
                  <span
                    className={cn(
                      'ml-auto rounded px-1 py-0.5 text-[10px] leading-none',
                      statusBadgeClass(session.status),
                    )}
                  >
                    {statusLabel(session.status)}
                  </span>
                </div>
                <div className="mt-1 truncate text-[10px] text-muted-foreground">
                  {cwdShort}
                </div>
                <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground/60">
                  <span>{formatTime(session.createdAt)}</span>
                  {session.exitCode !== undefined && (
                    <span>exit: {session.exitCode}</span>
                  )}
                  {session.status === 'active' && (
                    <button
                      type="button"
                      className={cn(
                        'flex h-4 w-4 items-center justify-center rounded opacity-0 transition-opacity',
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
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
