'use client'

import { useTranslations } from 'next-intl'
import { Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'

const CHAPTERS: readonly { titleKey: string; bodyKey: string }[] = [
  { titleKey: 'ch1Title', bodyKey: 'ch1Body' },
  { titleKey: 'ch2Title', bodyKey: 'ch2Body' },
  { titleKey: 'ch3Title', bodyKey: 'ch3Body' },
  { titleKey: 'ch4Title', bodyKey: 'ch4Body' },
  { titleKey: 'ch5Title', bodyKey: 'ch5Body' },
  { titleKey: 'ch6Title', bodyKey: 'ch6Body' },
  { titleKey: 'ch7Title', bodyKey: 'ch7Body' },
  { titleKey: 'ch8Title', bodyKey: 'ch8Body' },
  { titleKey: 'ch9Title', bodyKey: 'ch9Body' },
  { titleKey: 'ch10Title', bodyKey: 'ch10Body' },
]

export default function TermsPage() {
  const t = useTranslations('legal.terms')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('title')}</CardTitle>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>{t('lastUpdated')}</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {CHAPTERS.map((ch) => (
          <section key={ch.titleKey} className="space-y-1">
            <h2 className="text-base font-semibold">{t(ch.titleKey)}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{t(ch.bodyKey)}</p>
          </section>
        ))}
      </CardContent>
    </Card>
  )
}
