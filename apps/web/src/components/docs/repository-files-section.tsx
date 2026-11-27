// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Eye, FileText, Loader2 } from 'lucide-react'
import { Button, Card, CardContent } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import { formatDateOnly } from '@/lib/date-utils'
import { FileViewerDialog, type FileViewerTarget } from '@/components/media/file-viewer-dialog'

/**
 * 文档中心首页的「文档文件」板块(2026-11-26 立)。
 *
 * 立因:开发文档首页此前只列数据库里的 Markdown;仓库 `docs/` 下的 PDF/Office/
 * 表格/图片/音视频等非 md 文件只在「文档集市」里能翻到。本板块复用文档集市同一条
 * `/api/feature-center/documents` 数据(公开档匿名可见,顶层敏感档仅管理员),
 * 预览统一交 `FileViewerDialog` → `UniversalFilePreview`,不再另起渲染。
 */

interface RepoDocItem {
  id: string
  title: string
  description: string
  format: string
  url: string
  updatedAt: string
}

async function fetchRepositoryFiles(): Promise<RepoDocItem[]> {
  const res = await fetchApi<RepoDocItem[]>('/api/feature-center/documents')
  if (!res.success) return []
  return (res.data ?? []).filter((doc) => doc.format !== 'markdown' && doc.url)
}

/** 展示用格式徽章:取真实文件后缀,不再维护第二张 format→文案表。 */
function extLabelOf(item: RepoDocItem): string {
  const name = item.description.split('/').pop() ?? item.title
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toUpperCase() : item.format.toUpperCase()
}

export function RepositoryFilesSection() {
  const t = useTranslations('docs.repositoryFiles')
  const { data, isLoading } = useQuery({
    queryKey: ['docs', 'repository-files'],
    queryFn: fetchRepositoryFiles,
    staleTime: 60_000,
  })
  const [target, setTarget] = React.useState<FileViewerTarget | null>(null)

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-4 text-body text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('loading')}
        </CardContent>
      </Card>
    )
  }
  if (!data || data.length === 0) return null

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{t('title')}</h2>
          <span className="text-body text-muted-foreground">
            {t('count', { count: data.length })}
          </span>
        </div>
        <p className="text-label text-muted-foreground">{t('description')}</p>
        <ul className="grid grid-cols-1 gap-2 min-[768px]:grid-cols-2">
          {data.map((item) => {
            const fileName = item.description.split('/').pop() || item.title
            return (
              <li
                key={item.id}
                className="flex items-center gap-2 rounded-lg border bg-background p-2"
              >
                <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {extLabelOf(item)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body">{item.title}</p>
                  <p className="truncate text-label text-muted-foreground">
                    {item.description}
                    {item.updatedAt ? ` · ${formatDateOnly(item.updatedAt)}` : ''}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setTarget({ name: fileName, src: item.url, subtitle: item.description })
                  }
                >
                  <Eye className="mr-1 h-3.5 w-3.5" />
                  {t('preview')}
                </Button>
              </li>
            )
          })}
        </ul>
      </CardContent>
      <FileViewerDialog target={target} onClose={() => setTarget(null)} />
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
