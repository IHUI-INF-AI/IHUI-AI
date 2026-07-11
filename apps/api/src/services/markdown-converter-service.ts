/**
 * 文件转 Markdown 服务。
 *
 * 迁移自旧架构 server/app/services/markdown_converter.py。
 *
 * 支持：.docx / .xlsx / .pptx / .pdf / .txt / .md
 * - .docx：mammoth（提取纯文本，段落以空行分隔）
 * - .xlsx/.xlsm：xlsx（SheetJS，每 sheet 转 Markdown 表格）
 * - .pptx：零依赖 ZIP + XML 文本提取（无可用 pptx 库）
 * - .pdf：零依赖 FlateDecode 流文本提取（无可用 PDF 库）
 * - .txt/.md：直接读取 UTF-8 文本
 *
 * 失败时返回空字符串（与旧实现一致），不抛异常。
 */

import { readFileSync, existsSync } from 'node:fs'
import { extname } from 'node:path'
import { inflateRawSync } from 'node:zlib'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'

// ============================================================================
// .docx — mammoth
// ============================================================================

async function docxToMarkdown(filePath: string): Promise<string> {
  const result = await mammoth.extractRawText({ path: filePath })
  // 段落间已以空行分隔，直接返回
  return result.value
}

// ============================================================================
// .xlsx — SheetJS
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
// .pptx — 零依赖 ZIP + XML 文本提取
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
// 零依赖 ZIP 读取（仅用于 .pptx）
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
// .pdf — 零依赖 FlateDecode 文本提取
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
// 主入口
// ============================================================================

/**
 * 将任意支持的文件转为 Markdown 文本。
 *
 * @param filePath 文件绝对/相对路径
 * @returns Markdown 字符串；失败或不支持的类型返回空字符串
 */
export async function convertToMarkdown(filePath: string): Promise<string> {
  if (!filePath || !existsSync(filePath)) return ''
  const ext = extname(filePath).toLowerCase()
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
      case '.txt':
      case '.md':
      case '.markdown':
        return readFileSync(filePath, 'utf-8')
      default:
        return ''
    }
  } catch (e) {
    console.error('[markdown-converter] convert failed:', (e as Error).message)
    return ''
  }
}
