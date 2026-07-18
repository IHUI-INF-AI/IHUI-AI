'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { ArrowLeft, BookOpen, Download, Eye, FileText, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { SafeHtml } from '@/components/common'
import { ImageViewer, CodeViewer } from '@/components/media'

const CODE_EXTENSIONS = [
  'js',
  'ts',
  'tsx',
  'jsx',
  'py',
  'go',
  'rs',
  'java',
  'c',
  'cpp',
  'cs',
  'rb',
  'php',
  'swift',
  'kt',
  'sh',
  'bash',
  'yaml',
  'yml',
  'json',
  'xml',
  'html',
  'css',
  'scss',
  'sql',
  'vue',
  'svelte',
]

interface ResourceDetail {
  id: string
  title: string
  intro?: string | null
  introduction?: string | null
  coverImage?: string | null
  fileUrl?: string | null
  fileType?: string | null
  fileSize?: number | null
  categoryId?: string | null
  categoryName?: string | null
  viewCount: number
  downloadCount: number
  createdAt?: string | null
}

interface RelatedResource {
  id: string
  title: string
  coverImage?: string | null
  fileType?: string | null
  viewCount: number
  downloadCount: number
}

interface DetailResponse {
  resource: ResourceDetail
  related?: RelatedResource[]
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function ResourceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const t = useTranslations('resources')

  const { data, isLoading, error } = useQuery({
    queryKey: ['resources', 'detail', id],
    queryFn: () => api<DetailResponse>(`/api/resources/${id}`),
  })

  const fmtDate = (v?: string | null) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('zh-CN')
  }

  const fmtSize = (bytes?: number | null) => {
    if (!bytes) return '-'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
  }

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )

  if (error || !data)
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <Link
          href="/resources"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToList')}
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error)?.message ?? t('notFound')}
        </div>
      </div>
    )

  const resource = data.resource
  const related = data.related ?? []

  const fileExt = resource.fileType?.toLowerCase().replace(/^\./, '') ?? ''
  const isCodeResource = CODE_EXTENSIONS.includes(fileExt)

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Link
        href="/resources"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToList')}
      </Link>

      <header className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{resource.title}</h1>
        {resource.intro && <p className="text-sm text-muted-foreground">{resource.intro}</p>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {resource.categoryName && (
            <span className="inline-flex items-center gap-1">
              <BookOpen className="h-4 w-4" />
              {resource.categoryName}
            </span>
          )}
          {resource.fileType && <span>{resource.fileType}</span>}
          {resource.fileSize !== null && <span>{fmtSize(resource.fileSize)}</span>}
          <span className="inline-flex items-center gap-1">
            <Eye className="h-4 w-4" />
            {t('viewCount', { count: resource.viewCount })}
          </span>
          <span className="inline-flex items-center gap-1">
            <Download className="h-4 w-4" />
            {t('downloadCount', { count: resource.downloadCount })}
          </span>
          {resource.createdAt && (
            <span>{t('publishedAt', { date: fmtDate(resource.createdAt) })}</span>
          )}
        </div>
      </header>

      {resource.coverImage && (
        <ImageViewer
          src={resource.coverImage}
          alt={resource.title}
          className="max-h-[420px] border"
        />
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t('detailContent')}</CardTitle>
          {resource.fileUrl && (
            <Button size="sm" asChild>
              <a href={resource.fileUrl} target="_blank" rel="noopener noreferrer">
                <Download className="mr-1 h-4 w-4" />
                {t('download')}
              </a>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isCodeResource && resource.introduction ? (
            <CodeViewer code={resource.introduction} language={fileExt} showLineNumbers />
          ) : resource.introduction ? (
            <SafeHtml
              html={resource.introduction}
              className="prose prose-sm max-w-none dark:prose-invert"
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t('noContent')}</p>
          )}
        </CardContent>
      </Card>

      {related.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{t('relatedResources')}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <Link key={item.id} href={`/resources/${item.id}`} className="group block">
                <Card className="h-full overflow-hidden transition-colors hover:bg-accent">
                  <div className="flex h-24 items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                    <FileText className="h-8 w-8 text-primary/40" />
                  </div>
                  <CardContent className="space-y-1.5 p-4 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">{item.title}</p>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5" />
                        {item.viewCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <Download className="h-3.5 w-3.5" />
                        {item.downloadCount}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
