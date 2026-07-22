'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Search, FileText, Eye, FileType2, Clock } from 'lucide-react'
import { useTranslations } from 'next-intl'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, Input, Button } from '@ihui/ui'
import { FeatureCenterHeader, FeatureCenterNav } from '@/components/feature-center'

interface DocItem {
  id: string
  title: string
  description: string
  excerpt: string
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

// 分类英文 key → 中文显示映射(与后端 deriveCategory() 输出对齐)
const CATEGORY_LABELS: Record<string, string> = {
  api: 'API 参考',
  sdk: 'SDK',
  integration: '集成',
  'incentive-program': '激励计划',
  development: '开发',
  'getting-started': '入门',
  'user-feature': '功能',
  user: '用户',
  guide: '指南',
  enterprise: '企业服务',
  faq: 'FAQ',
  'best-practice': '最佳实践',
  changelog: '更新日志',
}

// format → 显示标签
const FORMAT_LABELS: Record<string, string> = {
  markdown: 'Markdown',
  pdf: 'PDF',
  html: 'HTML',
}

export default function DocumentsPage() {
  const t = useTranslations('featureCenter.documents')
  const { data, isLoading } = useQuery({
    queryKey: ['feature-center-docs'],
    queryFn: fetchDocs,
  })
  const [keyword, setKeyword] = React.useState('')
  const [category, setCategory] = React.useState('全部')
  const [previewId, setPreviewId] = React.useState<string | null>(null)

  // 动态生成分类按钮(从返回数据的 unique category 值)
  const categories = React.useMemo(() => {
    const unique = [...new Set((data ?? []).map((d) => d.category))]
    return ['全部', ...unique.sort()]
  }, [data])

  const list = React.useMemo(() => {
    const all = data ?? []
    return all.filter((item) => {
      const matchKeyword =
        !keyword ||
        item.title.toLowerCase().includes(keyword.toLowerCase()) ||
        item.excerpt.toLowerCase().includes(keyword.toLowerCase())
      const matchCategory = category === '全部' || item.category === category
      return matchKeyword && matchCategory
    })
  }, [data, keyword, category])

  const previewDoc = list.find((d) => d.id === previewId) ?? null

  // 点击 preview 时加载 markdown 内容(DB 优先,文件兜底)
  const { data: previewContent, isLoading: previewLoading } = useQuery({
    queryKey: ['doc-content', previewId],
    queryFn: async () => {
      if (!previewId) return ''
      const doc = (data ?? []).find((d) => d.id === previewId)
      if (!doc) return ''
      const slug = doc.url ? doc.url.replace('/docs/', '') : doc.id.replace('file:', '')
      const res = await fetchApi<{ content: string }>(
        `/api/feature-center/documents/${slug}/content`,
      )
      if (!res.success) throw new Error(res.error)
      return res.data.content
    },
    enabled: !!previewId,
  })

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
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={
                'rounded-md border px-3 py-1 text-sm transition-colors ' +
                (category === c
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-muted')
              }
            >
              {c === '全部' ? t('catAll') : (CATEGORY_LABELS[c] ?? c)}
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
          {list.map((item) => {
            const formatLabel = FORMAT_LABELS[item.format] ?? item.format
            const categoryLabel = CATEGORY_LABELS[item.category] ?? item.category
            return (
              <Card
                key={item.id}
                className="flex h-full flex-col transition-shadow hover:shadow-md"
              >
                <CardContent className="flex flex-1 flex-col gap-3 p-4">
                  {/* 顶部:format 标签 + 分类徽章 */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      <FileType2 className="h-3 w-3" />
                      {formatLabel}
                    </span>
                    <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {categoryLabel}
                    </span>
                  </div>

                  {/* 标题 */}
                  <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
                    {item.title}
                  </h3>

                  {/* excerpt 缩略预览 */}
                  {item.excerpt && (
                    <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {item.excerpt}
                    </p>
                  )}

                  {/* 底部:日期 + 预览按钮 */}
                  <div className="mt-auto flex items-center justify-between pt-2">
                    {item.updatedAt ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(item.updatedAt).toLocaleDateString()}
                      </span>
                    ) : (
                      <span />
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setPreviewId(item.id)}>
                      <Eye className="mr-1 h-3.5 w-3.5" />
                      {t('preview')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {previewDoc && (
        <Card className="fixed inset-4 z-modal overflow-auto md:inset-x-1/4 md:top-1/4 md:bottom-1/4">
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
            {previewLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('loading')}
              </div>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none overflow-auto">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{previewContent ?? ''}</ReactMarkdown>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
