'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Newspaper, Calendar, Sparkles, ArrowRight } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { getFormatters } from '@/lib/date-utils'

export function Hero() {
  const t = useTranslations('aiNews')
  const locale = React.useMemo(() => {
    if (typeof document === 'undefined') return 'zh-CN'
    return document.documentElement.lang || 'zh-CN'
  }, [])
  const fmt = React.useMemo(() => getFormatters(locale), [locale])
  const today = React.useMemo(() => fmt.dateOnlyFormatter.format(new Date()), [fmt])

  return (
    <section
      aria-label={t('hero.label')}
      className="overflow-hidden rounded-xl border bg-card shadow-sm"
    >
      <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:p-8">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            <span>{t('hero.badge')}</span>
          </div>
          <h1 className="flex items-center gap-2 text-3xl font-bold leading-tight tracking-tight md:text-4xl">
            <Newspaper className="h-7 w-7 text-primary md:h-8 md:w-8" />
            {t('hero.title')}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
            {t('hero.subtitle')}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="inline-flex items-center gap-1.5 rounded-md border bg-background/50 px-2 py-1 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              {today}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border bg-background/50 px-2 py-1 text-xs text-muted-foreground">
              {t('hero.updateFreq')}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-stretch justify-center gap-2">
          <Button asChild className="h-10">
            <Link href="/news">
              {t('hero.ctaPrimary')}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild className="h-10">
            <Link href="/live">{t('hero.ctaSecondary')}</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
