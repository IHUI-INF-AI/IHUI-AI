'use client'

import * as React from 'react'
import { Suspense } from 'react'
import { useTranslations } from 'next-intl'
import { Mail, Phone, Clock, Headphones, ShieldCheck } from 'lucide-react'
import { Card, CardContent } from '@ihui/ui-react'
import { InquiryForm } from '../../services/InquiryForm'

export function InquiryContent(): React.JSX.Element {
  const t = useTranslations('services')

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 min-[768px]:px-8 min-[768px]:py-14">
      {/* Hero */}
      <section className="space-y-4 text-center">
        <h1 className="text-2xl min-[768px]:text-3xl min-[1024px]:text-4xl font-bold tracking-tight">{t('enterpriseInquiry.title')}</h1>
        <p className="mx-auto max-w-2xl text-sm text-muted-foreground min-[768px]:text-base">
          {t('enterpriseInquiry.subtitle')}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-6 pt-2 text-sm">
          <span className="inline-flex items-center gap-1.5">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{t('enterpriseInquiry.contactEmail')}:</span>
            <span className="font-medium">business@aizhs.top</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{t('enterpriseInquiry.contactPhone')}:</span>
            <span className="font-medium">400-888-0000</span>
          </span>
        </div>
      </section>

      {/* 主体:表单 + 侧边栏 */}
      <div className="mt-10 grid grid-cols-1 gap-6 min-[1024px]:grid-cols-[1fr_280px]">
        {/* 表单区(InquiryForm 使用 useSearchParams,需 Suspense 边界) */}
        <Card>
          <CardContent className="p-4 min-[768px]:p-6">
            <Suspense fallback={null}>
              <InquiryForm />
            </Suspense>
          </CardContent>
        </Card>

        {/* 侧边栏 */}
        <aside className="space-y-4">
          <Card className="transition-colors hover:bg-accent">
            <CardContent className="space-y-3 p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Headphones className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold">{t('enterpriseInquiry.sidebar.salesTitle')}</h3>
              <p className="text-xs text-muted-foreground">{t('enterpriseInquiry.sidebar.salesDesc')}</p>
            </CardContent>
          </Card>
          <Card className="transition-colors hover:bg-accent">
            <CardContent className="space-y-3 p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Clock className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold">{t('enterpriseInquiry.sidebar.workHoursTitle')}</h3>
              <p className="text-xs text-muted-foreground">{t('enterpriseInquiry.sidebar.workHours')}</p>
            </CardContent>
          </Card>
          <Card className="transition-colors hover:bg-accent">
            <CardContent className="space-y-3 p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold">{t('enterpriseInquiry.sidebar.slaTitle')}</h3>
              <p className="text-xs text-muted-foreground">{t('enterpriseInquiry.sidebar.sla')}</p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  )
}
