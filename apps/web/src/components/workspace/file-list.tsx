'use client'

import * as React from 'react'
import { Download, Trash2, FileText, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@ihui/ui'

export interface FileItem {
  id: string
  name: string
  size: number
  mimeType: string
  createdAt: string | Date
}

export interface FileListProps {
  files: FileItem[]
  downloadingId?: string | null
  onDownload: (file: FileItem) => void
  onDelete: (file: FileItem) => void
}

function formatSize(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function formatDate(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString()
}

export function FileList({ files, downloadingId, onDownload, onDelete }: FileListProps) {
  const t = useTranslations('workspace')

  if (files.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        {t('emptyFiles')}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr className="text-left">
            <th className="px-4 py-3 font-medium">{t('fileName')}</th>
            <th className="px-4 py-3 font-medium">{t('fileSize')}</th>
            <th className="hidden px-4 py-3 font-medium md:table-cell">{t('fileType')}</th>
            <th className="hidden px-4 py-3 font-medium sm:table-cell">{t('uploadedAt')}</th>
            <th className="px-4 py-3 text-right font-medium">{t('actions')}</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => {
            const isDownloading = downloadingId === file.id
            return (
              <tr key={file.id} className="border-t transition-colors hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="max-w-[12rem] truncate sm:max-w-xs">{file.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatSize(file.size)}</td>
                <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                  {file.mimeType || '-'}
                </td>
                <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                  {formatDate(file.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onDownload(file)}
                      disabled={isDownloading}
                      title={t('download')}
                    >
                      {isDownloading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => onDelete(file)}
                      title={t('deleteFile')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default FileList
