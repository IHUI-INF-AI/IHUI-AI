'use client'

import * as React from 'react'
import { Upload, type UploadProps } from '@ihui/ui-react'
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

/**
 * ImageUpload — 业务侧薄封装(2026-07-21 迁移至 @ihui/ui-react Upload)
 *
 * 保留旧 API 契约(value 支持 string | string[]),内部委托给共享 Upload 组件:
 *  - 拖拽 + 点击 + 进度条 + 多文件上传逻辑统一来自 packages/ui Upload
 *  - 删除时通过 DELETE /api/oss/files 软删 files 表记录(fire-and-forget,
 *    失败不阻塞 UI;孤儿文件由后台清理任务兜底)
 *
 * 受影响 admin 页面:app/(main)/admin/{ai-gc,feedbacks,zhs-agent,edu/zhs-identity,advertise}/*
 * 跨端范围:仅 web + packages/ui(desktop/extension/mobile-rn/miniapp-taro/ai-service/api/cli
 * 当前未引用此组件,豁免同步,见 PROJECT_PLAN.md 同步标注)。
 */
export function ImageUpload({
  value,
  onChange,
  multiple = false,
  maxCount = 5,
  accept = 'image/*',
  uploadUrl = '/api/files/upload/form',
  className,
  placeholder = '点击或拖拽上传图片',
}: ImageUploadProps) {
  const values = React.useMemo<string[]>(() => {
    if (!value) return []
    return Array.isArray(value) ? value : value ? [value] : []
  }, [value])

  const handleChange = React.useCallback(
    (next: string[]) => {
      if (multiple) {
        onChange?.(next)
      } else {
        onChange?.(next[0] ?? '')
      }
    },
    [multiple, onChange],
  )

  const handleRemove = React.useCallback(
    (removedUrl: string, idx: number) => {
      const newValues = values.filter((_, i) => i !== idx)
      handleChange(newValues)
      // 服务端清理孤儿文件(fire-and-forget,失败不阻塞 UI)
      if (removedUrl) {
        fetchApi('/api/oss/files', {
          method: 'DELETE',
          body: JSON.stringify({ url: removedUrl }),
        }).catch(() => {
          // 静默失败:不阻塞用户操作,孤儿文件可由后台清理任务兜底
        })
      }
    },
    [handleChange, values],
  )

  // 解析响应 URL:支持 /api/files/upload/form 返回 { data: { file: { id } } },
  // 构造公开访问 URL `/uploads/<id>`(匹配 server.ts fastifyStatic prefix)
  const resolveUrl: NonNullable<UploadProps['resolveUrl']> = React.useCallback(
    (response) => {
      if (!response || typeof response !== 'object') return null
      const r = response as Record<string, unknown>
      // /api/files/upload/form 响应:{ success, data: { file: { id, name, ... } } }
      if (r.data && typeof r.data === 'object') {
        const d = r.data as Record<string, unknown>
        if (typeof d.url === 'string') return d.url
        if (d.file && typeof d.file === 'object') {
          const f = d.file as Record<string, unknown>
          if (typeof f.id === 'string') return `/uploads/${f.id}`
          if (typeof f.url === 'string') return f.url
          if (typeof f.path === 'string') return f.path
        }
      }
      if (typeof r.url === 'string') return r.url
      return null
    },
    [],
  )

  return (
    <Upload
      value={values}
      onChange={handleChange}
      endpoint={uploadUrl}
      multiple={multiple}
      maxCount={maxCount}
      accept={accept}
      placeholder={placeholder}
      resolveUrl={resolveUrl}
      className={cn(className)}
      // 单文件模式:删除时通知旧 API 走孤儿文件清理路径
      onRemove={handleRemove}
    />
  )
}
