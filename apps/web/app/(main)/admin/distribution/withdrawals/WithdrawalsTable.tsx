'use client'

import { Loader2, Check, X } from 'lucide-react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from '@ihui/ui-react'
import { amountCls, badgeCls, fmtYuan, STATUS_LABEL } from './helpers'
import type { Withdrawal } from './types'

const COLSPAN = 7

interface Props {
  items: Withdrawal[]
  isLoading: boolean
  reviewPending: boolean
  onReview: (id: string, action: 'approve' | 'reject') => void
  fmtDate: (v: string | null | undefined) => string
}

export function WithdrawalsTable({ items, isLoading, reviewPending, onReview, fmtDate }: Props) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="px-4 py-2.5">用户</TableHead>
            <TableHead className="px-4 py-2.5 text-right">金额</TableHead>
            <TableHead className="px-4 py-2.5">收款账户</TableHead>
            <TableHead className="px-4 py-2.5">状态</TableHead>
            <TableHead className="px-4 py-2.5">申请时间</TableHead>
            <TableHead className="px-4 py-2.5">处理时间</TableHead>
            <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                加载中...
              </TableCell>
            </TableRow>
          ) : items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-muted-foreground">
                暂无提现申请
              </TableCell>
            </TableRow>
          ) : (
            items.map((it) => (
              <TableRow key={it.id}>
                <TableCell className="px-4 py-2.5 font-medium">
                  {it.userNickname ?? it.userId ?? '-'}
                </TableCell>
                <TableCell className={amountCls(it.amount)}>{fmtYuan(it.amount)}</TableCell>
                <TableCell className="px-4 py-2.5 text-muted-foreground">
                  {it.account}
                  {it.accountType ? ` (${it.accountType})` : ''}
                </TableCell>
                <TableCell className="px-4 py-2.5">
                  <span className={badgeCls(it.status)}>
                    {STATUS_LABEL[it.status] ?? it.status}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-2.5 text-muted-foreground">
                  {fmtDate(it.createdAt)}
                </TableCell>
                <TableCell className="px-4 py-2.5 text-muted-foreground">
                  {fmtDate(it.processedAt)}
                </TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  {it.status === 'pending' ? (
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={reviewPending}
                        onClick={() => onReview(it.id, 'approve')}
                      >
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        通过
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={reviewPending}
                        onClick={() => onReview(it.id, 'reject')}
                      >
                        <X className="h-3.5 w-3.5 text-red-600" />
                        拒绝
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
