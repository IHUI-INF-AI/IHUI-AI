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
  /** human = 人工批注;ai = AI 预审官结论。旧数据缺省按 human。 */
  origin?: 'human' | 'ai'
  createdAt: string
  updatedAt: string
}

export interface AiReviewFinding {
  readonly title: string
  readonly severity: 'high' | 'medium' | 'low'
  readonly detail: string
  readonly evidence: string
  readonly suggestion: string
  /** PPTX 元素名;由服务端校验必须来自调用方给定元素集合 */
  readonly element?: string
  /** 全文预审时命中的 block 序号(1 起);单片段模式不返回 */
  readonly block?: number
}

/** 全文预审的一个可定位片段:anchor 与 text 必须成对,避免 AI 结论落不到页/元素。 */
export interface AiReviewBlock {
  readonly anchor: Record<string, unknown>
  readonly text: string
  readonly elements?: readonly { name: string; text: string }[]
}

/** 页内标记:PDF 页、PPTX 元素、DOCX 段落、XLSX 单元格/区域。 */
export interface PreviewAnnotationPin {
  readonly id: string
  readonly kind: 'pdf' | 'pptx' | 'docx' | 'xlsx'
  readonly label: string
  readonly body: string
  readonly excerpt: string | null
  readonly status: 'open' | 'resolved'
  readonly page?: number
  readonly slide?: number
  readonly element?: string
  /** DOCX 段落序号(1 起);仅 kind='docx' */
  readonly paragraph?: number
  /** XLSX 工作表名;仅 kind='xlsx' */
  readonly sheet?: string
  /** XLSX 选区(如 A2:C9);仅 kind='xlsx' */
  readonly range?: string
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
export function toPreviewAnnotationPin(
  record: DocumentAnnotationRecord,
): PreviewAnnotationPin | null {
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

  if (kind === 'docx') {
    const paragraph = positiveInt(anchor.paragraph)
    if (paragraph === null) return null
    return {
      id: record.id,
      kind: 'docx',
      label: label || `文档第 ${paragraph} 段`,
      body: record.body,
      excerpt: record.excerpt,
      status: record.status,
      paragraph,
    }
  }

  if (kind === 'xlsx') {
    const sheet = textOf(anchor.sheet)
    const range = textOf(anchor.range)
    if (!sheet || !range) return null
    return {
      id: record.id,
      kind: 'xlsx',
      label: label || `${sheet} · ${range}`,
      body: record.body,
      excerpt: record.excerpt,
      status: record.status,
      sheet,
      range,
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

/**
 * AI 预审官:对已定位的文档片段生成带证据的 findings。
 * 片段由查看器从已打开的 PDF/PPTX 中提取,服务端不按路径二次读盘。
 */
export async function reviewDocumentFragment(input: {
  title: string
  anchor: Record<string, unknown>
  text: string
  elements?: readonly { name: string; text: string }[]
}): Promise<AiReviewFinding[]> {
  const res = await fetchApi<{ findings: AiReviewFinding[] }>('/api/office/review', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!res.success) throw new Error(res.error)
  return res.data.findings
}

/**
 * AI 全文预审:一次把整份文档的多个可定位片段交给模型,要求模型用 block 回指位置。
 * 每个 block 都带 anchor,因此模型给出的结论能直接落成页/元素 pin,不需要二次猜坐标。
 */
export async function reviewDocumentBlocks(input: {
  title: string
  blocks: readonly AiReviewBlock[]
}): Promise<AiReviewFinding[]> {
  const res = await fetchApi<{ findings: AiReviewFinding[] }>('/api/office/review', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!res.success) throw new Error(res.error)
  return res.data.findings
}

/** 把 AI findings 落成页内 pin;同一位置同一结论由服务端去重。 */
export async function saveAiFindings(input: {
  documentId: string
  label: string
  anchorKind: string
  anchor: Record<string, unknown>
  findings: readonly AiReviewFinding[]
}): Promise<{ created: DocumentAnnotationRecord[]; skipped: number }> {
  const res = await fetchApi<{ created: DocumentAnnotationRecord[]; skipped: number }>(
    '/api/feature-center/documents/annotations/ai',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
  if (!res.success) throw new Error(res.error)
  return res.data
}
