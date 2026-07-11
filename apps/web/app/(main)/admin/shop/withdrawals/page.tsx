'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Wallet, Check, X } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Button,
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

interface Withdrawal {
  id: string
  user: string
  amount: number
  channel: 'alipay' | 'wechat' | 'bank'
  account: string
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'failed'
  createdAt: string
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const selectClass =
  'h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const CHANNEL_LABEL: Record<Withdrawal['channel'], string> = {
  alipay: '支付宝',
  wechat: '微信',
  bank: '银行卡',
}
const STATUS_LABEL: Record<Withdrawal['status'], string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回',
  completed: '已完成',
  failed: '已失败',
}
const STATUS_STYLE: Record<Withdrawal['status'], string> = {
  pending: 'bg-amber-500/10 text-amber-600',
  approved: 'bg-emerald-500/10 text-emerald-600',
  rejected: 'bg-muted text-muted-foreground',
  completed: 'bg-emerald-500/10 text-emerald-600',
  failed: 'bg-red-500/10 text-red-600',
}

export default function AdminShopWithdrawalsPage() {
  const qc = useQueryClient()
  const [status, setStatus] = React.useState('all')

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['admin', 'shop', 'withdrawals', status],
    queryFn: () => {
      const qs = new URLSearchParams()
      if (status !== 'all') qs.set('status', status)
      return api<{ list: Withdrawal[] }>(`/api/admin/shop/withdrawals?${qs.toString()}`).then(
        (d) => d.list ?? [],
      )
    },
  })

  const auditMut = useMutation({
    mutationFn: (p: { id: string; action: 'approve' | 'reject' }) =>
      api(`/api/admin/shop/withdrawals/${p.id}/${p.action}`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'shop', 'withdrawals'] }),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Wallet className="h-6 w-6 text-primary" />
            提现管理
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">审核与处理用户提现申请</p>
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className={selectClass} aria-label="状态">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs uppercase">用户</TableHead>
              <TableHead className="text-xs uppercase">金额</TableHead>
              <TableHead className="text-xs uppercase">渠道</TableHead>
              <TableHead className="text-xs uppercase">账户</TableHead>
              <TableHead className="text-xs uppercase">状态</TableHead>
              <TableHead className="text-xs uppercase">申请时间</TableHead>
              <TableHead className="text-right text-xs uppercase">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                </TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  暂无提现申请
                </TableCell>
              </TableRow>
            ) : (
              list.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-medium">{w.user}</TableCell>
                  <TableCell className="font-medium">¥{(w.amount / 100).toFixed(2)}</TableCell>
                  <TableCell>{CHANNEL_LABEL[w.channel]}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {w.account}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
                        STATUS_STYLE[w.status],
                      )}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {STATUS_LABEL[w.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(w.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {w.status === 'pending' && (
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={auditMut.isPending}
                          onClick={() => auditMut.mutate({ id: w.id, action: 'approve' })}
                        >
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          通过
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={auditMut.isPending}
                          onClick={() => auditMut.mutate({ id: w.id, action: 'reject' })}
                        >
                          <X className="h-3.5 w-3.5 text-red-600" />
                          驳回
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
