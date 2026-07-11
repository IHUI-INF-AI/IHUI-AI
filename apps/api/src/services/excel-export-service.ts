/**
 * Excel 导入/导出服务。
 *
 * 迁移自旧架构 app/utils/excel_util.py（基于 openpyxl）。
 * 新架构使用 exceljs 库。
 *
 * 核心能力：
 * - exportToExcel：将数据列表导出为 Excel 文件（xlsx），支持表头样式/列宽/边框
 * - generateTemplate：生成带样式表头的导入模板
 * - importFromExcel：解析上传的 Excel 文件为数据列表
 */

import ExcelJS from 'exceljs'
import { extname } from 'node:path'

// =============================================================================
// 类型定义
// =============================================================================

/** 列类型。 */
export type ColumnType = 'str' | 'int' | 'float' | 'date'

/** 列描述符。 */
export interface ColumnDef {
  /** 表头文字 */
  header: string
  /** 数据字段名 */
  field: string
  /** 列宽（字符数），默认 18 */
  width?: number
  /** 列类型，默认 str */
  type?: ColumnType
}

/** 导出选项。 */
export interface ExportOptions {
  /** 工作表名称，默认 Sheet1 */
  sheetName?: string
  /** 列描述符列表 */
  columns: ColumnDef[]
  /** 文件名（可选，用于设置 Buffer 的 name 属性） */
  filename?: string
  /** 是否冻结表头，默认 true */
  freezeHeader?: boolean
}

/** 导入结果。 */
export interface ImportResult {
  /** 解析出的数据行 */
  rows: Array<Record<string, unknown>>
  /** 匹配到的列数 */
  matchedColumns: number
  /** 总行数（不含表头） */
  totalRows: number
}

// =============================================================================
// 样式常量
// =============================================================================

const DEFAULT_COL_WIDTH = 18

const HEADER_FONT: Partial<ExcelJS.Font> = {
  name: '微软雅黑',
  bold: true,
  size: 11,
  color: { argb: 'FFFFFFFF' },
}

const HEADER_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF4472C4' },
}

const HEADER_ALIGN: Partial<ExcelJS.Alignment> = {
  horizontal: 'center',
  vertical: 'middle',
  wrapText: true,
}

const DATA_ALIGN: Partial<ExcelJS.Alignment> = {
  horizontal: 'left',
  vertical: 'middle',
  wrapText: true,
}

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' as const },
  left: { style: 'thin' as const },
  bottom: { style: 'thin' as const },
  right: { style: 'thin' as const },
}

// =============================================================================
// 导出
// =============================================================================

/**
 * 将数据列表导出为 Excel 文件（xlsx）。
 *
 * 迁移自 Python export_to_excel。
 *
 * @param data 数据列表，每个 dict 的 key 应与 columns[*].field 匹配
 * @param options 导出选项
 * @returns 包含 xlsx 文件的 Buffer
 */
export async function exportToExcel(
  data: Array<Record<string, unknown>>,
  options: ExportOptions,
): Promise<Buffer> {
  const { columns, sheetName = 'Sheet1', filename, freezeHeader = true } = options

  const workbook = new ExcelJS.Workbook()
  const ws = workbook.addWorksheet(sheetName)

  // -- 表头行 --
  columns.forEach((colDef, i) => {
    const colIdx = i + 1
    const cell = ws.getCell(1, colIdx)
    cell.value = colDef.header
    cell.font = HEADER_FONT
    cell.fill = HEADER_FILL
    cell.alignment = HEADER_ALIGN
    cell.border = THIN_BORDER

    const width = colDef.width ?? DEFAULT_COL_WIDTH
    ws.getColumn(colIdx).width = width
  })

  // -- 数据行 --
  data.forEach((rowData, rowOffset) => {
    const rowIdx = rowOffset + 2
    columns.forEach((colDef, colI) => {
      const colIdx = colI + 1
      let value = rowData[colDef.field] ?? ''
      const colType = colDef.type ?? 'str'

      // 日期格式化
      if (colType === 'date' && value instanceof Date) {
        value = formatDate(value)
      }

      const cell = ws.getCell(rowIdx, colIdx)
      cell.value = value as ExcelJS.CellValue
      cell.alignment = DATA_ALIGN
      cell.border = THIN_BORDER
    })
  })

  // 冻结表头
  if (freezeHeader) {
    ws.views = [{ state: 'frozen', ySplit: 1 }]
  }

  // -- 写入 Buffer --
  const buffer = await workbook.xlsx.writeBuffer()
  const buf = Buffer.from(buffer)

  // 设置文件名（用于 StreamingResponse 推断下载名）
  if (filename) {
    Object.defineProperty(buf, 'name', {
      value: filename,
      enumerable: false,
      writable: false,
    })
  }

  return buf
}

// =============================================================================
// 模板生成
// =============================================================================

/**
 * 生成带样式表头的导入模板。
 *
 * 迁移自 Python generate_template。
 *
 * @param columns 列描述符
 * @param filename 文件名（可选）
 * @returns 包含 xlsx 文件的 Buffer
 */
