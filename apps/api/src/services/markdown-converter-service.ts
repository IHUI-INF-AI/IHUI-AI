// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 文件转 Markdown 服务。
 *
 * 2026-09-08 升级:引入 Firecrawl anydoc(Rust 原生解析引擎,NAPI)作为主提取路径,
 * 支持格式由 6 种扩展至 16 种:
 *   .doc / .docx / .ppt / .pptx / .xls / .xlsx / .xlsm / .ods / .odt / .odp /
 *   .rtf / .epub / .csv / .pdf / .txt / .md
 *
 * 分层策略:
 * - anydoc 主路径:GFM Markdown 高保真输出(标题/表格/列表/加粗/脚注),
 *   内容签名检测 + 扩展名兜底,老式二进制格式(doc/ppt/xls)与开放格式
 *   (odt/ods/odp/rtf/epub)全部由其独占支持
 * - 旧实现降级(仅 anydoc 加载失败或转换异常时):mammoth(.docx)、
 *   SheetJS(.xlsx)、ZIP+XML(.pptx)、FlateDecode(.pdf)
 * - .txt/.md:直接读取 UTF-8
 *
 * 导出:
 * - convertToMarkdown(path)         向后兼容,失败返回空字符串
 * - convertToMarkdownDetailed(path) 返回 { markdown, error? },供路由层给出具体文案
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { extname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { inflateRawSync } from 'node:zlib'
import mammoth from 'mammoth'
import * as XLSX from '@e965/xlsx'
import { logger } from '../utils/logger.js'
import { MAX_FILE_SIZE } from './document-parser.js'

// ============================================================================
// anydoc 主路径
// ============================================================================

/** anydoc 原生模块的最小接口(完整类型见 node_modules/@firecrawl/anydoc/index.d.ts)。 */
interface AnydocModule {
  toMarkdown: (path: string) => Promise<string>
  toMarkdownBytes: (bytes: Uint8Array, format?: string | null) => Promise<string>
  formatFromPath: (path: string) => string | null
  formatFromBytes: (bytes: Uint8Array) => string | null
  toDocument: (bytes: Uint8Array, format?: string | null) => Promise<AnydocDocument>
}

/** anydoc 文档模型(与 Python 绑定字段对应)。 */
interface AnydocAsset {
  id: number
  mediaType: string
  originPart: string
  data: Buffer
}
interface AnydocDocument {
  assets: AnydocAsset[]
  blocks: unknown[]
  notes: unknown[]
}

/** anydoc 转换错误(带 code 的 Error)。 */
interface AnydocError extends Error {
  code?: string
  /** needsOcr 专属:需要 OCR 的 1-based 页码。 */
  pages?: number[]
  pageCount?: number
}

let anydocModule: AnydocModule | null = null
let anydocLoadAttempted = false

/** 懒加载 anydoc(动态 import,加载失败不阻塞进程,降级旧实现)。 */
async function loadAnydoc(): Promise<AnydocModule | null> {
  if (anydocLoadAttempted) return anydocModule
  anydocLoadAttempted = true
  try {
    const mod = (await import('@firecrawl/anydoc')) as unknown as AnydocModule
    if (typeof mod.toMarkdown !== 'function') throw new Error('toMarkdown 导出缺失')
    anydocModule = mod
  } catch (e) {
    logger.warn('[markdown-converter] anydoc 模块加载失败,将降级旧实现', {
      error: (e as Error).message,
    })
  }
  return anydocModule
}

/** anydoc 主路径覆盖的扩展名(小写含点)。 */
const ANYDOC_EXTS = new Set([
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
  '.xlsm',
  '.ods',
  '.odt',
  '.odp',
  '.rtf',
  '.epub',
  '.csv',
  '.pdf',
])

/** 支持 toDocument 文档模型的扩展名(pdf 无文档模型,仅 to_markdown 直出)。 */
const ANYDOC_DOCUMENT_EXTS = new Set([
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
  '.xlsm',
  '.ods',
  '.odt',
  '.odp',
  '.rtf',
  '.epub',
])

/** 资产 mediaType -> 落盘扩展名(未知图片 .img,其余 .bin)。 */
const MEDIA_EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/bmp': '.bmp',
  'image/svg+xml': '.svg',
  'image/tiff': '.tif',
  'image/x-icon': '.ico',
  'image/avif': '.avif',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/octet-stream': '.bin',
}

