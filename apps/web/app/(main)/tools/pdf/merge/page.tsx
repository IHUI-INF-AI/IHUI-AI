'use client'

import * as React from 'react'
import { GripVertical, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import {
  ToolHeader,
  UploadArea,
  ProgressBar,
  DownloadLink,
  NotAvailableAlert,
  useProcessApi,
} from '../_components/shared'

interface FileItem {
  id: string
  file: File
}

export default function PdfMergePage() {
  const [items, setItems] = React.useState<FileItem[]>([])
  const [dragIndex, setDragIndex] = React.useState<number | null>(null)
  const { loading, progress, result, error, run } = useProcessApi('/api/pdf-service/merge')

  const addFiles = (files: File[]) => {
    const next = files.map((file) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
      file,
    }))
    setItems((prev) => [...prev, ...next])
  }

  const remove = (id: string) => setItems((prev) => prev.filter((it) => it.id !== id))

  const onDrop = (index: number) => {
    if (dragIndex === null || dragIndex === index) return
    setItems((prev) => {
      const next = [...prev]
      const removed = next.splice(dragIndex, 1)
      const moved = removed[0]
      if (!moved) return prev
      next.splice(index, 0, moved)
      return next
    })
    setDragIndex(null)
  }

  const handleSubmit = () => {
    if (items.length < 2) return
    const fd = new FormData()
    items.forEach((it) => fd.append('files', it.file))
    run(fd)
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <ToolHeader title="PDF 合并" description="按列表顺序将多个 PDF 合并为一个文件" />
      <UploadArea
        multiple
        accept="application/pdf"
        onFiles={addFiles}
        label="点击或拖拽多个 PDF 文件到此处上传"
      />
      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((it, index) => (
            <li
              key={it.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(index)}
              className="flex items-center gap-3 rounded-lg border bg-card p-3 text-sm"
            >
              <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" />
              <span className="flex-1 truncate">{it.file.name}</span>
              <span className="text-xs text-muted-foreground">
                {(it.file.size / 1024).toFixed(1)} KB
              </span>
              <span className="text-xs text-muted-foreground">#{index + 1}</span>
              <Button variant="ghost" size="icon" onClick={() => remove(it.id)} aria-label="删除">
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-3">
        <Button onClick={handleSubmit} disabled={loading || items.length < 2}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? '合并中...' : '合并'}
        </Button>
        {items.length > 0 && items.length < 2 && (
          <span className="text-xs text-muted-foreground">至少选择 2 个文件才能合并</span>
        )}
      </div>
      {(loading || progress > 0) && <ProgressBar value={progress} />}
      {error && <NotAvailableAlert />}
      {result && (
        <div className="rounded-lg border bg-card p-3">
          <DownloadLink url={result.url} filename={result.filename} />
        </div>
      )}
    </div>
  )
}