export async function generateTemplate(columns: ColumnDef[], filename?: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const ws = workbook.addWorksheet('导入模板')

  // 表头行
  columns.forEach((colDef, i) => {
    const colIdx = i + 1
    const cell = ws.getCell(1, colIdx)
    cell.value = colDef.header
    cell.font = HEADER_FONT
    cell.fill = HEADER_FILL
    cell.alignment = HEADER_ALIGN
    cell.border = THIN_BORDER

    const width = colDef.width ?? DEFAULT_COL_WIDTH
    ws.getColumn(colIdx).width = width
  })

  // 示例提示行
  columns.forEach((colDef, i) => {
    const colIdx = i + 1
    const hint = typeHint(colDef.type ?? 'str')
    const cell = ws.getCell(2, colIdx)
    cell.value = hint
    cell.font = { color: { argb: 'FF999999' }, italic: true }
    cell.alignment = DATA_ALIGN
  })

  ws.views = [{ state: 'frozen', ySplit: 1 }]

  const buffer = await workbook.xlsx.writeBuffer()
  const buf = Buffer.from(buffer)

  if (filename) {
    Object.defineProperty(buf, 'name', {
      value: filename,
      enumerable: false,
      writable: false,
    })
  }

  return buf
}

// =============================================================================
// 导入
// =============================================================================

/**
 * 解析上传的 Excel 文件为数据列表。
 *
 * 迁移自 Python import_from_excel。
 * 第一行必须为表头，表头与 columns[*].header 匹配（不区分大小写、去除空白）。
 *
 * @param fileBytes xlsx 文件内容
 * @param columns 列描述符
 * @returns 解析结果
 */
export async function importFromExcel(
  fileBytes: Buffer | ArrayBuffer,
  columns: ColumnDef[],
): Promise<ImportResult> {
  const workbook = new ExcelJS.Workbook()
  // exceljs 在 index.d.ts 中声明了 `declare interface Buffer extends ArrayBuffer {}`，
  // 与 @types/node 的全局 Buffer 合并后导致 load() 参数类型不兼容。
  // 这里将输入统一拷贝为 ArrayBuffer，并通过宽松的 load 签名调用。
  const src = fileBytes instanceof ArrayBuffer ? fileBytes : fileBytes
  const loadData = new Uint8Array(src)
  const xlsxLoader = workbook.xlsx as unknown as {
    load: (data: Uint8Array | ArrayBuffer) => Promise<ExcelJS.Workbook>
  }
  await xlsxLoader.load(loadData)

  const ws = workbook.worksheets[0]
  if (!ws) {
    return { rows: [], matchedColumns: 0, totalRows: 0 }
  }

  // 构建 header → field 映射（不区分大小写）
  const headerToField = new Map<string, ColumnDef>()
  for (const colDef of columns) {
    headerToField.set(colDef.header.trim().toLowerCase(), colDef)
  }

  const rows: Array<Record<string, unknown>> = []
  let matchedColumns = 0
  let totalRows = 0
  let headers: (ColumnDef | null)[] = []

  ws.eachRow((row, rowIdx) => {
    // row.values 是一个稀疏数组，索引从 1 开始；转为普通数组并跳过索引 0
    const values = (row.values ?? []) as ExcelJS.CellValue[]
    const slice = values.slice(1)

    if (rowIdx === 1) {
      // 表头行：映射每个单元格到 field
      headers = slice.map((cell) => {
        const headerText = cellValueToString(cell)?.trim()?.toLowerCase() ?? ''
        return headerToField.get(headerText) ?? null
      })
      matchedColumns = headers.filter((h) => h !== null).length
      return
    }

    // 数据行
    const rowDict: Record<string, unknown> = {}
    for (let colI = 0; colI < slice.length; colI++) {
      const colDef = headers[colI]
      if (!colDef) continue
      const cellValue = slice[colI]
      if (cellValue === undefined || cellValue === null) continue
      const colType = colDef.type ?? 'str'
      rowDict[colDef.field] = coerceValue(cellValue, colType)
    }
    rows.push(rowDict)
    totalRows++
  })

  return { rows, matchedColumns, totalRows }
}

/** 将 ExcelJS CellValue 转为字符串。 */
function cellValueToString(value: ExcelJS.CellValue | undefined | null): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    if ('result' in value) return String(value.result ?? '')
    if ('text' in value) return String(value.text ?? '')
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((t: { text?: string }) => t.text ?? '').join('')
    }
  }
  return String(value)
}

// =============================================================================
// 内部辅助
// =============================================================================

/** 格式化日期为 YYYY-MM-DD HH:mm:ss。 */
function formatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  )
}

/** 类型提示文字。 */
function typeHint(colType: ColumnType): string {
  switch (colType) {
    case 'int':
      return '整数'
    case 'float':
      return '小数'
    case 'date':
      return '日期 (YYYY-MM-DD HH:MM:SS)'
    case 'str':
    default:
      return '文本'
  }
}

/** 将单元格值强制转换为期望的 Python/JS 类型。 */
function coerceValue(value: ExcelJS.CellValue, colType: ColumnType): unknown {
  if (value === null || value === undefined) return null

  try {
    if (colType === 'int') {
      return typeof value === 'number' ? Math.trunc(value) : parseInt(String(value), 10)
    }
    if (colType === 'float') {
      return typeof value === 'number' ? value : parseFloat(String(value))
    }
    if (colType === 'date') {
      if (value instanceof Date) return value
      return new Date(String(value).trim())
    }
  } catch {
    // 转换失败时回退为字符串
  }

  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return value
  return String(value).trim()
}

/**
 * 根据文件扩展名猜测 Content-Type。
 */
export function guessContentType(filename: string): string {
  const ext = extname(filename).toLowerCase()
  const typeMap: Record<string, string> = {
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.csv': 'text/csv',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.mp4': 'video/mp4',
    '.obj': 'application/octet-stream',
    '.glb': 'model/gltf-binary',
    '.stl': 'application/octet-stream',
  }
  return typeMap[ext] ?? 'application/octet-stream'
}