/** 按 MIME 推导资产落盘扩展名。 */
function assetExtension(mediaType: string): string {
  if (!mediaType) return '.bin'
  const mt = mediaType.toLowerCase()
  if (MEDIA_EXTENSIONS[mt]) return MEDIA_EXTENSIONS[mt]
  if (mt.startsWith('image/')) return '.img'
  if (mt.startsWith('audio/')) return '.bin'
  return '.bin'
}

/** 把 anydoc 错误码翻译为面向用户的中文文案。 */
function describeAnydocError(e: unknown): string {
  const err = e as AnydocError
  switch (err?.code) {
    case 'unsupported':
      return '不支持的文件格式'
    case 'needsOcr': {
      const pages = Array.isArray(err.pages) ? err.pages.join('、') : ''
      return pages
        ? `该 PDF 第 ${pages} 页为扫描件/图片内容,需要 OCR 才能提取文字`
        : '该文档为扫描件/图片内容,需要 OCR 才能提取文字'
    }
    case 'malformed':
      return '文件结构损坏或内容不完整,无法解析'
    case 'encrypted':
      return '文件已加密(含密码保护),请先解除密码后重试'
    case 'resourceLimit':
      return '文件内容超出解析引擎的安全限制'
    case 'missingPart':
      return '归档不完整,缺少必要的内部部件(文件可能未上传完整)'
    case 'io':
      return '文件读取失败(磁盘 IO 错误)'
    default:
      return err?.message || '文档解析失败'
  }
}

// ============================================================================
// 降级实现 — .docx — mammoth
// ============================================================================

async function docxToMarkdown(filePath: string): Promise<string> {
  const result = await mammoth.extractRawText({ path: filePath })
  // 段落间已以空行分隔，直接返回
  return result.value
}

// ============================================================================
// 降级实现 — .xlsx — SheetJS
// ============================================================================

function xlsxToMarkdown(filePath: string): string {
  const workbook = XLSX.readFile(filePath)
  const sheets: string[] = []
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue
    // 转为 CSV 再格式化为 Markdown 表格
    const csv = XLSX.utils.sheet_to_csv(sheet, { FS: '\t', RS: '\n' })
    const lines = csv.split('\n').filter((l) => l.length > 0)
    if (lines.length === 0) continue
    const rows = lines.map((l) => l.split('\t'))
    sheets.push(formatAsMarkdownTable(sheetName, rows))
  }
  return sheets.join('\n\n')
}

function formatAsMarkdownTable(title: string, rows: string[][]): string {
  if (rows.length === 0) return `## ${title}\n`
  const colCount = Math.max(...rows.map((r) => r.length))
  // 补齐每行列数
  const padded = rows.map((r) => {
    const row = [...r]
    while (row.length < colCount) row.push('')
    return row
  })
  const header = `| ${padded[0]!.join(' | ')} |`
  const separator = `| ${Array(colCount).fill('---').join(' | ')} |`
  const body = padded.slice(1).map((r) => `| ${r.join(' | ')} |`)
  return `## ${title}\n\n${[header, separator, ...body].join('\n')}`
}

// ============================================================================
// 降级实现 — .pptx — 零依赖 ZIP + XML 文本提取
// ============================================================================

/** OOXML 命名空间下的文本标签。 */
const PPTX_TEXT_TAG = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g

function pptxToMarkdown(filePath: string): string {
  const entries = readZipEntries(filePath)
  const slideNames = Object.keys(entries)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort()
  const slides: string[] = []
  slideNames.forEach((name, idx) => {
    const xml = entries[name]!.toString('utf-8')
    const texts: string[] = []
    let m: RegExpExecArray | null
    PPTX_TEXT_TAG.lastIndex = 0
    while ((m = PPTX_TEXT_TAG.exec(xml)) !== null) {
      const t = decodeXmlEntities(m[1] ?? '')
      if (t.trim()) texts.push(t)
    }
    slides.push(`## Slide ${idx + 1}\n\n${texts.join('\n')}`)
  })
  return slides.join('\n\n')
}

// ============================================================================
// 零依赖 ZIP 读取（仅用于 .pptx 降级）
// ============================================================================

const EOCD_SIG = 0x06054b50
const CDH_SIG = 0x02014b50

