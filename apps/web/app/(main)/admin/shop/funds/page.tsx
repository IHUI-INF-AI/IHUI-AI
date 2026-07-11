'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Loader2,
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@ihui/ui'
import { cn } from '@/lib/utils'

interface FundAccount {
  id: string
  user: string
  balance: number
  frozen: number
  totalRecharge: number
  totalConsume: number
  updatedAt: string
}

interface FundFlow {
  id: string
  user: string
  amount: number
  direction: 'in' | 'out'
  type: 'recharge' | 'consume' | 'refund' | 'withdraw'
  balance: number
  remark: string | null
  createdAt: string
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const selectClass =
  'h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const TYPE_LABEL: Record<FundFlow['type'], string> = {
  recharge: '充值',
  consume: '消费',
  refund: '退款',
  withdraw: '提现',
}

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
                  {c.raw
                    ? c.value.toLocaleString()
                    : `¥${(c.value / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
          <button onClick={() => setTab('accounts')} className={tabCls(tab === 'accounts')}>
            账户
          </button>
          <button onClick={() => setTab('flows')} className={tabCls(tab === 'flows')}>
            流水
          </button>
        </div>
        {tab === 'flows' && (
          <Select value={flowType} onValueChange={setFlowType}>
            <SelectTrigger className={selectClass} aria-label="类型">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              {Object.entries(TYPE_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div key={tab} className="animate-in fade-in-0 duration-200">
        {tab === 'accounts' ? (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs uppercase">用户</TableHead>
                  <TableHead className="text-xs uppercase">余额</TableHead>
                  <TableHead className="text-xs uppercase">冻结</TableHead>
                  <TableHead className="text-xs uppercase">累计充值</TableHead>
                  <TableHead className="text-xs uppercase">累计消费</TableHead>
                  <TableHead className="text-xs uppercase">更新时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : accounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      暂无账户
                    </TableCell>
                  </TableRow>
                ) : (
                  accounts.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.user}</TableCell>
                      <TableCell className="font-medium text-primary">
                        ¥{(a.balance / 100).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-amber-600">
                        ¥{(a.frozen / 100).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-emerald-600">
                        ¥{(a.totalRecharge / 100).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-red-600">
                        ¥{(a.totalConsume / 100).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(a.updatedAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs uppercase">用户</TableHead>
                  <TableHead className="text-xs uppercase">类型</TableHead>
                  <TableHead className="text-xs uppercase">金额</TableHead>
                  <TableHead className="text-xs uppercase">余额</TableHead>
                  <TableHead className="text-xs uppercase">备注</TableHead>
                  <TableHead className="text-xs uppercase">时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flowLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : flows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      暂无流水
                    </TableCell>
                  </TableRow>
                ) : (
                  flows.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.user}</TableCell>
                      <TableCell>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {TYPE_LABEL[f.type]}
                        </span>
                      </TableCell>
                      <TableCell
                        className={cn(
                          'font-medium',
                          f.direction === 'in' ? 'text-emerald-600' : 'text-red-600',
                        )}
                      >
                        <span className="inline-flex items-center gap-0.5">
                          {f.direction === 'in' ? (
                            <ArrowUpRight className="h-3 w-3" />
                          ) : (
                            <ArrowDownRight className="h-3 w-3" />
                          )}
                          {f.direction === 'in' ? '+' : '-'}¥{(f.amount / 100).toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>¥{(f.balance / 100).toFixed(2)}</TableCell>
                      <TableCell className="max-w-[200px] break-words text-xs text-muted-foreground">
                        {f.remark || '-'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(f.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
