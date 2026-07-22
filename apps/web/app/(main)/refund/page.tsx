'use client'

import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { Loader2, RotateCcw, Clock, CheckCircle, XCircle, Wallet } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, Button } from '@ihui/ui'
import { cn } from '@/lib/utils'

type RefundStatus = 'pending' | 'approved' | 'rejected' | 'completed'

interface RefundItem {
  id: string
  orderNo: string
  refundAmount: string
  status: RefundStatus
  createdAt: string
  reason?: string | null
}

const STATUS_CONFIG: Record<RefundStatus, { icon: typeof Clock; cls: string; labelKey: string }> = {
  pending: {
    icon: Clock,
    cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
    labelKey: 'listStatusPending',
  },
  approved: {
    icon: CheckCircle,
    cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
    labelKey: 'listStatusApproved',
  },
  rejected: {
    icon: XCircle,
    cls: 'bg-red-500/10 text-red-600 dark:text-red-500',
    labelKey: 'listStatusRejected',
  },
  completed: {
    icon: Wallet,
    cls: 'bg-primary/10 text-primary',
    labelKey: 'listStatusCompleted',
  },
}

export default function RefundPage() {
  const t = useTranslations('refund')
  const locale = useLocale()
  const { data, isLoading, error } = useQuery({
    queryKey: ['refund'],
    queryFn: async () => {
      const r = await fetchApi<{ list: RefundItem[] }>('/api/refunds/me')
      if (r.success && r.data) return r.data.list ?? []
      return []
    },
  })

  const items = data ?? []
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const currencyFmt = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' })

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

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('listLoading')}
        </div>
      ) : error ? (
        <div className="py-10 text-center text-destructive">{(error as Error).message}</div>
      ) : items.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">{t('listEmpty')}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const sc = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending
            const StatusIcon = sc.icon
            return (
              <Card key={item.id} className="transition-colors hover:bg-accent">
                <CardContent className="space-y-2 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-muted-foreground">{item.orderNo}</span>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                        sc.cls,
                      )}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {t(sc.labelKey)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold text-primary">
                      {currencyFmt.format(Number(item.refundAmount))}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {dateFmt.format(new Date(item.createdAt))}
                    </span>
                  </div>
                  {item.reason && (
                    <p className="truncate text-xs text-muted-foreground">
                      {t('listReason', { reason: item.reason })}
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
