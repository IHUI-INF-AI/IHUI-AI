'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Loader2, FolderOpen } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import {
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@ihui/ui'
import { UploadZone } from '@/components/workspace/upload-zone'
import { FileList, type FileItem } from '@/components/workspace/file-list'
import { DiffPreview } from '@/components/ai/diff-preview'
import { InlineDiffViewer } from '@/components/ai/inline-diff-viewer'
import { TaskListPanel } from '@/components/ai/task-list-panel'
import { RoutinesPanel } from '@/components/ai/routines-panel'
import { WorkspaceFolderSelector } from '@/components/ai/workspace-folder-selector'
import { ErrorBoundary } from '@/components/common'
import { FilePreview } from '@/components/media'

const AI_MOCK = {
  diffOld: 'export function auth(token: string) {\n  return verify(token)\n}',
  diffNew:
    'export function auth(token: string): Promise<User> {\n  return verify(token).then(decode)\n}',
  inlineDiff:
    ' export function auth(token) {\n-  return verify(token)\n+  return verify(token).then(decode)\n }',
  tasks: [
    {
      id: 't1',
      title: 'review 认证模块',
      status: 'in-progress' as const,
      priority: 'high' as const,
      assignee: 'Alice',
    },
    { id: 't2', title: '补充 README', status: 'todo' as const, priority: 'low' as const },
  ],
  routines: [
    { id: 'r1', name: '每日构建', schedule: '0 9 * * *', enabled: true, lastRun: '今天 09:00' },
    { id: 'r2', name: '每周清理', schedule: '0 0 * * 0', enabled: false },
  ],
  folders: [
    {
      id: 'f1',
      name: 'src',
      path: '/src',
      children: [
        { id: 'f1-1', name: 'auth', path: '/src/auth' },
        { id: 'f1-2', name: 'utils', path: '/src/utils' },
      ],
    },
    { id: 'f2', name: 'tests', path: '/tests' },
  ],
}

interface ProjectDetail {
  id: string
  name: string
  description: string
  updatedAt: string
}

async function fetchProject(id: string): Promise<ProjectDetail> {
  const res = await fetchApi<{ project: ProjectDetail }>(`/api/workspace/projects/${id}`)
  if (!res.success) throw new Error(res.error)
  return res.data.project
}

async function fetchFiles(projectId: string): Promise<FileItem[]> {
  const res = await fetchApi<{ files: FileItem[] }>(`/api/workspace/projects/${projectId}/files`)
  if (!res.success) throw new Error(res.error)
  return res.data.files
}

async function uploadFile(projectId: string, file: File, errorMsg: string): Promise<FileItem> {
  const token = useAuthStore.getState().token
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch(`/api/workspace/projects/${projectId}/files`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })
  const json = (await response.json()) as {
    code: number
    message: string
    data?: { file: FileItem }
  }
  if (!response.ok || json.code !== 0) throw new Error(json.message || errorMsg)
  return json.data!.file
}

