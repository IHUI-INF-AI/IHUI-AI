'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { MailPlus, Users, ArrowRight } from 'lucide-react'
import { Button, CardContent } from '@ihui/ui-react'

export function CtaSection() {
  const t = useTranslations('aiNews')

  return (
    <section
      aria-label={t('cta.label')}
      className="overflow-hidden rounded-xl border bg-card shadow-sm"
    >
      <CardContent className="grid gap-6 p-6 md:grid-cols-2 md:p-8">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold leading-tight tracking-tight md:text-3xl">
            {t('cta.title')}
          </h2>
          <p className="text-sm text-muted-foreground md:text-base">{t('cta.subtitle')}</p>
        </div>
        <div className="flex flex-col justify-center gap-3">
          <Button asChild className="h-10 w-full">
            <Link href="/support?source=ai-news">
              <MailPlus className="mr-1.5 h-4 w-4" />
              {t('cta.subscribe')}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-10 w-full">
            <Link href="/circles">
              <Users className="mr-1.5 h-4 w-4" />
              {t('cta.community')}
            </Link>
          </Button>
        </div>
      </CardContent>
    </section>
  )
}
