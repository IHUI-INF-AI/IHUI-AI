'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Search, FileText, Eye } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, Input, Button } from '@ihui/ui'
import { FeatureCenterHeader, FeatureCenterNav, FeatureCard } from '@/components/feature-center'

interface DocItem {
  id: string
  title: string
  description: string
  category: string
  format: 'markdown' | 'pdf' | 'html'
  url: string
  updatedAt: string
}

async function fetchDocs(): Promise<DocItem[]> {
  const res = await fetchApi<DocItem[]>('/api/feature-center/documents')
  if (!res.success) throw new Error(res.error)
  return res.data
}

const CATEGORIES = [
  { value: '全部', key: 'catAll' },
  { value: '入门', key: 'catGettingStarted' },
  { value: '指南', key: 'catGuide' },
  { value: 'API 参考', key: 'catApiRef' },
  { value: '最佳实践', key: 'catBestPractice' },
  { value: '更新日志', key: 'catChangelog' },
] as const

export default function DocumentsPage() {
  const t = useTranslations('featureCenter.documents')
  const { data, isLoading } = useQuery({
    queryKey: ['feature-center-docs'],
    queryFn: fetchDocs,
  })
  const [keyword, setKeyword] = React.useState('')
  const [category, setCategory] = React.useState('全部')
  const [previewId, setPreviewId] = React.useState<string | null>(null)

  const list = React.useMemo(() => {
    const all = data ?? []
    return all.filter((item) => {
      const matchKeyword =
        !keyword ||
        item.title.toLowerCase().includes(keyword.toLowerCase()) ||
        item.description.toLowerCase().includes(keyword.toLowerCase())
      const matchCategory = category === '全部' || item.category === category
      return matchKeyword && matchCategory
    })
  }, [data, keyword, category])

  const previewDoc = list.find((d) => d.id === previewId) ?? null

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
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              className={
                'rounded-full border px-3 py-1 text-sm transition-colors ' +
                (category === c.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-muted')
              }
            >
              {t(c.key)}
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((item) => (
            <FeatureCard
              key={item.id}
              title={item.title}
              description={item.description}
              badge={item.category}
              footer={
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.updatedAt).toLocaleDateString()}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setPreviewId(item.id)}>
                    <Eye className="mr-1 h-3.5 w-3.5" />
                    {t('preview')}
                  </Button>
                </div>
              }
            />
          ))}
        </div>
      )}

      {previewDoc && (
        <Card className="fixed inset-4 z-50 overflow-auto md:inset-x-1/4 md:top-1/4 md:bottom-1/4">
          <CardContent className="space-y-3 p-6">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <FileText className="h-5 w-5 text-primary" />
                {previewDoc.title}
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setPreviewId(null)}>
                {t('close')}
              </Button>
            </div>
            <iframe
              src={previewDoc.url}
              className="h-[60vh] w-full rounded border"
              title={previewDoc.title}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
