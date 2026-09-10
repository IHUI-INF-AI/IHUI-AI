// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import * as React from 'react'
import { X, Play, Trash2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import type { TerminalRecordingListItem } from '@ihui/types'
import { useTranslations } from 'next-intl'
import { formatRecordingDuration, formatRecordingStartedAt } from './model'

interface RecordingDrawerProps {
  recordings: TerminalRecordingListItem[]
  /** 打开抽屉时触发(拉取最新列表) */
  onRefresh: () => void
  /** 回放录制(POST /recordings/:id/play) */
  onPlay: (recordingId: string) => void
  /** 删除录制(DELETE /recordings/:id) */
  onDelete: (recordingId: string) => void
}

/**
 * 录制列表抽屉 — 触发按钮 + 计数徽章 + 列表(回放/删除操作)。
 * 打开态自持;打开时调用 onRefresh 拉取最新列表,外部点击自动关闭。
 */
export function RecordingDrawer({ recordings, onRefresh, onPlay, onDelete }: RecordingDrawerProps) {
  const t = useTranslations('ide')
  const [open, setOpen] = React.useState(false)
  const drawerRef = React.useRef<HTMLDivElement>(null)

  // 外部点击关闭抽屉
  React.useEffect(() => {
    if (!open) return
    const handle = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  // 打开时拉取最新列表
  React.useEffect(() => {
    if (open) onRefresh()
  }, [open, onRefresh])

  return (
    <div className="relative flex items-center" ref={drawerRef}>
      <Tooltip content={t('terminalTabBar.recordingList')}>
        <button
          type="button"
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors',
            'hover:bg-background hover:text-foreground',
            open && 'bg-background text-foreground',
          )}
          onClick={() => setOpen((v) => !v)}
          aria-label={t('terminalTabBar.recordingList')}
        >
          <Clock className="h-3 w-3" />
        </button>
      </Tooltip>
      {recordings.length > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-3 min-w-3 items-center justify-center rounded bg-accent px-0.5 text-[9px] font-medium text-accent-foreground">
          {recordings.length > 99 ? '99+' : recordings.length}
        </span>
      )}
      {open && (
        <div className="absolute right-0 top-7 z-50 w-80 overflow-hidden rounded-md border border-border bg-popover shadow-md">
          <div className="flex items-center justify-between bg-muted/40 px-2.5 py-1.5">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {t('terminalTabBar.recordingListWithCount', { count: recordings.length })}
            </span>
            <button
              type="button"
              className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              onClick={() => setOpen(false)}
              aria-label={t('terminalPanel.close')}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {recordings.length === 0 ? (
              <div className="px-2.5 py-4 text-center text-xs text-muted-foreground">
                {t('terminalTabBar.noRecordingsHint')}
              </div>
            ) : (
              recordings.map((rec) => (
                <div
                  key={rec.id}
                  className="group flex items-center gap-2 px-2.5 py-1.5 text-xs transition-colors hover:bg-accent"
                >
                  <Play className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-foreground">
                      {rec.title ||
                        t('terminalTabBar.defaultRecTitle', {
                          time: formatRecordingStartedAt(rec.startedAt),
                        })}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{formatRecordingStartedAt(rec.startedAt)}</span>
                      <span>{formatRecordingDuration(rec.durationMs)}</span>
                      <span>{t('terminalTabBar.eventCount', { count: rec.eventCount })}</span>
                    </div>
                  </div>
                  <Tooltip content={t('terminalTabBar.play')}>
                    <button
                      type="button"
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation()
                        onPlay(rec.id)
                        setOpen(false)
                      }}
                      aria-label={t('terminalTabBar.play')}
                    >
                      <Play className="h-3 w-3" />
                    </button>
                  </Tooltip>
                  <Tooltip content={t('terminalTabBar.delete')}>
                    <button
                      type="button"
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/15 hover:text-destructive group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(rec.id)
                      }}
                      aria-label={t('terminalTabBar.delete')}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Tooltip>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
