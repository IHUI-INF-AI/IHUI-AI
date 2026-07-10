'use client'

import * as React from 'react'
import { UploadCloud, X, File as FileIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileUploadProps {
  multiple?: boolean
  accept?: string
  maxSize?: number
  onFilesChange?: (files: File[]) => void
  showPreview?: boolean
  label?: string
  className?: string
}

interface PreviewItem {
  file: File
  url?: string
}

export function FileUpload({
  multiple = false,
  accept,
  maxSize,
  onFilesChange,
  showPreview = true,
  label,
  className,
}: FileUploadProps) {
  const [items, setItems] = React.useState<PreviewItem[]>([])
  const [dragging, setDragging] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const addFiles = (newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles)
    const filtered = maxSize ? arr.filter((f) => f.size <= maxSize) : arr
    const previews = filtered.map((file) => ({
      file,
      url: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }))
    const next = multiple ? [...items, ...previews] : previews.slice(0, 1)
    setItems(next)
    onFilesChange?.(next.map((p) => p.file))
  }

  const removeFile = (idx: number) => {
    const next = items.filter((_, i) => i !== idx)
    if (items[idx]?.url) URL.revokeObjectURL(items[idx].url!)
    setItems(next)
    onFilesChange?.(next.map((p) => p.file))
  }

  return (
    <div className={cn('w-full space-y-2', className)}>
      {label && <label className="text-sm font-medium leading-none">{label}</label>}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-input hover:border-primary/50',
        )}
      >
        <UploadCloud className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">点击或拖拽文件到此处上传</p>
        {accept && <p className="text-xs text-muted-foreground">支持: {accept}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        className="hidden"
        onChange={(e) => e.target.files && addFiles(e.target.files)}
      />
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((item, idx) => (
            <div key={idx} className="group relative h-20 w-20 overflow-hidden rounded-md border">
              {showPreview && item.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt={item.file.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-1">
                  <FileIcon className="h-5 w-5 text-muted-foreground" />
                  <span className="w-full truncate text-[10px] text-muted-foreground">{item.file.name}</span>
                </div>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); removeFile(idx) }}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
