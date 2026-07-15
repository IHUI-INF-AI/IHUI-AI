'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import type { DispatchResult } from './types'

interface Props {
  result: DispatchResult
}

export function DispatchResultView({ result }: Props) {
  const t = useTranslations('adminTools')
  const stats = [
    { key: 'sent', value: result.sent, cls: 'bg-emerald-500/10 text-emerald-600' },
    { key: 'failed', value: result.failed, cls: 'bg-red-500/10 text-red-600' },
    { key: 'skipped', value: result.skipped, cls: 'bg-muted text-muted-foreground' },
    { key: 'queued', value: result.queued, cls: 'bg-amber-500/10 text-amber-600' },
  ]
  return (
    <div className="rounded-lg border p-4">
      <h2 className="mb-3 text-sm font-medium">{t('nd.resultTitle')}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.key} className={cn('rounded-md px-3 py-2', s.cls)}>
            <div className="text-xs opacity-80">{t(`nd.result_${s.key}`)}</div>
            <div className="text-xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
