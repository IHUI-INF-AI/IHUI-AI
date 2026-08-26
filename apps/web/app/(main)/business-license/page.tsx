'use client'

import { useTranslations } from 'next-intl'
import { Building2, CheckCircle2 } from 'lucide-react'

import { Card, CardContent } from '@ihui/ui-react'
import { BackButton } from '@/components/common'

const FACTS = [
  '吉林省爱智汇人工智能科技有限公司',
  '注册地:吉林省长春市(长春高新区)',
  '经营方向:人工智能应用开发、AI+教育、企业服务',
  'IHUI-AI 开源项目为平台自研主导',
]

export default function BusinessLicensePage() {
  const t = useTranslations('businessLicense')
  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <BackButton fallbackHref="/settings" />
        <h1 className="text-lg font-medium">{t('title')}</h1>
        <div className="w-10" />
      </div>

      <Card className="mb-4">
        <CardContent className="flex flex-col items-center py-8 text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
            <Building2 className="h-7 w-7" />
          </div>
          <h2 className="text-base font-medium">{t('companyName')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          {FACTS.map((fact) => (
            <div key={fact} className="flex items-start gap-2.5 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              <span>{fact}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
