'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Globe, ShieldCheck } from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent } from '@ihui/ui'
import { Container } from '@/components/layout'

interface IcpRecord {
  labelKey: string
  value: string
  link?: string
}

export default function IcpRecordPage() {
  const t = useTranslations('settings')

  const records: IcpRecord[] = [
    { labelKey: 'icpRecordNumber', value: '沪ICP备2026000001号-1' },
    { labelKey: 'icpRecordEntity', value: '上海慧慧人工智能科技有限公司' },
    { labelKey: 'icpRecordEntityType', value: '企业' },
    { labelKey: 'icpRecordTime', value: '2026-01-15' },
    {
      labelKey: 'icpRecordUrl',
      value: 'https://beian.miit.gov.cn',
      link: 'https://beian.miit.gov.cn',
    },
    { labelKey: 'icpRecordScope', value: t('icpRecordScopeValue') },
  ]

  return (
    <Container maxWidth="md" padding={false} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('icpRecordTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('icpRecordDesc')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4" />
            {t('icpRecordCardTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            {records.map((item) => (
              <div
                key={item.labelKey}
                className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <dt className="shrink-0 text-sm text-muted-foreground">{t(item.labelKey)}</dt>
                <dd className="text-right text-sm font-medium">
                  {item.link ? (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline-offset-4 transition-colors hover:underline"
                    >
                      {item.value}
                    </a>
                  ) : (
                    item.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-start gap-3 p-4">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-xs leading-relaxed text-muted-foreground">{t('icpRecordNotice')}</p>
        </CardContent>
      </Card>
    </Container>
  )
}
