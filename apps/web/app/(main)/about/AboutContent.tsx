'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Sparkles,
  BookOpen,
  Blocks,
  Database,
  Cpu,
  Plug,
  Workflow,
  Users,
  Globe,
  ShieldCheck,
  Rocket,
  CircleDollarSign,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@ihui/ui-react'

const ICON_MAP = {
  blocks: Blocks,
  database: Database,
  cpu: Cpu,
  plug: Plug,
  workflow: Workflow,
  users: Users,
  globe: Globe,
  shield: ShieldCheck,
  rocket: Rocket,
  sparkles: Sparkles,
  book: BookOpen,
  dollar: CircleDollarSign,
} as const

export function AboutContent(): React.JSX.Element {
  const t = useTranslations('about')

  // 4 个核心价值观(开源 / 六端 / 免费 / 企业级)
  const values = [
    { icon: 'globe', titleKey: 'valueOpenTitle', descKey: 'valueOpenDesc' },
    { icon: 'blocks', titleKey: 'valueCrossTitle', descKey: 'valueCrossDesc' },
    { icon: 'dollar', titleKey: 'valueFreeTitle', descKey: 'valueFreeDesc' },
    { icon: 'shield', titleKey: 'valueEnterpriseTitle', descKey: 'valueEnterpriseDesc' },
  ] as const

  // 6 个平台核心能力
  const platforms = [
    { icon: 'blocks', titleKey: 'platformAgentsTitle', descKey: 'platformAgentsDesc' },
    { icon: 'database', titleKey: 'platformRagTitle', descKey: 'platformRagDesc' },
    { icon: 'cpu', titleKey: 'platformModelsTitle', descKey: 'platformModelsDesc' },
    { icon: 'plug', titleKey: 'platformMcpTitle', descKey: 'platformMcpDesc' },
    { icon: 'workflow', titleKey: 'platformWorkflowTitle', descKey: 'platformWorkflowDesc' },
    { icon: 'users', titleKey: 'platformCollabTitle', descKey: 'platformCollabDesc' },
  ] as const

  // 4 个数字见证
  const stats = [
    { valueKey: 'statUsers', descKey: 'statUsersDesc' },
    { valueKey: 'statAgents', descKey: 'statAgentsDesc' },
    { valueKey: 'statLanguages', descKey: 'statLanguagesDesc' },
    { valueKey: 'statOpensource', descKey: 'statOpensourceDesc' },
  ] as const

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 min-[768px]:px-8 min-[768px]:py-8">
      {/* Hero */}
      <section className="space-y-5 text-center">
        <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {t('heroBadge')}
        </div>
        <h1 className="text-2xl min-[768px]:text-4xl min-[1024px]:text-6xl font-bold tracking-tight">{t('heroTitle')}</h1>
        <p className="mx-auto max-w-3xl text-base text-muted-foreground min-[768px]:text-lg">
          {t('heroSubtitle')}
        </p>
      </section>

      {/* 我们的故事 */}
      <section className="mt-8 min-[768px]:mt-16 rounded-2xl border bg-card p-5 min-[768px]:p-8 min-[1024px]:p-12">
        <div className="mb-4 inline-flex items-center gap-2 rounded bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <BookOpen className="h-3.5 w-3.5" />
          {t('storyBadge')}
        </div>
        <h2 className="text-xl font-bold tracking-tight min-[768px]:text-2xl">{t('storyTitle')}</h2>
        <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted-foreground min-[768px]:text-base">
          <p>{t('storyP1')}</p>
          <p>{t('storyP2')}</p>
        </div>
      </section>

      {/* 4 个核心价值观 */}
      <section className="mt-12 grid grid-cols-1 gap-6 min-[640px]:grid-cols-2">
        {values.map(({ icon, titleKey, descKey }) => {
          const Icon = ICON_MAP[icon as keyof typeof ICON_MAP] ?? Sparkles
          return (
            <div
              key={titleKey}
              className="rounded-2xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">{t(titleKey)}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t(descKey)}</p>
            </div>
          )
        })}
      </section>

      {/* 6 个平台核心能力 */}
      <section className="mt-16">
        <h2 className="text-center text-xl font-bold tracking-tight min-[768px]:text-2xl">
          {t('platformTitle')}
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-6 min-[768px]:grid-cols-2 min-[1024px]:grid-cols-3">
          {platforms.map(({ icon, titleKey, descKey }) => {
            const Icon = ICON_MAP[icon as keyof typeof ICON_MAP] ?? Blocks
            return (
              <div
                key={titleKey}
                className="rounded-2xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{t(titleKey)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(descKey)}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* 数字见证 */}
      <section className="mt-8 min-[768px]:mt-16 rounded-2xl border bg-primary/5 p-5 min-[768px]:p-8 min-[1024px]:p-12">
        <h2 className="text-center text-xl font-bold tracking-tight min-[768px]:text-2xl">
          {t('numbersTitle')}
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-6 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-4">
          {stats.map(({ valueKey, descKey }) => (
            <div key={valueKey} className="text-center">
              <div className="text-2xl min-[768px]:text-4xl min-[1024px]:text-5xl font-bold tracking-tight text-primary">
                {t(valueKey)}
              </div>
              <div className="mt-2 text-sm text-muted-foreground min-[768px]:text-base">{t(descKey)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mt-8 min-[768px]:mt-16 rounded-2xl border bg-card p-5 min-[768px]:p-8 min-[1024px]:p-12 text-center">
        <Rocket className="mx-auto h-10 w-10 text-primary" />
        <h2 className="mt-4 text-xl font-bold tracking-tight min-[768px]:text-2xl">{t('ctaTitle')}</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground min-[768px]:text-base">
          {t('ctaDesc')}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild>
            <Link href="/sso/register">{t('ctaPrimary')}</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/developer">{t('ctaSecondary')}</Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
