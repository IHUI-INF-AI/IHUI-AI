'use client'

import * as React from 'react'
import Link from 'next/link'
import { HelpCircle, ChevronDown, MessageCircle, Sparkles, BookOpen } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@ihui/ui-react'

// 12 个 FAQ 集中配置(category 用于左侧导航 + 分类徽章)
const FAQ_ITEMS = [
  { id: 'q1', category: 'general' },
  { id: 'q2', category: 'general' },
  { id: 'q3', category: 'general' },
  { id: 'q4', category: 'tech' },
  { id: 'q5', category: 'tech' },
  { id: 'q6', category: 'tech' },
  { id: 'q7', category: 'pricing' },
  { id: 'q8', category: 'pricing' },
  { id: 'q9', category: 'deploy' },
  { id: 'q10', category: 'deploy' },
  { id: 'q11', category: 'privacy' },
  { id: 'q12', category: 'privacy' },
] as const

const CATEGORIES = [
  { id: 'general', key: 'categoryGeneral' },
  { id: 'tech', key: 'categoryTech' },
  { id: 'pricing', key: 'categoryPricing' },
  { id: 'deploy', key: 'categoryDeploy' },
  { id: 'privacy', key: 'categoryPrivacy' },
] as const

export function FaqContent(): React.JSX.Element {
  const t = useTranslations('faq')

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12 md:px-8 md:py-16">
      {/* Hero */}
      <section className="space-y-4 text-center">
        <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <HelpCircle className="h-3.5 w-3.5 text-primary" />
          {t('heroBadge')}
        </div>
        <h1 className="text-3xl font-bold tracking-tight md:text-5xl">{t('heroTitle')}</h1>
        <p className="mx-auto max-w-2xl text-base text-muted-foreground md:text-lg">
          {t('heroSubtitle')}
        </p>
      </section>

      {/* 分类导航 */}
      <nav
        aria-label="FAQ categories"
        className="mt-10 flex flex-wrap items-center justify-center gap-2"
      >
        {CATEGORIES.map((cat) => (
          <a
            key={cat.id}
            href={`#category-${cat.id}`}
            className="rounded border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:text-sm"
          >
            {t(cat.key)}
          </a>
        ))}
      </nav>

      {/* FAQ 列表(按分类分组) */}
      <div className="mt-10 space-y-10">
        {CATEGORIES.map((cat) => {
          const items = FAQ_ITEMS.filter((item) => item.category === cat.id)
          if (items.length === 0) return null
          return (
            <section key={cat.id} id={`category-${cat.id}`} className="scroll-mt-20">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                  <BookOpen className="h-4 w-4 text-primary" />
                </div>
                <h2 className="text-lg font-semibold md:text-xl">{t(cat.key)}</h2>
              </div>
              <div className="space-y-3">
                {items.map((item) => {
                  const questionKey = `${item.id}Question` as const
                  const answerKey = `${item.id}Answer` as const
                  return (
                    <details
                      key={item.id}
                      className="group rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md md:p-5"
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold md:text-base">
                          {t(questionKey)}
                        </h3>
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="mt-3 pt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
                        {t(answerKey)}
                      </div>
                    </details>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      {/* CTA */}
      <section className="mt-16 rounded-2xl border bg-primary/5 p-8 text-center md:p-12">
        <MessageCircle className="mx-auto h-10 w-10 text-primary" />
        <h2 className="mt-4 text-2xl font-bold tracking-tight md:text-3xl">{t('ctaTitle')}</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
          {t('ctaDesc')}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild>
            <Link href="/support?source=faq">{t('ctaButton')}</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/docs/quickstart">
              <Sparkles className="mr-2 h-4 w-4" />
              快速开始
            </Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
