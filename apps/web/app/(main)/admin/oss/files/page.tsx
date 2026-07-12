'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { HardDrive, Download, Trash2, Loader2, Search } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { exportToExcel } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { UploadZone } from '@/components/workspace/upload-zone'
import {
  Button,
  Input,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@ihui/ui'

interface OssFile {
  id: string
  fileName: string
  size: number
  mimeType: string
  url: string | null
  uploadedBy: string
  createdAt: string
}

interface FileListData {
  list: OssFile[]
  total: number
}

const PAGE_SIZE = 20

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export default function AdminOssFilesPage() {
  const t = useTranslations('common')
  const qc = useQueryClient()
  const [fileName, setFileName] = React.useState('')
  const [uploadDate, setUploadDate] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [uploading, setUploading] = React.useState(false)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(fileName)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [fileName])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'oss', 'files', debounced, uploadDate, page],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (debounced) qs.set('fileName', debounced)
      if (uploadDate) qs.set('uploadDate', uploadDate)
      const r = await fetchApi<FileListData>(`/api/admin/oss/files?${qs.toString()}`)
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  const uploadMut = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) {
        const fd = new FormData()
        fd.append('file', file)
        const r = await fetchApi<OssFile>('/api/admin/oss/files', { method: 'POST', body: fd })
        if (!r.success) throw new Error(r.error)
      }
    },
    onSuccess: () => {
      toast.success('上传成功')
      qc.invalidateQueries({ queryKey: ['admin', 'oss', 'files'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetchApi(`/api/admin/oss/files/${id}`, { method: 'DELETE' })
      if (!r.success) throw new Error(r.error)
    },
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
      [
        { key: 'id', title: 'ID' },
        { key: 'fileName', title: '文件名' },
        { key: 'size', title: '大小', formatter: (v) => formatSize(Number(v)) },
        { key: 'mimeType', title: '类型' },
        { key: 'uploadedBy', title: '上传者' },
        { key: 'createdAt', title: '上传时间' },
      ],
      files as unknown as Record<string, unknown>[],
    )
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

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="搜索文件名..."
            className="h-9 pl-8"
          />
        </div>
        <Input
          type="date"
          value={uploadDate}
          onChange={(e) => setUploadDate(e.target.value)}
          className="h-9 w-40"
          aria-label="上传日期"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">文件名</TableHead>
              <TableHead className="px-4 py-2.5">大小</TableHead>
              <TableHead className="px-4 py-2.5">类型</TableHead>
              <TableHead className="px-4 py-2.5">上传时间</TableHead>
              <TableHead className="px-4 py-2.5">上传者</TableHead>
              <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中...
                </TableCell>
              </TableRow>
            ) : files.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  暂无文件
                </TableCell>
              </TableRow>
            ) : (
              files.map((f) => (
                <TableRow key={f.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">{f.fileName}</TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">
                    {formatSize(f.size)}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                    {f.mimeType}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                    {f.createdAt}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">{f.uploadedBy}</TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <HasPermi code="system:oss:remove">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={deleteMut.isPending}
                        onClick={() => {
                          if (confirm(`确认删除文件 "${f.fileName}" ?`)) deleteMut.mutate(f.id)
                        }}
                        title="删除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </HasPermi>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
    </div>
  )
}
