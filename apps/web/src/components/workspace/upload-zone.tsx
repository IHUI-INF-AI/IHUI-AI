'use client'

import * as React from 'react'
import { UploadCloud, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { toast } from '@/components/common'
import { cn } from '@/lib/utils'

/** 默认单文件大小上限:50MB */
const DEFAULT_MAX_SIZE = 50 * 1024 * 1024
/** 默认单次选择数量上限:20 */
const DEFAULT_MAX_COUNT = 20

export interface UploadZoneProps {
  uploading?: boolean
  onFiles: (files: File[]) => void
  /** 单文件大小上限(字节),默认 50MB */
  maxSize?: number
  /** 单次选择数量上限,默认 20 */
  maxCount?: number
}

export function UploadZone({
  uploading = false,
  onFiles,
  maxSize = DEFAULT_MAX_SIZE,
  maxCount = DEFAULT_MAX_COUNT,
}: UploadZoneProps) {
  const t = useTranslations('workspace')
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = React.useState(false)

  const handleSelected = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    const arr = Array.from(fileList)
    // 大小校验:防止超大文件透传给 onFiles 导致 OOM / 上传失败
    const oversized = arr.filter((f) => f.size > maxSize)
    if (oversized.length > 0) {
      toast.error(
        `文件超过大小上限(${Math.floor(maxSize / 1024 / 1024)}MB):${oversized.map((f) => f.name).join(', ')}`,
      )
      return
    }
    // 数量校验:单次选择兜底
    if (arr.length > maxCount) {
      toast.error(`单次最多选择 ${maxCount} 个文件`)
      return
    }
    onFiles(arr)
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    if (uploading) return
    handleSelected(e.dataTransfer.files)
  }

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!dragging) setDragging(true)
  }

  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !uploading && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !uploading) {
          e.preventDefault()
          inputRef.current?.click()
        }
      }}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-5 min-[768px]:p-8 text-center transition-colors',
        dragging ? 'border-primary bg-primary/5' : 'border-input hover:bg-accent',
        uploading && 'pointer-events-none opacity-60',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          handleSelected(e.target.files)
          // 允许重复选择同名文件
          e.target.value = ''
        }}
      />
      {uploading ? (
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      ) : (
        <UploadCloud className="h-8 w-8 text-muted-foreground" />
      )}
      <div className="text-sm">
        <p className="font-medium">{t('dragUpload')}</p>
        <p className="text-muted-foreground">{t('clickUpload')}</p>
      </div>
    </div>
  )
}

export default UploadZone
