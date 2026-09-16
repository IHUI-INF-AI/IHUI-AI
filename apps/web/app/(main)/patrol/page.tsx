// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 主动巡逻 Agent 页面(2026-09-17 立,P3 #40,/patrol)。
 * 列表(名称/类型/计划/状态徽章/上次巡检结论) + 操作(立即巡检/暂停恢复/历史/编辑/删除)
 * + 新建弹窗。发现问题(issue)可一键深链打开告警会话授权执行修复。
 * API 全部走 @ihui/api-client patrol 端点。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import {
  History,
  Loader2,
  MessageSquare,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  Zap,
} from 'lucide-react'
import { Button, Badge } from '@ihui/ui-react'
import {
  listPatrolTasks,
  updatePatrolTask,
  deletePatrolTask,
  runPatrolTaskNow,
  type PatrolTask,
  type PatrolType,
} from '@ihui/api-client'
import { ConfirmDialog, Tooltip } from '@/components/feedback'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { rruleToParts, type RruleFrequency } from '@/lib/rrule-form'
import { PatrolFormDialog } from '@/components/patrol/patrol-form-dialog'
import { PatrolRunsDialog } from '@/components/patrol/patrol-runs-dialog'

/** 巡检类型 → i18n 键(静态映射) */
const TYPE_LABEL_KEYS: Record<
  PatrolType,
  'typeCi' | 'typeDependency' | 'typeLog' | 'typeDeadlink' | 'typeWorkspace' | 'typeCustom'
> = {
  ci: 'typeCi',
  dependency: 'typeDependency',
  log: 'typeLog',
  deadlink: 'typeDeadlink',
  workspace: 'typeWorkspace',
  custom: 'typeCustom',
}

/** 判定状态 → i18n 键(静态映射) */
const RESULT_KEYS = {
  ok: 'resultOk',
  issue: 'resultIssue',
  error: 'resultError',
} as const

const RESULT_BADGE_CLASS: Record<string, string> = {
  ok: 'border-transparent bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15',
  issue: 'border-transparent bg-amber-500/15 text-amber-600 hover:bg-amber-500/15',
  error: 'border-transparent bg-destructive/15 text-destructive hover:bg-destructive/15',
}

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

