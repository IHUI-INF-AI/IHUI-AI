'use client'

import { useQuery } from '@tanstack/react-query'
import { Loader2, RotateCcw } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Card,
  CardContent,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@ihui/ui'

interface RefundItem {
  id: string
  orderNo: string
  amount: number
  status: 'pending' | 'approved' | 'rejected' | 'completed'
  createdAt: string
}

const STATUS_LABEL: Record<RefundItem['status'], string> = {
  pending: '审核中',
  approved: '已通过',
  rejected: '已拒绝',
  completed: '已完成',
}

export default function RefundPage() {
  const { data: list = [], isLoading } = useQuery({
    queryKey: ['refund'],
    queryFn: async () => {
      const r = await fetchApi<RefundItem[]>('/api/refund')
      if (r.success && r.data) return r.data
      return []
    },
  })

  const fmtDate = (v: string) => {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString()
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <RotateCcw className="h-6 w-6 text-primary" />
            退款管理
          </h1>
          <p className="text-sm text-muted-foreground">查看退款记录并申请退款</p>
        </div>
        <Button>
          <RotateCcw className="h-4 w-4" />
          申请退款
        </Button>
      </header>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              加载中...
            </div>
          ) : list.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">暂无退款记录</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="px-4 py-2.5">订单号</TableHead>
                  <TableHead className="px-4 py-2.5 text-right">金额</TableHead>
                  <TableHead className="px-4 py-2.5">状态</TableHead>
                  <TableHead className="px-4 py-2.5">申请时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="px-4 py-2.5 font-medium">{item.orderNo}</TableCell>
                    <TableCell className="px-4 py-2.5 text-right">
                      ¥{item.amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      {STATUS_LABEL[item.status] ?? item.status}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-muted-foreground">
                      {fmtDate(item.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
