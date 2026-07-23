/**
 * Design 模式跨端共享类型(2026-07-23 立)。
 * desktop 画布 + 元素选择器 + CSS 面板 + 评论到对话闭环。
 */

export interface DesignElement {
  id: string
  type: string
  style: Record<string, string>
  props: Record<string, string>
  text?: string
  children?: DesignElement[]
}

export interface DesignPreview {
  id: string
  userId: number
  name: string
  html: string
  createdAt: string
  updatedAt: string
}

export interface DesignComment {
  id: string
  previewId: string
  elementId: string
  userId: number
  userName: string
  content: string
  createdAt: string
}

export interface DesignPreviewRequest {
  name: string
  html: string
}

export interface DesignPreviewResponse {
  preview: DesignPreview
}
