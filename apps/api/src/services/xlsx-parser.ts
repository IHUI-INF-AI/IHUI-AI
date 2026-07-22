/**
 * XLSX/XLS/CSV 解析器 — 把电子表格转成纯文本 / Markdown 表格,供 RAG 切片入库。
 *
 * 设计:
 * - .xlsx → exceljs(现代 OOXML,支持合并单元格 / Date / 公式结果)
 * - .xls  → xlsx 库(老格式 BIFF,exceljs 不支持)
 * - .csv  → 直接 utf8 解码 + 手写 CSV 解析(支持引号 / 逗号 / 换行转义)
 *
 * 输出两种格式:
 * - text:     每行 `val1\tval2\tval3`,适合 RAG 按 \n 切片
 * - markdown: `| col1 | col2 |\n| --- | --- |\n| val1 | val2 |`,适合直接喂 LLM
 *
 * 大文件保护:>10MB 抛错(Excel 应转数据入库前先抽样)
 * 空表处理:全空 sheet 跳过
 * 合并单元格:左上角值填充到所有合并区单元格
 */

import exceljs from 'exceljs'
import type { Worksheet } from 'exceljs'
import { read, utils } from 'xlsx'

const { Workbook } = exceljs

/** 单文件上限 10MB(Excel 大文件应走数据导入而非 RAG 文档解析) */
export const XLSX_MAX_SIZE = 10 * 1024 * 1024

export class XlsxFileTooLargeError extends Error {
  readonly size: number
  constructor(size: number) {
    super(`XLSX file too large: ${size} bytes (max ${XLSX_MAX_SIZE} bytes)`)
    this.name = 'XlsxFileTooLargeError'
    this.size = size
  }
}

export interface XlsxSheetInfo {
  name: string
  rows: number
  cols: number
  headers?: string[]
  preview: string[][]
}

export interface XlsxParseResult {
  /** 纯文本:每行一个表格行,列用 \t 分隔,适合 RAG 分块 */
  text: string
  /** Markdown 表格格式,首行作 header */
  markdown: string
  /** 各 sheet 元信息 */
  sheets: XlsxSheetInfo[]
  /** 所有 sheet 非空行总数 */
  totalRows: number
}

// =============================================================================
// 内部工具
// =============================================================================

/** 把 exceljs 单元格值转为字符串(处理 number/string/boolean/Date/公式/富文本) */
function exceljsCellToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return String(value)
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    const v = value as {
      result?: unknown
      text?: string
      richText?: Array<{ text: string }>
      hyperlink?: string
    }
    // 公式单元格:取 result
    if ('result' in v && v.result !== undefined && v.result !== null) {
      return exceljsCellToString(v.result)
    }
    // 富文本:拼接 text
    if ('richText' in v && Array.isArray(v.richText)) {
      return v.richText.map((r) => r.text).join('')
    }
    // 超链接:优先 text
    if ('text' in v && typeof v.text === 'string') return v.text
  }
  return String(value)
}

/** 把 string[][] 矩阵转成 text(每行 \t 分隔) */
function matrixToText(matrix: string[][]): string {
  return matrix.map((row) => row.join('\t')).join('\n')
}

/** 把 string[][] 矩阵转成 markdown 表格(首行作 header) */
function matrixToMarkdown(matrix: string[][]): string {
  if (matrix.length === 0) return ''
  const header = matrix[0] ?? []
  const separator = header.map(() => '---').join(' | ')
  const lines = [`| ${header.join(' | ')} |`, `| ${separator} |`]
  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i] ?? []
    // 补齐列数(避免 markdown 表格错位)
    const padded = header.map((_, idx) => row[idx] ?? '')
    lines.push(`| ${padded.join(' | ')} |`)
  }
  return lines.join('\n')
}

/** 过滤全空行 */
function filterEmptyRows(matrix: string[][]): string[][] {
  return matrix.filter((row) => row.some((cell) => cell.trim() !== ''))
}

/** 从矩阵提取 sheet 信息(预览前 5 行,首行作 header) */
function buildSheetInfo(name: string, matrix: string[][]): XlsxSheetInfo {
  const nonEmpty = filterEmptyRows(matrix)
  const cols = nonEmpty.reduce((max, r) => Math.max(max, r.length), 0)
  const firstRow = nonEmpty[0]
  const headers = firstRow ? firstRow.map((c) => c.trim()) : undefined
  return {
    name,
    rows: nonEmpty.length,
    cols,
    ...(headers && headers.length > 0 ? { headers } : {}),
    preview: nonEmpty.slice(0, 5),
  }
}

