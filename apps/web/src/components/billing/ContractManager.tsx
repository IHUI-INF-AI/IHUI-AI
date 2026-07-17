'use client'

import * as React from 'react'
import { Loader2, Ban } from 'lucide-react'
import { Button } from '@ihui/ui'
import { Badge } from '@/components/data'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import {
  useRecurringContracts,
  useCancelContract,
  type WechatPayContract,
} from '@/hooks/use-subscription'

const dateFmt = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const STATUS_LABEL: Record<WechatPayContract['status'], string> = {
  pending: '签约中',
  active: '生效中',
  cancelled: '已解约',
  expired: '已过期',
}

function statusVariant(status: WechatPayContract['status']): 'success' | 'warning' | 'default' {
  if (status === 'active') return 'success'
  if (status === 'pending') return 'warning'
  return 'default'
}

function chargeStatusText(status?: WechatPayContract['lastChargeStatus']): string {
  if (!status) return '-'
  if (status === 'success') return '成功'
  if (status === 'failed') return '失败'
  return '处理中'
}

function fmt(input?: string): string {
  if (!input) return '-'
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return '-'
  return dateFmt.format(d)
}

export function ContractManager() {
  const { data: contracts, isLoading } = useRecurringContracts()
  const cancelMutation = useCancelContract()
  const [cancelTarget, setCancelTarget] = React.useState<WechatPayContract | null>(null)

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
        <h3 className="text-sm font-medium">签约管理</h3>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          暂无自动续费签约
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((c) => (
            <li key={c.id} className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">连续包月订阅</span>
                    <Badge variant={statusVariant(c.status)}>{STATUS_LABEL[c.status]}</Badge>
                  </div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <dt>下次扣款</dt>
                    <dd className="text-foreground">{fmt(c.nextChargeTime)}</dd>
                    <dt>上次扣款</dt>
                    <dd className="text-foreground">{fmt(c.lastChargeTime)}</dd>
                    <dt>扣款状态</dt>
                    <dd className="text-foreground">{chargeStatusText(c.lastChargeStatus)}</dd>
                    <dt>签约时间</dt>
                    <dd className="text-foreground">{fmt(c.signedAt)}</dd>
                  </dl>
                </div>
                {c.status === 'active' && (
                  <Button variant="outline" size="sm" onClick={() => setCancelTarget(c)}>
                    <Ban className="mr-1" />
                    解约
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={cancelTarget !== null}
        title="解约自动续费"
        content={
          <p className="text-sm text-muted-foreground">
            解约后将不再自动扣款,当前 VIP 权益持续到期满。确认解约?
          </p>
        }
        confirmText="确认解约"
        cancelText="取消"
        variant="danger"
        loading={cancelMutation.isPending}
        onConfirm={confirmCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  )
}
