import Link from 'next/link'
import { Check } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { cn } from '@/lib/utils'

const PLANS = [
  {
    name: '免费版',
    price: '¥0',
    period: '永久免费',
    desc: '适合个人体验',
    features: ['每日 20 次 AI 对话', '基础模型支持', '社区支持', '100MB 存储空间'],
    cta: '免费开始',
    href: '/register',
    popular: false,
  },
  {
    name: '专业版',
    price: '¥99',
    period: '/月',
    desc: '适合专业用户',
    features: [
      '无限 AI 对话',
      '全部模型支持',
      '优先技术支持',
      '10GB 存储空间',
      '团队协作功能',
      'API 访问',
    ],
    cta: '立即升级',
    href: '/vip',
    popular: true,
  },
  {
    name: '企业版',
    price: '定制',
    period: '联系销售',
    desc: '适合企业团队',
    features: [
      '专属模型部署',
      'SLA 99.9% 保障',
      '专属客户经理',
      '无限存储空间',
      'SSO 单点登录',
      '定制化开发',
    ],
    cta: '联系我们',
    href: '/about',
    popular: false,
  },
]

export function PricingSection() {
  return (
    <section className="bg-muted/30 py-20">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">定价方案</h2>
          <p className="mt-4 text-muted-foreground">选择最适合你的方案</p>
        </div>
        <div className="mt-12 grid gap-6 lg:grid-cols-3 lg:items-start">
          {PLANS.map((plan) => (
            <Card
              key={plan.name}
              className={cn(
                'relative flex flex-col transition-shadow',
                plan.popular && 'border-primary shadow-lg lg:scale-105',
              )}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground shadow">
                  热门
                </span>
              )}
              <CardHeader className="p-6 pb-3">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <p className="text-xs text-muted-foreground">{plan.desc}</p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col p-6 pt-0">
                <div className="mb-4 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </div>
                <ul className="mb-6 space-y-2 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-4">
                  <Button asChild className="w-full" variant={plan.popular ? 'default' : 'outline'}>
                    <Link href={plan.href}>{plan.cta}</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
