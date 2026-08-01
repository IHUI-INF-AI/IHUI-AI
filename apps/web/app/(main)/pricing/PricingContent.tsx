'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Check, Crown, Loader2, Sparkles } from 'lucide-react'
import { Button, Card, CardContent } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { SocialProof } from './SocialProof'
import { ComparisonTable } from './ComparisonTable'
import { Testimonials } from './Testimonials'
import { Guarantee } from './Guarantee'

interface VipBenefits {
  dailyTokenLimit?: number | null
  monthlyTokenLimit?: number | null
  dailyCostLimit?: number | null
  monthlyCostLimit?: number | null
  apiQps?: number | null
  concurrency?: number | null
  modelWhitelist?: string[] | null
}

interface VipLevel {
  id: string
  levelName: string
  levelValue: number
  price: number
  durationDays: number
  benefits: VipBenefits
  status: number
  sortOrder: number
}

interface VipLevelsResponse {
  items: VipLevel[]
}

async function fetchVipLevels(): Promise<VipLevel[]> {
  const r = await fetchApi<VipLevelsResponse>(`/api/vip/levels`)
  if (!r.success || !r.data?.items) {
    throw new Error(r.error ?? '加载 VIP 定价失败')
  }
  return r.data.items
}

const formatCNY = (cents: number) =>
  new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(cents / 100)

const TIER_BADGE: Record<number, string> = {
  0: '免费',
  1: '个人',
  2: '团队',
  3: '企业',
}

const BENEFIT_ROWS: Array<{ key: keyof VipBenefits; label: string; suffix?: string }> = [
  { key: 'dailyTokenLimit', label: '每日 Token', suffix: ' / 天' },
  { key: 'monthlyTokenLimit', label: '每月 Token', suffix: ' / 月' },
  { key: 'dailyCostLimit', label: '每日消费上限', suffix: ' 元' },
  { key: 'monthlyCostLimit', label: '每月消费上限', suffix: ' 元' },
  { key: 'apiQps', label: 'API QPS' },
  { key: 'concurrency', label: '并发数' },
]

export function PricingContent(): React.JSX.Element {
  const [yearly, setYearly] = React.useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['pricing-vip-levels'],
    queryFn: fetchVipLevels,
  })

  const levels = React.useMemo(() => {
    if (!data) return []
    return [...data]
      .filter((l) => l.status === 1)
      .sort((a, b) => a.levelValue - b.levelValue)
  }, [data])

  // 推荐档:非免费档中的第一档(通常是个人档)
  const popularIdx = levels.findIndex((l) => l.levelValue === 1)

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 min-[768px]:px-8 min-[768px]:py-14">
      <section className="space-y-3 text-center">
        <div className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          VIP 会员权益
        </div>
        <h1 className="text-2xl min-[768px]:text-3xl min-[1024px]:text-4xl font-bold tracking-tight">选择适合你的方案</h1>
        <p className="mx-auto max-w-2xl text-sm text-muted-foreground min-[768px]:text-base">
          4 档 VIP 会员,从免费到企业级,满足不同使用场景。年付享 2 个月免费。
        </p>
      </section>

      <SocialProof />

      {/* 月付/年付切换 */}
      <section className="mt-8 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setYearly(false)}
          className={cn(
            'rounded-md px-4 py-1.5 text-sm transition-colors',
            !yearly
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          月付
        </button>
        <button
          type="button"
          onClick={() => setYearly(true)}
          className={cn(
            'rounded-md px-4 py-1.5 text-sm transition-colors',
            yearly
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          年付
          <span className="ml-1 text-xs text-emerald-600">省 2 个月</span>
        </button>
      </section>

      {/* 4 档对比卡片 */}
      <section className="mt-8 grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-4 min-[1024px]:items-start">
        {isLoading ? (
          <div className="col-span-full flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            加载中...
          </div>
        ) : error ? (
          <div className="col-span-full rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {(error as Error).message}
          </div>
        ) : levels.length === 0 ? (
          <div className="col-span-full rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
            暂无定价方案
          </div>
        ) : (
          levels.map((level, idx) => {
            const isPopular = idx === popularIdx
            const isFree = level.levelValue === 0
            const monthlyPrice = level.price
            const displayPrice = isFree ? 0 : yearly ? monthlyPrice * 10 : monthlyPrice
            const benefits = level.benefits ?? {}
            const whitelistCount = benefits.modelWhitelist?.length ?? 0

            return (
              <Card
                key={level.id}
                className={cn(
                  'relative flex flex-col',
                  isPopular && 'border-primary shadow-md min-[1024px]:scale-[1.02]',
                )}
              >
                {isPopular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                    <Sparkles className="mr-1 inline h-3 w-3" />
                    推荐
                  </span>
                )}
                <CardContent className="flex flex-1 flex-col p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">{level.levelName}</h2>
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {TIER_BADGE[level.levelValue] ?? ''}
                    </span>
                  </div>

                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-xl font-bold tracking-tight min-[768px]:text-2xl text-primary">
                      {isFree ? '免费' : formatCNY(displayPrice)}
                    </span>
                    {!isFree && (
                      <span className="text-sm text-muted-foreground">/ {yearly ? '年' : '月'}</span>
                    )}
                  </div>

                  <ul className="mt-5 flex-1 min-w-0 space-y-2 text-sm">
                    {BENEFIT_ROWS.map(({ key, label, suffix }) => {
                      const val = benefits[key]
                      if (val === null || val === undefined) return null
                      return (
                        <li key={key} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          <span className="text-muted-foreground">{label}:</span>
                          <span className="font-medium">
                            {val}
                            {suffix ?? ''}
                          </span>
                        </li>
                      )
                    })}
                    <li className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      <span className="text-muted-foreground">模型白名单:</span>
                      <span className="font-medium">
                        {whitelistCount === 0 ? '全部模型' : `${whitelistCount} 个模型`}
                      </span>
                    </li>
                  </ul>

                  <Button
                    asChild
                    variant={isPopular ? 'default' : 'outline'}
                    className="mt-5 w-full"
                  >
                    <Link href="/vip">
                      <Crown className="mr-1 h-4 w-4" />
                      立即订阅
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })
        )}
      </section>

      <section className="mt-10 rounded-md border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
        所有方案均含完整 API 接入权限,企业版支持定制 SLA 与私有部署。
      </section>

      <ComparisonTable />

      <Testimonials />

      <Guarantee />

      <section className="mt-14 rounded-lg border border-primary/30 bg-primary/5 p-8 text-center">
        <h2 className="text-xl font-bold tracking-tight text-foreground min-[768px]:text-2xl">
          还不确定?免费试用 30 天
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          无需信用卡,全功能体验。30 天内不满意可申请全额退款。
        </p>
        <Button asChild className="mt-5">
          <Link href="/register">
            <Sparkles className="mr-1 h-4 w-4" />
            立即免费试用
          </Link>
        </Button>
      </section>
    </main>
  )
}
