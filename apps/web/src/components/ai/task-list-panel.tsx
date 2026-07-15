'use client'

import { User } from 'lucide-react'

import { Checkbox } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface TaskItem {
  id: string
  title: string
  status: 'todo' | 'in-progress' | 'done' | 'blocked'
  assignee?: string
  priority?: 'low' | 'medium' | 'high'
}

interface TaskListPanelProps {
  tasks: TaskItem[]
  onToggle?: (id: string) => void
}

const STATUS_CLS: Record<TaskItem['status'], string> = {
  todo: 'text-muted-foreground',
  'in-progress': 'text-primary',
  done: 'text-emerald-500',
  blocked: 'text-destructive',
}

const PRIORITY_CLS: Record<NonNullable<TaskItem['priority']>, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  high: 'bg-destructive/10 text-destructive',
}

const PRIORITY_LABEL: Record<NonNullable<TaskItem['priority']>, string> = {
  low: '低',
  medium: '中',
  high: '高',
}

export function TaskListPanel({ tasks, onToggle }: TaskListPanelProps) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b px-4 py-2.5">
        <h3 className="text-sm font-semibold">任务清单</h3>
      </div>
      <ul className="divide-y">
        {tasks.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">暂无任务</p>
        ) : (
          tasks.map((task) => {
            const isDone = task.status === 'done'
            return (
              <li key={task.id} className="flex items-center gap-3 px-4 py-2.5">
                <Checkbox
                  checked={isDone}
                  onCheckedChange={() => onToggle?.(task.id)}
                  disabled={task.status === 'blocked'}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'break-words text-sm',
                      isDone && 'text-muted-foreground line-through',
                    )}
                  >
                    {task.title}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs">
                    <span className={cn('font-medium', STATUS_CLS[task.status])}>
                      {task.status}
                    </span>
                    {task.assignee && (
                      <span className="flex items-center gap-0.5 text-muted-foreground">
                        <User className="h-3 w-3" />
                        {task.assignee}
                      </span>
                    )}
                  </div>
                </div>
                {task.priority && (
                  <span
                    className={cn(
                      'shrink-0 rounded px-1.5 py-0.5 text-xs font-medium',
                      PRIORITY_CLS[task.priority],
                    )}
                  >
                    {PRIORITY_LABEL[task.priority]}
                  </span>
                )}
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}

export default TaskListPanel