// =============================================================================
// exceljs 路径(.xlsx / .xlsm)
// =============================================================================

/** 把 Excel 列字母(A/B/.../AA/AB/...)转为 1-based 列号 */
function colLettersToNumber(letters: string): number {
  let n = 0
  for (let i = 0; i < letters.length; i++) {
    n = n * 26 + (letters.charCodeAt(i) - 64)
  }
  return n
}

/** 解析 Excel 单元格地址(如 "A1")为 { row, col }(1-based) */
function parseAddress(addr: string): { row: number; col: number } | null {
  const m = /^([A-Z]+)(\d+)$/.exec(addr.toUpperCase())
  if (!m || !m[1] || !m[2]) return null
  return { row: parseInt(m[2], 10), col: colLettersToNumber(m[1]) }
}

/** 解析 Excel range 字符串(如 "A1:B2")为 { top, left, bottom, right }(1-based) */
function parseRange(range: string): { top: number; left: number; bottom: number; right: number } | null {
  const parts = range.split(':')
  const tl = parseAddress(parts[0] ?? '')
  const br = parts[1] ? parseAddress(parts[1]) : tl
  if (!tl || !br) return null
  return {
    top: Math.min(tl.row, br.row),
    left: Math.min(tl.col, br.col),
    bottom: Math.max(tl.row, br.row),
    right: Math.max(tl.col, br.col),
  }
}

/** 从 exceljs worksheet 构建 string[][] 矩阵,处理合并单元格 */
function exceljsWorksheetToMatrix(ws: Worksheet): string[][] {
  const rowCount = ws.rowCount
  const colCount = ws.columnCount
  const matrix: string[][] = []

  for (let r = 1; r <= rowCount; r++) {
    const row: string[] = []
    const excelRow = ws.getRow(r)
    for (let c = 1; c <= colCount; c++) {
      const cell = excelRow.getCell(c)
      row.push(exceljsCellToString(cell.value))
    }
    matrix.push(row)
  }

  // 合并单元格:左上角值填充到所有合并区单元格
  // exceljs model.merges 是 { [range: string]: string },key 是 "A1:B2",value 是 top-left 地址
  const merges = ws.model?.merges
  if (merges) {
    for (const rangeStr of Object.keys(merges)) {
      const range = parseRange(rangeStr)
      if (!range) continue
      const topLeftRow = matrix[range.top - 1]
      const topLeftValue = topLeftRow ? (topLeftRow[range.left - 1] ?? '') : ''
      for (let r = range.top - 1; r < range.bottom; r++) {
        const matrixRow = matrix[r]
        if (!matrixRow) continue
        for (let c = range.left - 1; c < range.right; c++) {
          // 只填充空单元格(避免覆盖已有值)
          if (!matrixRow[c]) matrixRow[c] = topLeftValue
        }
      }
    }
  }

  return matrix
}

/** 用 exceljs 解析 .xlsx/.xlsm,返回多 sheet 矩阵 */
async function parseWithExceljs(buffer: Buffer): Promise<Array<{ name: string; matrix: string[][] }>> {
  const workbook = new Workbook()
  // exceljs .d.ts 在全局声明了 `interface Buffer extends ArrayBuffer`,与 Node.js 的 Buffer(extends Uint8Array)类型冲突
  // 运行时完全兼容(Node Buffer 是 Uint8Array 子类,exceljs 内部用 Buffer.isBuffer / instanceof Uint8Array 检测)
  // @ts-expect-error exceljs Buffer(extends ArrayBuffer) vs Node Buffer(extends Uint8Array) 类型冲突,运行时兼容
  await workbook.xlsx.load(buffer)
  const sheets: Array<{ name: string; matrix: string[][] }> = []
  for (const ws of workbook.worksheets) {
    const matrix = filterEmptyRows(exceljsWorksheetToMatrix(ws))
    if (matrix.length > 0) {
      sheets.push({ name: ws.name, matrix })
    }
  }
  return sheets
}

// =============================================================================
// xlsx 库路径(.xls 老格式)
// =============================================================================

