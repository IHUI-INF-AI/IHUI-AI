'use client'

import { ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { STATUS_BADGE } from './helpers'
import type { Instance } from './types'

interface Props {
  inst: Instance
  fmt: (v?: string) => string
  onBack: () => void
}

export function InstanceHeader({ inst, fmt, onBack }: Props) {
  const t = useTranslations('workflows')
  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('instanceDetail.backToWorkflow')}
      </button>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
        <span
          className={cn(
            'inline-flex rounded px-2 py-0.5 text-xs font-medium',
            STATUS_BADGE[inst.status],
          )}
        >
          {t(`instanceStatus.${inst.status}`)}
        </span>
        {inst.workflowName && <span className="text-sm font-medium">{inst.workflowName}</span>}
        <div className="text-xs text-muted-foreground">
          <span>
            {t('instanceDetail.startedAt')}: {fmt(inst.startedAt)}
          </span>
          <span className="ml-3">
            {t('instanceDetail.completedAt')}: {fmt(inst.completedAt)}
          </span>
        </div>
      </div>
    </>
  )
}
