'use client'

import { Loader2 } from 'lucide-react'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@ihui/ui-react'
import type { FundAccount } from './types'
import { formatDate } from '@/lib/date-utils'

interface Props {
  accounts: FundAccount[]
  isLoading: boolean
}

export function FundsAccountsTable({ accounts, isLoading }: Props) {
  return (
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
          {isLoading ? (
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
                <TableCell className="text-amber-600">¥{(a.frozen / 100).toFixed(2)}</TableCell>
                <TableCell className="text-emerald-600">
                  ¥{(a.totalRecharge / 100).toFixed(2)}
                </TableCell>
                <TableCell className="text-red-600">¥{(a.totalConsume / 100).toFixed(2)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDate(a.updatedAt)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
