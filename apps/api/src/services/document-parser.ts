// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 文档解析器 — 把多格式文件转成纯文本/Markdown,供 RAG 切片入库。
 *
 * 用途:RAG 知识库 `ingestFile` 入库前的格式归一化层。
 *
 * 2026-09-08 升级:引入 Firecrawl anydoc(Rust 原生解析引擎)作为主提取路径。
 * - PDF/DOCX      → anydoc 高保真 Markdown(保留标题/表格/列表),失败降级
 *                   unpdf / mammoth 旧实现
 * - PPTX/PPT/DOC/ODT/RTF/EPUB → anydoc 独占支持(此前完全无法入库)
 * - Markdown/Text → 原样 utf8(保留原始格式,切片时按行/段处理)
 * - HTML          → 简单 regex 去标签 + 实体解码
 * - XLSX/XLSM     → exceljs(优先)+ xlsx 库(降级),转 \t 分隔纯文本
 * - XLS           → xlsx 库(老格式 BIFF,exceljs 不支持)
 * - CSV           → 手写 CSV 解析(支持引号 / 逗号 / 换行转义)
 *
 * anydoc 错误语义:
 * - needsOcr(扫描件/图片型 PDF):直接抛出(降级实现同样无文字层,入库无意义)
 * - encrypted/malformed/resourceLimit/missingPart:PDF/DOCX 记日志降级旧实现,
 *   新格式直接抛出中文错误(路由层 500)
 *
 * 错误契约:
 * - UnsupportedFormatError: MIME 未知 + 文件名后缀不匹配(路由层 400)
 * - FileTooLargeError:     > 20MB 拒绝(路由层 400, 防止 OOM)
 * - 其他:                  透传(路由层 500)
 */

import mammoth from 'mammoth'
import { extractText, getDocumentProxy } from 'unpdf'
import { parseXlsx, parseXls, parseCsv } from './xlsx-parser.js'
import { logger } from '../utils/logger.js'

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

// ============================================================================
// anydoc 主路径(Rust 原生引擎,动态加载,失败不阻塞进程)
// ============================================================================

/** anydoc 原生模块的最小接口。 */
interface AnydocModule {
  toMarkdownBytes: (bytes: Uint8Array, format?: string | null) => Promise<string>
  formatFromPath: (path: string) => string | null
}

interface AnydocError extends Error {
  code?: string
}

let anydocModule: AnydocModule | null = null
let anydocLoadAttempted = false

async function loadAnydoc(): Promise<AnydocModule | null> {
  if (anydocLoadAttempted) return anydocModule
  anydocLoadAttempted = true
  try {
    const mod = (await import('@firecrawl/anydoc')) as unknown as AnydocModule
    if (typeof mod.toMarkdownBytes !== 'function') throw new Error('toMarkdownBytes 导出缺失')
    anydocModule = mod
  } catch (e) {
    logger.warn('[document-parser] anydoc 模块加载失败,新格式将不可用', {
      error: (e as Error).message,
    })
  }
  return anydocModule
}

/** 把 anydoc 错误码翻译为面向用户的中文文案。 */
function describeAnydocError(e: unknown): string {
  const err = e as AnydocError
  switch (err?.code) {
    case 'unsupported':
      return '不支持的文件格式'
    case 'needsOcr':
      return '该 PDF 为扫描件/图片内容,没有文字层,需要 OCR 才能提取'
    case 'malformed':
      return '文件结构损坏或内容不完整,无法解析'
    case 'encrypted':
      return '文件已加密(含密码保护),请先解除密码后重试'
    case 'resourceLimit':
      return '文件内容超出解析引擎的安全限制'
    case 'missingPart':
      return '归档不完整,缺少必要的内部部件(文件可能未上传完整)'
    case 'io':
      return '文件读取失败'
    default:
      return err?.message || '文档解析失败'
  }
}

// ============================================================================
// MIME 常量
// ============================================================================

const PDF_MIME = 'application/pdf'
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
const PPT_MIME = 'application/vnd.ms-powerpoint'
const DOC_MIME = 'application/msword'
const ODT_MIME = 'application/vnd.oasis.opendocument.text'
const RTF_MIME = 'application/rtf'
const RTF_MIME_ALT = 'text/rtf'
const EPUB_MIME = 'application/epub+zip'
const TEXT_MIME = 'text/plain'
const MD_MIME = 'text/markdown'
const HTML_MIME = 'text/html'
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const XLSX_MIME_ALT = 'application/vnd.ms-excel.sheet.macroEnabled.12' // .xlsm
const XLS_MIME = 'application/vnd.ms-excel'
const CSV_MIME = 'text/csv'

