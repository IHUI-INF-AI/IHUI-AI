'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Search, Download } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, Input, Button } from '@ihui/ui-react'
import {
  FeatureCenterHeader,
  FeatureCenterNav,
  FeatureCard,
  VirtualList,
} from '@/components/feature-center'

interface SdkItem {
  id: string
  name: string
  language: string
  version: string
  description: string
  downloadUrl: string
  docsUrl?: string
}

async function fetchSdks(): Promise<SdkItem[]> {
  const res = await fetchApi<SdkItem[]>('/api/feature-center/sdks')
  if (!res.success) throw new Error(res.error)
  return res.data
}

const LANGUAGES = ['全部', 'TypeScript', 'JavaScript', 'Python', 'Go', 'Java', 'Rust']

export default function SdksPage() {
  const t = useTranslations('featureCenter.sdks')
  const { data, isLoading } = useQuery({
    queryKey: ['feature-center-sdks'],
    queryFn: fetchSdks,
  })
  const [keyword, setKeyword] = React.useState('')
  const [language, setLanguage] = React.useState('全部')

  const list = React.useMemo(() => {
    const all = data ?? []
    return all.filter((item) => {
      const matchKeyword =
        !keyword ||
        item.name.toLowerCase().includes(keyword.toLowerCase()) ||
        item.description.toLowerCase().includes(keyword.toLowerCase())
      const matchLanguage = language === '全部' || item.language === language
      return matchKeyword && matchLanguage
    })
  }, [data, keyword, language])

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <FeatureCenterHeader title={t('title')} description={t('description')} />
      <FeatureCenterNav />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLanguage(l)}
              className={
                'rounded-md border px-3 py-1 text-sm transition-colors ' +
                (language === l
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-muted')
              }
            >
              {l === '全部' ? t('catAll') : l}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            {t('noMatch')}
          </CardContent>
        </Card>
      ) : (
        <VirtualList items={list} itemKey={(item) => item.id} itemHeight={180}>
          {(item) => (
            <FeatureCard
              title={item.name}
              description={item.description}
              badge={`${item.language} v${item.version}`}
              footer={
                <div className="flex items-center justify-between">
                  {item.docsUrl && (
                    <a
                      href={item.docsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      {t('viewDocs')}
                    </a>
                  )}
                  <Button asChild variant="default" size="sm">
                    <a href={item.downloadUrl} download>
                      <Download className="mr-1 h-3.5 w-3.5" />
                      {t('download')}
                    </a>
                  </Button>
                </div>
              }
            />
          )}
        </VirtualList>
      )}
    </div>
  )
}
