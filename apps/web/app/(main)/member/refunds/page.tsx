'use client'

import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { RotateCcw, Loader2, Clock, CheckCircle, XCircle, Wallet } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent } from '@ihui/ui'
import { Alert } from '@/components/feedback'
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

const STATUS_CONFIG: Record<RefundStatus, { icon: typeof Clock; cls: string }> = {
  pending: {
    icon: Clock,
    cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  },
  approved: {
    icon: CheckCircle,
    cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  },
  rejected: { icon: XCircle, cls: 'bg-red-500/10 text-red-600 dark:text-red-500' },
  completed: { icon: Wallet, cls: 'bg-primary/10 text-primary' },
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function MemberRefundsPage() {
  const t = useTranslations('memberRefundsPage')
  const locale = useLocale()
  const { data, isLoading, error } = useQuery({
    queryKey: ['member', 'refunds'],
    queryFn: () =>
      api<{ list: RefundItem[] }>('/api/refunds/me')
        .then((d) => d.list ?? [])
        .catch(() => [] as RefundItem[]),
  })

  const items = data ?? []
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const currencyFmt = new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <RotateCcw className="h-5 w-5 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {error && <Alert variant="danger" description={(error as Error).message} />}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
          <RotateCcw className="h-8 w-8 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
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
                      {t(`status.${item.status}`)}
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
                    <p className="truncate text-xs text-muted-foreground">{t('reason', { reason: item.reason })}</p>
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