/** 读取 ZIP 文件全部条目为 { 名称: Buffer } 映射。失败返回空对象。 */
function readZipEntries(filePath: string): Record<string, Buffer> {
  let buf: Buffer
  try {
    buf = readFileSync(filePath)
  } catch {
    return {}
  }
  const result: Record<string, Buffer> = {}
  // 定位 EOCD（从尾部搜索）
  const minEocd = 22
  const searchStart = Math.max(0, buf.length - 65557)
  let eocdOffset = -1
  for (let i = buf.length - minEocd; i >= searchStart; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocdOffset = i
      break
    }
  }
  if (eocdOffset < 0) return {}
  const cdOffset = buf.readUInt32LE(eocdOffset + 16)
  const cdCount = buf.readUInt16LE(eocdOffset + 10)
  let ptr = cdOffset
  for (let i = 0; i < cdCount; i++) {
    if (ptr + 46 > buf.length) break
    if (buf.readUInt32LE(ptr) !== CDH_SIG) break
    const method = buf.readUInt16LE(ptr + 10)
    const compressedSize = buf.readUInt32LE(ptr + 20)
    const nameLen = buf.readUInt16LE(ptr + 28)
    const extraLen = buf.readUInt16LE(ptr + 30)
    const commentLen = buf.readUInt16LE(ptr + 32)
    const localOffset = buf.readUInt32LE(ptr + 42)
    const name = buf.toString('utf-8', ptr + 46, ptr + 46 + nameLen)
    // 跳过目录条目
    if (!name.endsWith('/')) {
      const data = readZipEntryData(buf, localOffset, method, compressedSize)
      if (data) result[name] = data
    }
    ptr += 46 + nameLen + extraLen + commentLen
  }
  return result
}

/** 从 local header 读取条目数据并按需解压。 */
function readZipEntryData(
  buf: Buffer,
  localOffset: number,
  method: number,
  compressedSize: number,
): Buffer | null {
  if (localOffset + 30 > buf.length) return null
  if (buf.readUInt32LE(localOffset) !== 0x04034b50) return null
  const nameLen = buf.readUInt16LE(localOffset + 26)
  const extraLen = buf.readUInt16LE(localOffset + 28)
  const dataStart = localOffset + 30 + nameLen + extraLen
  const data = buf.subarray(dataStart, dataStart + compressedSize)
  if (method === 0) return Buffer.from(data) // stored
  if (method === 8) {
    try {
      return inflateRawSync(data)
    } catch {
      return null
    }
  }
  return null
}

/** 解码 XML 基础实体。 */
function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

// ============================================================================
// 降级实现 — .pdf — 零依赖 FlateDecode 文本提取
// ============================================================================

const PDF_TEXT_OP = /\(([^()\\]*)\)\s*Tj?/g
const PDF_TJ_ARRAY = /\[([^\]]*)\]\s*TJ/g

function pdfToMarkdown(filePath: string): string {
  let buf: Buffer
  try {
    buf = readFileSync(filePath)
  } catch {
    return ''
  }
  const text = buf.toString('latin1')
  const pages: string[] = []
  // 按页分割（/Type /Page），对每个 stream 尝试解压并提取文本
  const streamRegex = /stream\r?\n([\s\S]*?)endstream/g
  let sm: RegExpExecArray | null
  let currentPage: string[] = []
  let lastPos = 0
  while ((sm = streamRegex.exec(text)) !== null) {
    // 检查两个 stream 之间是否出现 /Page
    const between = text.slice(lastPos, sm.index)
    if (/\/Type\s*\/Page[^s]/.test(between) && currentPage.length > 0) {
      pages.push(currentPage.join(' '))
      currentPage = []
    }
    lastPos = streamRegex.lastIndex
    const raw = Buffer.from(sm[1] ?? '', 'latin1')
    // 尝试 zlib inflate（FlateDecode）
    let decoded = ''
    try {
      const inflated = inflateRawSync(raw)
      decoded = inflated.toString('latin1')
    } catch {
      // 非 FlateDecode 或已解压，直接用原文
      decoded = raw.toString('latin1')
    }
    // 提取 Tj 文本
    let tm: RegExpExecArray | null
    PDF_TEXT_OP.lastIndex = 0
    while ((tm = PDF_TEXT_OP.exec(decoded)) !== null) {
      const t = unescapePdfString(tm[1] ?? '')
      if (t.trim()) currentPage.push(t)
    }
    // 提取 TJ 数组文本
    PDF_TJ_ARRAY.lastIndex = 0
    while ((tm = PDF_TJ_ARRAY.exec(decoded)) !== null) {
      const arr = tm[1] ?? ''
      const parts: string[] = []
      const inner = /\(([^()\\]*)\)/g
      let im: RegExpExecArray | null
      while ((im = inner.exec(arr)) !== null) {
        parts.push(unescapePdfString(im[1] ?? ''))
      }
      const joined = parts.join('')
      if (joined.trim()) currentPage.push(joined)
    }
  }
  if (currentPage.length > 0) pages.push(currentPage.join(' '))
  if (pages.length === 0) return ''
  return pages.map((p, i) => `## Page ${i + 1}\n\n${p}`).join('\n\n')
}

