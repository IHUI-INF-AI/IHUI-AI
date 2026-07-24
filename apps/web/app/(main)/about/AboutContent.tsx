'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Sparkles, Target, Users, Shield, Rocket, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'

export interface AboutValue {
  icon: 'target' | 'users' | 'shield' | 'rocket' | string
  title: string
  desc: string
}

export interface AboutInfo {
  siteName?: string
  description?: string
}

interface AboutSettingsResponse {
  list: Array<{
    key: string
    value?: string | null
  }>
}

const ICON_MAP = {
  target: Target,
  users: Users,
  shield: Shield,
  rocket: Rocket,
} as const

async function fetchAbout(): Promise<{ info: AboutInfo; values: AboutValue[] }> {
  const r = await fetchApi<AboutSettingsResponse>(`/api/settings/about`)
  if (!r.success || !r.data?.list?.length) {
    throw new Error('about settings not configured')
  }
  const info: AboutInfo = {}
  const values: AboutValue[] = []
  for (const item of r.data.list) {
    if (!item.value) continue
    // 普通字符串值直接赋给 info
    if (item.key === 'siteName') {
      info.siteName = item.value
    } else if (item.key === 'description') {
      info.description = item.value
    } else {
      // 尝试 JSON 解析(价值观等结构化数据)
      try {
        const parsed = JSON.parse(item.value) as Partial<AboutValue>
        if (parsed.title && parsed.desc) {
          values.push({
            icon: String(parsed.icon ?? 'target'),
            title: String(parsed.title),
            desc: String(parsed.desc),
          })
        }
      } catch {
        // 非 JSON value,跳过
      }
    }
  }
  return { info, values }
}

export function AboutContent(): React.JSX.Element {
  const t = useTranslations('about')
  const { data, isLoading } = useQuery({
    queryKey: ['about-marketing'],
    queryFn: fetchAbout,
    retry: false,
  })

  // i18n 化的 fallback values(API 不可用时使用)
  // 标题/描述走 t() 翻译,确保 5 语言切换时 fallback 也正确
  const i18nValues: AboutValue[] = React.useMemo(
    () => [
      { icon: 'target', title: t('valueMissionTitle'), desc: t('valueMissionDesc') },
      { icon: 'users', title: t('valueCommunityTitle'), desc: t('valueCommunityDesc') },
      { icon: 'shield', title: t('valuePromiseTitle'), desc: t('valuePromiseDesc') },
      { icon: 'rocket', title: t('valueDirectionTitle'), desc: t('valueDirectionDesc') },
    ],
    [t],
  )

  // 优先使用 API 返回的 values,fallback 用 i18n 化的版本(替代 page.tsx 传的中文 FALLBACK)
  const displayValues = data?.values?.length ? data.values : i18nValues

  // i18n 化的 info fallback
  const i18nInfo: AboutInfo = React.useMemo(
    () => ({
      siteName: t('marketingFallbackSiteName'),
      description: t('marketingFallbackDescription'),
    }),
    [t],
  )
  const displayInfo = data?.info?.siteName ? data.info : i18nInfo

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12 md:px-8 md:py-16">
      {/* Hero */}
      <section className="space-y-4 text-center">
        <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {t('marketingBadge')}
        </div>
        <h1 className="text-3xl font-bold tracking-tight md:text-5xl">{t('marketingHeroTitle')}</h1>
        <p className="mx-auto max-w-2xl text-base text-muted-foreground md:text-lg">
          {displayInfo.description ?? i18nInfo.description}
        </p>
      </section>

      {/* 价值观网格 */}
      <section className="mt-16 grid gap-6 sm:grid-cols-2">
        {isLoading && (
          <div className="col-span-full flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t('loading')}
          </div>
        )}
        {!isLoading &&
          displayValues.map(({ icon, title, desc }) => {
            const Icon = ICON_MAP[icon as keyof typeof ICON_MAP] ?? Target
            return (
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
            )
          })}
      </section>

      {/* CTA */}
      <section className="mt-16 rounded-2xl border bg-primary/5 p-8 text-center md:p-12">
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{t('marketingCtaTitle')}</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
          {t('marketingCtaDesc')}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild>
            <Link href="/support?source=about">{t('marketingJoinNow')}</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/pricing">{t('marketingViewPricing')}</Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
