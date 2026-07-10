'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { ArrowDownToLine, ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { fetchApi } from '@/lib/api'
import { Button, Input, Label, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'

interface AvailableData {
  available: number
}

interface WithdrawalSummaryData {
  totalWithdrawn: number
  pendingAmount: number
}

interface ApplyResult {
  id: string
  status: number
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const fmtYuan = (cents: number) => `¥${(cents / 100).toFixed(2)}`

export default function WithdrawPage() {
  const t = useTranslations('distribution')
  const tc = useTranslations('common')
  const router = useRouter()
  const [amount, setAmount] = React.useState('')

  const availableQ = useQuery({
    queryKey: ['distribution', 'withdrawal-available'],
    queryFn: () => api<AvailableData>('/api/finance/withdrawal/available'),
  })
  const summaryQ = useQuery({
    queryKey: ['distribution', 'withdrawal-summary'],
    queryFn: () => api<WithdrawalSummaryData>('/api/finance/withdrawal/summary'),
  })

  const applyMutation = useMutation({
    mutationFn: async (cents: number) => {
      const r = await fetchApi<ApplyResult>(`/api/finance/withdrawal/apply?amount=${cents}`, {
        method: 'POST',
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => {
      toast.success(t('withdrawSuccess'))
      availableQ.refetch()
      summaryQ.refetch()
      setAmount('')
      router.push('/distribution/withdraw/records')
    },
    onError: (err: Error) => {
      toast.error(err.message || t('withdrawFail'))
    },
  })

  const available = availableQ.data?.available ?? 0

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const yuan = parseFloat(amount)
    if (!Number.isFinite(yuan) || yuan <= 0) {
      toast.error(t('withdrawAmountInvalid'))
      return
    }
    const cents = Math.round(yuan * 100)
    if (cents > available) {
      toast.error(t('withdrawInsufficient'))
      return
    }
    applyMutation.mutate(cents)
  }

  const totalAmount = (summaryQ.data?.totalWithdrawn ?? 0) + (summaryQ.data?.pendingAmount ?? 0)
  const stats = [
    { label: t('totalWithdrawn'), value: fmtYuan(totalAmount) },
    { label: t('processingAmount'), value: fmtYuan(summaryQ.data?.pendingAmount ?? 0) },
    { label: t('completedAmount'), value: fmtYuan(summaryQ.data?.totalWithdrawn ?? 0) },
  ]

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <Link
        href="/distribution"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {tc('back')}
      </Link>

      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        <ArrowDownToLine className="h-7 w-7 text-primary" />
        {t('withdrawTitle')}
      </h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('availableTip')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted/40 px-4 py-3">
            <div className="text-xs text-muted-foreground">{t('availableAmount')}</div>
            {availableQ.isLoading ? (
              <Loader2 className="mt-1 h-5 w-5 animate-spin text-muted-foreground" />
            ) : availableQ.error ? (
              <div className="mt-1 text-sm text-destructive">{(availableQ.error as Error).message}</div>
            ) : (
              <div className="mt-1 text-2xl font-bold">{fmtYuan(available)}</div>
            )}
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">{t('withdrawAmount')}</Label>
              <Input
                id="amount"
                type="number"
                min={0.01}
                step={0.01}
                placeholder={t('withdrawAmountPlaceholder')}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <Button type="submit" className="w-full" disabled={applyMutation.isPending}>
              {applyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('withdrawBtn')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-base font-semibold">{t('withdrawSummary')}</h2>
        <div className="grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardContent className="space-y-1 p-4">
                <div className="text-xs text-muted-foreground">{s.label}</div>
                {summaryQ.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <div className="text-lg font-bold tracking-tight">{s.value}</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
