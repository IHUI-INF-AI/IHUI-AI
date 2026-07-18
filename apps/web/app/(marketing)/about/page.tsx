import * as React from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, Target, Users, Shield, Rocket } from 'lucide-react'
import { Button } from '@ihui/ui'

export const metadata: Metadata = {
  title: '关于我们',
  description:
    '智汇 AI 社区是 AI 时代企业理性效率服务与互助社群,帮助决策者深度理解 AI 与企业的关系,构建人机协同的超级组织。',
}

const VALUES = [
  {
    icon: Target,
    title: '我们的使命',
    desc: '帮助决策者深度理解 AI 与企业的关系,推动企业理性效率提升。',
  },
  {
    icon: Users,
    title: '我们的社群',
    desc: '汇聚 AI 时代企业决策者,构建人机协同的超级组织,互助共进。',
  },
  {
    icon: Shield,
    title: '我们的承诺',
    desc: '不满意全额退款。前 18 位会员享受一对一 AI 顾问咨询。',
  },
  {
    icon: Rocket,
    title: '我们的方向',
    desc: '从 AI 新工具到企业 AI 文化,三阶段循序渐进,持续演进。',
  },
]

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12 md:px-8 md:py-16">
      {/* Hero */}
      <section className="space-y-4 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          关于智汇 AI
        </div>
        <h1 className="text-3xl font-bold tracking-tight md:text-5xl">AI 时代企业理性效率伙伴</h1>
        <p className="mx-auto max-w-2xl text-base text-muted-foreground md:text-lg">
          智汇 AI 社区是 AI 时代企业理性效率服务与互助社群。我们帮助决策者深度理解 AI 与企业的关系,
          构建人机协同的超级组织,实现企业的理性效率提升。
        </p>
      </section>

      {/* 价值观网格 */}
      <section className="mt-16 grid gap-6 sm:grid-cols-2">
        {VALUES.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="rounded-2xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">{title}</h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{desc}</p>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="mt-16 rounded-2xl border bg-primary/5 p-8 text-center md:p-12">
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">加入智汇 AI 社区</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
          仅限前 18 位会员 · 早鸟价 ¥6000/人/年 · 不满意全额退款
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild>
            <Link href="/support?source=about">立即加入</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/pricing">查看定价</Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
