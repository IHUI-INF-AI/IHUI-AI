import * as React from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Mail, Phone, MapPin, Globe, MessageCircle, Sparkles } from 'lucide-react'
import { Button } from '@ihui/ui'

export const metadata: Metadata = {
  title: '联系我们',
  description:
    '联系智汇 AI 社区团队。商务合作、课程咨询、企业服务定制,欢迎通过微信、电话或邮件与我们取得联系。',
}

const CONTACTS = [
  {
    icon: MessageCircle,
    label: '微信咨询',
    value: 'ihui-ai(添加时备注"咨询")',
    href: '/support?source=contact',
  },
  {
    icon: Phone,
    label: '客服电话',
    value: '400-000-0000',
    href: 'tel:400-000-0000',
  },
  {
    icon: Mail,
    label: '商务邮箱',
    value: 'support@ihui.ai',
    href: 'mailto:support@ihui.ai',
  },
  {
    icon: Globe,
    label: '官方网站',
    value: 'https://www.ihui.ai',
    href: 'https://www.ihui.ai',
  },
]

export default function ContactPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12 md:px-8 md:py-16">
      {/* Hero */}
      <section className="space-y-4 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          联系我们
        </div>
        <h1 className="text-3xl font-bold tracking-tight md:text-5xl">与我们取得联系</h1>
        <p className="mx-auto max-w-2xl text-base text-muted-foreground md:text-lg">
          商务合作、课程咨询、企业服务定制,欢迎随时联系我们。我们的团队会在 24 小时内回复。
        </p>
      </section>

      {/* 联系方式 */}
      <section className="mt-16 grid gap-6 sm:grid-cols-2">
        {CONTACTS.map(({ icon: Icon, label, value, href }) => (
          <a
            key={label}
            href={href}
            className="group flex items-center gap-4 rounded-2xl border bg-card p-6 shadow-sm transition-all hover:border-primary hover:shadow-md"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="mt-1 truncate text-sm font-medium">{value}</div>
            </div>
          </a>
        ))}
      </section>

      {/* 公司地址 */}
      <section className="mt-12 rounded-2xl border bg-card p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">公司地址</h2>
            <p className="text-sm text-muted-foreground">吉林省爱智汇人工智能科技有限公司</p>
            <p className="text-sm text-muted-foreground">微信支付商户号:1714645682</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mt-12 rounded-2xl border bg-primary/5 p-8 text-center md:p-12">
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">立即加入智汇 AI 社区</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
          早鸟价 ¥6000/人/年,限 18 席。一对一 AI 顾问咨询,不满意全额退款。
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild>
            <Link href="/support?source=contact">立即加入</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/about">了解更多</Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
