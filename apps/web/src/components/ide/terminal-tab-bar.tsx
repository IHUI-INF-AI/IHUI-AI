'use client'

import * as React from 'react'
import { Plus, X, Terminal as TerminalIcon, ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TerminalSession } from '@ihui/types'

/** 可选 shell 列表(Windows 优先) */
const SHELL_OPTIONS = [
  { value: 'powershell', label: 'PowerShell' },
  { value: 'cmd', label: 'CMD' },
  { value: 'bash', label: 'Bash' },
  { value: 'wsl', label: 'WSL' },
] as const

interface TerminalTabBarProps {
  sessions: TerminalSession[]
  activeSessionId: string | null
  loading: boolean
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onNew: (shell?: string) => void
  onRename: (id: string, name: string) => Promise<boolean> | void
}

/**
 * 终端 tab bar — 多 session 切换 + 新建(带 shell 选择) + 关闭 + 双击 rename。
 *
 * 样式约束(AGENTS.md §4):
 * - border-b border-border 分隔(非 divide-x)
 * - gap-* 间距分隔
 * - 禁止 rounded-full / 蓝色发光边框
 * - active tab 用 subtle 颜色变化(text-foreground vs text-muted-foreground)
 * - 中文字体图标垂直对齐自动应用 --text-vcenter-offset(由 globals.css 全局规则生效)
 */
export function TerminalTabBar({
  sessions,
  activeSessionId,
  loading,
  onSelect,
  onClose,
  onNew,
  onRename,
}: TerminalTabBarProps) {
  // shell 选择下拉
  const [selectedShell, setSelectedShell] = React.useState<string>('powershell')
  const [shellMenuOpen, setShellMenuOpen] = React.useState(false)
  const shellMenuRef = React.useRef<HTMLDivElement>(null)

  // rename 状态
  const [renamingId, setRenamingId] = React.useState<string | null>(null)
  const [renameValue, setRenameValue] = React.useState('')
  const renameInputRef = React.useRef<HTMLInputElement>(null)

  // 外部点击关闭 shell 菜单
  React.useEffect(() => {
    if (!shellMenuOpen) return
    const handle = (e: MouseEvent) => {
      if (shellMenuRef.current && !shellMenuRef.current.contains(e.target as Node)) {
        setShellMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [shellMenuOpen])

  // rename 输入框聚焦
  React.useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingId])

  const handleStartRename = (session: TerminalSession, fallbackLabel: string) => {
    setRenamingId(session.id)
    setRenameValue(session.name ?? fallbackLabel)
  }

  const handleConfirmRename = async () => {
    const id = renamingId
    if (!id) return
    const trimmed = renameValue.trim()
    if (trimmed) {
      await onRename(id, trimmed)
    }
    setRenamingId(null)
    setRenameValue('')
  }

  const handleCancelRename = () => {
    setRenamingId(null)
    setRenameValue('')
  }

  const handleNewWithShell = () => {
    onNew(selectedShell)
    setShellMenuOpen(false)
  }

  return (
    <div className="flex items-center gap-1 border-b border-border bg-muted/30 px-2 py-1">
      {sessions.map((session, index) => {
        const isActive = session.id === activeSessionId
        const fallbackLabel = `Terminal ${index + 1}`
        const label = session.name ?? fallbackLabel
        const cwdShort = session.cwd.split(/[\\/]/).pop() || session.cwd
        const isRenaming = renamingId === session.id

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
            {isRenaming ? (
              <input
                ref={renameInputRef}
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void handleConfirmRename()
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    handleCancelRename()
                  }
                }}
                onBlur={() => void handleConfirmRename()}
                className="w-24 rounded border border-border bg-background px-1 py-0 text-xs outline-none focus:border-ring/50"
                maxLength={32}
                aria-label="重命名终端"
              />
            ) : (
              <span
                className="max-w-32 truncate"
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  handleStartRename(session, fallbackLabel)
                }}
                title="双击重命名"
              >
                {label}
              </span>
            )}
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

      {/* 新建按钮 + shell 下拉 */}
      <div className="relative flex items-center" ref={shellMenuRef}>
        <button
          type="button"
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors',
            'hover:bg-background hover:text-foreground',
            loading && 'pointer-events-none opacity-40',
          )}
          onClick={handleNewWithShell}
          disabled={loading}
          aria-label="新建终端"
          title={`新建终端 (${SHELL_OPTIONS.find((s) => s.value === selectedShell)?.label ?? 'PowerShell'})`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className={cn(
            'flex h-6 w-4 items-center justify-center rounded-md text-muted-foreground transition-colors',
            'hover:bg-background hover:text-foreground',
            loading && 'pointer-events-none opacity-40',
          )}
          onClick={() => setShellMenuOpen((v) => !v)}
          disabled={loading}
          aria-label="选择 Shell 类型"
          title="选择 Shell"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
        {shellMenuOpen && (
          <div className="absolute left-0 top-7 z-50 min-w-32 overflow-hidden rounded-md border border-border bg-popover shadow-md">
            <div className="bg-muted/40 px-2.5 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              Shell 类型
            </div>
            <div className="py-0.5">
              {SHELL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={cn(
                    'flex w-full items-center justify-between gap-2 px-2.5 py-1 text-left text-xs transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    selectedShell === opt.value && 'text-foreground',
                  )}
                  onClick={() => {
                    setSelectedShell(opt.value)
                    setShellMenuOpen(false)
                  }}
                >
                  <span>{opt.label}</span>
                  {selectedShell === opt.value && <Check className="h-3 w-3 opacity-70" />}
                </button>
              ))}
            </div>
            <div className="bg-muted/40 py-0.5">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-2.5 py-1 text-left text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                onClick={handleNewWithShell}
              >
                <Plus className="h-3 w-3" />
                <span>新建会话</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {loading && (
        <span className="ml-1 text-[10px] text-muted-foreground/60">创建中...</span>
      )}
    </div>
  )
}
