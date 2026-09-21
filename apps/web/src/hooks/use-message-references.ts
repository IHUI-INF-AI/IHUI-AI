// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'

import { formatFileSize } from '@ihui/shared/utils/format'
import { fetchApi } from '@/lib/api'

/** 引用类型(2026-07-29 从 message-input.tsx 迁移至此) */
export type ReferenceType = 'file' | 'url' | 'text' | 'image' | 'video'

/** 单条引用项(2026-07-29 从 message-input.tsx 迁移至此) */
export interface ReferenceItem {
  id: string
  type: ReferenceType
  label: string
  preview?: string
  /** 图片/视频缩略图 URL(objectURL),用于在引用面板中显示视觉缩略图 */
  thumbnail?: string
  /** 原始文件大小(字节),用于在 label 中显示尺寸信息 */
  size?: number
  /** 自定义图标(覆盖 type 默认图标) */
  icon?: React.ComponentType<{ className?: string }>
  /** 自定义图标颜色 class */
  iconColor?: string
  /** 服务端文件 id(矩阵 A #19:/api/files/upload/form 上传成功后回写) */
  fileId?: string
  /** 服务端公开 URL(矩阵 A #19:响应 data.file.path,发送时替代仅本会话有效的 blob: objectURL) */
  serverUrl?: string
  /** 上传状态(矩阵 A #19):uploading 进行中 / ready 成功 / error 失败 */
  uploadState?: 'uploading' | 'ready' | 'error'
}

const MAX_LABEL_LENGTH = 30

/**
 * 可上传扩展名集合(矩阵 A #19)。
 * 与 apps/api/src/utils/file-type-validator.ts 的 EXT_MIME_MAP 白名单对齐:
 * 图片/视频之外放开文档与纯文本类型,其余扩展名仍静默忽略。
 * 服务端以 EXT_MIME_MAP + magic number 为准,此处仅做前端预筛。
 */
const UPLOADABLE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'txt',
  'csv',
  'md',
  'json',
  'zip',
  'odt',
  'rtf',
  'epub',
  'mp4',
  'webm',
  'mov',
])

/** 上传端点(与 AttachmentsUpload 默认端点一致) */
const UPLOAD_ENDPOINT = '/api/files/upload/form'

/** /api/files/upload/form 响应 data 形状。
 * 标准 code=0 包装经 fetchApi 解包后为 { file };
 * 裸 success 包装(无 code 字段)时 fetchApi 把整个响应体作为 data 返回(即 data.data.file)。 */
interface UploadFormPayload {
  file?: { id?: string; path?: string; name?: string; size?: number; mimeType?: string }
  data?: { file?: { id?: string; path?: string; name?: string; size?: number; mimeType?: string } }
}

const generateId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

/**
 * 消息输入区 references 状态管理 hook(2026-07-29 提取自 message-input.tsx)
 *
 * 职责:
 * - 维护当前消息引用的列表(reference 列表)
 * - 提供 file / text / code 三种类型的添加、移除、重置方法
 * - 自动管理 objectURL 的释放(避免内存泄漏)
 *
 * 关键边界:
 * - addFileReference(2026-09-13 矩阵 A #19 放开)接受 image/*、video/* 与
 *   UPLOADABLE_EXTENSIONS 白名单扩展名,其他类型静默忽略;创建 ref(uploadState:'uploading')
 *   后立即异步上传到 /api/files/upload/form,按 ref.id 回写 fileId/serverUrl/uploadState,
 *   修复 blob: objectURL 仅本会话有效导致附件从未真正送达 AI 的断链
 * - addTextReference 自动 trim,空文本直接返回不创建 ref
 * - addCodeReference 接受代码 + 语言标签,沿用 'text' 类型存储(code 类型在
 *   ReferenceType 联合中未声明,后续若需要独立展示可扩展)
 * - removeReference 自动 revoke 被移除项的 objectURL
 * - resetReferences 不主动 revoke objectURL(doSend 中发送后已显式遍历 revoke)
 */
