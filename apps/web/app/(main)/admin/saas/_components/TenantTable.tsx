/**
 * P1-2.2: 租户表格
 */
import * as React from 'react'
import { useTranslations, useLocale } from 'next-intl'
import {
  Eye,
  Pause,
  Play,
  Database,
  Trash2,
} from 'lucide-react'
import { Button } from '@ihui/ui'

import { StateBadge } from './StateBadge'
import { ContainerStatusCell } from './ContainerStatusCell'
import type { Tenant } from '../types'

type PendingMap = { [slug: string]: 'pause' | 'resume' | 'backup' | 'delete' | null }

interface TenantTableProps {
  tenants: Tenant[]
  dateFmt: Intl.DateTimeFormat
  pending: PendingMap
  onPause: (t: Tenant) => void
  onResume: (t: Tenant) => void
  onBackup: (t: Tenant) => void
  onDelete: (t: Tenant) => void
}

export function TenantTable({
  tenants,
  dateFmt,
  pending,
  onPause,
  onResume,
  onBackup,
  onDelete,
}: TenantTableProps) {
  const t = useTranslations('admin.saas')
  const locale = useLocale()
  const isRtl = locale === 'ar' || locale === 'he'

  if (tenants.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        {t('empty')}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm" dir={isRtl ? 'rtl' : 'ltr'}>
        <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">{t('table.slug')}</th>
            <th className="px-4 py-2.5 font-medium">{t('table.domain')}</th>
            <th className="px-4 py-2.5 font-medium">{t('table.state')}</th>
            <th className="px-4 py-2.5 font-medium">{t('table.containers')}</th>
            <th className="px-4 py-2.5 font-medium">{t('table.memory')}</th>
            <th className="px-4 py-2.5 font-medium">{t('table.cpu')}</th>
            <th className="px-4 py-2.5 font-medium">
              {t('table.stateChangedAt')}
            </th>
            <th className="px-4 py-2.5 text-right font-medium">
              {t('table.actions')}
            </th>
          </tr>
        </thead>
        <tbody>
          {tenants.map((tn) => {
            const p = pending[tn.slug] ?? null
            return (
              <tr key={tn.slug} className="border-b last:border-0 hover:bg-muted/20">
                <td className="px-4 py-2.5 font-mono font-medium">{tn.slug}</td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {tn.domain === '-' ? '—' : tn.domain}
                </td>
                <td className="px-4 py-2.5">
                  <StateBadge state={tn.state} />
                </td>
                <td className="px-4 py-2.5">
                  <ContainerStatusCell
                    running={tn.containersRunning}
                    total={tn.containersTotal}
                  />
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {tn.memory}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{tn.cpu}</td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {tn.stateChangedAt
                    ? dateFmt.format(new Date(tn.stateChangedAt))
                    : '—'}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={t('action.detail')}
                      title={t('action.detail')}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {tn.state === 'paused' ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={t('action.resume')}
                        title={t('action.resume')}
                        disabled={p !== null}
                        onClick={() => onResume(tn)}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={t('action.pause')}
                        title={t('action.pause')}
                        disabled={p !== null || !tn.exists}
                        onClick={() => onPause(tn)}
                      >
                        <Pause className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={t('action.backup')}
                      title={t('action.backup')}
                      disabled={p !== null || !tn.exists}
                      onClick={() => onBackup(tn)}
                    >
                      <Database className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={t('action.destroy')}
                      title={t('action.destroy')}
                      disabled={p !== null}
                      onClick={() => onDelete(tn)}
                      className="text-rose-500 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
