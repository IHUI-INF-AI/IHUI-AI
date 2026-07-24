'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  KeyRound,
  Code2,
  ShieldCheck,
  BookOpen,
  ArrowRight,
  Rocket,
  Lock,
  Plug,
} from 'lucide-react'

import { Button, Card, CardContent } from '@ihui/ui-react'

export default function OauthPlatformPage() {
  const t = useTranslations('oauthPlatform')

  const features = [
    { icon: Code2, title: t('featureApiTitle'), desc: t('featureApiDesc') },
    { icon: KeyRound, title: t('featureOauthTitle'), desc: t('featureOauthDesc') },
    { icon: ShieldCheck, title: t('featureSecurityTitle'), desc: t('featureSecurityDesc') },
    { icon: BookOpen, title: t('featureDocsTitle'), desc: t('featureDocsDesc') },
  ]

  const steps = [
    { icon: Plug, title: t('step1Title'), desc: t('step1Desc') },
    { icon: Lock, title: t('step2Title'), desc: t('step2Desc') },
    { icon: Code2, title: t('step3Title'), desc: t('step3Desc') },
    { icon: Rocket, title: t('step4Title'), desc: t('step4Desc') },
  ]

  return (
    <div className="mx-auto w-full max-w-5xl space-y-16 py-10">
      {/* Hero */}
      <section className="space-y-6 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <KeyRound className="h-3.5 w-3.5" />
          {t('heroBadge')}
        </div>
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">{t('heroTitle')}</h1>
        <p className="mx-auto max-w-2xl text-base text-muted-foreground md:text-lg">
          {t('heroSubtitle')}
        </p>
        <div className="flex justify-center">
          <Link href="/oauth/my-authorized">
            <Button size="lg">
              {t('heroCta')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="space-y-6">
        <div className="space-y-1 text-center">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{t('featuresTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('featuresSubtitle')}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => {
            const Icon = f.icon
            return (
              <Card key={f.title}>
                <CardContent className="space-y-3 p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* Steps */}
      <section className="space-y-6">
        <div className="space-y-1 text-center">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{t('stepsTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('stepsSubtitle')}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {steps.map((s, i) => {
            const Icon = s.icon
            return (
              <div key={s.title} className="relative space-y-3 rounded-lg border p-6">
                <div className="absolute right-4 top-4 text-3xl font-bold text-muted/30">
                  {i + 1}
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="rounded-2xl bg-primary/5 px-6 py-12 text-center">
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{t('ctaTitle')}</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">{t('ctaSubtitle')}</p>
        <div className="mt-6 flex justify-center">
          <Link href="/oauth/my-authorized">
            <Button size="lg">
              {t('ctaButton')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
