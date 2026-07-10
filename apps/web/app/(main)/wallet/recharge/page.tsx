'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Input, Label, Card, CardContent, CardHeader, CardTitle, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@ihui/ui'

const rechargeSchema = z.object({
  amount: z.coerce.number().int().min(1, 'wallet.rechargeAmount'),
  method: z.enum(['wechat', 'alipay']),
})

type RechargeValues = z.infer<typeof rechargeSchema>

interface PaymentCreateData {
  outTradeNo: string
  mock?: boolean
}

export default function RechargePage() {
  const t = useTranslations('wallet')
  const router = useRouter()
  const [submitting, setSubmitting] = React.useState(false)
  const [serverError, setServerError] = React.useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RechargeValues>({
    resolver: zodResolver(rechargeSchema),
    defaultValues: { amount: 0, method: 'wechat' },
  })

  const method = watch('method')

  const onSubmit = async (values: RechargeValues) => {
    setServerError(null)
    setSubmitting(true)
    try {
      const url =
        values.method === 'wechat'
          ? `/api/payments/wechat/create?amount=${values.amount}&openId=mock`
          : `/api/payments/alipay/create?amount=${values.amount}`
      const r = await fetchApi<PaymentCreateData>(url, { method: 'POST' })
      if (r.success) {
        router.push(`/wallet/recharge/success?orderNo=${r.data.outTradeNo}`)
      } else {
        setServerError(r.error)
        router.push('/wallet/recharge/fail?orderNo=')
      }
    } catch (err) {
      setServerError(err instanceof Error ? err.message : t('rechargeFailDesc'))
      router.push('/wallet/recharge/fail?orderNo=')
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

      <h1 className="text-2xl font-bold tracking-tight">{t('rechargeTitle')}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('rechargeTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {serverError && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {serverError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="amount">{t('rechargeAmount')}</Label>
              <Input
                id="amount"
                type="number"
                min={1}
                step={1}
                placeholder={t('rechargeAmount')}
                {...register('amount')}
              />
              {errors.amount && (
                <p className="text-xs text-destructive">{t('rechargeAmount')}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t('rechargeMethod')}</Label>
              <Select
                value={method}
                onValueChange={(v) => setValue('method', v as 'wechat' | 'alipay')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wechat">{t('methodWechat')}</SelectItem>
                  <SelectItem value="alipay">{t('methodAlipay')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('rechargeBtn')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
