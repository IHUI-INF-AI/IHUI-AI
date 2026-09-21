// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Download, Trash2, FileText, FileCode, Loader2, Eye } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { formatDate } from '@/lib/date-utils'
import { Button } from '@ihui/ui-react'
import { Tooltip } from '@/components/feedback'

export interface FileItem {
  id: string
  name: string
  size: number
  mimeType: string
  createdAt: string | Date
}

// 2026-09-08:可转 Markdown 的扩展名(与后端 anydoc 引擎 16 格式对齐)。
// 按钮仅对这些格式显示,避免不支持格式点击后必然报错。
const CONVERTIBLE_EXTS = new Set([
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
  '.xlsm',
  '.ods',
  '.odt',
  '.odp',
  '.rtf',
  '.epub',
  '.csv',
  '.pdf',
  '.txt',
  '.md',
  '.markdown',
])

export function isConvertibleToMarkdown(name: string): boolean {
  const dot = name.lastIndexOf('.')
  if (dot < 0) return false
  return CONVERTIBLE_EXTS.has(name.slice(dot).toLowerCase())
}

export interface FileListProps {
  files: FileItem[]
  downloadingId?: string | null
  onDownload: (file: FileItem) => void
  onDelete: (file: FileItem) => void
  onPreview?: (file: FileItem) => void
  onConvertMarkdown?: (file: FileItem) => void
  convertingId?: string | null
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

export function FileList({
  files,
  downloadingId,
  onDownload,
  onDelete,
  onPreview,
  onConvertMarkdown,
  convertingId,
}: FileListProps) {
  const t = useTranslations('workspace')

  if (files.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
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
            <th className="hidden px-4 py-3 font-medium min-[768px]:table-cell">{t('fileType')}</th>
            <th className="hidden px-4 py-3 font-medium min-[640px]:table-cell">
              {t('uploadedAt')}
            </th>
            <th className="px-4 py-3 text-right font-medium">{t('actions')}</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => {
            const isDownloading = downloadingId === file.id
            const isConverting = convertingId === file.id
            const showConvert = onConvertMarkdown && isConvertibleToMarkdown(file.name)
            return (
              <tr key={file.id} className="transition-colors hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="max-w-[12rem] break-words min-[640px]:max-w-xs">
                      {file.name}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatSize(file.size)}</td>
                <td className="hidden px-4 py-3 text-muted-foreground min-[768px]:table-cell">
                  {file.mimeType || '-'}
                </td>
                <td className="hidden px-4 py-3 text-muted-foreground min-[640px]:table-cell">
                  {formatDate(file.createdAt) || '-'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    {showConvert && (
                      <Tooltip content={t('convertToMarkdown')}>
                        <span className="inline-flex">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => onConvertMarkdown?.(file)}
                            disabled={isConverting}
                          >
                            {isConverting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <FileCode className="h-4 w-4" />
                            )}
                          </Button>
                        </span>
                      </Tooltip>
                    )}
                    {onPreview && (
                      <Tooltip content="预览">
                        <Button variant="ghost" size="icon-sm" onClick={() => onPreview(file)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Tooltip>
                    )}
                    <Tooltip content={t('download')}>
                      <span className="inline-flex">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => onDownload(file)}
                          disabled={isDownloading}
                        >
                          {isDownloading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                      </span>
                    </Tooltip>
                    <Tooltip content={t('deleteFile')}>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => onDelete(file)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </Tooltip>
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
