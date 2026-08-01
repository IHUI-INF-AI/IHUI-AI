'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Server, GraduationCap, Code2, Phone, Check, ArrowRight, ChevronDown, Sparkles } from 'lucide-react'
import { Button, Card, CardContent } from '@ihui/ui-react'
import { AnimatedNumber } from '@/components/common'

const SERVICE_CARDS = [
  { key: 'deployment', icon: Server, id: 'deployment' },
  { key: 'training', icon: GraduationCap, id: 'training' },
  { key: 'custom', icon: Code2, id: 'custom' },
  { key: 'consulting', icon: Phone, id: 'consulting' },
] as const

const FAQ_COUNT = 6

export function ServicesContent(): React.JSX.Element {
  const t = useTranslations('services')
  const faqItems = t.raw('faq.items') as Array<{ q: string; a: string }>

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 min-[768px]:px-8 min-[768px]:py-14">
      {/* Hero */}
      <section className="space-y-4 text-center">
        <div className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {t('hero.cta')}
        </div>
        <h1 className="text-2xl min-[768px]:text-3xl min-[1024px]:text-4xl font-bold tracking-tight">{t('hero.title')}</h1>
        <p className="mx-auto max-w-2xl text-sm text-muted-foreground min-[768px]:text-base">
          {t('hero.subtitle')}
        </p>
        <div className="flex justify-center pt-2">
          <Button asChild size="lg">
            <a href="#inquiry">
              {t('hero.cta')}
              <ArrowRight className="ml-1 h-4 w-4" />
            </a>
          </Button>
        </div>
      </section>

      {/* 服务卡片网格 */}
      <section className="mt-10 grid gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-4 min-[1024px]:items-start">
        {SERVICE_CARDS.map(({ key, icon: Icon, id }) => {
          const features = t.raw(`cards.${key}.features`) as string[]
          return (
            <Card key={key} className="relative flex flex-col transition-colors hover:bg-accent">
              <CardContent className="flex flex-1 flex-col p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-3 text-lg font-semibold tracking-tight">{t(`cards.${key}.title`)}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{t(`cards.${key}.desc`)}</p>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-2xl font-bold tracking-tight text-primary">
                    {t(`cards.${key}.price`)}
                  </span>
                  <span className="text-sm text-muted-foreground">{t(`cards.${key}.unit`)}</span>
                </div>
                <ul className="mt-4 flex-1 space-y-2 text-sm">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild variant="outline" className="mt-4 w-full">
                  <Link href={`/enterprise/inquiry?service=${id}`}>{t('hero.cta')}</Link>
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </section>

      {/* 社会证明 */}
      <section className="mt-12 grid gap-4 min-[640px]:grid-cols-3">
        {[
          { value: 120, suffix: '+', labelKey: 'socialProof.clients' },
          { value: 86, suffix: '+', labelKey: 'socialProof.deployments' },
          { value: 98, suffix: '%', labelKey: 'socialProof.satisfaction' },
        ].map(({ value, suffix, labelKey }) => (
          <Card key={labelKey}>
            <CardContent className="p-5 text-center">
              <div className="text-xl font-bold tracking-tight min-[768px]:text-2xl text-primary">
                <AnimatedNumber value={value} suffix={suffix} duration={1500} />
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{t(labelKey)}</div>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* FAQ */}
      <section className="mt-12 space-y-4">
        <h2 className="text-center text-xl font-bold tracking-tight min-[768px]:text-2xl">{t('faq.title')}</h2>
        <div className="mx-auto max-w-3xl space-y-3">
          {faqItems.slice(0, FAQ_COUNT).map((item, idx) => (
            <details
              key={idx}
              className="group rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <h3 className="text-sm font-semibold min-[768px]:text-base">{item.q}</h3>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* 询价表单 */}
      <section id="inquiry" className="mt-12 scroll-mt-20">
        <div className="mx-auto max-w-2xl space-y-2 text-center">
          <h2 className="text-xl font-bold tracking-tight min-[768px]:text-2xl">{t('inquiry.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('inquiry.subtitle')}</p>
        </div>
      </section>
    </main>
  )
}
