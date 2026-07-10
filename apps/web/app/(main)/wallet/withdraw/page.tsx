'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { fetchApi } from '@/lib/api'
import { Button, Input, Label, Card, CardContent, CardHeader, CardTitle, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@ihui/ui'

interface AvailableData {
  available: number
}

const withdrawSchema = z.object({
  amount: z.coerce.number().min(0.01, 'wallet.withdrawAmount'),
  method: z.enum(['wechat', 'alipay', 'bank']),
  accountInfo: z.string().min(1, 'wallet.withdrawMethod'),
})

type WithdrawValues = z.infer<typeof withdrawSchema>

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function WithdrawPage() {
  const t = useTranslations('wallet')
  const router = useRouter()
  const [submitting, setSubmitting] = React.useState(false)
  const [serverError, setServerError] = React.useState<string | null>(null)

  const availableQ = useQuery({
    queryKey: ['wallet', 'withdrawal', 'available'],
    queryFn: () => api<AvailableData>('/api/finance/withdrawal/available'),
  })

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<WithdrawValues>({
    resolver: zodResolver(withdrawSchema),
    defaultValues: { amount: 0, method: 'wechat', accountInfo: '' },
  })

  const method = watch('method')

  const onSubmit = async (values: WithdrawValues) => {
    setServerError(null)
    setSubmitting(true)
    try {
      const r = await fetchApi('/api/finance/withdrawal/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: values.amount,
          method: values.method,
          accountInfo: values.accountInfo,
        }),
      })
      if (r.success) {
        toast.success(t('withdrawSuccess'))
        router.push('/wallet/withdraw/records')
      } else {
        setServerError(r.error)
      }
    } catch (err) {
      setServerError(err instanceof Error ? err.message : t('rechargeFailDesc'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <Link
        href="/wallet"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToWallet')}
      </Link>

      <h1 className="text-2xl font-bold tracking-tight">{t('withdrawTitle')}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('withdrawTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted/40 px-4 py-3">
            <div className="text-xs text-muted-foreground">{t('availableAmount')}</div>
            {availableQ.isLoading ? (
              <Loader2 className="mt-1 h-5 w-5 animate-spin text-muted-foreground" />
            ) : availableQ.error ? (
              <div className="mt-1 text-sm text-destructive">{(availableQ.error as Error).message}</div>
            ) : (
              <div className="mt-1 text-2xl font-bold">{availableQ.data?.available ?? 0}</div>
            )}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {serverError && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {serverError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="amount">{t('withdrawAmount')}</Label>
              <Input
                id="amount"
                type="number"
                min={0.01}
                step={0.01}
                placeholder={t('withdrawAmount')}
                {...register('amount')}
              />
              {errors.amount && (
                <p className="text-xs text-destructive">{t('withdrawAmount')}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t('withdrawMethod')}</Label>
              <Select
                value={method}
                onValueChange={(v) => setValue('method', v as 'wechat' | 'alipay' | 'bank')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wechat">{t('methodWechat')}</SelectItem>
                  <SelectItem value="alipay">{t('methodAlipay')}</SelectItem>
                  <SelectItem value="bank">{t('methodBank')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountInfo">{t('withdrawMethod')}</Label>
              <Input
                id="accountInfo"
                placeholder={t('withdrawMethod')}
                {...register('accountInfo')}
              />
              {errors.accountInfo && (
                <p className="text-xs text-destructive">{t('withdrawMethod')}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('withdrawBtn')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
