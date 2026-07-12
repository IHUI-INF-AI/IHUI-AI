'use client'

import { Loader2, FolderOpen } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ErrorBoundary } from '@/components/common'
import { UploadZone } from '@/components/workspace/upload-zone'
import { FileList, type FileItem } from '@/components/workspace/file-list'

interface Props {
  files?: FileItem[]
  filesLoading: boolean
  filesError: boolean
  filesErr: unknown
  uploading: boolean
  uploadErrorMessage?: string
  deleteErrorMessage?: string
  downloadingId: string | null
  onFiles: (files: File[]) => void
  onDownload: (file: FileItem) => void
  onDelete: (file: FileItem) => void
  onPreview: (file: FileItem) => void
}

export function FilesSection({
  files,
  filesLoading,
  filesError,
  filesErr,
  uploading,
  uploadErrorMessage,
  deleteErrorMessage,
  downloadingId,
  onFiles,
  onDownload,
  onDelete,
  onPreview,
}: Props) {
  const t = useTranslations('workspace')
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <FolderOpen className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">{t('files')}</h2>
        {files && <span className="text-sm text-muted-foreground">({files.length})</span>}
      </div>

      <UploadZone uploading={uploading} onFiles={onFiles} />

      {uploadErrorMessage && <p className="text-xs text-destructive">{uploadErrorMessage}</p>}
      {deleteErrorMessage && <p className="text-xs text-destructive">{deleteErrorMessage}</p>}

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
            onDownload={onDownload}
            onDelete={onDelete}
            onPreview={onPreview}
          />
        </ErrorBoundary>
      )}
    </section>
  )
}