async function downloadFile(file: FileItem, errorMsg: string) {
  const token = useAuthStore.getState().token
  const response = await fetch(`/api/workspace/files/${file.id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) throw new Error(errorMsg)
  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

async function removeFile(fileId: string): Promise<void> {
  const res = await fetchApi(`/api/workspace/files/${fileId}`, { method: 'DELETE' })
  if (!res.success) throw new Error(res.error)
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const t = useTranslations('workspace')
  const queryClient = useQueryClient()

  const projectId = params.id

  const {
    data: project,
    isLoading: projectLoading,
    isError: projectError,
    error: projectErr,
  } = useQuery({
    queryKey: ['workspace', 'project', projectId],
    queryFn: () => fetchProject(projectId),
    enabled: !!projectId,
  })

  const {
    data: files,
    isLoading: filesLoading,
    isError: filesError,
    error: filesErr,
  } = useQuery({
    queryKey: ['workspace', 'files', projectId],
    queryFn: () => fetchFiles(projectId),
    enabled: !!projectId,
  })

  const [uploading, setUploading] = React.useState(false)
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null)
  const [selectedFolder, setSelectedFolder] = React.useState<string>()
  const [preview, setPreview] = React.useState<{
    file: FileItem
    url: string | null
    loading: boolean
  } | null>(null)

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadFile(projectId, file, t('uploadFailed')),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', 'files', projectId] })
      queryClient.invalidateQueries({ queryKey: ['workspace', 'projects'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: removeFile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', 'files', projectId] })
      queryClient.invalidateQueries({ queryKey: ['workspace', 'projects'] })
    },
  })

  const handleFiles = async (fileList: File[]) => {
    setUploading(true)
    try {
      for (const file of fileList) await uploadMutation.mutateAsync(file)
    } catch {
      // 错误已通过 mutation 状态暴露
    } finally {
      setUploading(false)
    }
  }

  const handleDownload = async (file: FileItem) => {
    setDownloadingId(file.id)
    try {
      await downloadFile(file, t('downloadFailed'))
    } catch {
      // 忽略
    } finally {
      setDownloadingId(null)
    }
  }

  const handleDelete = (file: FileItem) => {
    if (!window.confirm(t('deleteConfirm', { name: file.name }))) return
    deleteMutation.mutate(file.id)
  }

  const handlePreview = async (file: FileItem) => {
    setPreview({ file, url: null, loading: true })
    try {
      const token = useAuthStore.getState().token
      const res = await fetch(`/api/workspace/files/${file.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error('预览失败')
      setPreview({ file, url: window.URL.createObjectURL(await res.blob()), loading: false })
    } catch {
      setPreview({ file, url: null, loading: false })
    }
  }

  const closePreview = () => {
    if (preview?.url) window.URL.revokeObjectURL(preview.url)
    setPreview(null)
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/workspace')}
          title={t('back')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-bold tracking-tight md:text-3xl">
            {projectError ? (
              <span className="text-destructive">{(projectErr as Error)?.message}</span>
            ) : projectLoading ? (
              t('loading')
            ) : (
              (project?.name ?? '')
            )}
          </h1>
          <p className="mt-0.5 break-words text-sm text-muted-foreground">
            {project?.description || t('description')}
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">{t('files')}</h2>
          {files && <span className="text-sm text-muted-foreground">({files.length})</span>}
        </div>

        <UploadZone uploading={uploading} onFiles={handleFiles} />

        {uploadMutation.isError && (
          <p className="text-xs text-destructive">{(uploadMutation.error as Error)?.message}</p>
        )}
        {deleteMutation.isError && (
          <p className="text-xs text-destructive">{(deleteMutation.error as Error)?.message}</p>
        )}

        {filesError ? (
          <div className="py-8 text-center text-sm text-destructive">
            {(filesErr as Error)?.message}
          </div>
        ) : filesLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t('loading')}
          </div>
        ) : (
          <ErrorBoundary>
            <FileList
              files={files ?? []}
              downloadingId={downloadingId}
              onDownload={handleDownload}
              onDelete={handleDelete}
              onPreview={handlePreview}
            />
          </ErrorBoundary>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">AI 工作区</h2>
        <Tabs defaultValue="diff">
          <TabsList>
            <TabsTrigger value="diff">Diff 对比</TabsTrigger>
            <TabsTrigger value="tasks">任务清单</TabsTrigger>
            <TabsTrigger value="routines">例行程序</TabsTrigger>
            <TabsTrigger value="folders">文件夹</TabsTrigger>
          </TabsList>
          <TabsContent value="diff" className="space-y-4">
            <DiffPreview
              oldContent={AI_MOCK.diffOld}
              newContent={AI_MOCK.diffNew}
              filename="src/auth.ts"
              language="ts"
            />
            <InlineDiffViewer content={AI_MOCK.inlineDiff} filename="src/auth.ts" />
          </TabsContent>
          <TabsContent value="tasks">
            <TaskListPanel tasks={AI_MOCK.tasks} />
          </TabsContent>
          <TabsContent value="routines">
            <RoutinesPanel routines={AI_MOCK.routines} />
          </TabsContent>
          <TabsContent value="folders">
            <WorkspaceFolderSelector
              folders={AI_MOCK.folders}
              selected={selectedFolder}
              onSelect={setSelectedFolder}
            />
          </TabsContent>
        </Tabs>
      </section>

      <Dialog
        open={!!preview}
        onOpenChange={(open) => {
          if (!open) closePreview()
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="break-words">{preview?.file.name ?? '预览'}</DialogTitle>
          </DialogHeader>
          <div className="min-h-[300px]">
            {preview?.loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                加载中...
              </div>
            ) : preview?.url ? (
              <FilePreview url={preview.url} name={preview.file.name} className="max-h-[60vh]" />
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">无法预览此文件</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
