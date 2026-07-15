'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ScrollText } from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent } from '@ihui/ui'
import { Container } from '@/components/layout'

interface UsageRuleSection {
  titleKey: string
  contentKey: string
}

export default function UsageRulesPage() {
  const t = useTranslations('settings')

  const sections: UsageRuleSection[] = [
    { titleKey: 'usageRulesSection1Title', contentKey: 'usageRulesSection1Content' },
    { titleKey: 'usageRulesSection2Title', contentKey: 'usageRulesSection2Content' },
    { titleKey: 'usageRulesSection3Title', contentKey: 'usageRulesSection3Content' },
    { titleKey: 'usageRulesSection4Title', contentKey: 'usageRulesSection4Content' },
    { titleKey: 'usageRulesSection5Title', contentKey: 'usageRulesSection5Content' },
  ]

  return (
    <Container maxWidth="md" padding={false} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('usageRulesTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('usageRulesDesc')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ScrollText className="h-4 w-4" />
            {t('usageRulesCardTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {sections.map((section, idx) => (
            <section key={section.titleKey} className="space-y-2">
              <h3 className="text-sm font-semibold">
                {idx + 1}. {t(section.titleKey)}
              </h3>
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {t(section.contentKey)}
              </p>
            </section>
          ))}
        </CardContent>
      </Card>
    </Container>
  )
}
