'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { FileJson, FileText, Download } from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent, Button } from '@ihui/ui'
import { Alert } from '@/components/feedback'
import { Container } from '@/components/layout'

export default function DataExportPage() {
  const t = useTranslations('settings')

  const formats = [
    {
      icon: FileJson,
      name: t('exportJson'),
      desc: t('exportJsonDesc'),
    },
    {
      icon: FileText,
      name: t('exportCsv'),
      desc: t('exportCsvDesc'),
    },
  ]

  return (
    <Container maxWidth="md" padding={false} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('dataExportTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('dataExportDesc')}</p>
      </div>

      <Alert variant="info" title={t('exportScope')} description={t('exportScopeDesc')} />

      {formats.map((format) => {
        const Icon = format.icon
        return (
          <Card key={format.name}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon className="h-4 w-4" />
                {format.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{format.desc}</span>
                <Button size="sm">
                  <Download className="h-4 w-4" />
                  {t('download')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </Container>
  )
}
