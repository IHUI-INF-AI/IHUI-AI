'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import { useAuthStore } from '@/stores/auth'
import type { FileItem } from '@/components/workspace/file-list'

import { ProjectHeader } from './ProjectHeader'
import { FilesSection } from './FilesSection'
import { AIWorkspaceTabs } from './AIWorkspaceTabs'
import { PreviewDialog } from './PreviewDialog'
import { fetchProject, fetchFiles, uploadFile, downloadFile, removeFile } from './helpers'
import type { PreviewState } from './types'

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
  const [preview, setPreview] = React.useState<PreviewState | null>(null)

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
      <ProjectHeader
        onBack={() => router.push('/workspace')}
        project={project}
        projectLoading={projectLoading}
        projectError={projectError}
        projectErr={projectErr}
      />

      <FilesSection
        files={files}
        filesLoading={filesLoading}
        filesError={filesError}
        filesErr={filesErr}
        uploading={uploading}
        uploadErrorMessage={
          uploadMutation.isError ? (uploadMutation.error as Error)?.message : undefined
        }
        deleteErrorMessage={
          deleteMutation.isError ? (deleteMutation.error as Error)?.message : undefined
        }
        downloadingId={downloadingId}
        onFiles={handleFiles}
        onDownload={handleDownload}
        onDelete={handleDelete}
        onPreview={handlePreview}
      />

      <AIWorkspaceTabs selectedFolder={selectedFolder} onSelectFolder={setSelectedFolder} />

      <PreviewDialog preview={preview} onClose={closePreview} />
    </div>
  )
}
