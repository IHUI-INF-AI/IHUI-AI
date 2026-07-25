'use client'

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Loader2, Ban } from 'lucide-react'
import { Button } from '@ihui/ui-react'
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

  // 性能修复(2026-07-25):Intl.DateTimeFormat 构造涉及 ICU 数据加载,
  // 每次 render 重建代价高(数十 ms)。useMemo 仅 locale 变化时重建。
  const dateFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
    [locale],
  )

  // 性能优化(2026-07-25):useCallback 稳定 fmt/chargeStatusText 引用,
  // 配合 ContractRow 的 React.memo 提升列表渲染命中率。
  const fmt = React.useCallback(
    (input?: string): string => {
      if (!input) return '-'
      const d = new Date(input)
      if (Number.isNaN(d.getTime())) return '-'
      return dateFmt.format(d)
    },
    [dateFmt],
  )

  const chargeStatusText = React.useCallback(
    (status?: WechatPayContract['lastChargeStatus']): string => {
      if (!status) return '-'
      if (status === 'success') return t('chargeStatus.success')
      if (status === 'failed') return t('chargeStatus.failed')
      return t('chargeStatus.processing')
    },
    [t],
  )

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

  const handleCancelClick = React.useCallback(
    (c: WechatPayContract) => setCancelTarget(c),
    [],
  )

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
            <ContractRow
              key={c.id}
              contract={c}
              fmt={fmt}
              chargeStatusText={chargeStatusText}
              onCancel={handleCancelClick}
            />
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

interface ContractRowProps {
  contract: WechatPayContract
  fmt: (input?: string) => string
  chargeStatusText: (status?: WechatPayContract['lastChargeStatus']) => string
  onCancel: (contract: WechatPayContract) => void
}

// 性能优化(2026-07-25):抽出列表项 + React.memo,避免父方 state 变更
// (如 cancelTarget 切换)导致全部行重渲染。t 经 next-intl 内部稳定,
// 故 useTranslations 在子组件内调用即可。
const ContractRow = React.memo(function ContractRow({
  contract,
  fmt,
  chargeStatusText,
  onCancel,
}: ContractRowProps) {
  const t = useTranslations('contractManager')
  return (
    <li className="rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{t('planName')}</span>
            <Badge variant={statusVariant(contract.status)}>
              {t(`status.${contract.status}` as 'status.active')}
            </Badge>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <dt>{t('fields.nextCharge')}</dt>
            <dd className="text-foreground">{fmt(contract.nextChargeTime)}</dd>
            <dt>{t('fields.lastCharge')}</dt>
            <dd className="text-foreground">{fmt(contract.lastChargeTime)}</dd>
            <dt>{t('fields.chargeStatus')}</dt>
            <dd className="text-foreground">{chargeStatusText(contract.lastChargeStatus)}</dd>
            <dt>{t('fields.signedAt')}</dt>
            <dd className="text-foreground">{fmt(contract.signedAt)}</dd>
          </dl>
        </div>
        {contract.status === 'active' && (
          <Button variant="outline" size="sm" onClick={() => onCancel(contract)}>
            <Ban className="mr-1" />
            {t('actions.cancel')}
          </Button>
        )}
      </div>
    </li>
  )
})
