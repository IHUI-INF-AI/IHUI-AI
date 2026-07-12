'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'

import { FundsHeader } from './FundsHeader'
import { FundsTabs } from './FundsTabs'
import { FundsAccountsTable } from './FundsAccountsTable'
import { FundsFlowsTable } from './FundsFlowsTable'
import { api } from './helpers'
import type { FundAccount, FundFlow } from './types'

export default function AdminShopFundsPage() {
  const [tab, setTab] = React.useState<'accounts' | 'flows'>('accounts')
  const [flowType, setFlowType] = React.useState('all')

  const { data: accounts = [], isLoading: accLoading } = useQuery({
    queryKey: ['admin', 'shop', 'funds', 'accounts'],
    queryFn: () =>
      api<{ list: FundAccount[] }>('/api/admin/shop/funds/accounts').then((d) => d.list ?? []),
    enabled: tab === 'accounts',
  })

  const { data: flows = [], isLoading: flowLoading } = useQuery({
    queryKey: ['admin', 'shop', 'funds', 'flows', flowType],
    queryFn: () => {
      const qs = new URLSearchParams()
      if (flowType !== 'all') qs.set('type', flowType)
      return api<{ list: FundFlow[] }>(`/api/admin/shop/funds/flows?${qs.toString()}`).then(
        (d) => d.list ?? [],
      )
    },
    enabled: tab === 'flows',
  })

  return (
    <div className="space-y-4">
      <FundsHeader accounts={accounts} />
      <FundsTabs tab={tab} setTab={setTab} flowType={flowType} setFlowType={setFlowType} />
      <div key={tab} className="animate-in fade-in-0 duration-200">
        {tab === 'accounts' ? (
          <FundsAccountsTable accounts={accounts} isLoading={accLoading} />
        ) : (
          <FundsFlowsTable flows={flows} isLoading={flowLoading} />
        )}
      </div>
    </div>
  )
}
