'use client'

import * as React from 'react'
import { ListChecks, ChevronRight, ChevronDown, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { STATUS_BADGE } from './helpers'
import type { Task } from './types'

interface Props {
  tasks: Task[]
  isLoading: boolean
}

export function InstanceTasks({ tasks, isLoading }: Props) {
  const t = useTranslations('workflows')
  return (
    <div className="space-y-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <ListChecks className="h-4 w-4 text-primary" />
        {t('instanceDetail.tasks')}
      </h2>
      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {t('loading')}
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          {t('instanceDetail.noTasks')}
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  )
}

function TaskRow({ task }: { task: Task }) {
  const t = useTranslations('workflows')
  const [open, setOpen] = React.useState(false)
  return (
    <div className="rounded-md border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/30"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0" />
        )}
        <span className="w-8 shrink-0 text-xs text-muted-foreground">#{task.step}</span>
        <span className="min-w-0 flex-1 break-words text-sm font-medium">{task.name}</span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          {task.type}
        </span>
        <span
          className={cn('rounded px-1.5 py-0.5 text-xs font-medium', STATUS_BADGE[task.status])}
        >
          {t(`instanceStatus.${task.status}`)}
        </span>
      </button>
      {open && (
        <div className="grid gap-2 border-t px-4 py-2 text-xs sm:grid-cols-2">
          <div>
            <div className="mb-1 font-medium text-muted-foreground">
              {t('instanceDetail.input')}
            </div>
            <pre className="overflow-auto rounded bg-muted p-2 leading-relaxed">
              {JSON.stringify(task.input ?? null, null, 2)}
            </pre>
          </div>
          <div>
            <div className="mb-1 font-medium text-muted-foreground">
              {t('instanceDetail.output')}
            </div>
            <pre className="overflow-auto rounded bg-muted p-2 leading-relaxed">
              {JSON.stringify(task.output ?? null, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
