'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { CenteredText } from '@/components/common/CenteredText'
import type { KanbanColumn as KanbanColumnData, KanbanTask } from '@ihui/types'
import { KanbanTaskCard, KanbanTaskCardEmpty, STATUS_BADGE_CLASS } from './KanbanTaskCard'

export interface KanbanColumnProps {
  column: KanbanColumnData
  onSelectTask: (task: KanbanTask) => void
}

export function KanbanColumn({ column, onSelectTask }: KanbanColumnProps) {
  const t = useTranslations('agents.kanban')

  const sortedTasks = React.useMemo(
    () => [...column.tasks].sort((a, b) => b.priority - a.priority),
    [column.tasks],
  )

  return (
    <div className="flex min-w-[280px] flex-col rounded-lg border border-border bg-card/50">
      {/* 列头 */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex h-2 w-2 rounded-full',
              STATUS_BADGE_CLASS[column.status].split(' ')[0],
            )}
            aria-hidden
          />
          <span className="text-sm font-medium">
            <CenteredText>{t(column.status)}</CenteredText>
          </span>
        </div>
        <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-md bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
          {sortedTasks.length}
        </span>
      </div>

      {/* 任务列表 */}
      <div className="flex flex-col gap-2 px-2 pb-3">
        {sortedTasks.length === 0 ? (
          <KanbanTaskCardEmpty />
        ) : (
          sortedTasks.map((task) => (
            <KanbanTaskCard key={task.id} task={task} onSelect={onSelectTask} />
          ))
        )}
      </div>
    </div>
  )
}
