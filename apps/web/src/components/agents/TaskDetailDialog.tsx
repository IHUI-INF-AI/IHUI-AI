'use client'

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Loader2, Trash2, ArrowRightCircle } from 'lucide-react'
import { Button, Input, Label, cn } from '@ihui/ui'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui'
import { useToast } from '@/hooks/use-toast'
import { CenteredText } from '@/components/common/CenteredText'
import { transitionKanbanTask, deleteKanbanTask } from '@/lib/agent-kanban-api'
import type { AgentTaskStatus, KanbanTask } from '@ihui/types'
import {
  STATUS_BADGE_CLASS,
  LEGAL_TRANSITIONS,
  getPriorityLevel,
  PRIORITY_DOT_CLASS,
  formatRelativeTime,
  formatDuration,
} from './KanbanTaskCard'

const ALL_STATUSES: AgentTaskStatus[] = [
  'triage',
  'todo',
  'ready',
  'in_progress',
  'blocked',
  'done',
]

export interface TaskDetailDialogProps {
  task: KanbanTask | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onTaskChanged: () => void
}

export function TaskDetailDialog({ task, open, onOpenChange, onTaskChanged }: TaskDetailDialogProps) {
  const t = useTranslations('agents.kanban')
  const tc = useTranslations('common')
  const locale = useLocale()
  const { success, error } = useToast()

  const [transitionTo, setTransitionTo] = React.useState<AgentTaskStatus | ''>('')
  const [reason, setReason] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  const legalTargets = task ? LEGAL_TRANSITIONS[task.status] : []
  const reasonRequired = transitionTo === 'blocked'
  const canConfirm = transitionTo !== '' && (!reasonRequired || reason.trim().length > 0)

  React.useEffect(() => {
    if (open) {
      setTransitionTo('')
      setReason('')
      setSubmitting(false)
      setDeleting(false)
    }
  }, [open, task?.id])

  const handleConfirm = async () => {
    if (!task || transitionTo === '') return
    setSubmitting(true)
    try {
      const result = await transitionKanbanTask(
        task.id,
        transitionTo as AgentTaskStatus,
        reason.trim() || undefined,
      )
      if (result.allowed) {
        success(t('confirm'))
        onTaskChanged()
        onOpenChange(false)
      } else {
        error(result.reason || tc('errorTitle'))
      }
    } catch (e) {
      error(e instanceof Error ? e.message : tc('unknownError'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!task) return
    setDeleting(true)
    try {
      await deleteKanbanTask(task.id)
      success(t('delete'))
      onTaskChanged()
      onOpenChange(false)
    } catch (e) {
      error(e instanceof Error ? e.message : tc('unknownError'))
    } finally {
      setDeleting(false)
    }
  }

  if (!task) return null

  const level = getPriorityLevel(task.priority)
  const hasDuration = task.startedAt && (task.completedAt || task.status === 'in_progress')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className={cn('h-2.5 w-2.5 rounded-full', PRIORITY_DOT_CLASS[level])} aria-hidden />
            <span className="truncate">{task.name}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">{task.id}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {/* 状态 + 优先级 */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                STATUS_BADGE_CLASS[task.status],
              )}
            >
              {t(task.status)}
            </span>
            <span className="text-xs text-muted-foreground">
              {t('priority')}: {t(level)}
            </span>
            <span className="text-xs text-muted-foreground">P{task.priority}</span>
          </div>

          {/* 描述 */}
          {task.description && (
            <div className="rounded-md bg-muted/50 p-2.5 text-xs leading-relaxed text-muted-foreground">
              {task.description}
            </div>
          )}

          {/* 元信息 */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <div>
              <dt className="text-muted-foreground">{t('created')}</dt>
              <dd>{formatRelativeTime(task.createdAt, locale)}</dd>
            </div>
            {task.startedAt && (
              <div>
                <dt className="text-muted-foreground">{t('worker')}</dt>
                <dd className="truncate">{task.workerId || '—'}</dd>
              </div>
            )}
            {hasDuration && task.startedAt && (
              <div>
                <dt className="text-muted-foreground">{t('duration')}</dt>
                <dd>
                  {formatDuration(
                    task.startedAt,
                    task.completedAt || new Date().toISOString(),
                  )}
                </dd>
              </div>
            )}
            {task.dependencies && task.dependencies.length > 0 && (
              <div className="col-span-2">
                <dt className="text-muted-foreground">{t('dependencies')}</dt>
                <dd className="flex flex-wrap gap-1">
                  {task.dependencies.map((dep) => (
                    <span
                      key={dep}
                      className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-mono"
                    >
                      {dep.slice(0, 8)}
                    </span>
                  ))}
                </dd>
              </div>
            )}
            {task.errorMessage && (
              <div className="col-span-2">
                <dt className="text-destructive">Error</dt>
                <dd className="text-destructive/80">{task.errorMessage}</dd>
              </div>
            )}
          </dl>

          {/* 状态流转 */}
          {legalTargets.length > 0 && (
            <div className="space-y-2 rounded-md border border-border p-2.5">
              <Label className="flex items-center gap-1.5 text-xs font-medium">
                <ArrowRightCircle className="h-3.5 w-3.5" />
                <CenteredText>{t('transition')}</CenteredText>
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {ALL_STATUSES.map((status) => {
                  const isLegal = legalTargets.includes(status)
                  const isSelected = transitionTo === status
                  return (
                    <button
                      key={status}
                      type="button"
                      disabled={!isLegal}
                      onClick={() => setTransitionTo(status)}
                      className={cn(
                        'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium transition-colors',
                        isSelected
                          ? STATUS_BADGE_CLASS[status]
                          : isLegal
                            ? 'border border-border bg-background hover:bg-accent'
                            : 'cursor-not-allowed border border-border/50 bg-muted/30 text-muted-foreground/40',
                      )}
                    >
                      {t(status)}
                    </button>
                  )
                })}
              </div>
              {reasonRequired && (
                <div className="space-y-1">
                  <Label htmlFor="transition-reason" className="text-xs">
                    {t('reason')} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="transition-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={t('reasonRequired')}
                    maxLength={500}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="justify-between sm:justify-between">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleting || submitting}
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {t('delete')}
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting || deleting}
            >
              {t('cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm || submitting || deleting}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('confirm')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
