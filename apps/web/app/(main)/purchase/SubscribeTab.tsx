// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 统一购买页 — 订阅 Tab(2026-09-16 立)。
 *
 * 展示:
 * 1. 当前订阅(套餐名 / 有效期 / 窗口额度进度 / 重置倒计时)
 * 2. 在售套餐卡片(价格 + 划线原价 + 有效期 + 日/周/月限额 + 权益 + 模型白名单)
 * 3. 订阅/续费入口(走既有 subscribeApiPlan → checkoutUrl,不改支付链路)
 *
 * 窗口额度口径见 apps/api 的 subscription-window-service(UTC+8 日/周/月)。
 */
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Building2, Check, Loader2, Sparkles, Zap } from 'lucide-react'

import { Button, Card, CardContent } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import {
  fetchApiSubscriptionPlans,
  subscribeApiPlan,
  type PlanInfo,
  type SubscriptionWindowStatus,
} from '@/lib/api-client-subscriptions'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { formatCents, formatCountdown, formatDate, formatTokens, windowPercent } from './helpers'

type WindowType = SubscriptionWindowStatus['windowType']

/** i18n 静态映射(i18n 守门:禁止 windowType 动态拼 key) */
const WINDOW_LABEL_KEY: Record<WindowType, string> = {
  daily: 'dailyWindow',
  weekly: 'weeklyWindow',
  monthly: 'monthlyWindow',
}

/** 订阅方案图标(按名称关键词;与既有订阅页口径一致) */
function planIcon(name: string): React.ReactNode {
  if (name.includes('Enterprise')) return <Building2 className="h-5 w-5" aria-hidden />
  if (name.includes('Pro')) return <Zap className="h-5 w-5" aria-hidden />
  return <Sparkles className="h-5 w-5" aria-hidden />
}

/** 单窗口额度行(标签 + 已用/上限 + 进度 + 重置倒计时)。 */
function WindowRow({ w }: { w: SubscriptionWindowStatus }) {
  const t = useTranslations('purchase')
  const unlimited = w.limit === -1
  const percent = windowPercent(w.used, w.limit)
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{t(WINDOW_LABEL_KEY[w.windowType])}</span>
        <span className="tabular-nums">
          {unlimited ? t('unlimited') : `${formatTokens(w.used)} / ${formatTokens(w.limit)}`}
        </span>
      </div>
      {!unlimited && w.limit > 0 && (
        <div className="h-1.5 w-full overflow-hidden rounded-sm bg-muted">
          <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        {t('resetsIn')} {formatCountdown(w.resetsInSeconds)}
      </p>
    </div>
  )
}

/** 套餐卡片。 */
function PlanCard({
  plan,
  isCurrent,
  pending,
  onSubscribe,
}: {
  plan: PlanInfo
  isCurrent: boolean
  pending: boolean
  onSubscribe: (planId: string) => void
}) {
  const t = useTranslations('purchase')
  const hasOriginal = plan.originalPrice > 0 && plan.originalPrice > plan.price
  const limits = [
    { labelKey: 'dailyWindow', value: plan.dailyTokenLimit },
    { labelKey: 'weeklyWindow', value: plan.weeklyTokenLimit },
    { labelKey: 'monthlyWindow', value: plan.monthlyTokenLimit },
  ].filter((x) => x.value !== 0)

  return (
    <Card className={cn('flex flex-col', isCurrent && 'border-emerald-500/40 bg-emerald-500/5')}>
      <CardContent className="min-[640px]:p-3 flex flex-1 flex-col gap-3 p-3">
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-muted p-1.5">{planIcon(plan.name)}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{plan.name}</p>
            <p className="text-xs text-muted-foreground">
              {t('validityDays', { days: plan.validityDays })}
            </p>
          </div>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-medium tabular-nums">{formatCents(plan.price)}</span>
          {hasOriginal && (
            <span className="text-xs text-muted-foreground line-through tabular-nums">
              {formatCents(plan.originalPrice)}
            </span>
          )}
          <span className="text-xs text-muted-foreground">/{plan.billingPeriod}</span>
        </div>

        {limits.length > 0 && (
          <ul className="space-y-1 text-xs">
            {limits.map((l) => (
              <li key={l.labelKey} className="flex items-center justify-between">
                <span className="text-muted-foreground">{t(l.labelKey)}</span>
                <span className="tabular-nums">
                  {l.value === -1 ? t('unlimited') : formatTokens(l.value)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {plan.features.length > 0 && (
          <ul className="flex-1 space-y-1.5">
            {plan.features.map((f, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs">
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" aria-hidden />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-muted-foreground">
          {plan.modelWhitelist.length > 0
            ? t('modelWhitelist', { count: plan.modelWhitelist.length })
            : t('allModels')}
        </p>

        <Button
          size="sm"
          className="w-full"
          disabled={isCurrent || pending}
          onClick={() => onSubscribe(plan.id)}
        >
          {isCurrent ? <span>{t('currentPlan')}</span> : <span>{t('subscribeNow')}</span>}
        </Button>
      </CardContent>
    </Card>
  )
}

export function SubscribeTab() {
  const t = useTranslations('purchase')
  const router = useRouter()
  const toast = useToast()

  const { data, isLoading, error } = useQuery({
    queryKey: ['purchase', 'subscriptions'],
    queryFn: async () => {
      const r = await fetchApiSubscriptionPlans()
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  const subscribeMutation = useMutation({
    mutationFn: async (planId: string) => {
      const r = await subscribeApiPlan(planId, 'wechat')
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: (res) => {
      toast.success(t('orderCreated', { orderNo: res.orderNo }))
      router.push(res.checkoutUrl)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const plans: PlanInfo[] = data?.plans ?? []
  const status = data?.status
  const activePlan = status?.activePlan
  const subscription = status?.subscription
  const windows = status?.windows ?? []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        <span>{t('loading')}</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && <Alert variant="danger" description={(error as Error).message} />}

      {subscription ? (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="min-[640px]:p-3 space-y-3 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600">
                  {t('currentSubscription')}
                </span>
                <span className="text-sm font-medium">{subscription.planName}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {t('expiresAt')} {formatDate(subscription.endAt)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('remaining')}{' '}
              <span className="font-medium tabular-nums">
                {status?.remainingTokens === -1
                  ? t('unlimited')
                  : formatTokens(status?.remainingTokens ?? 0)}
              </span>
            </p>
            {windows.length > 0 && (
              <div className="grid gap-3 min-[640px]:grid-cols-3">
                {windows.map((w) => (
                  <WindowRow key={w.windowType} w={w} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">{t('noSubscription')}</p>
      )}

      {plans.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t('noPlans')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrent={activePlan?.id === plan.id}
              pending={subscribeMutation.isPending}
              onSubscribe={(id) => subscribeMutation.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
