// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]: document-annotation-pin-bridge

import { fetchApi } from '@/lib/api'

/**
 * 文档批注共享模型(2026-11-27 立)。
 *
 * 文档中心需要两份视图:
 *  - 侧栏线程:完整 record(作者、回复、状态);
 *  - 正文页内 pin:只保留定位所需的锚点与摘要,不把整条线程塞进 PDF/PPTX 渲染层。
 * 两类视图来自同一份服务端数据;`toPreviewAnnotationPin` 是唯一映射口径,避免
 * 侧栏能点到、页内找不到,或页内标了但线程不存在。
 */

export interface DocumentAnnotationRecord {
  id: string
  documentId: string
  parentId: string | null
  author: string
  body: string
  label: string
  anchorKind: string | null
  anchor: Record<string, unknown> | null
  excerpt: string | null
  status: 'open' | 'resolved'
  createdAt: string
  updatedAt: string
}

/** 页内标记:只支持有稳定页面/元素坐标的 PDF 与 PPTX。 */
export interface PreviewAnnotationPin {
  readonly id: string
  readonly kind: 'pdf' | 'pptx'
  readonly label: string
  readonly body: string
  readonly excerpt: string | null
  readonly status: 'open' | 'resolved'
  readonly page?: number
  readonly slide?: number
  readonly element?: string
}

function positiveInt(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

function textOf(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * 线程 record → 页内 pin。
 * 回复不生成 pin(只挂主线程);锚点不完整时返回 null,绝不猜页码/元素名。
 */
export function toPreviewAnnotationPin(record: DocumentAnnotationRecord): PreviewAnnotationPin | null {
  if (record.parentId) return null
  const anchor = record.anchor
  if (!anchor || typeof anchor !== 'object') return null
  const kind = textOf(anchor.kind)
  const label = record.label.trim()

  if (kind === 'pdf') {
    const page = positiveInt(anchor.page)
    if (page === null) return null
    return {
      id: record.id,
      kind: 'pdf',
      label: label || `PDF 第 ${page} 页`,
      body: record.body,
      excerpt: record.excerpt,
      status: record.status,
      page,
    }
  }

  if (kind === 'pptx') {
    const slide = positiveInt(anchor.slide)
    if (slide === null) return null
    const element = textOf(anchor.element)
    return {
      id: record.id,
      kind: 'pptx',
      label: label || `第 ${slide} 张${element ? ` · ${element}` : ''}`,
      body: record.body,
      excerpt: record.excerpt,
      status: record.status,
      slide,
      element: element || undefined,
    }
  }

  return null
}

export async function fetchDocumentAnnotations(
  documentId: string,
): Promise<DocumentAnnotationRecord[]> {
  const res = await fetchApi<DocumentAnnotationRecord[]>(
    `/api/feature-center/documents/annotations?documentId=${encodeURIComponent(documentId)}`,
  )
  if (!res.success) throw new Error(res.error)
  return res.data
}

export async function createDocumentAnnotation(input: {
  documentId: string
  body: string
  parentId?: string
}): Promise<DocumentAnnotationRecord> {
  const res = await fetchApi<DocumentAnnotationRecord>(
    '/api/feature-center/documents/annotations',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
  if (!res.success) throw new Error(res.error)
  return res.data
}

export async function updateDocumentAnnotation(
  id: string,
  documentId: string,
  status: 'open' | 'resolved',
): Promise<void> {
  const res = await fetchApi(`/api/feature-center/documents/annotations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ documentId, status }),
  })
  if (!res.success) throw new Error(res.error)
}

export async function deleteDocumentAnnotation(id: string, documentId: string): Promise<void> {
  const res = await fetchApi(`/api/feature-center/documents/annotations/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ documentId }),
  })
  if (!res.success) throw new Error(res.error)
}
