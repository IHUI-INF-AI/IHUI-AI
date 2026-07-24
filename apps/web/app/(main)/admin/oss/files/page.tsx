'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { HardDrive, Download } from 'lucide-react'

import { exportToExcel } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { UploadZone } from '@/components/workspace/upload-zone'
import { Button } from '@ihui/ui-react'

import { OssFileFilter } from './OssFileFilter'
import { OssFileTable } from './OssFileTable'
import { OssFileDialog } from './OssFileDialog'
import { PAGE_SIZE, api, EXPORT_COLUMNS } from './helpers'
import type { OssFile, FileListData } from './types'

export default function AdminOssFilesPage() {
  const t = useTranslations('common')
  const qc = useQueryClient()
  const [fileName, setFileName] = React.useState('')
  const [uploadDate, setUploadDate] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [uploading, setUploading] = React.useState(false)
  const [previewFile, setPreviewFile] = React.useState<OssFile | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(fileName)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [fileName])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'oss', 'files', debounced, uploadDate, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (debounced) qs.set('fileName', debounced)
      if (uploadDate) qs.set('uploadDate', uploadDate)
      return api<FileListData>(`/api/admin/oss/files?${qs.toString()}`)
    },
  })

  const uploadMut = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) {
        const fd = new FormData()
        fd.append('file', file)
        await api<OssFile>('/api/admin/oss/files', { method: 'POST', body: fd })
      }
    },
    onSuccess: () => {
      toast.success('上传成功')
      qc.invalidateQueries({ queryKey: ['admin', 'oss', 'files'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/oss/files/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['admin', 'oss', 'files'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  async function handleFiles(files: File[]) {
    setUploading(true)
    try {
      await uploadMut.mutateAsync(files)
    } catch {
      // 错误已通过 mutation 状态暴露
    } finally {
      setUploading(false)
    }
  }

  function handleExport() {
    exportToExcel(
      'OSS文件',
      EXPORT_COLUMNS,
      (data?.list ?? []) as unknown as Record<string, unknown>[],
    )
  }

  function handleDelete(f: OssFile) {
    if (!window.confirm(`确认删除文件 "${f.fileName}" ?`)) return
    deleteMut.mutate(f.id)
  }

  const files = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <HardDrive className="h-6 w-6 text-primary" />
            文件管理
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">管理对象存储中的文件</p>
        </div>
        <HasPermi code="system:oss:export">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            {t('export')}
          </Button>
        </HasPermi>
      </div>

      <HasPermi
        code="system:oss:add"
        fallback={
          <div className="rounded-lg border-2 border-dashed p-8 text-center text-sm text-muted-foreground">
            无上传权限
          </div>
        }
      >
        <UploadZone uploading={uploading} onFiles={handleFiles} />
      </HasPermi>

      <OssFileFilter
        fileName={fileName}
        setFileName={setFileName}
        uploadDate={uploadDate}
        setUploadDate={setUploadDate}
      />

      <OssFileTable
        list={files}
        isLoading={isLoading}
        deletePending={deleteMut.isPending}
        onPreview={setPreviewFile}
        onDelete={handleDelete}
      />

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">共 {total} 条</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            第 {page} / {totalPages} 页
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </Button>
        </div>
      </div>

      <OssFileDialog file={previewFile} onClose={() => setPreviewFile(null)} />
    </div>
  )
}
