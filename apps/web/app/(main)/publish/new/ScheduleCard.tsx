'use client'

/**
 * 定时发布卡片(从 new/page.tsx 抽出)
 *
 * 立即/定时切换 + datetime-local 输入。
 *
 * AGENTS.md §4:rounded-md(禁 rounded-full)/ 无分割线 / subtle hover
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Clock, Zap } from 'lucide-react'
import { Card, CardContent, Label, Input } from '@ihui/ui-react'
import { cn } from '@/lib/utils'

export type ScheduleMode = 'now' | 'schedule'

export interface ScheduleCardProps {
  readonly scheduleMode: ScheduleMode
  readonly onScheduleModeChange: (v: ScheduleMode) => void
  readonly scheduledAt: string
  readonly onScheduledAtChange: (v: string) => void
}

export function ScheduleCard({
  scheduleMode,
  onScheduleModeChange,
  scheduledAt,
  onScheduledAtChange,
}: ScheduleCardProps) {
  const t = useTranslations('publish')

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <Label>{t('new.schedule')}</Label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onScheduleModeChange('now')}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors',
              scheduleMode === 'now'
                ? 'border-primary bg-primary/5 text-foreground'
                : 'border-border text-muted-foreground hover:bg-accent',
            )}
          >
            <Zap className="h-4 w-4" />
            {t('new.submitNow')}
          </button>
          <button
            type="button"
            onClick={() => onScheduleModeChange('schedule')}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors',
              scheduleMode === 'schedule'
                ? 'border-primary bg-primary/5 text-foreground'
                : 'border-border text-muted-foreground hover:bg-accent',
            )}
          >
            <Clock className="h-4 w-4" />
            {t('new.submitSchedule')}
          </button>
        </div>
        {scheduleMode === 'schedule' && (
          <Input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => onScheduledAtChange(e.target.value)}
          />
        )}
      </CardContent>
    </Card>
  )
}
