'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { FileText, Loader2, Calendar, Tag } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { cn } from '@/lib/utils'

type AgreementType = 'user' | 'privacy'

// 前端短名 → 后端完整 type
const TYPE_MAP: Record<AgreementType, string> = {
  user: 'user-agreement',
  privacy: 'privacy-policy',
}

interface Agreement {
  id: string
  title: string
  content: string
  version?: string | null
  effectiveDate?: string | null
  type?: string | null
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const TABS: { key: AgreementType; labelKey: string }[] = [
  { key: 'user', labelKey: 'userAgreement' },
  { key: 'privacy', labelKey: 'privacyPolicy' },
]

export default function AgreementPage() {
  const t = useTranslations('agreement')
  const searchParams = useSearchParams()

  const typeParam = (searchParams.get('type') as AgreementType | null) ?? 'user'
  const [activeType, setActiveType] = React.useState<AgreementType>(
    typeParam === 'privacy' ? 'privacy' : 'user',
  )

  React.useEffect(() => {
    if (typeParam === 'privacy' || typeParam === 'user') {
      setActiveType(typeParam)
    }
  }, [typeParam])

  const { data, isLoading, error } = useQuery({
    queryKey: ['agreement', activeType],
    queryFn: () => api<Agreement>(`/api/agreements/current?type=${TYPE_MAP[activeType]}`),
    retry: false,
  })

  const fmtDate = (v?: string | null) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('zh-CN')
  }

  const agreement = data

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <FileText className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      {/* 协议类型切换 */}
      <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveType(tab.key)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              activeType === tab.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <FileText className="h-3.5 w-3.5" />
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : error || !agreement ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {activeType === 'privacy' ? t('privacyPolicy') : t('userAgreement')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Tag className="h-4 w-4" />
                {t('version')}: v1.0.0
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {t('effectiveDate')}: {fmtDate(new Date().toISOString())}
              </span>
            </div>
            <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>{t('staticContent1')}</p>
              <p>{t('staticContent2')}</p>
              <p>{t('staticContent3')}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{agreement.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b pb-4 text-sm text-muted-foreground">
              {agreement.version && (
                <span className="inline-flex items-center gap-1">
                  <Tag className="h-4 w-4" />
                  {t('version')}: {agreement.version}
                </span>
              )}
              {agreement.effectiveDate && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {t('effectiveDate')}: {fmtDate(agreement.effectiveDate)}
                </span>
              )}
            </div>
            <article
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: agreement.content }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
