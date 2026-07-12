'use client'

import * as React from 'react'
import { Wallet } from 'lucide-react'

import { cn } from '@/lib/utils'

import { useWithdrawalDetail } from './useWithdrawalDetail'
import { useWithdrawalFlow } from './useWithdrawalFlow'
import { WithdrawalDetailTable } from './WithdrawalDetailTable'
import { WithdrawalDetailDialog } from './WithdrawalDetailDialog'
import { WithdrawalReviewDialog } from './WithdrawalReviewDialog'
import { WithdrawalFlowTable } from './WithdrawalFlowTable'
import { WithdrawalFlowDialog } from './WithdrawalFlowDialog'

export default function AdminShopWithdrawalsPage() {
  const [tab, setTab] = React.useState<'detail' | 'flow'>('detail')
  const detail = useWithdrawalDetail(tab === 'detail')
  const flow = useWithdrawalFlow(tab === 'flow')

  const tabCls = (active: boolean) =>
    cn(
      'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
      active
        ? 'bg-background text-foreground shadow-sm'
        : 'text-muted-foreground hover:text-foreground',
    )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Wallet className="h-6 w-6 text-primary" />
          提现管理
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">审核与处理用户提现申请</p>
      </div>

      <div className="flex w-fit gap-1 rounded-lg border bg-muted/30 p-1">
        <button onClick={() => setTab('detail')} className={tabCls(tab === 'detail')}>
          提现详情
        </button>
        <button onClick={() => setTab('flow')} className={tabCls(tab === 'flow')}>
          提现流水
        </button>
      </div>

      {tab === 'detail' && (
        <>
          <WithdrawalDetailTable {...detail} />
          <WithdrawalDetailDialog {...detail} />
          <WithdrawalReviewDialog {...detail} />
        </>
      )}

      {tab === 'flow' && (
        <>
          <WithdrawalFlowTable {...flow} />
          <WithdrawalFlowDialog {...flow} />
        </>
      )}
    </div>
  )
}
