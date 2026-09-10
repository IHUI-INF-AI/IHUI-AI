// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 用户侧 Agent 定时自动化页面(2026-09-07 立,/automations)。
 * 列表(名称/计划/状态徽章/上次运行/上次结果摘要) + 操作(立即运行/暂停恢复/编辑/删除)
 * + 新建弹窗。API 全部走 @ihui/api-client automations 端点。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Pause, Pencil, Play, Plus, RefreshCw, Trash2, Zap } from 'lucide-react'
import { Button, Badge } from '@ihui/ui-react'
import {
  listAutomations,
  updateAutomation,
  deleteAutomation,
  runAutomation,
  type UserAutomation,
} from '@ihui/api-client'
import { ConfirmDialog, Tooltip } from '@/components/feedback'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { AutomationFormDialog } from '@/components/automations/automation-form-dialog'

/** 周几代码 → i18n 键(静态映射) */
const WEEKDAY_LABEL_KEYS = {
  MO: 'weekdayMo',
  TU: 'weekdayTu',
  WE: 'weekdayWe',
  TH: 'weekdayTh',
  FR: 'weekdayFr',
  SA: 'weekdaySa',
  SU: 'weekdaySu',
} as const

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

export default function AutomationsPage() {
  const t = useTranslations('automations')
  const toast = useToast()

  const [items, setItems] = React.useState<UserAutomation[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [runningId, setRunningId] = React.useState<string | null>(null)
  const [deleting, setDeleting] = React.useState<UserAutomation | null>(null)
  const [deletePending, setDeletePending] = React.useState(false)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<UserAutomation | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await listAutomations({ limit: 100 })
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

  const handleRunNow = async (a: UserAutomation) => {
    setRunningId(a.id)
    try {
      const res = await runAutomation(a.id)
      toast.success(t('toast.runDone'), res.summary.slice(0, 120))
      await load()
    } catch (err) {
      toast.error(t('toast.runFailed'), err instanceof Error ? err.message : undefined)
    } finally {
      setRunningId(null)
    }
  }

  const handleToggleStatus = async (a: UserAutomation) => {
    const next = a.status === 'active' ? 'paused' : 'active'
    try {
      await updateAutomation(a.id, { status: next })
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
      await deleteAutomation(deleting.id)
      toast.success(t('toast.deleted'))
      setDeleting(null)
      await load()
    } catch (err) {
      toast.error(t('toast.deleteFailed'), err instanceof Error ? err.message : undefined)
    } finally {
      setDeletePending(false)
    }
  }

  /** 计划描述:once 显示定时;recurring 按频率描述 */
  const describeSchedule = (a: UserAutomation): string => {
    if (a.scheduleType === 'once') {
      return `${t('schedule.oncePrefix')} ${formatDateTime(a.scheduledAt)}`
    }
    const parts: Record<string, string> = {}
    for (const seg of (a.rrule ?? '').split(';')) {
      const idx = seg.indexOf('=')
      if (idx > 0) parts[seg.slice(0, idx).trim().toUpperCase()] = seg.slice(idx + 1).trim()
    }
    const time =
      parts.BYHOUR !== undefined || parts.BYMINUTE !== undefined
        ? `${String(Number(parts.BYHOUR ?? '0')).padStart(2, '0')}:${String(
            Number(parts.BYMINUTE ?? '0'),
          ).padStart(2, '0')}`
        : ''
    const freq = parts.FREQ?.toUpperCase()
    if (freq === 'HOURLY') return t('schedule.hourly')
    if (freq === 'DAILY') return `${t('schedule.daily')} ${time}`
    if (freq === 'WEEKLY' && parts.BYDAY) {
      const dayNames = parts.BYDAY.split(',')
        .map((d) => {
          const key = WEEKDAY_LABEL_KEYS[d.trim().toUpperCase() as keyof typeof WEEKDAY_LABEL_KEYS]
          return key ? t(key) : d
        })
        .join(' / ')
      return `${t('schedule.weekly')} ${dayNames} ${time}`
    }
    return a.rrule ?? t('schedule.unknown')
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4">
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
          {items.map((a) => (
            <div
              key={a.id}
              className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/30"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">{a.name}</span>
                    {a.status === 'active' ? (
                      <Badge
                        className="border-transparent bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15"
                      >
                        {t('status.active')}
                      </Badge>
                    ) : (
                      <Badge
                        className="border-transparent bg-muted text-muted-foreground hover:bg-muted"
                      >
                        {t('status.paused')}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{describeSchedule(a)}</span>
                  </div>
                  {a.lastRunAt && (
                    <div className="text-xs text-muted-foreground">
                      {t('lastRunAt')}: {formatDateTime(a.lastRunAt)}
                    </div>
                  )}
                  {a.lastResult?.summary && (
                    <div className="truncate text-xs text-muted-foreground">
                      {t('lastResult')}: {a.lastResult.summary}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Tooltip content={t('action.runNow')}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleRunNow(a)}
                      disabled={runningId === a.id}
                    >
                      {runningId === a.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4" />
                      )}
                      {t('action.runNow')}
                    </Button>
                  </Tooltip>
                  <Tooltip content={a.status === 'active' ? t('action.pause') : t('action.resume')}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleToggleStatus(a)}
                    >
                      {a.status === 'active' ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      {a.status === 'active' ? t('action.pause') : t('action.resume')}
                    </Button>
                  </Tooltip>
                  <Tooltip content={t('action.edit')}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(a)
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
                      onClick={() => setDeleting(a)}
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

      <AutomationFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={() => void load()}
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