/** 用 xlsx 库解析 .xls,返回多 sheet 矩阵 */
function parseWithXlsxLib(buffer: Buffer): Array<{ name: string; matrix: string[][] }> {
  // xlsx 库 read 接受 Uint8Array(type:'array'),避免 Node Buffer<ArrayBufferLike> 类型不匹配
  const workbook = read(new Uint8Array(buffer), { type: 'array' })
  const sheets: Array<{ name: string; matrix: string[][] }> = []
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue
    // header:1 → 返回数组 of 数组(每行是值数组,不取第一行作 key)
    const rows = utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as unknown[][]
    const matrix: string[][] = rows.map((row) =>
      (row ?? []).map((cell) => (cell === null || cell === undefined ? '' : String(cell))),
    )
    const filtered = filterEmptyRows(matrix)
    if (filtered.length > 0) {
      sheets.push({ name: sheetName, matrix: filtered })
    }
  }
  return sheets
}

// =============================================================================
// CSV 路径
// =============================================================================

/** 手写 CSV 解析(支持引号包裹 / 逗号 / 双引号转义 / 换行) */
function parseCsvText(text: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!
    if (inQuotes) {
      if (char === '"') {
        const next = text[i + 1]
        if (next === '"') {
          currentField += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        currentField += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        currentRow.push(currentField)
        currentField = ''
      } else if (char === '\n') {
        currentRow.push(currentField)
        rows.push(currentRow)
        currentRow = []
        currentField = ''
      } else if (char === '\r') {
        // skip,下一轮 \n 会处理
      } else {
        currentField += char
      }
    }
  }
  // 最后一个字段
  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField)
    rows.push(currentRow)
  }
  return rows
}

/** CSV 解析:整文件当一个 sheet */
function parseCsvBuffer(buffer: Buffer): Array<{ name: string; matrix: string[][] }> {
  const text = buffer.toString('utf-8')
  const matrix = filterEmptyRows(parseCsvText(text))
  if (matrix.length === 0) return []
  return [{ name: 'Sheet1', matrix }]
}

// =============================================================================
// 汇总:多 sheet 矩阵 → XlsxParseResult
// =============================================================================

function buildResult(sheets: Array<{ name: string; matrix: string[][] }>): XlsxParseResult {
  const sheetInfos: XlsxSheetInfo[] = []
  const textParts: string[] = []
  const mdParts: string[] = []
  let totalRows = 0

  for (const sheet of sheets) {
    sheetInfos.push(buildSheetInfo(sheet.name, sheet.matrix))
    totalRows += sheet.matrix.length

    // text 格式:sheet 名做标题行 + 表格行
    if (sheets.length > 1) {
      textParts.push(`## ${sheet.name}`)
      mdParts.push(`### ${sheet.name}`)
    }
    textParts.push(matrixToText(sheet.matrix))
    const md = matrixToMarkdown(sheet.matrix)
    if (md) mdParts.push(md)
  }

  return {
    text: textParts.join('\n\n'),
    markdown: mdParts.join('\n\n'),
    sheets: sheetInfos,
    totalRows,
  }
}

// =============================================================================
// 公开 API
// =============================================================================

function assertSize(buffer: Buffer): void {
  if (buffer.length > XLSX_MAX_SIZE) {
    throw new XlsxFileTooLargeError(buffer.length)
  }
}

/** 解析 .xlsx / .xlsm(优先 exceljs,失败降级 xlsx 库) */
export async function parseXlsx(buffer: Buffer): Promise<XlsxParseResult> {
  assertSize(buffer)
  let sheets: Array<{ name: string; matrix: string[][] }> = []
  try {
    sheets = await parseWithExceljs(buffer)
  } catch (e) {
    // exceljs 解析失败(可能是 .xlsm 或非标准 OOXML)→ 降级 xlsx 库
    console.warn('[xlsx-parser.parseXlsx] exceljs failed, fallback to xlsx lib:', (e as Error).message)
    sheets = parseWithXlsxLib(buffer)
  }
  if (sheets.length === 0) {
    return { text: '', markdown: '', sheets: [], totalRows: 0 }
  }
  return buildResult(sheets)
}

/** 解析 .xls 老格式(xlsx 库独占,exceljs 不支持) */
export async function parseXls(buffer: Buffer): Promise<XlsxParseResult> {
  assertSize(buffer)
  const sheets = parseWithXlsxLib(buffer)
  if (sheets.length === 0) {
    return { text: '', markdown: '', sheets: [], totalRows: 0 }
  }
  return buildResult(sheets)
}

/** 解析 CSV(直接 utf8 解码 + 手写解析) */
export async function parseCsv(buffer: Buffer): Promise<XlsxParseResult> {
  assertSize(buffer)
  const sheets = parseCsvBuffer(buffer)
  if (sheets.length === 0) {
    return { text: '', markdown: '', sheets: [], totalRows: 0 }
  }
  return buildResult(sheets)
}