/** 解码 PDF 字符串转义。 */
function unescapePdfString(s: string): string {
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
}

// ============================================================================
// 降级分发
// ============================================================================

/** anydoc 失败后按扩展名尝试旧实现;无对应降级实现的格式返回空串。 */
async function legacyToMarkdown(filePath: string, ext: string): Promise<string> {
  try {
    switch (ext) {
      case '.docx':
        return await docxToMarkdown(filePath)
      case '.xlsx':
      case '.xlsm':
        return xlsxToMarkdown(filePath)
      case '.pptx':
        return pptxToMarkdown(filePath)
      case '.pdf':
        return pdfToMarkdown(filePath)
      default:
        return ''
    }
  } catch (e) {
    logger.error('[markdown-converter] 降级实现失败', { ext, error: (e as Error).message })
    return ''
  }
}

// ============================================================================
// 主入口
// ============================================================================

export interface DetailedConvertResult {
  markdown: string
  /** 失败时的中文错误文案(供路由层直接返回)。 */
  error?: string
}

/**
 * 将任意支持的文件转为 Markdown 文本(详细版)。
 *
 * @param filePath 文件绝对/相对路径
 * @param originalName 原始文件名(可选)。落盘文件名常为无后缀 UUID(path=/uploads/<id>),
 *   类型判定须以原始文件名的扩展名为准;磁盘路径无后缀时,anydoc 走字节路径显式传格式。
 * @returns 成功返回 { markdown };失败返回 { markdown: '', error: 中文文案 }
 */
export async function convertToMarkdownDetailed(
  filePath: string,
  originalName?: string,
): Promise<DetailedConvertResult> {
  if (!filePath || !existsSync(filePath)) {
    return { markdown: '', error: '文件不存在或路径无效' }
  }
  // 类型判定优先用原始文件名(落盘名可能是无后缀 UUID)
  const ext = extname(originalName && extname(originalName) ? originalName : filePath).toLowerCase()
  // 磁盘文件自身是否有后缀(决定 anydoc 走路径还是字节路径)
  const diskExt = extname(filePath).toLowerCase()

  // .txt/.md:直接读取 UTF-8
  if (ext === '.txt' || ext === '.md' || ext === '.markdown') {
    try {
      return { markdown: readFileSync(filePath, 'utf-8') }
    } catch (e) {
      return { markdown: '', error: `文件读取失败: ${(e as Error).message}` }
    }
  }

  // anydoc 主路径
  if (ANYDOC_EXTS.has(ext)) {
    let anydocError: unknown = null
    const anydoc = await loadAnydoc()
    if (anydoc) {
      try {
        let md = ''
        if (diskExt) {
          md = await anydoc.toMarkdown(filePath)
        } else {
          // 落盘文件无后缀:读字节,优先 formatFromBytes 字节探测,再回退原始文件名格式
          const bytes = new Uint8Array(readFileSync(filePath))
          const fmt =
            anydoc.formatFromBytes?.(bytes) ?? anydoc.formatFromPath(originalName ?? filePath) ?? null
          md = await anydoc.toMarkdownBytes(bytes, fmt)
        }
        if (md && md.trim()) return { markdown: md }
        // 输出为空视为失败,继续降级
      } catch (e) {
        anydocError = e
        logger.error('[markdown-converter] anydoc 转换失败', {
          ext,
          code: (e as AnydocError)?.code ?? 'unknown',
          error: (e as Error).message,
        })
      }
    }
    // 旧实现降级(降级实现均按文件内容自识别,不依赖后缀)
    const legacy = await legacyToMarkdown(filePath, ext)
    if (legacy && legacy.trim()) {
      logger.warn('[markdown-converter] anydoc 失败,已由降级实现兜底', { ext })
      return { markdown: legacy }
    }
    if (!anydoc) {
      return { markdown: '', error: '文档解析引擎不可用(anydoc 模块加载失败),请检查部署依赖' }
    }
    return {
      markdown: '',
      error: anydocError ? describeAnydocError(anydocError) : '解析结果为空(文档可能无文本内容)',
    }
  }

  return { markdown: '', error: `不支持的文件类型: ${ext || '(无后缀)'}` }
}

