'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { FileText, Loader2, ArrowLeft, Calendar, Tag } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { SafeHtml } from '@/components/common'

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

const TYPE_MAP: Record<string, string> = {
  user: 'user-agreement',
  'user-protocol': 'user-agreement',
  'user-agreement': 'user-agreement',
  privacy: 'privacy-policy',
  'privacy-policy': 'privacy-policy',
  disclaimer: 'disclaimer',
  terms: 'terms-of-service',
  'terms-of-service': 'terms-of-service',
}

const TYPE_TITLE: Record<string, { zh: string; en: string }> = {
  'user-agreement': { zh: '用户协议', en: 'User Agreement' },
  'privacy-policy': { zh: '隐私政策', en: 'Privacy Policy' },
  disclaimer: { zh: '免责声明', en: 'Disclaimer' },
  'terms-of-service': { zh: '服务条款', en: 'Terms of Service' },
}

export default function AgreementTypePage() {
  const params = useParams<{ type: string }>()
  const rawType = params.type ?? ''
  const apiType = TYPE_MAP[rawType] ?? rawType
  const t = useTranslations('agreement')
  const tc = useTranslations('common')
  const locale = useLocale()

  const { data, isLoading, error } = useQuery({
    queryKey: ['agreement', apiType],
    queryFn: () => api<Agreement>(`/api/agreements/current?type=${encodeURIComponent(apiType)}`),
    retry: false,
  })

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const fmt = (v?: string | null) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  const titleMeta = TYPE_TITLE[apiType] ?? { zh: rawType, en: rawType }
  const displayTitle = data?.title ?? titleMeta.zh

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {tc('back')}
      </Link>

      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <FileText className="h-7 w-7 text-primary" />
          {displayTitle}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : error || !data ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{displayTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Tag className="h-4 w-4" />
                {t('version')}: v1.0.0
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {t('effectiveDate')}: {fmt(new Date().toISOString())}
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
            <CardTitle className="text-lg">{data.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b pb-4 text-sm text-muted-foreground">
              {data.version && (
                <span className="inline-flex items-center gap-1">
                  <Tag className="h-4 w-4" />
                  {t('version')}: {data.version}
                </span>
              )}
              {data.effectiveDate && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {t('effectiveDate')}: {fmt(data.effectiveDate)}
                </span>
              )}
            </div>
            <SafeHtml html={data.content} className="prose prose-sm max-w-none dark:prose-invert" />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
