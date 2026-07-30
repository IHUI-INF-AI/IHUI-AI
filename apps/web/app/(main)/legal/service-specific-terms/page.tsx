'use client'

import { useTranslations } from 'next-intl'
import { Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'

const SECTIONS: readonly { titleKey: string; bodyKey: string }[] = [
  { titleKey: 's1Title', bodyKey: 's1Body' },
  { titleKey: 's2Title', bodyKey: 's2Body' },
  { titleKey: 's3Title', bodyKey: 's3Body' },
  { titleKey: 's4Title', bodyKey: 's4Body' },
  { titleKey: 's5Title', bodyKey: 's5Body' },
]

export default function ServiceSpecificTermsPage() {
  const t = useTranslations('legal.serviceSpecificTerms')

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
        {SECTIONS.map((s) => (
          <section key={s.titleKey} className="space-y-1">
            <h2 className="text-base font-semibold">{t(s.titleKey)}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{t(s.bodyKey)}</p>
          </section>
        ))}
      </CardContent>
    </Card>
  )
}
