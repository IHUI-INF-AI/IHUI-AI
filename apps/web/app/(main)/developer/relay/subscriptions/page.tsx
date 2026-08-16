'use client'

import * as React from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, Loader2, Sparkles, Zap, Building2 } from 'lucide-react'
import { Card, CardContent, Button } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'
import { BackButton } from '@/components/common'
import {
  fetchApiSubscriptionPlans,
  subscribeApiPlan,
  type PlanInfo,
} from '@/lib/api-client-subscriptions'

/** 订阅方案图标映射(按 sortOrder:1=Starter/2=Pro/3=Enterprise)。 */
function planIcon(name: string): React.ReactNode {
  if (name.includes('Enterprise')) return <Building2 className="h-5 w-5" />
  if (name.includes('Pro')) return <Zap className="h-5 w-5" />
  return <Sparkles className="h-5 w-5" />
}

/** 价格(分)→ 显示字符串。 */
function formatPrice(cents: number): string {
  return `¥${(cents / 100).toFixed(0)}`
}

/** 剩余 token 显示(-1 = 无限)。 */
function formatTokens(n: number): string {
  if (n === -1) return '无限'
  if (n >= 10000) return `${(n / 10000).toFixed(1)} 万`
  return n.toLocaleString()
}

export default function RelaySubscriptionsPage() {
  const router = useRouter()

  const { data, isLoading, error } = useQuery({
    queryKey: ['developer', 'relay', 'subscriptions'],
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
    onSuccess: (data) => {
      toast.success(`已创建订单 ${data.orderNo}`)
      router.push(data.checkoutUrl)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const plans: PlanInfo[] = data?.plans ?? []
  const status = data?.status
  const activePlan = status?.activePlan

  return (
    <div className="space-y-4">
      <BackButton />
      <div>
        <h1 className="text-2xl font-bold tracking-tight">API 订阅</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          选择适合的订阅方案,token 配额自动写入你的活跃 API Key
        </p>
      </div>

      {error && <Alert variant="danger" description={(error as Error).message} />}

      {activePlan && (
        <Card className="bg-emerald-500/5 border-emerald-500/30">
          <CardContent className="flex items-center justify-between gap-3 p-3 min-[640px]:p-3">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                当前订阅
              </span>
              <span className="text-sm font-medium">{activePlan.name}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              剩余{' '}
              <span className="font-semibold tabular-nums">
                {formatTokens(status?.remainingTokens ?? 0)}
              </span>{' '}
              token
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          加载中...
        </div>
      ) : plans.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">暂无可订阅方案</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = activePlan?.id === plan.id
            return (
              <Card
                key={plan.id}
                className={cn(
                  'flex flex-col',
                  isCurrent && 'border-emerald-500/40 bg-emerald-500/5',
                )}
              >
                <CardContent className="flex flex-1 flex-col gap-3 p-4">
                  <div className="flex items-center gap-2">
                    <div className="rounded-md bg-muted p-1.5">{planIcon(plan.name)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{plan.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {plan.billingPeriod === 'month' ? '月付' : plan.billingPeriod}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold tabular-nums">
                      {formatPrice(plan.price)}
                    </span>
                    <span className="text-xs text-muted-foreground">/月</span>
                  </div>

                  {plan.description && (
                    <p className="text-xs text-muted-foreground">{plan.description}</p>
                  )}

                  <ul className="flex-1 min-w-0 space-y-1.5">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs">
                        <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    size="sm"
                    className="w-full"
                    disabled={isCurrent || subscribeMutation.isPending}
                    onClick={() => subscribeMutation.mutate(plan.id)}
                  >
                    {isCurrent ? '当前方案' : '订阅'}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
