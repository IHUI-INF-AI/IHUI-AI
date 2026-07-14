'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Target, Users, Globe, Bot, ArrowRight, ArrowLeft, Check, Sparkles } from 'lucide-react'

import { Button, Card, CardContent } from '@ihui/ui'
import { AnimatedNumber } from '@/components/common'
import { ArchitectureSection } from './sections/ArchitectureSection'
import { CompassSection } from './sections/CompassSection'
import { CoursesSection } from './sections/CoursesSection'
import { ToolsSection } from './sections/ToolsSection'

interface ServiceModule {
  icon: React.ComponentType<{ className?: string }>
  tag: string
  title: string
  description: string
  features: string[]
  featured?: boolean
}

const MODULES: ServiceModule[] = [
  {
    icon: Users,
    tag: 'MODULE 01',
    title: '在地社群',
    description: '线下课程、探索活动与互助社群,深度链接志同道合的决策者',
    features: ['系统化课程', '实践探索', '社群互助'],
  },
  {
    icon: Globe,
    tag: 'MODULE 02',
    title: '线上社群',
    description: '便捷的在线交流平台,随时随地获取信息与支持',
    features: ['交流平台', '经验共享', '资源对接'],
  },
  {
    icon: Bot,
    tag: 'MODULE 03',
    title: 'AI专业服务',
    description: '专业大模型与智能体服务,提供深度AI化咨询与支持',
    features: ['专业大模型', '智能体服务', '咨询服务'],
    featured: true,
  },
]

const BENEFITS = [
  '全年所有课程免费参加',
  '探索活动优先参与',
  '社群互助无限次',
  '线上社群专属入口',
  'AI助手优先体验',
  '不满意全额退款',
]

const POSITIONING_TAGS = ['人机协同', '理性效率', '超级组织']

export function EnterpriseContent() {
  const router = useRouter()

  const handleJoin = () => router.push('/support?source=enterprise')

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10 py-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">
            <ArrowLeft className="mr-1 h-4 w-4" />
            返回首页
          </Link>
        </Button>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          ENTERPRISESERVICE
        </span>
      </div>

      <section className="space-y-5 text-center">
        <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <span className="h-px w-8 bg-border" />
          智汇AI社
          <span className="h-px w-8 bg-border" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">智汇AI企业服务</h1>
        <p className="mx-auto max-w-2xl text-sm text-muted-foreground md:text-base">
          AI时代企业理性效率服务与互助社群。帮助决策者深度理解AI与企业的关系,构建人机协同的超级组织。
        </p>
        <div className="flex flex-wrap items-center justify-center gap-6 pt-2">
          <div className="text-center">
            <div className="text-2xl font-bold tracking-tight">
              <AnimatedNumber value={18000} prefix="¥" duration={2000} />
            </div>
            <div className="text-xs text-muted-foreground">元/人/年 标准价格</div>
          </div>
          <div className="text-center">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold tracking-tight text-primary">
                <AnimatedNumber value={6000} prefix="¥" duration={2000} />
              </span>
              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                -67%
              </span>
            </div>
            <div className="text-xs text-muted-foreground">元/人/年 早鸟价</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold tracking-tight">
              <AnimatedNumber value={18} duration={1500} />
            </div>
            <div className="text-xs text-muted-foreground">位早鸟名额</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button size="lg" onClick={handleJoin}>
            立即加入
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/agents">
              <Sparkles className="mr-1 h-4 w-4" />
              深入了解智能体场景
            </Link>
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          核心定位
        </div>
        <Card className="overflow-hidden">
          <CardContent className="flex flex-col items-start gap-4 p-6 md:flex-row md:items-center md:gap-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Target className="h-7 w-7" />
            </div>
            <div className="flex-1 space-y-2">
              <h2 className="text-lg font-semibold tracking-tight">
                AI时代企业理性效率服务与互助社群
              </h2>
              <p className="text-sm text-muted-foreground">
                智汇AI社致力于帮助企业决策者深度理解AI与企业的关系,通过系统化的课程、实践探索和社群互助,构建人机协同的超级组织,实现企业的理性效率提升。
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {POSITIONING_TAGS.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          三大服务模块
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {MODULES.map((m) => {
            const Icon = m.icon
            return (
              <Card
                key={m.title}
                className={`relative transition-colors hover:bg-accent ${
                  m.featured ? 'border-primary/40' : ''
                }`}
              >
                {m.featured && (
                  <span className="absolute right-3 top-3 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                    核心服务
                  </span>
                )}
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">{m.tag}</span>
                  </div>
                  <h3 className="text-base font-semibold tracking-tight">{m.title}</h3>
                  <p className="text-sm text-muted-foreground">{m.description}</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {m.features.map((f) => (
                      <span key={f} className="rounded-md bg-muted px-2 py-0.5 text-xs">
                        {f}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      <ArchitectureSection />

      <CompassSection />

      <CoursesSection />

      <ToolsSection />

      <section className="space-y-4">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          加入智汇AI社
        </div>
        <Card className="overflow-hidden border-primary/20">
          <CardContent className="space-y-5 p-6">
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
              <div className="space-y-1">
                <h2 className="text-xl font-bold tracking-tight">
                  与志同道合的决策者一起,探索AI时代的无限可能
                </h2>
                <p className="text-sm text-muted-foreground">
                  仅限前18位会员 · 早鸟价 ¥6000/人/年 · 不满意全额退款
                </p>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground line-through">¥18000</div>
                <div className="text-3xl font-bold tracking-tight text-primary">¥6000</div>
                <div className="text-xs text-muted-foreground">/人/年</div>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {BENEFITS.map((b) => (
                <div key={b} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 shrink-0 text-success" />
                  <span>{b}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button size="lg" onClick={handleJoin}>
                立即加入
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">扫码咨询或直接联系我们</span>
            </div>
          </CardContent>
        </Card>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-xs text-muted-foreground">
        <span>智汇AI社 · 中国 · 北京</span>
        <Link href="/support" className="hover:text-foreground">
          联系我们
        </Link>
      </footer>
    </div>
  )
}
