import * as React from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, Sparkles } from 'lucide-react'
import { Button } from '@ihui/ui'

export const metadata: Metadata = {
  title: '定价方案',
  description:
    '智汇 AI 社区会员定价:早鸟价 ¥6000/人/年,原价 ¥18000。全年所有课程免费参加,探索活动优先参与,社群互助无限次。',
}

interface Plan {
  name: string
  price: string
  originalPrice?: string
  period: string
  desc: string
  features: string[]
  cta: string
  ctaHref: string
  highlighted?: boolean
}

const PLANS: Plan[] = [
  {
    name: '早鸟会员',
    price: '¥6000',
    originalPrice: '¥18000',
    period: '/人/年',
    desc: '限前 18 席,售完即恢复原价',
    features: [
      '全年所有课程免费参加',
      '探索活动优先参与',
      '社群互助无限次',
      '线上社群专属入口',
      'AI 助手优先体验',
      '不满意全额退款',
    ],
    cta: '立即加入',
    ctaHref: '/support?source=pricing',
    highlighted: true,
  },
  {
    name: '标准会员',
    price: '¥18000',
    period: '/人/年',
    desc: '早鸟售罄后自动切换至此方案',
    features: [
      '全年所有课程免费参加',
      '探索活动优先参与',
      '社群互助无限次',
      '线上社群专属入口',
      'AI 助手优先体验',
    ],
    cta: '了解详情',
    ctaHref: '/support?source=pricing-standard',
  },
  {
    name: '企业服务',
    price: '商务洽谈',
    period: '',
    desc: '面向企业决策者团队的定制方案',
    features: [
      '团队多席位套餐',
      '一对一 AI 顾问咨询',
      '企业 AI 文化落地陪跑',
      '专属定制课程',
      '私享闭门活动',
    ],
    cta: '联系商务',
    ctaHref: '/contact?source=pricing-enterprise',
  },
]

export default function PricingPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-12 md:px-8 md:py-16">
      {/* Hero */}
      <section className="space-y-4 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          会员定价
        </div>
        <h1 className="text-3xl font-bold tracking-tight md:text-5xl">选择适合你的方案</h1>
        <p className="mx-auto max-w-2xl text-base text-muted-foreground md:text-lg">
          早鸟价 ¥6000/人/年,限 18 席。所有方案均享受不满意全额退款保障。
        </p>
      </section>

      {/* 定价卡片 */}
      <section className="mt-16 grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={`relative flex flex-col rounded-2xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md ${
              plan.highlighted ? 'border-primary ring-2 ring-primary/20' : ''
            }`}
          >
            {plan.highlighted && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                限时早鸟
              </div>
            )}
            <h2 className="text-lg font-semibold">{plan.name}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{plan.desc}</p>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-primary md:text-4xl">
                {plan.price}
              </span>
              {plan.originalPrice && (
                <span className="text-sm text-muted-foreground line-through">
                  {plan.originalPrice}
                </span>
              )}
              {plan.period && <span className="text-sm text-muted-foreground">{plan.period}</span>}
            </div>
            <ul className="mt-6 flex-1 space-y-2">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Button
              size="lg"
              variant={plan.highlighted ? 'default' : 'outline'}
              asChild
              className="mt-6 w-full"
            >
              <Link href={plan.ctaHref}>{plan.cta}</Link>
            </Button>
          </div>
        ))}
      </section>

      {/* 退款保障 */}
      <section className="mt-12 rounded-2xl border bg-primary/5 p-6 text-center md:p-8">
        <h2 className="text-lg font-semibold">不满意全额退款保障</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          我们对所有会员承诺:若您在加入后任何时间觉得价值不达预期,可申请全额退款,无理由无门槛。
        </p>
      </section>
    </main>
  )
}
