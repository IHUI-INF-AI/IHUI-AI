// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import * as React from 'react'
import { X, Terminal as TerminalIcon, Server } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import type { TerminalSession } from '@ihui/types'
import { useTranslations } from 'next-intl'
import { getTerminalSessionSubtitle, getTerminalTabLabel } from './model'

interface TerminalTabProps {
  session: TerminalSession
  index: number
  isActive: boolean
  isRecording: boolean
  renaming: boolean
  renameValue: string
  onRenameValueChange: (value: string) => void
  onConfirmRename: () => void
  onCancelRename: () => void
  onStartRename: () => void
  onSelect: (id: string) => void
  onClose: (id: string) => void
}

/**
 * 单个终端 tab — 激活态切换 + 双击 rename + 录制红点 + 关闭按钮。
 * 样式约束(AGENTS.md §4):gap-* 间距分隔、禁止 rounded-full、
 * active 用 subtle 颜色变化(text-foreground vs text-muted-foreground)。
 */
export function TerminalTab({
  session,
  index,
  isActive,
  isRecording,
  renaming,
  renameValue,
  onRenameValueChange,
  onConfirmRename,
  onCancelRename,
  onStartRename,
  onSelect,
  onClose,
}: TerminalTabProps) {
  const t = useTranslations('ide')
  const renameInputRef = React.useRef<HTMLInputElement>(null)

  // 进入 rename 态时聚焦 + 全选
  React.useEffect(() => {
    if (renaming && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renaming])

  const label = getTerminalTabLabel(session, index)
  const subtitle = getTerminalSessionSubtitle(session)

  return (
    <div
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
      {session.kind === 'ssh' ? (
        <Server className="h-3 w-3 shrink-0 opacity-60" />
      ) : (
        <TerminalIcon className="h-3 w-3 shrink-0 opacity-60" />
      )}
      {/* 录制中:红色圆点闪烁(纯装饰点,豁免 rounded-full,用 Tailwind animate-pulse) */}
      {isRecording && (
        <Tooltip content={t('terminalTabBar.recording')}>
          <span
            className="inline-block h-1.5 w-1.5 shrink-0 animate-pulse bg-red-500"
            style={{ borderRadius: '50%' }}
            aria-label={t('terminalTabBar.recording')}
          />
        </Tooltip>
      )}
      {renaming ? (
        <input
          ref={renameInputRef}
          type="text"
          value={renameValue}
          onChange={(e) => onRenameValueChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') {
              e.preventDefault()
              onConfirmRename()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              onCancelRename()
            }
          }}
          onBlur={() => onConfirmRename()}
          className="w-24 rounded border border-border bg-background px-1 py-0 text-xs outline-none focus:border-ring/50"
          maxLength={32}
          aria-label={t('terminalTabBar.renameAria')}
        />
      ) : (
        <Tooltip content={t('terminalTabBar.renameHint')}>
          <span
            className="max-w-32 truncate"
            onDoubleClick={(e) => {
              e.stopPropagation()
              onStartRename()
            }}
          >
            {label}
          </span>
        </Tooltip>
      )}
      <span className="max-w-24 truncate text-[10px] opacity-50">{subtitle}</span>
      {session.status === 'exited' && (
        <span className="text-[10px] text-muted-foreground/60">{t('terminalTabBar.exited')}</span>
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
        aria-label={t('terminalTabBar.closeTerminalAria')}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
