'use client'

/**
 * 发布日历 — 月视图 + 任务颜色编码 + 点击展开 + 拖拽改期 + 快速创建。
 * 纯 SVG/CSS 实现,无图表库依赖。
 *
 * AGENTS.md §4:rounded-md / 无分割线 / 无渐变遮罩
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Button, Card, CardContent, Badge } from '@ihui/ui-react'
import { cn } from '@/lib/utils'

export type TaskStatus = 'scheduled' | 'published' | 'failed' | 'draft'

export interface ScheduledTask {
  readonly id: string
  readonly title: string
  readonly scheduledAt: string
  readonly status: TaskStatus
  readonly platform?: string
}

export interface PublishCalendarProps {
  readonly tasks: ScheduledTask[]
  readonly onReschedule: (taskId: string, newDate: Date) => void
  readonly onCreateTask: (date: Date) => void
}

const STATUS_COLOR: Record<TaskStatus, string> = {
  published: 'bg-emerald-500',
  scheduled: 'bg-blue-500',
  failed: 'bg-rose-500',
  draft: 'bg-muted-foreground',
}

const STATUS_BADGE: Record<TaskStatus, string> = {
  published: 'text-emerald-700 dark:text-emerald-400',
  scheduled: 'text-blue-700 dark:text-blue-400',
  failed: 'text-rose-700 dark:text-rose-400',
  draft: 'text-muted-foreground',
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function groupByDate(tasks: readonly ScheduledTask[]): Map<string, ScheduledTask[]> {
  const m = new Map<string, ScheduledTask[]>()
  for (const t of tasks) {
    const d = toDateString(new Date(t.scheduledAt))
    const arr = m.get(d) ?? []
    arr.push(t)
    m.set(d, arr)
  }
  return m
}

function buildMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const startDay = first.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Date[] = []
  // 上月填充
  for (let i = startDay - 1; i >= 0; i--) {
    cells.push(new Date(year, month, -i))
  }
  // 本月
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d))
  }
  // 补齐到 42 格(6 行)
  while (cells.length < 42) {
    const last = cells[cells.length - 1]
    if (!last) break
    cells.push(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1))
  }
  return cells
}

export function PublishCalendar({ tasks, onReschedule, onCreateTask }: PublishCalendarProps) {
  const t = useTranslations('publish')
  const today = new Date()
  const [cursor, setCursor] = React.useState({ year: today.getFullYear(), month: today.getMonth() })
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null)
  const [draggedId, setDraggedId] = React.useState<string | null>(null)

  const grouped = React.useMemo(() => groupByDate(tasks), [tasks])
  const grid = React.useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor])

  const monthLabel = `${cursor.year} 年 ${cursor.month + 1} 月`
  const todayStr = toDateString(today)

  function prevMonth() {
    setCursor((c) =>
      c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 },
    )
  }
  function nextMonth() {
    setCursor((c) =>
      c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 },
    )
  }

  function handleDrop(date: Date) {
    if (draggedId) {
      onReschedule(draggedId, date)
      setDraggedId(null)
    }
  }

  const selectedTasks = selectedDate ? (grouped.get(selectedDate) ?? []) : []

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={prevMonth}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold">{monthLabel}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={nextMonth}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            {(Object.keys(STATUS_COLOR) as TaskStatus[]).map((s) => (
              <span key={s} className="flex items-center gap-1">
                <span className={cn('h-2 w-2 rounded-sm', STATUS_COLOR[s])} />
                {t(`calendar.${s}` as never)}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-1">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {grid.map((date, i) => {
            const ds = toDateString(date)
            const dayTasks = grouped.get(ds) ?? []
            const isCurrentMonth = date.getMonth() === cursor.month
            const isToday = ds === todayStr
            const isSelected = ds === selectedDate
            return (
              <div
                key={i}
                role="gridcell"
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(date)}
                onClick={() => setSelectedDate(ds)}
                // 2026-08-06 修复:静态 div 带 onClick 需键盘等价(jsx-a11y),
                // Enter/Space 触发日期选择
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelectedDate(ds)
                  }
                }}
                className={cn(
                  'min-h-[64px] cursor-pointer rounded-md border p-1 transition-colors',
                  isCurrentMonth ? 'bg-card' : 'bg-muted/20 text-muted-foreground',
                  isToday && 'border-primary',
                  isSelected && 'ring-1 ring-ring',
                  !isSelected && !isToday && 'border-border/40 hover:border-border',
                )}
              >
                <div className="text-right text-[10px]">{date.getDate()}</div>
                <div className="mt-0.5 space-y-0.5">
                  {dayTasks.slice(0, 3).map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => setDraggedId(task.id)}
                      className={cn(
                        'flex items-center gap-1 truncate rounded-sm bg-muted/40 px-1 py-0.5 text-[9px]',
                        STATUS_BADGE[task.status],
                      )}
                    >
                      <span
                        className={cn('h-1.5 w-1.5 shrink-0 rounded-sm', STATUS_COLOR[task.status])}
                      />
                      <span className="truncate">{task.title}</span>
                    </div>
                  ))}
                  {dayTasks.length > 3 && (
                    <div className="text-[9px] text-muted-foreground">+{dayTasks.length - 3}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {selectedDate && (
          <div className="mt-3 space-y-2 rounded-md border border-border/60 bg-muted/20 p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">
                {selectedDate} · {t('calendar.taskCount', { count: selectedTasks.length })}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={() => onCreateTask(new Date(selectedDate))}
              >
                <Plus className="mr-1 h-3 w-3" />
                {t('calendar.createTask')}
              </Button>
            </div>
            {selectedTasks.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">{t('calendar.noTasks')}</p>
            ) : (
              <div className="space-y-1">
                {selectedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-2 rounded-sm bg-card px-2 py-1 text-xs"
                  >
                    <Badge
                      variant="secondary"
                      className={cn('h-1.5 w-1.5 rounded-sm p-0', STATUS_COLOR[task.status])}
                    />
                    <span className="flex-1 truncate">{task.title}</span>
                    {task.platform && (
                      <span className="text-[10px] text-muted-foreground">{task.platform}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(task.scheduledAt).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <p className="mt-2 text-[10px] text-muted-foreground">{t('calendar.dragHint')}</p>
      </CardContent>
    </Card>
  )
}
