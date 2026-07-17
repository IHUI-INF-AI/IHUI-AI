'use client'

import { Loader2, Workflow, Zap, Edit, Trash2, Eye } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'

import { cn } from '@/lib/utils'
import { Button } from '@ihui/ui'
import { STATUS_BADGE, TRIGGER_BADGE } from './helpers'
import type { WorkflowItem, WfStatus } from './types'

interface WorkflowsTableProps {
  list: WorkflowItem[]
  isLoading: boolean
  error: Error | null
  onView: (w: WorkflowItem) => void
  onEdit: (w: WorkflowItem) => void
  onDelete: (id: string) => void
}

export function WorkflowsTable({
  list,
  isLoading,
  error,
  onView,
  onEdit,
  onDelete,
}: WorkflowsTableProps) {
  const t = useTranslations('admin.workflows')
  const tc = useTranslations('common')
  const locale = useLocale()
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const th = 'px-4 py-2.5 font-medium'

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className={th}>{t('name')}</th>
            <th className={th}>{t('triggerType')}</th>
            <th className={th}>{t('status')}</th>
            <th className={th}>{t('createdAt')}</th>
            <th className={cn(th, 'text-right')}>{t('actions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {isLoading ? (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                {t('loading')}
              </td>
            </tr>
          ) : error ? (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-destructive">
                {error.message}
              </td>
            </tr>
          ) : list.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                <Workflow className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noData')}
              </td>
            </tr>
          ) : (
            list.map((w) => {
              const status: WfStatus = w.isActive ? 'active' : 'archived'
              const sc = STATUS_BADGE[status] ?? STATUS_BADGE.draft
              const stepCount = Array.isArray(w.steps) ? w.steps.length : 0
              return (
                <tr key={w.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Workflow className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium">{w.name}</div>
                        {w.description ? (
                          <div className="text-xs text-muted-foreground">{w.description}</div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium',
                        TRIGGER_BADGE[w.triggerType] ?? TRIGGER_BADGE.manual,
                      )}
                    >
                      <Zap className="h-3 w-3" />
                      {t(`trigger_${w.triggerType}`)}
                    </span>
                    {stepCount > 0 ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {t('stepsCount', { count: stepCount })}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                        sc.cls,
                      )}
                    >
                      <span className={cn('h-1.5 w-1.5 rounded-full', sc.dot)} />
                      {t(`status_${status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {dateFmt.format(new Date(w.createdAt))}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => onView(w)}>
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        {t('view')}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onEdit(w)}>
                        <Edit className="mr-1 h-3.5 w-3.5" />
                        {tc('edit')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => onDelete(w.id)}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        {tc('delete')}
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
