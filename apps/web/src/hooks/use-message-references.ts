'use client'

import * as React from 'react'

import { formatFileSize } from '@ihui/shared/utils/format'

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
}

const MAX_LABEL_LENGTH = 30

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
 * - addFileReference 仅接受 image/* 与 video/* 文件,其他类型静默忽略
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
    if (!isImage && !isVideo) return
    const objectUrl = URL.createObjectURL(file)
    const ref: ReferenceItem = {
      id: generateId(),
      type: isImage ? 'image' : 'video',
      label: file.name,
      preview: `${file.name} · ${formatFileSize(file.size)}`,
      thumbnail: objectUrl,
      size: file.size,
    }
    setReferences((prev) => [...prev, ref])
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
