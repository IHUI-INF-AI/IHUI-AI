'use client'

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Loader2, Ban } from 'lucide-react'
import { Button } from '@ihui/ui'
import { Badge } from '@/components/data'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import {
  useRecurringContracts,
  useCancelContract,
  type WechatPayContract,
} from '@/hooks/use-subscription'

function statusVariant(status: WechatPayContract['status']): 'success' | 'warning' | 'default' {
  if (status === 'active') return 'success'
  if (status === 'pending') return 'warning'
  return 'default'
}

export function ContractManager() {
  const t = useTranslations('contractManager')
  const locale = useLocale()
  const { data: contracts, isLoading } = useRecurringContracts()
  const cancelMutation = useCancelContract()
  const [cancelTarget, setCancelTarget] = React.useState<WechatPayContract | null>(null)

  const dateFmt = new Intl.DateTimeFormat(locale, {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const fmt = (input?: string): string => {
    if (!input) return '-'
    const d = new Date(input)
    if (Number.isNaN(d.getTime())) return '-'
    return dateFmt.format(d)
  }

  const chargeStatusText = (status?: WechatPayContract['lastChargeStatus']): string => {
    if (!status) return '-'
    if (status === 'success') return t('chargeStatus.success')
    if (status === 'failed') return t('chargeStatus.failed')
    return t('chargeStatus.processing')
  }

  const list = (contracts ?? []).filter((c) => c.status === 'active' || c.status === 'pending')

  const confirmCancel = async () => {
    if (!cancelTarget) return
    try {
      await cancelMutation.mutateAsync({ id: cancelTarget.id })
      setCancelTarget(null)
    } catch {
      // 错误已在 mutation 上下文中暴露,此处静默
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{t('title')}</h3>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {t('empty')}
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((c) => (
            <li key={c.id} className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{t('planName')}</span>
                    <Badge variant={statusVariant(c.status)}>{t(`status.${c.status}` as 'status.active')}</Badge>
                  </div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <dt>{t('fields.nextCharge')}</dt>
                    <dd className="text-foreground">{fmt(c.nextChargeTime)}</dd>
                    <dt>{t('fields.lastCharge')}</dt>
                    <dd className="text-foreground">{fmt(c.lastChargeTime)}</dd>
                    <dt>{t('fields.chargeStatus')}</dt>
                    <dd className="text-foreground">{chargeStatusText(c.lastChargeStatus)}</dd>
                    <dt>{t('fields.signedAt')}</dt>
                    <dd className="text-foreground">{fmt(c.signedAt)}</dd>
                  </dl>
                </div>
                {c.status === 'active' && (
                  <Button variant="outline" size="sm" onClick={() => setCancelTarget(c)}>
                    <Ban className="mr-1" />
                    {t('actions.cancel')}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={cancelTarget !== null}
        title={t('cancelDialog.title')}
        content={
          <p className="text-sm text-muted-foreground">{t('cancelDialog.content')}</p>
        }
        confirmText={t('cancelDialog.confirmText')}
        cancelText={t('cancelDialog.cancelText')}
        variant="danger"
        loading={cancelMutation.isPending}
        onConfirm={confirmCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  )
}