/**
 * 将任意支持的文件转为 Markdown 文本(向后兼容包装)。
 *
 * @param filePath 文件绝对/相对路径
 * @returns Markdown 字符串；失败或不支持的类型返回空字符串
 */
export async function convertToMarkdown(filePath: string): Promise<string> {
  const result = await convertToMarkdownDetailed(filePath)
  return result.markdown
}

// ============================================================================
// 内嵌资产提取(extractDocumentAssets)
// ============================================================================

/** 提取出的单个资产。 */
export interface ExtractedAsset {
  id: number
  mediaType: string
  originPart: string
  /** 落盘扩展名(不含点,根据 MIME 推导;未知图片 image)。 */
  extension: string
  size: number
  /** 落盘后在 writeToDir 内的文件名(自生成 UUID,绝不复用服务器 originPart,防路径穿越)。 */
  filename: string
}

export interface ExtractAssetsResult {
  assets: ExtractedAsset[]
  /** pdf 等无文档模型格式:true 且 assets 为空,供前端提示"该格式不支持内嵌图片"。 */
  unsupported?: boolean
  /** 失败时的中文文案。 */
  error?: string
}

/**
 * 提取文档内嵌图片/对象资产并落盘到 writeToDir。
 *
 * @param filePath 源文件磁盘路径
 * @param originalName 原始文件名(可选;落盘名常为无后缀 UUID,用于格式判定/字节探测兜底)
 * @param writeToDir 资产落盘目录(路由层传 UPLOAD_DIR,并据此生成公开 URL)
 */
export async function extractDocumentAssets(
  filePath: string,
  originalName?: string,
  writeToDir?: string,
): Promise<ExtractAssetsResult> {
  if (!filePath || !existsSync(filePath)) {
    return { assets: [], error: '文件不存在或路径无效' }
  }
  const ext = extname(originalName && extname(originalName) ? originalName : filePath).toLowerCase()
  const diskExt = extname(filePath).toLowerCase()

  // .txt/.md 等纯文本无文档模型
  if (!ANYDOC_DOCUMENT_EXTS.has(ext) && ext !== '.pdf') {
    return { assets: [], error: `不支持资产提取的文件类型: ${ext || '(无后缀)'}` }
  }
  // pdf 仅支持 to_markdown,无文档模型:明确提示不支持
  if (ext === '.pdf') {
    return { assets: [], unsupported: true }
  }

  const anydoc = await loadAnydoc()
  if (!anydoc) {
    return { assets: [], error: '文档解析引擎不可用(anydoc 模块加载失败),请检查部署依赖' }
  }

  let bytes: Buffer
  try {
    bytes = readFileSync(filePath)
  } catch (e) {
    return { assets: [], error: `文件读取失败: ${(e as Error).message}` }
  }
  // to_document 会全量载入内存:超出上限直接拒绝
  if (bytes.length > MAX_FILE_SIZE) {
    const mb = Math.floor(MAX_FILE_SIZE / 1024 / 1024)
    return { assets: [], error: `文件超过 ${mb}MB 上限,无法提取内嵌资产` }
  }

  // 格式判定:磁盘有后缀优先;否则 formatFromBytes 字节探测;仍 null 回退原始文件名;再空则报错
  let fmt: string | null = null
  if (diskExt) {
    fmt = anydoc.formatFromPath(filePath)
  }
  if (!fmt) {
    fmt = anydoc.formatFromBytes?.(new Uint8Array(bytes)) ?? null
  }
  if (!fmt) {
    fmt = anydoc.formatFromPath(originalName ?? filePath)
  }
  if (!fmt) {
    return { assets: [], error: '无法识别文件格式,请为文件保留正确扩展名后重试' }
  }

  let doc: AnydocDocument
  try {
    doc = await anydoc.toDocument(new Uint8Array(bytes), fmt)
  } catch (e) {
    return { assets: [], error: describeAnydocError(e) }
  }

  const assets = doc.assets ?? []
  const outDir = writeToDir
  if (outDir && !existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  const out: ExtractedAsset[] = []
  for (const a of assets) {
    const extName = assetExtension(a.mediaType)
    // 自生成文件名,绝不复用 originPart(其可能含路径穿越载荷)
    const filename = `${randomUUID()}${extName}`
    const target = outDir ? join(outDir, filename) : ''
    if (outDir) writeFileSync(target, a.data)
    out.push({
      id: a.id,
      mediaType: a.mediaType,
      originPart: a.originPart,
      extension: extName.replace(/^\./, '') || 'bin',
      size: a.data?.length ?? 0,
      filename,
    })
  }
  return { assets: out }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
