'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Crown, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

import { fetchApi } from '@/lib/api'
import { formatDate } from '@/lib/date-utils'
import {
  Button,
  Label,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'

const renewSchema = z.object({
  planId: z.string().min(1, '请选择订阅方案'),
  paymentMethod: z.enum(['wechat', 'alipay']),
})

type RenewValues = z.infer<typeof renewSchema>

interface SubscriptionPlan {
  id: string
  name: string
  price: number
  duration: number
}

interface SubscriptionStatus {
  isVip: boolean
  vipLevel?: string
  expireTime?: string
  autoRenew?: boolean
  plans?: SubscriptionPlan[]
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
  }).format(cents / 100)
}

export default function SubscriptionPage() {
  const t = useTranslations('user')
  const qc = useQueryClient()

  const { data: status, isLoading } = useQuery({
    queryKey: ['payments', 'subscription', 'status'],
    queryFn: () => api<SubscriptionStatus>('/api/payments/subscription/status'),
  })

  const {
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RenewValues>({
    resolver: zodResolver(renewSchema),
    defaultValues: { planId: '', paymentMethod: 'wechat' },
  })

  const planId = watch('planId')
  const paymentMethod = watch('paymentMethod')

  const onSubmit = async (values: RenewValues) => {
    try {
      const r = await fetchApi('/api/payments/subscription/renew', {
        method: 'POST',
        body: JSON.stringify(values),
      })
      if (r.success) {
        toast.success(t('subscription.success'))
        qc.invalidateQueries({
          queryKey: ['payments', 'subscription', 'status'],
        })
      } else {
        toast.error(r.error)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('subscription.error'))
    }
  }

  const plans = status?.plans ?? []
  const isVip = status?.isVip ?? false

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Crown className="h-6 w-6 text-amber-500" />
          {t('subscription.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subscription.subtitle')}</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('subscription.loading')}
        </div>
      ) : (
        <>
          {/* 状态卡片 */}
          {isVip ? (
            <Card className="border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                  <Crown className="h-6 w-6 text-emerald-600 dark:text-emerald-500" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t('subscription.current')}</p>
                  <p className="text-lg font-semibold">
                    {status?.vipLevel ?? 'VIP'} {t('subscription.activated')}
                  </p>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span>
                      {t('subscription.expireTime')}：
                      {status?.expireTime ? formatDate(status.expireTime) : '-'}
                    </span>
                    <span className="flex items-center gap-1">
                      {t('subscription.autoRenew')}：
                      {status?.autoRenew ? (
                        <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-500">
                          <Check className="h-3 w-3" />
                          {t('subscription.autoRenewOn')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                          <X className="h-3 w-3" />
                          {t('subscription.autoRenewOff')}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-muted">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Crown className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-semibold">{t('subscription.notSubscribed')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('subscription.notSubscribedHint')}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 续费/订阅表单 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {isVip ? t('subscription.renewTitle') : t('subscription.openTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('subscription.plan')}</Label>
                  <Select value={planId} onValueChange={(v) => setValue('planId', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('subscription.planPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name} - {formatPrice(plan.price)} / {plan.duration}
                          {t('subscription.days')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.planId && (
                    <p className="text-xs text-destructive">{errors.planId.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>{t('subscription.paymentMethod')}</Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={(v) => setValue('paymentMethod', v as 'wechat' | 'alipay')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wechat">{t('subscription.wechat')}</SelectItem>
                      <SelectItem value="alipay">{t('subscription.alipay')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isVip ? t('subscription.renewNow') : t('subscription.openNow')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