/** 走 anydoc 主路径的 MIME 集合(PDF/DOCX 失败可降级,新格式独占)。 */
const ANYDOC_MIMES = new Set([
  PDF_MIME,
  DOCX_MIME,
  PPTX_MIME,
  PPT_MIME,
  DOC_MIME,
  ODT_MIME,
  RTF_MIME,
  RTF_MIME_ALT,
  EPUB_MIME,
])

/** anydoc 失败后仍有降级实现的 MIME(unpdf / mammoth)。 */
const ANYDOC_FALLBACK_MIMES = new Set([PDF_MIME, DOCX_MIME])

/** 按文件名后缀推断 MIME(MIME 缺失或 application/octet-stream 时兜底) */
function detectByExt(filename: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(filename)
  const ext = (m?.[1] ?? '').toLowerCase()
  if (ext === 'pdf') return PDF_MIME
  if (ext === 'docx') return DOCX_MIME
  if (ext === 'pptx') return PPTX_MIME
  if (ext === 'ppt') return PPT_MIME
  if (ext === 'doc') return DOC_MIME
  if (ext === 'odt') return ODT_MIME
  if (ext === 'rtf') return RTF_MIME
  if (ext === 'epub') return EPUB_MIME
  if (ext === 'md' || ext === 'markdown') return MD_MIME
  if (ext === 'txt' || ext === 'log') return TEXT_MIME
  if (ext === 'html' || ext === 'htm') return HTML_MIME
  if (ext === 'xlsx' || ext === 'xlsm') return XLSX_MIME
  if (ext === 'xls') return XLS_MIME
  if (ext === 'csv') return CSV_MIME
  return ''
}

/** 把 HTML 转为纯文本(粗粒度,够 RAG 切片用,避免引入 cheerio) */
function htmlToText(html: string): string {
  // 1. 去掉 <script>/<style> 整段(包含内容)
  let s = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
  // 2. 块级标签换行
  s = s.replace(
    /<\/?(p|div|br|li|h[1-6]|tr|td|th|section|article|header|footer|nav|aside|main|blockquote|pre)\b[^>]*>/gi,
    '\n',
  )
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
 * 自动选择对应解析器。anydoc 主路径输出 GFM Markdown
 * (对 RAG 切片而言等价于纯文本,且保留结构信息)。
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
  const mime =
    provided && provided !== 'application/octet-stream' ? provided : detectByExt(filename)

  // ---- anydoc 主路径 ----
  const anydoc = await loadAnydoc()
  if (anydoc && ANYDOC_MIMES.has(mime)) {
    const fmt = anydoc.formatFromPath(filename)
    try {
      const md = await anydoc.toMarkdownBytes(new Uint8Array(buffer), fmt ?? null)
      if (md && md.trim()) return md
      // 输出为空:PDF/DOCX 降级旧实现,新格式抛错
      if (!ANYDOC_FALLBACK_MIMES.has(mime)) {
        throw new Error('解析结果为空(文档可能无文本内容)')
      }
      logger.warn('[document-parser] anydoc 输出为空,降级旧实现', { mime })
    } catch (e) {
      const code = (e as AnydocError)?.code
      // needsOcr:降级实现同样没有文字层,直接抛出明确错误
      if (code === 'needsOcr') throw new Error(describeAnydocError(e))
      // PDF/DOCX:记日志后降级旧实现;新格式:直接抛出中文错误
      if (!ANYDOC_FALLBACK_MIMES.has(mime)) {
        logger.error('[document-parser] anydoc 转换失败', {
          mime,
          code: code ?? 'unknown',
          error: (e as Error).message,
        })
        throw new Error(describeAnydocError(e))
      }
      logger.error('[document-parser] anydoc 转换失败,降级旧实现', {
        mime,
        code: code ?? 'unknown',
        error: (e as Error).message,
      })
    }
  }

  // ---- 旧实现 / 非 anydoc 格式 ----
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

  // XLSX / XLSM:exceljs 优先,xlsx 库降级
  if (mime === XLSX_MIME || mime === XLSX_MIME_ALT) {
    const result = await parseXlsx(buffer)
    return result.text
  }

  // XLS 老格式:xlsx 库独占
  if (mime === XLS_MIME) {
    const result = await parseXls(buffer)
    return result.text
  }

  // CSV:手写解析
  if (mime === CSV_MIME) {
    const result = await parseCsv(buffer)
    return result.text
  }

  throw new UnsupportedFormatError(mime || '(no mime)')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
