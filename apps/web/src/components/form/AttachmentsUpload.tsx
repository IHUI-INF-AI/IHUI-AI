'use client'

import * as React from 'react'
import { UploadCloud, X, Loader2, FileIcon } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

/**
 * 附件项(与后端 AttachmentItem 一致)。
 */
export interface AttachmentItem {
  url: string
  name: string
  type: string
  size: number
}

export interface AttachmentsUploadProps {
  /** 已上传附件列表(受控) */
  value?: AttachmentItem[]
  /** 增量回调:返回完整列表(含新增项) */
  onChange?: (items: AttachmentItem[]) => void
  /** 是否多选(默认 true) */
  multiple?: boolean
  /** 最多允许数量(默认 10) */
  maxCount?: number
  /** 单文件大小上限(字节,默认 50MB) */
  maxSize?: number
  /** 接受的文件类型(HTML accept 字符串,如 'image/*,audio/*,video/*') */
  accept?: string
  /** 上传端点(默认 /api/files/upload/form) */
  endpoint?: string
  /** 占位文案(i18n key 或字面量) */
  placeholder?: string
  /** 自定义类 */
  className?: string
  /** 错误回调 */
  onError?: (err: Error) => void
}

const DEFAULT_MAX_COUNT = 10
const DEFAULT_MAX_SIZE = 50 * 1024 * 1024

/**
 * AttachmentsUpload — 多格式附件上传(图片/音频/视频/文档)
 *
 * 与 ImageUpload 区别:本组件跟踪完整 {url, name, type, size} 元数据,
 * 用于 edu_notes / edu_offline_records 的 attachments jsonb 字段。
 *
 * 上传流程:
 *  1. 用户选择文件 → 立即 POST /api/files/upload/form(multipart)
 *  2. 后端返回 { data: { file: { id, name, size, mimeType } } }
 *  3. 构造公开 URL `/uploads/<file.id>` + 完整 attachment item
 *  4. onChange 回调推送完整列表(受控)
 *
 * 跨端范围:仅 web(desktop/extension/mobile-rn/miniapp-taro 当前未引用,
 * 豁免同步,见 PROJECT_PLAN.md P2 任务标注)。
 */
export function AttachmentsUpload({
  value = [],
  onChange,
  multiple = true,
  maxCount = DEFAULT_MAX_COUNT,
  maxSize = DEFAULT_MAX_SIZE,
  accept = 'image/*,audio/*,video/*,application/pdf',
  endpoint = '/api/files/upload/form',
  placeholder,
  className,
  onError,
}: AttachmentsUploadProps) {
  const t = useTranslations('attachments')
  const [uploading, setUploading] = React.useState(false)
  const [dragOver, setDragOver] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const uploadOne = React.useCallback(
    async (file: File): Promise<AttachmentItem | null> => {
      if (file.size > maxSize) {
        onError?.(new Error(`文件超过大小上限:${file.name}`))
        return null
      }
      const formData = new FormData()
      formData.append('file', file, file.name)
      try {
        const resp = await fetch(endpoint, {
          method: 'POST',
          body: formData,
          credentials: 'include',
        })
        if (!resp.ok) {
          onError?.(new Error(`上传失败:${resp.status} ${resp.statusText}`))
          return null
        }
        const json = (await resp.json()) as {
          data?: { file?: { id?: string; name?: string; size?: number; mimeType?: string } }
        }
        const f = json.data?.file
        if (!f?.id) {
          onError?.(new Error('上传响应缺少 file.id'))
          return null
        }
        return {
          url: `/uploads/${f.id}`,
          name: f.name ?? file.name,
          type: f.mimeType ?? file.type,
          size: f.size ?? file.size,
        }
      } catch (e) {
        onError?.(e instanceof Error ? e : new Error(String(e)))
        return null
      }
    },
    [endpoint, maxSize, onError],
  )

  const handleFiles = React.useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return
      const remaining = maxCount - value.length
      if (remaining <= 0) {
        onError?.(new Error(`最多 ${maxCount} 个附件`))
        return
      }
      const files = Array.from(fileList).slice(0, remaining)
      setUploading(true)
      try {
        const results = await Promise.all(files.map(uploadOne))
        const ok = results.filter((r): r is AttachmentItem => r !== null)
        if (ok.length > 0) {
          onChange?.([...value, ...ok])
        }
      } finally {
        setUploading(false)
      }
    },
    [maxCount, onChange, uploadOne, value],
  )

  const handleRemove = React.useCallback(
    (idx: number) => {
      const next = value.filter((_, i) => i !== idx)
      onChange?.(next)
      // 服务端清理孤儿文件(fire-and-forget,失败不阻塞 UI)
      // 复用 ImageUpload 的清理路径:DELETE /api/oss/files { url }
      const removed = value[idx]
      if (removed?.url) {
        fetchApi('/api/oss/files', {
          method: 'DELETE',
          body: JSON.stringify({ url: removed.url }),
        }).catch(() => {})
      }
    },
    [onChange, value],
  )

  const onDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles],
  )

  const placeholderText = placeholder ?? t('placeholder')

  return (
    <div className={cn('space-y-2', className)}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border px-4 py-6 text-center transition-colors hover:bg-muted/50',
          dragOver && 'border-primary/60 bg-primary/5',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          accept={accept}
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
        {uploading ? (
          <>
            <Loader2 className="mb-2 h-6 w-6 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{t('uploading')}</span>
          </>
        ) : (
          <>
            <UploadCloud className="mb-2 h-6 w-6 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{placeholderText}</span>
          </>
        )}
      </div>

      {value.length > 0 && (
        <ul className="space-y-1">
          {value.map((item, idx) => (
            <li
              key={`${item.url}-${idx}`}
              className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm"
            >
              <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 truncate hover:underline"
                title={item.name}
              >
                {item.name}
              </a>
              <span className="shrink-0 text-xs text-muted-foreground">
                {(item.size / 1024).toFixed(1)} KB
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  handleRemove(idx)
                }}
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={t('remove')}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