export function useMessageReferences(): {
  references: ReferenceItem[]
  addFileReference: (file: File) => void
  addTextReference: (text: string) => void
  addCodeReference: (code: string, language: string) => void
  removeReference: (id: string) => void
  resetReferences: () => void
} {
  const [references, setReferences] = React.useState<ReferenceItem[]>([])
  // 2026-08-02 修复 P1 内存泄露:用 ref 引用最新 references,
  // 供组件卸载时 cleanup 释放所有 objectURL。
  const refsRef = React.useRef(references)
  refsRef.current = references

  const addFileReference = React.useCallback((file: File) => {
    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')
    // 矩阵 A #19:非图片/视频文件按扩展名白名单放开(pdf/doc/md 等),其余仍静默忽略
    const dotIndex = file.name.lastIndexOf('.')
    const ext = dotIndex >= 0 ? file.name.slice(dotIndex + 1).toLowerCase() : ''
    if (!isImage && !isVideo && !UPLOADABLE_EXTENSIONS.has(ext)) return
    const objectUrl = URL.createObjectURL(file)
    const ref: ReferenceItem = {
      id: generateId(),
      type: isImage ? 'image' : isVideo ? 'video' : 'file',
      label: file.name,
      preview: `${file.name} · ${formatFileSize(file.size)}`,
      // 图片/视频仍用本地 objectURL 缩略图做即时预览;其他文件无缩略图
      thumbnail: isImage || isVideo ? objectUrl : undefined,
      size: file.size,
      uploadState: 'uploading',
    }
    setReferences((prev) => [...prev, ref])
    // 矩阵 A #19 断链修复:异步上传到服务端,成功后回写 serverUrl(公开 URL),
    // 发送时以 serverUrl 替代 blob: objectURL。fetchApi 统一承担鉴权/credentials。
    void (async () => {
      try {
        const formData = new FormData()
        formData.append('file', file, file.name)
        const res = await fetchApi<UploadFormPayload>(UPLOAD_ENDPOINT, {
          method: 'POST',
          body: formData,
          // 对齐 AttachmentsUpload:默认 30s 超时对大文件偏紧,放宽到 120s
          timeoutMs: 120_000,
        })
        if (!res.success) throw new Error(res.error ?? '附件上传失败')
        const f = res.data.file ?? res.data.data?.file
        // path 为服务端公开 URL(如 /api/files/<uuid>),以响应为准直接透传
        if (!f?.id || !f.path) throw new Error('上传响应缺少 file.id/file.path')
        setReferences((prev) =>
          prev.map((r) =>
            r.id === ref.id
              ? { ...r, fileId: f.id, serverUrl: f.path, uploadState: 'ready' as const }
              : r,
          ),
        )
      } catch {
        setReferences((prev) =>
          prev.map((r) => (r.id === ref.id ? { ...r, uploadState: 'error' as const } : r)),
        )
      }
    })()
  }, [])

  const addTextReference = React.useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const ref: ReferenceItem = {
      id: generateId(),
      type: 'text',
      label:
        trimmed.length > MAX_LABEL_LENGTH ? `${trimmed.slice(0, MAX_LABEL_LENGTH)}...` : trimmed,
      preview: trimmed,
    }
    setReferences((prev) => [...prev, ref])
  }, [])

  const addCodeReference = React.useCallback((code: string, language: string) => {
    const trimmed = code.trim()
    if (!trimmed) return
    const summary =
      trimmed.length > MAX_LABEL_LENGTH ? `${trimmed.slice(0, MAX_LABEL_LENGTH)}...` : trimmed
    const ref: ReferenceItem = {
      id: generateId(),
      type: 'text',
      label: language ? `${language} · ${summary}` : summary,
      preview: trimmed,
    }
    setReferences((prev) => [...prev, ref])
  }, [])

  const removeReference = React.useCallback((id: string) => {
    setReferences((prev) => {
      const removed = prev.find((r) => r.id === id)
      if (removed?.thumbnail) URL.revokeObjectURL(removed.thumbnail)
      return prev.filter((r) => r.id !== id)
    })
  }, [])

  // 2026-08-02 修复 P1 内存泄露:resetReferences 中释放所有 objectURL,
  // 原实现只清空数组不释放,用户添加图片后关闭对话框不发送会泄露 objectURL。
  // 仅对 thumbnail 以 'blob:' 开头的释放,避免误 revoke 非 blob URL。
  const resetReferences = React.useCallback(() => {
    setReferences((prev) => {
      prev.forEach((r) => {
        if (r.thumbnail && r.thumbnail.startsWith('blob:')) {
          URL.revokeObjectURL(r.thumbnail)
        }
      })
      return []
    })
  }, [])

  // 2026-08-02 修复 P1 内存泄露:组件卸载时释放 references 中所有 objectURL。
  React.useEffect(() => {
    return () => {
      refsRef.current.forEach((r) => {
        if (r.thumbnail && r.thumbnail.startsWith('blob:')) {
          URL.revokeObjectURL(r.thumbnail)
        }
      })
    }
  }, [])

  return {
    references,
    addFileReference,
    addTextReference,
    addCodeReference,
    removeReference,
    resetReferences,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
