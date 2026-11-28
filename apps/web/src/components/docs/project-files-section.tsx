// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Eye, FolderOpen, Loader2 } from 'lucide-react'
import { Button, Card, CardContent } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import { useAuthGate } from '@/hooks/use-auth-gate'
import { formatDateOnly } from '@/lib/date-utils'
import { FileViewerDialog, type FileViewerTarget } from '@/components/media/file-viewer-dialog'

/**
 * 文档中心的「我的项目文件」板块(2026-11-26 立)。
 *
 * 立因:文档中心此前只列仓库/数据库里的 Markdown,项目工作区里上传的 pdf / docx /
 * xlsx / pptx / 图片 / 音视频 / csv 在文档中心完全不可见 —— 用户要回到项目页才能看。
 * 本板块复用工作区既有接口(项目列表 + 项目文件),预览统一交
 * `FileViewerDialog`(内部仍走 `UniversalFilePreview`),
 * 与 AI 面板、工作区页共用同一套判型与渲染,不另起第二套。
 */

interface WorkspaceProject {
  id: string
  name: string
  fileCount?: number
}

interface WorkspaceFile {
  id: string
  name: string
  size: number
  mimeType?: string
  createdAt?: string
}

interface ProjectFile extends WorkspaceFile {
  projectId: string
  projectName: string
}

async function fetchProjectFiles(): Promise<ProjectFile[]> {
  const res = await fetchApi<{ projects: WorkspaceProject[] }>('/api/workspace/projects')
  if (!res.success) return []
  const projects = (res.data?.projects ?? []).filter((p) => (p.fileCount ?? 0) > 0)
  const groups = await Promise.all(
    projects.map(async (project) => {
      try {
        const fres = await fetchApi<{ files: WorkspaceFile[] }>(
          `/api/workspace/projects/${project.id}/files`,
        )
        if (!fres.success) return []
        return (fres.data?.files ?? []).map((file) => ({
          ...file,
          projectId: project.id,
          projectName: project.name,
        }))
      } catch {
        return []
      }
    }),
  )
  return groups.flat().sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
}

function formatSize(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

export function ProjectFilesSection() {
  const t = useTranslations('docs.projectFiles')
  const { allow } = useAuthGate()
  const queryClient = useQueryClient()
  // AI 修订稿保存成功后由 ai-revision-panel 派发该事件:文档中心立即重拉列表,
  // 不让用户等 staleTime 过期才发现"刚存的稿子不见了"。
  React.useEffect(() => {
    const onChanged = (): void => {
      void queryClient.invalidateQueries({ queryKey: ['docs', 'project-files'] })
    }
    window.addEventListener('ihui:project-files-changed', onChanged)
    return () => window.removeEventListener('ihui:project-files-changed', onChanged)
  }, [queryClient])
  const { data, isLoading } = useQuery({
    queryKey: ['docs', 'project-files'],
    queryFn: fetchProjectFiles,
    enabled: allow,
    staleTime: 60_000,
  })
  const [target, setTarget] = React.useState<FileViewerTarget | null>(null)

  // 未登录时不占版面(文档中心主体仍可匿名阅读);登录后无文件同样不立空板块。
  if (!allow) return null
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
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{t('title')}</h2>
          <span className="text-body text-muted-foreground">
            {t('count', { count: data.length })}
          </span>
        </div>
        <p className="text-label text-muted-foreground">{t('description')}</p>
        <ul className="grid grid-cols-1 gap-2 min-[768px]:grid-cols-2">
          {data.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-2 rounded-lg border bg-background p-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-body">{file.name}</p>
                <p className="truncate text-label text-muted-foreground">
                  {file.projectName} · {formatSize(file.size)}
                  {file.createdAt ? ` · ${formatDateOnly(file.createdAt)}` : ''}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setTarget({
                    name: file.name,
                    src: `/api/workspace/files/${file.id}`,
                    subtitle: `${file.projectName} · ${formatSize(file.size)}`,
                    projectId: file.projectId,
                  })
                }
              >
                <Eye className="mr-1 h-3.5 w-3.5" />
                {t('preview')}
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
      <FileViewerDialog target={target} onClose={() => setTarget(null)} />
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
