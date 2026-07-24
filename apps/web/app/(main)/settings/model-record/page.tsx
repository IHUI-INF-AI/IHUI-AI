'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Cpu, ShieldCheck } from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent } from '@ihui/ui-react'
import { Container } from '@/components/layout'

interface ModelRecordItem {
  labelKey: string
  value: string
}

export default function ModelRecordPage() {
  const t = useTranslations('settings')

  const records: ModelRecordItem[] = [
    { labelKey: 'modelRecordModelName', value: 'IHUI 通用大语言模型' },
    { labelKey: 'modelRecordNumber', value: '网信算备310115606600001号' },
    { labelKey: 'modelRecordAlgorithmType', value: t('modelRecordAlgorithmTypeValue') },
    { labelKey: 'modelRecordApplicant', value: '上海慧慧人工智能科技有限公司' },
    { labelKey: 'modelRecordApplyDate', value: '2026-03-20' },
    { labelKey: 'modelRecordStatus', value: t('modelRecordStatusFiled') },
    { labelKey: 'modelRecordScope', value: t('modelRecordScopeValue') },
  ]

  return (
    <Container maxWidth="md" padding={false} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('modelRecordTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('modelRecordDesc')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cpu className="h-4 w-4" />
            {t('modelRecordCardTitle')}
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
                <dd className="max-w-[60%] text-right text-sm font-medium">{item.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-start gap-3 p-4">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-xs leading-relaxed text-muted-foreground">{t('modelRecordNotice')}</p>
        </CardContent>
      </Card>
    </Container>
  )
}
