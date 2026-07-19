'use client'

import * as React from 'react'
import { Sparkles, Trash2, History, Cpu } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'

interface ChatHeaderProps {
  currentModel: string
  onClear: () => void
  hasMessages: boolean
  isStreaming: boolean
  title: string
  clearLabel: string
  clearConfirm: string
  historyLabel: string
}

export function ChatHeader({
  currentModel,
  onClear,
  hasMessages,
  isStreaming,
  title,
  clearLabel,
  clearConfirm,
  historyLabel,
}: ChatHeaderProps) {
  const t = useTranslations('chat')

  const handleClear = () => {
    if (!hasMessages) return
    if (window.confirm(clearConfirm)) {
      onClear()
    }
  }

  return (
    <header
      className={cn(
        'flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        // 2026-07-19 中文 + 图标垂直对齐:主标题 span 视觉居中
        '[&>div>span:first-child]:translate-y-[var(--text-vcenter-offset)]',
      )}
    >
      {/* 图标容器:与 ai-side-panel.tsx 保持一致,2026-07-19 去掉背景色让内部图标自然显示 */}
      <div className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/80">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="break-words text-sm font-semibold">{title}</span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Cpu className="h-3 w-3" />
          <span className="break-words">{currentModel}</span>
          {isStreaming && (
            <span className="ml-1 inline-flex items-center gap-1 text-primary">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              {t('generating')}
            </span>
          )}
        </span>
      </div>

      <button
        type="button"
        onClick={handleClear}
        disabled={!hasMessages || isStreaming}
        aria-label={clearLabel}
        title={clearLabel}
        className={cn(
          'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          'disabled:cursor-not-allowed disabled:opacity-40',
        )}
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <button
        type="button"
        aria-label={historyLabel}
        title={historyLabel}
        disabled
        className={cn(
          'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          'disabled:cursor-not-allowed disabled:opacity-40',
        )}
      >
        <History className="h-4 w-4" />
      </button>
    </header>
  )
}

export default ChatHeader