export default function PatrolPage() {
  const t = useTranslations('patrol')
  const toast = useToast()

  const [items, setItems] = React.useState<PatrolTask[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [runningId, setRunningId] = React.useState<string | null>(null)
  const [deleting, setDeleting] = React.useState<PatrolTask | null>(null)
  const [deletePending, setDeletePending] = React.useState(false)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<PatrolTask | null>(null)
  const [historyTask, setHistoryTask] = React.useState<PatrolTask | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await listPatrolTasks({ limit: 100 })
      setItems(res.items)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : t('toast.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  React.useEffect(() => {
    void load()
  }, [load])

  const handleRunNow = async (task: PatrolTask) => {
    setRunningId(task.id)
    try {
      const res = await runPatrolTaskNow(task.id)
      if (res.status === 'issue' && res.conversationId) {
        toast.success(t('toast.runDone'), t('toast.runIssueFound'))
      } else {
        toast.success(t('toast.runDone'), res.summary.slice(0, 120))
      }
      await load()
    } catch (err) {
      toast.error(t('toast.runFailed'), err instanceof Error ? err.message : undefined)
    } finally {
      setRunningId(null)
    }
  }

  const handleToggleStatus = async (task: PatrolTask) => {
    const next = task.status === 'active' ? 'paused' : 'active'
    try {
      await updatePatrolTask(task.id, { status: next })
      toast.success(next === 'active' ? t('toast.resumed') : t('toast.paused'))
      await load()
    } catch (err) {
      toast.error(t('toast.updateFailed'), err instanceof Error ? err.message : undefined)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeletePending(true)
    try {
      await deletePatrolTask(deleting.id)
      toast.success(t('toast.deleted'))
      setDeleting(null)
      await load()
    } catch (err) {
      toast.error(t('toast.deleteFailed'), err instanceof Error ? err.message : undefined)
    } finally {
      setDeletePending(false)
    }
  }

  /** 计划描述:按 rrule 频率描述(与 automations 同语义) */
  const describeSchedule = (task: PatrolTask): string => {
    const parts = rruleToParts(task.rrule)
    if (!parts) return task.rrule
    const freqLabel: Record<RruleFrequency, string> = {
      hourly: t('form.freqHourly'),
      daily: `${t('form.freqDaily')} ${parts.time}`,
      weekly: `${t('form.freqWeekly')} ${parts.time}`,
    }
    return freqLabel[parts.frequency]
  }

  return (
    <div className="px-4 py-4 mx-auto w-full max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            {t('refresh')}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
          >
            <Plus className="h-4 w-4" />
            {t('create')}
          </Button>
        </div>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('loading')}
        </div>
      ) : loadError ? (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-md bg-muted/40 px-4 py-16 text-center text-sm text-muted-foreground">
          {t('empty')}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((task) => (
            <div
              key={task.id}
              className="rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/30"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">{task.name}</span>
                    <Badge className="border-transparent bg-primary/10 text-primary hover:bg-primary/10">
                      {t(TYPE_LABEL_KEYS[task.patrolType])}
                    </Badge>
                    {task.status === 'active' ? (
                      <Badge className="border-transparent bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15">
                        {t('statusActive')}
                      </Badge>
                    ) : (
                      <Badge className="border-transparent bg-muted text-muted-foreground hover:bg-muted">
                        {t('statusPaused')}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{describeSchedule(task)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t('nextRunAt')}: {formatDateTime(task.nextRunAt)}
                  </div>
                  {task.lastResult && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        className={
                          RESULT_BADGE_CLASS[task.lastResult.status] ?? RESULT_BADGE_CLASS.ok
                        }
                      >
                        {t(RESULT_KEYS[task.lastResult.status] ?? 'resultOk')}
                      </Badge>
                      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                        {task.lastResult.summary}
                      </span>
                      {task.lastResult.conversationId && (
                        <Button variant="outline" size="xs" asChild>
                          <Link href={`/chat?conversationId=${task.lastResult.conversationId}`}>
                            <MessageSquare className="h-3.5 w-3.5" />
                            {t('action.openConversation')}
                          </Link>
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Tooltip content={t('action.runNow')}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleRunNow(task)}
                      disabled={runningId === task.id}
                    >
                      {runningId === task.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4" />
                      )}
                      {t('action.runNow')}
                    </Button>
                  </Tooltip>
                  <Tooltip
                    content={task.status === 'active' ? t('action.pause') : t('action.resume')}
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleToggleStatus(task)}
                    >
                      {task.status === 'active' ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      {task.status === 'active' ? t('action.pause') : t('action.resume')}
                    </Button>
                  </Tooltip>
                  <Tooltip content={t('action.history')}>
                    <Button variant="ghost" size="sm" onClick={() => setHistoryTask(task)}>
                      <History className="h-4 w-4" />
                      {t('action.history')}
                    </Button>
                  </Tooltip>
                  <Tooltip content={t('action.edit')}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(task)
                        setDialogOpen(true)
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                      {t('action.edit')}
                    </Button>
                  </Tooltip>
                  <Tooltip content={t('action.delete')}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleting(task)}
                    >
                      <Trash2 className="h-4 w-4" />
                      {t('action.delete')}
                    </Button>
                  </Tooltip>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <PatrolFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={() => void load()}
      />

      <PatrolRunsDialog
        open={historyTask !== null}
        onOpenChange={(open) => {
          if (!open) setHistoryTask(null)
        }}
        task={historyTask}
      />

      <ConfirmDialog
        open={deleting !== null}
        title={t('deleteConfirm.title')}
        content={t('deleteConfirm.content', { name: deleting?.name ?? '' })}
        confirmText={t('delete')}
        cancelText={t('cancel')}
        variant="danger"
        loading={deletePending}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
