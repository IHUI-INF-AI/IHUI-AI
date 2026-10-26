// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * PDF 工具服务端点(Wave2 2026-10-26,tools 域:web /tools/pdf/{merge,split,watermark} 的 RN 承载)。
 *
 * 覆盖端点(后端 apps/api/src/routes/other/pdf-routes.ts 已实装,不动):
 * - POST /api/pdf-service/merge     JSON {fileIds: uuid[≥2]} → 201 {taskId, operation, status:'done', fileCount}
 * - POST /api/pdf-service/split     JSON {fileId, ranges}    → 201 {taskId, ..., ranges, pageCount}
 * - POST /api/pdf-service/watermark JSON {fileId, text?, fontSize?, opacity?, rotation?} → 201 {taskId, ..., text, pageCount}
 * - GET  /api/pdf-service/result/:id → application/pdf 字节流(按 URL 直接下载)
 *
 * 口径说明:web 侧 useProcessApi 发的是 FormData(files),而后端 Zod 契约是 JSON fileIds/fileId,
 * web 三页提交恒失败 → NotAvailableAlert。RN 侧走真链路:选文件 → uploadFileBase64 拿 fileId
 * → 本端点提交 → pdfServiceResultUrl 下载结果。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi, normalizeUrlPublic } from '../client.js'

/** POST /pdf-service/{merge,split,watermark} 的信封 data 载荷(taskId 即结果文件名)。 */
export interface PdfProcessTask {
  taskId: string
  operation: 'merge' | 'split' | 'watermark'
  status: 'done'
  fileCount?: number
  ranges?: string
  pageCount?: number
  text?: string
}

/** 合并多个 PDF(≥2 个,fileId 来自 POST /files/upload/base64)。 */
export async function processPdfMerge(body: {
  fileIds: string[]
}): Promise<ApiResult<PdfProcessTask>> {
  return fetchApi<PdfProcessTask>('/api/pdf-service/merge', {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: 120_000,
  })
}

/** 按页码范围拆分 PDF(ranges 形如 "1-3,5,7-10",越界/非法后端当场 400)。 */
export async function processPdfSplit(body: {
  fileId: string
  ranges: string
}): Promise<ApiResult<PdfProcessTask>> {
  return fetchApi<PdfProcessTask>('/api/pdf-service/split', {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: 120_000,
  })
}

/** 逐页为 PDF 叠加文本水印(opacity 0-1;后端固定灰色居中渲染,颜色/位置仅前端预览)。 */
export async function processPdfWatermark(body: {
  fileId: string
  text?: string
  fontSize?: number
  opacity?: number
  rotation?: number
}): Promise<ApiResult<PdfProcessTask>> {
  return fetchApi<PdfProcessTask>('/api/pdf-service/watermark', {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: 120_000,
  })
}

/** 结果下载绝对 URL(GET /api/pdf-service/result/:taskId,返回 application/pdf 字节流)。 */
export function pdfServiceResultUrl(taskId: string): string {
  return normalizeUrlPublic(`/api/pdf-service/result/${encodeURIComponent(taskId)}`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
