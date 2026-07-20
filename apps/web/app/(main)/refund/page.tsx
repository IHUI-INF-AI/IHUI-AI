'use client'

import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2, RotateCcw } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { formatDate } from '@/lib/date-utils'

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

type StatusKey = RefundItem['status']

export default function RefundPage() {
  const t = useTranslations('refund')
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
    return Number.isNaN(d.getTime()) ? '-' : formatDate(d)
  }

  const STATUS_LABEL: Record<StatusKey, string> = {
    pending: t('listStatusPending'),
    approved: t('listStatusApproved'),
    rejected: t('listStatusRejected'),
    completed: t('listStatusCompleted'),
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <RotateCcw className="h-6 w-6 text-primary" />
            {t('listTitle')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('listSubtitle')}</p>
        </div>
        <Button>
          <RotateCcw className="h-4 w-4" />
          {t('listApply')}
        </Button>
      </header>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t('listLoading')}
            </div>
          ) : list.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">{t('listEmpty')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="px-4 py-2.5">{t('listOrderNo')}</TableHead>
                  <TableHead className="px-4 py-2.5 text-right">{t('listAmount')}</TableHead>
                  <TableHead className="px-4 py-2.5">{t('listStatus')}</TableHead>
                  <TableHead className="px-4 py-2.5">{t('listApplyTime')}</TableHead>
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
