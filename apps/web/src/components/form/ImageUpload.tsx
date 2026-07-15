'use client'

import * as React from 'react'
import { UploadCloud, X, Loader2 } from 'lucide-react'
import Image from 'next/image'
import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'

export interface ImageUploadProps {
  value?: string | string[]
  onChange?: (value: string | string[]) => void
  multiple?: boolean
  maxCount?: number
  accept?: string
  uploadUrl?: string
  className?: string
  placeholder?: string
}

export function ImageUpload({
  value,
  onChange,
  multiple = false,
  maxCount = 5,
  accept = 'image/*',
  uploadUrl = '/api/files/upload',
  className,
  placeholder = '点击或拖拽上传图片',
}: ImageUploadProps) {
  const [uploading, setUploading] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const values = React.useMemo(() => {
    if (!value) return []
    return Array.isArray(value) ? value : [value]
  }, [value])

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const remaining = maxCount - values.length
    const toUpload = Array.from(files).slice(0, remaining)
    if (toUpload.length === 0) return

    setUploading(true)
    try {
      const uploadedUrls: string[] = []
      for (const file of toUpload) {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetchApi<{ url: string }>(uploadUrl, {
          method: 'POST',
          body: formData,
        })
        if (res.success && res.data.url) {
          uploadedUrls.push(res.data.url)
        }
      }
      if (uploadedUrls.length > 0) {
        if (multiple) {
          onChange?.([...values, ...uploadedUrls])
        } else {
          onChange?.(uploadedUrls[0]!)
        }
      }
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = (idx: number) => {
    const newValues = values.filter((_, i) => i !== idx)
    onChange?.(multiple ? newValues : (newValues[0] ?? ''))
  }

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {values.map((url, idx) => (
        <div
          key={idx}
          className="group relative h-20 w-20 overflow-hidden rounded-md border bg-muted"
        >
          <Image src={url} alt="" fill className="object-cover" />
          <button
            type="button"
            onClick={() => handleRemove(idx)}
            className="absolute right-0 top-0 rounded-bl-md bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      {values.length < (multiple ? maxCount : 1) && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-input bg-muted/50 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <UploadCloud className="h-4 w-4" />
              <span>{placeholder}</span>
            </>
          )}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  )
}
