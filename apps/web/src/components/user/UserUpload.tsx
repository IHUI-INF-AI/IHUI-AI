'use client'

import * as React from 'react'
import { UploadCloud, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface UserUploadProps {
  accept?: string
  multiple?: boolean
  uploading?: boolean
  onUpload?: (files: File[]) => void | Promise<void>
  className?: string
  hint?: string
}

export default function UserUpload({
  accept = '*',
  multiple = false,
  uploading = false,
  onUpload,
  className,
  hint = '点击或拖拽文件到此处上传',
}: UserUploadProps): React.JSX.Element {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [drag, setDrag] = React.useState(false)
  const [files, setFiles] = React.useState<File[]>([])

  const handleFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return
    const arr = Array.from(list)
    setFiles((prev) => (multiple ? [...prev, ...arr] : arr))
    if (onUpload) void onUpload(arr)
  }

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx))

  return (
    <div className={cn('rounded-xl border bg-card p-4', className)}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          handleFiles(e.dataTransfer.files)
        }}
        className={cn(
          'flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors',
          drag ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50',
        )}
      >
        {uploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        ) : (
          <UploadCloud className="h-8 w-8 text-muted-foreground" />
        )}
        <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      {files.length > 0 && (
        <ul className="mt-3 space-y-1">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1 text-xs"
            >
              <span className="truncate">{f.name}</span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
