'use client'

import { useTranslations } from 'next-intl'
import { Zap, Check, X, Edit, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { PROVIDER_INITIAL } from './helpers'
import type { Integration, TestResult } from './types'

interface Props {
  list: Integration[]
  isLoading: boolean
  testResults: Record<string, TestResult | 'loading'>
  testPending: boolean
  onTest: (id: string) => void
  onEdit: (item: Integration) => void
  onDelete: (item: Integration) => void
}

export function IntegrationTable({
  list,
  isLoading,
  testResults,
  testPending,
  onTest,
  onEdit,
  onDelete,
}: Props) {
  const t = useTranslations('admin.integrations')
  const tc = useTranslations('common')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {t('loading')}
      </div>
    )
  }
  if (list.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-16 text-center text-muted-foreground">
        {t('noData')}
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((i) => {
        const tr = testResults[i.id]
        return (
          <div
            key={i.id}
            className="flex flex-col rounded-lg border p-4 transition-colors hover:bg-muted/30"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary">
                  {PROVIDER_INITIAL[i.provider] ?? i.provider[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="font-medium">{i.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {t(`providers.${i.provider}`)}
                  </div>
                </div>
              </div>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                  i.isEnabled
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    i.isEnabled ? 'bg-emerald-500' : 'bg-muted-foreground/50',
                  )}
                />
                {i.isEnabled ? t('enabled') : t('disabled')}
              </span>
            </div>
            {tr && tr !== 'loading' && (
              <div
                className={cn(
                  'mt-3 flex items-start gap-2 rounded-md px-2.5 py-1.5 text-xs',
                  tr.success
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                    : 'bg-red-500/10 text-red-600 dark:text-red-500',
                )}
              >
                {tr.success ? (
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                ) : (
                  <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                )}
                <span className="break-all">{tr.message}</span>
              </div>
            )}
            <div className="mt-4 flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={testPending && testResults[i.id] === 'loading'}
                onClick={() => onTest(i.id)}
              >
                {tr === 'loading' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                {t('test')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onEdit(i)}>
                <Edit className="h-4 w-4" />
                {t('edit')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => onDelete(i)}
              >
                <Trash2 className="h-4 w-4" />
                {tc('delete')}
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
