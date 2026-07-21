/**
 * 文档解析器 — 把多格式文件 (PDF / DOCX / Markdown / Text / HTML) 转成纯文本。
 *
 * 用途:RAG 知识库 `ingestFile` 入库前的格式归一化层。
 *
 * 设计:
 * - PDF      → unpdf (extractText + getDocumentProxy,纯 ESM, 0 依赖冲突)
 * - DOCX     → mammoth.extractRawText({ buffer })
 * - Markdown → 原样 utf8(保留原始格式,切片时按行/段处理)
 * - Text     → 原样 utf8
 * - HTML     → 简单 regex 去标签 + 实体解码(避免引入 cheerio/node-html-parser)
 *
 * 错误契约:
 * - UnsupportedFormatError: MIME 未知 + 文件名后缀不匹配(路由层 400)
 * - FileTooLargeError:     > 20MB 拒绝(路由层 400, 防止 OOM)
 * - 其他:                  透传(路由层 500)
 */

import mammoth from 'mammoth'
import { extractText, getDocumentProxy } from 'unpdf'

/** 单文件上限 20MB(防止 OOM,与 Fastify multipart 全局 100MB 配合,本端点更严格) */
export const MAX_FILE_SIZE = 20 * 1024 * 1024

export class UnsupportedFormatError extends Error {
  readonly mime: string
  constructor(mime: string) {
    super(`Unsupported file format: ${mime || 'unknown'}`)
    this.name = 'UnsupportedFormatError'
    this.mime = mime
  }
}

export class FileTooLargeError extends Error {
  readonly size: number
  constructor(size: number) {
    super(`File too large: ${size} bytes (max ${MAX_FILE_SIZE} bytes)`)
    this.name = 'FileTooLargeError'
    this.size = size
  }
}

const PDF_MIME = 'application/pdf'
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const TEXT_MIME = 'text/plain'
const MD_MIME = 'text/markdown'
const HTML_MIME = 'text/html'

/** 按文件名后缀推断 MIME(MIME 缺失或 application/octet-stream 时兜底) */
function detectByExt(filename: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(filename)
  const ext = (m?.[1] ?? '').toLowerCase()
  if (ext === 'pdf') return PDF_MIME
  if (ext === 'docx') return DOCX_MIME
  if (ext === 'md' || ext === 'markdown') return MD_MIME
  if (ext === 'txt' || ext === 'log') return TEXT_MIME
  if (ext === 'html' || ext === 'htm') return HTML_MIME
  return ''
}

/** 把 HTML 转为纯文本(粗粒度,够 RAG 切片用,避免引入 cheerio) */
function htmlToText(html: string): string {
  // 1. 去掉 <script>/<style> 整段(包含内容)
  let s = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
  // 2. 块级标签换行
  s = s.replace(/<\/?(p|div|br|li|h[1-6]|tr|td|th|section|article|header|footer|nav|aside|main|blockquote|pre)\b[^>]*>/gi, '\n')
  // 3. 去掉其余标签
  s = s.replace(/<[^>]+>/g, '')
  // 4. 实体解码(只覆盖最常见的)
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCharCode(Number(n)))
  // 5. 收尾:折叠空行
  return s
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0)
    .join('\n')
}

/**
 * 解析入口:统一接受 (buffer, mimeType, filename) 三元组,
 * 自动选择对应解析器。
 */
export async function parseDocument(opts: {
  buffer: Buffer
  mimeType?: string
  filename: string
}): Promise<string> {
  const { buffer, filename } = opts
  if (buffer.length > MAX_FILE_SIZE) {
    throw new FileTooLargeError(buffer.length)
  }

  // MIME 解析优先级:显式传入(multipart 头的 mimetype) > 扩展名兜底
  const provided = (opts.mimeType ?? '').toLowerCase().trim()
  const mime = provided && provided !== 'application/octet-stream' ? provided : detectByExt(filename)

  if (mime === PDF_MIME) {
    // unpdf 接受 Uint8Array,Node Buffer 是其子类,直接传
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    const { text } = await extractText(pdf, { mergePages: true })
    return Array.isArray(text) ? text.join('\n\n') : text
  }

  if (mime === DOCX_MIME) {
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }

  if (mime === MD_MIME || mime === TEXT_MIME) {
    return buffer.toString('utf8')
  }

  if (mime === HTML_MIME) {
    return htmlToText(buffer.toString('utf8'))
  }

  throw new UnsupportedFormatError(mime || '(no mime)')
}
