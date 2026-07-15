'use client'

import { Wallet, TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { cn } from '@/lib/utils'
import type { FundAccount } from './types'
import { formatNumber, formatCurrency } from '@/lib/date-utils'

interface Props {
  accounts: FundAccount[]
}

export function FundsHeader({ accounts }: Props) {
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0)
  const totalFrozen = accounts.reduce((s, a) => s + a.frozen, 0)
  const cards = [
    { label: '总余额', value: totalBalance, icon: Wallet, cls: 'text-primary' },
    { label: '总冻结', value: totalFrozen, icon: TrendingDown, cls: 'text-amber-600' },
    {
      label: '账户数',
      value: accounts.length,
      icon: TrendingUp,
      cls: 'text-emerald-600',
      raw: true,
    },
  ]
  return (
    <>
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Wallet className="h-6 w-6 text-primary" />
          资金账户管理
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">用户资金账户与流水</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <Card key={c.label}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  {c.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={cn('text-2xl font-bold', c.cls)}>
                  {c.raw ? formatNumber(c.value) : `¥${formatCurrency(c.value / 100)}`}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </>
  )
}
