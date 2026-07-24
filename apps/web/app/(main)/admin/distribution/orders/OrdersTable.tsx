'use client'

import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell, Button } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { PAGE_SIZE, STATUS_CLS, STATUS_LABEL, fmtYuan } from './types'
import type { Order } from './types'

interface Props {
  items: Order[]
  isLoading: boolean
  total: number
  page: number
  totalPages: number
  fmtDate: (v: string | null | undefined) => string
  onPrev: () => void
  onNext: () => void
}

export function OrdersTable({
  items,
  isLoading,
  total,
  page,
  totalPages,
  fmtDate,
  onPrev,
  onNext,
}: Props) {
  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="px-4 py-2.5">订单号</TableHead>
              <TableHead className="px-4 py-2.5">用户</TableHead>
              <TableHead className="px-4 py-2.5">商品</TableHead>
              <TableHead className="px-4 py-2.5 text-right">金额</TableHead>
              <TableHead className="px-4 py-2.5 text-right">佣金</TableHead>
              <TableHead className="px-4 py-2.5">状态</TableHead>
              <TableHead className="px-4 py-2.5">时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  暂无分销订单
                </TableCell>
              </TableRow>
            ) : (
              items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="px-4 py-2.5 font-medium">
                    {it.orderNo ?? it.orderId ?? it.id}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">
                    {it.userNickname ?? it.userId ?? '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">
                    {it.productName ?? '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    {fmtYuan(it.orderAmount ?? it.amount ?? 0)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'px-4 py-2.5 text-right font-medium',
                      (it.commissionAmount ?? 0) >= 0
                        ? 'text-emerald-600 dark:text-emerald-500'
                        : 'text-red-600 dark:text-red-500',
                    )}
                  >
                    {fmtYuan(it.commissionAmount ?? 0)}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                        STATUS_CLS[it.status] ?? 'bg-muted text-muted-foreground',
                      )}
                    >
                      {STATUS_LABEL[it.status] ?? it.status}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">
                    {fmtDate(it.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">共 {total} 条</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={onPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={onNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
