'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { Crown, Check, Loader2, ArrowUp, Sparkles } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, Button } from '@ihui/ui'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

interface VipLevel {
  id: string
  levelName: string
  levelValue: number
  price: number
  durationDays: number
  benefits: string[]
  status: number
}

interface MyVip {
  levelName?: string
  levelValue: number
  endTime: string
  status: number
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const formatCNY = (cents: number) =>
  new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(cents / 100)

export default function MemberUpgradePage() {
  const locale = useLocale()

  const levelsQ = useQuery({
    queryKey: ['member', 'upgrade-levels'],
    queryFn: () =>
      api<{ items: VipLevel[] }>('/api/vip/levels')
        .then((d) => d.items ?? [])
        .catch(() => [] as VipLevel[]),
  })
  const myQ = useQuery({
    queryKey: ['member', 'upgrade-my'],
    queryFn: () =>
      api<{ vip: MyVip | null }>('/api/vip/my')
        .then((d) => d.vip)
        .catch(() => null),
  })

  const levels = levelsQ.data ?? []
  const myVip = myQ.data
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const popularIdx = levels.length > 1 ? Math.floor(levels.length / 2) : 0

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <ArrowUp className="h-5 w-5 text-primary" />
          会员升级
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">选择适合你的会员等级,解锁更多权益</p>
      </div>

      {myVip && (
        <Card className="border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/10">
          <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">当前等级</p>
              <p className="flex items-center gap-1.5 font-semibold">
                <Crown className="h-4 w-4 text-amber-500" />
                {myVip.levelName ?? '会员'}
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs',
                    myVip.status === 1
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {myVip.status === 1 ? '生效中' : '已过期'}
                </span>
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              到期:{dateFmt.format(new Date(myVip.endTime))}
            </p>
          </CardContent>
        </Card>
      )}

      {levelsQ.error && <Alert variant="danger" description={(levelsQ.error as Error).message} />}

      {levelsQ.isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      ) : levels.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
          <Crown className="h-8 w-8 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">暂无可选会员等级</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:items-start">
          {levels.map((level, idx) => {
            const isPopular = idx === popularIdx
            const benefits = Array.isArray(level.benefits) ? level.benefits : []
            const isCurrent = myVip?.levelValue === level.levelValue
            return (
              <Card
                key={level.id}
                className={cn(
                  'relative flex flex-col transition-shadow',
                  isPopular && 'border-amber-500/50 shadow-lg lg:scale-105',
                )}
              >
                {isPopular && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-medium text-white shadow">
                    <Sparkles className="mr-1 inline h-2.5 w-2.5" />
                    推荐
                  </span>
                )}
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">{level.levelName}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col p-4 pt-0">
                  <div className="mb-3 flex items-baseline gap-1">
                    <span className="text-2xl font-bold">{formatCNY(level.price)}</span>
                    <span className="text-xs text-muted-foreground">/{level.durationDays}天</span>
                  </div>
                  {benefits.length > 0 && (
                    <ul className="mb-3 space-y-1.5 text-sm">
                      {benefits.map((b, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-auto pt-2">
                    {isCurrent ? (
                      <Button variant="outline" className="w-full" disabled>
                        当前等级
                      </Button>
                    ) : (
                      <Button
                        asChild
                        className="w-full"
                        variant={isPopular ? 'default' : 'outline'}
                      >
                        <Link href={`/vip/details?levelId=${level.id}`}>
                          {myVip && level.levelValue > myVip.levelValue ? '立即升级' : '立即订阅'}
                        </Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
