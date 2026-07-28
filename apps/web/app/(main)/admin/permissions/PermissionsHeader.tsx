'use client'

import * as React from 'react'
import { Key, Shield, Boxes, Zap } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface Props {
  total: number
  resourceCount: number
  actionCount: number
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
}) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  )
}

export function PermissionsHeader({ total, resourceCount, actionCount }: Props) {
  const t = useTranslations('admin.permissions')
  return (
    <>
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Key className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={Shield} label={t('statsTotal')} value={total} />
        <StatCard icon={Boxes} label={t('statsResources')} value={resourceCount} />
        <StatCard icon={Zap} label={t('statsActions')} value={actionCount} />
      </div>
    </>
  )
}
