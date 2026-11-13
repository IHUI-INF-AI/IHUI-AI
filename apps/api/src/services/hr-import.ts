// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { createHash } from 'node:crypto'
import ExcelJS from 'exceljs'
import { and, eq, inArray, isNull } from 'drizzle-orm'

import {
  hrAttendanceRecord,
  hrDepartment,
  hrEmployee,
  hrImportBatch,
  hrImportRow,
} from '@ihui/database'
import { judgeStatus } from '@ihui/attendance-core'
import { db } from '../db/index.js'
import { loadEnabledHrRule } from './hr-attendance.js'
import { logger } from '../utils/logger.js'
import { AppError } from '../errors/AppError.js'

/**
 * 考勤导入服务(HR-5 第 2 期,2026-11-12 立)。
 *
 * 定位:把飞书/钉钉/企业微信导出的打卡表变成系统内可核对的考勤记录。
 *
 * 铁律(准确性优先于自动化):
 *   1. 导入**先进暂存表**(hr_import_row),绝不直接写正式考勤表。
 *   2. 差异行(conflict)**必须人工裁决**才允许 confirm;
 *      未裁决的差异行会阻止整批 confirm(而不是悄悄跳过)。
 *   3. 已存在的系统记录**绝不自动覆盖**:命中即判 conflict,由人选择采用哪边。
 *   4. 同一文件重复上传按 SHA-256 拦下(防止同月重复导入把数据洗乱)。
 *
 * 解析口径:
 *   · 支持 .xlsx/.xls(ExcelJS)与 .csv(按行/逗号切分,支持双引号包裹)。
 *   · 表头行自动探测(前 10 行内挑"能识别出最多已知列"的那行),因为各家导出
 *     常在正式表头之上压公司名/月份/统计说明。
 *   · 列→字段映射靠**中文表头别名表**识别,识别不出的列留在 raw 里不丢;
 *     人工可覆盖映射后重新 parse(见 remapBatch)。
 */

/** 导入支持的标准化字段 */
export interface HrImportParsedFields {
  employeeNo?: string | null
  employeeName?: string | null
  /** YYYY-MM-DD */
  date?: string | null
  /** ISO 或 HH:mm:ss(当天内) */
  checkInTime?: string | null
  checkOutTime?: string | null
  /** 飞书/钉钉打卡结果原文,如 正常/迟到/早退/缺卡/旷工 */
  rawStatus?: string | null
}

/** 单行解析结果 */
export interface HrImportParsedRow {
  rowNumber: number
  raw: Record<string, string>
  parsed: HrImportParsedFields
}

/** 列映射:Excel 表头 → 标准化字段名 */
export type HrImportMapping = Record<string, keyof HrImportParsedFields>

/**
 * 中文表头别名表(单一真相源)。
 * 键 = 标准化字段,值 = 可识别的表头写法(已做去空格/去括号归一化后比较)。
 * 飞书/钉钉/企业微信/通用 Excel 常见写法都收进来,新增来源只需往这里加一行。
 */
const HEADER_ALIASES: Record<keyof HrImportParsedFields, readonly string[]> = {
  employeeNo: [
    '工号',
    '员工工号',
    '员工编号',
    '人员编号',
    '员工id',
    'employeeid',
    'employeeno',
    '工号/编号',
    '人员id',
  ],
  employeeName: ['姓名', '员工姓名', '人员姓名', '名字', 'name', 'employeename'],
  date: ['日期', '考勤日期', '打卡日期', '出勤日期', 'date', 'attendanceDate'.toLowerCase()],
  checkInTime: [
    '上班打卡',
    '上班打卡时间',
    '签到时间',
    '上班时间',
    '首次打卡',
    '上班1',
    'checkin',
    'checkintime',
    '打卡时间1',
  ],
  checkOutTime: [
    '下班打卡',
    '下班打卡时间',
    '签退时间',
    '下班时间',
    '末次打卡',
    '下班1',
    'checkout',
    'checkouttime',
    '打卡时间2',
  ],
  rawStatus: [
    '考勤结果',
    '打卡结果',
    '考勤状态',
    '状态',
    '出勤状态',
    '异常原因',
    'status',
    'result',
  ],
}

/** 表头归一化:去空白、全角括号转半角、转小写 */
function normalizeHeader(raw: string): string {
  return raw
    .replace(/\s+/g, '')
    .replace(/[（）]/g, (m) => (m === '（' ? '(' : ')'))
    .toLowerCase()
}

/** 从一行表头里识别字段映射;识别不出的表头不进映射(但仍保留在 raw 中) */
export function detectMapping(headers: string[]): HrImportMapping {
  const mapping: HrImportMapping = {}
  for (const header of headers) {
    const normalized = normalizeHeader(header)
    if (!normalized) continue
    for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [
      keyof HrImportParsedFields,
      readonly string[],
    ][]) {
      // 已映射过该字段则跳过(取最左匹配,避免"上班打卡2"抢占"上班打卡")
      if (mapping[header]) continue
      if (aliases.some((alias) => normalized === normalizeHeader(alias))) {
        mapping[header] = field
        break
      }
    }
  }
  return mapping
}

/** 映射得分 = 识别出的字段数(用于挑表头行 + 判断映射质量) */
function mappingScore(mapping: HrImportMapping): number {
  return new Set(Object.values(mapping)).size
}

/** 单元格值转字符串(ExcelJS 的 cell.value 可能是对象/富文本/公式) */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    // 富文本 / 超链接 / 公式
    if ('text' in value && typeof value.text === 'string') return value.text.trim()
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText
        .map((p) => ('text' in p && typeof p.text === 'string' ? p.text : ''))
        .join('')
        .trim()
    }
    if ('result' in value) return cellText(value.result as ExcelJS.CellValue)
    if ('hyperlink' in value && 'text' in value) return String(value.text).trim()
  }
  return String(value).trim()
}

/** 把二维表(表头 + 数据行)解析成行集合 */
export function parseMatrix(matrix: string[][]): {
  headers: string[]
  headerRowIndex: number
  mapping: HrImportMapping
  rows: HrImportParsedRow[]
} {
  // 表头行探测:前 10 行里挑识别字段最多的一行
  let headerRowIndex = -1
  let bestMapping: HrImportMapping = {}
  let bestScore = 0
  const scanLimit = Math.min(matrix.length, 10)
  for (let i = 0; i < scanLimit; i++) {
    const candidate = matrix[i] ?? []
    if (candidate.length === 0) continue
    const mapping = detectMapping(candidate)
    const score = mappingScore(mapping)
    if (score > bestScore) {
      bestScore = score
      bestMapping = mapping
      headerRowIndex = i
    }
  }
  if (headerRowIndex < 0 || bestScore === 0) {
    throw new AppError(
      '无法识别表头,请确认文件包含工号与日期列',
      400,
      'IMPORT_HEADER_NOT_RECOGNIZED',
    )
  }

  const headers = (matrix[headerRowIndex] ?? []).map((h) => h.trim())
  const rows: HrImportParsedRow[] = []
  for (let i = headerRowIndex + 1; i < matrix.length; i++) {
    const cells = matrix[i] ?? []
    // 整行空 → 跳过(各家导出末尾常有空行/合计行)
    if (cells.every((c) => !c || !c.trim())) continue
    const raw: Record<string, string> = {}
    headers.forEach((header, colIndex) => {
      if (!header) return
      raw[header] = (cells[colIndex] ?? '').trim()
    })
    const parsed: HrImportParsedFields = {}
    for (const [header, field] of Object.entries(bestMapping)) {
      parsed[field] = raw[header] ?? null
    }
    // 日期缺失 → 不是有效考勤数据行。
    // 打卡记录必然带日期;合计行(如「合计,,」)、说明行、小计行的日期列都是空的,
    // 若只判「工号与日期都缺」会让「合计」被当工号收进来,变成一条假 not_found。
    if (!parsed.date) continue
    rows.push({ rowNumber: i + 1, raw, parsed })
  }
  return { headers, headerRowIndex, mapping: bestMapping, rows }
}

/** 解析 Excel(.xlsx/.xls)缓冲区 */
async function parseExcelBuffer(buffer: Buffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer)
  const sheet = workbook.worksheets[0]
  if (!sheet) throw new AppError('文件中没有可读取的工作表', 400, 'IMPORT_EMPTY_SHEET')
  const matrix: string[][] = []
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = []
    // ExcelJS 的 row.values 是 1-based 稀疏数组
    const values = row.values as ExcelJS.CellValue[]
    for (let c = 1; c < values.length; c++) cells.push(cellText(values[c] ?? null))
    matrix.push(cells)
  })
  return matrix
}

/** 解析 CSV 缓冲区(支持双引号包裹与转义) */
export function parseCsvBuffer(buffer: Buffer): string[][] {
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '') // 去 BOM
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field.trim())
      field = ''
    } else if (ch === '\n') {
      row.push(field.trim())
      rows.push(row)
      row = []
      field = ''
    } else if (ch === '\r') {
      // 交给 \n 处理
    } else {
      field += ch
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.trim())
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c !== ''))
}

/** 按文件扩展名解析为二维表 */
async function parseFileToMatrix(fileName: string, buffer: Buffer): Promise<string[][]> {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.csv')) return parseCsvBuffer(buffer)
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return parseExcelBuffer(buffer)
  throw new AppError('仅支持 .xlsx / .xls / .csv 格式的打卡表', 400, 'IMPORT_UNSUPPORTED_FORMAT')
}

/** 把日期单元格归一为 YYYY-MM-DD;支持 2026-11-01 / 2026/11/1 / 20261101 / Excel 序列号 */
export function normalizeDateCell(value: string | null | undefined): string | null {
  if (!value) return null
  const raw = value.trim()
  if (!raw) return null
  // 2026-11-01 / 2026/11/1 / 2026.11.1
  const m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(raw)
  if (m) {
    const [, y, mo, d] = m
    return `${y}-${mo!.padStart(2, '0')}-${d!.padStart(2, '0')}`
  }
  // 20261101
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(raw)
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`
  // Excel 序列号(1900 系统):45000 左右对应 2023 年
  if (/^\d{5}(\.\d+)?$/.test(raw)) {
    const serial = Number(raw)
    const epoch = Date.UTC(1899, 11, 30)
    const d = new Date(epoch + serial * 86400_000)
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }
  return null
}

/**
 * 业务时区偏移(Asia/Shanghai = UTC+8,无夏令时)。
 * 与 apps/api/src/utils/biz-day.ts 的 BIZ_TIMEZONE 同源口径。
 *
 * 为什么要显式带偏移:飞书/钉钉导出的"09:12"是**业务本地时间**。
 * 若拼成不带时区的 `2026-11-01T09:12:00` 再交给 `new Date()`,解析结果取决于
 * **进程时区** —— 本机是 +08 时恰好对,生产容器跑 UTC 就会把 09:12 存成上海 17:12,
 * 迟到判定整片失真。这里钉死 +08:00,让结果与运行环境无关。
 */
const BIZ_TZ_OFFSET = '+08:00'

/**
 * 把时间单元格归一为 ISO 字符串(带显式业务时区偏移)。
 * - 仅 HH:mm / HH:mm:ss → 拼到 dateKey 并补 +08:00
 * - 已带时区标记(Z / ±HH:MM)→ 原样转 ISO
 * - 不带时区的完整日期时间 → 按业务时区(+08:00)解释
 */
export function normalizeTimeCell(
  value: string | null | undefined,
  dateKey: string | null,
): string | null {
  if (!value) return null
  const raw = value.trim()
  if (!raw) return null
  // 纯时间 HH:mm(:ss) —— 飞书/钉钉"打卡时间"最常见形态
  const hm = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(raw)
  if (hm) {
    if (!dateKey) return null
    const [, h, mi, s] = hm
    const hh = h!.padStart(2, '0')
    const dt = new Date(`${dateKey}T${hh}:${mi}:${s ?? '00'}${BIZ_TZ_OFFSET}`)
    return Number.isNaN(dt.getTime()) ? null : dt.toISOString()
  }
  // 已自带时区标记(Z 或 ±HH:MM / ±HHMM)→ 直接按绝对时刻解析
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw)) {
    const d = new Date(raw)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  // 不带时区的完整日期时间 → 按业务时区解释(不交给进程时区猜)
  const local = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(raw)
  if (local) {
    const [, y, mo, d, h, mi, s] = local
    const iso = `${y}-${mo!.padStart(2, '0')}-${d!.padStart(2, '0')}T${h!.padStart(2, '0')}:${mi}:${s ?? '00'}${BIZ_TZ_OFFSET}`
    const dt = new Date(iso)
    return Number.isNaN(dt.getTime()) ? null : dt.toISOString()
  }
  return null
}

/** 差异项 */
interface DiffItem {
  field: string
  systemValue: string | null
  importValue: string | null
}

/** 匹配结果分类 */
export type HrImportMatchStatus = 'matched' | 'conflict' | 'not_found' | 'duplicate'

/**
 * 上传并解析:创建批次 + 逐行落暂存。
 * 返回批次与统计;此处**不写正式考勤表**。
 */
export async function createImportBatch(params: {
  periodMonth: string
  fileName: string
  storageFileId: string
  buffer: Buffer
  uploadedBy?: string | undefined
}): Promise<{
  batch: typeof hrImportBatch.$inferSelect
  preview: HrImportParsedRow[]
  mapping: HrImportMapping
}> {
  const { periodMonth, fileName, storageFileId, buffer, uploadedBy } = params

  if (!/^\d{4}-\d{2}$/.test(periodMonth)) {
    throw new AppError('考勤月份格式必须是 YYYY-MM', 400, 'IMPORT_BAD_PERIOD')
  }
  if (buffer.length === 0) {
    throw new AppError('上传文件为空', 400, 'IMPORT_EMPTY_FILE')
  }

  const fileHash = createHash('sha256').update(buffer).digest('hex')

  // 同一份文件重复导入 → 拦下(同月同文件必然重复)
  const [sameFile] = await db
    .select({ id: hrImportBatch.id, periodMonth: hrImportBatch.periodMonth })
    .from(hrImportBatch)
    .where(and(eq(hrImportBatch.fileHash, fileHash), eq(hrImportBatch.periodMonth, periodMonth)))
    .limit(1)
  if (sameFile) {
    throw new AppError(
      `该文件已在 ${sameFile.periodMonth} 导入过(批次 ${sameFile.id}),请勿重复导入`,
      409,
      'IMPORT_DUPLICATE_FILE',
    )
  }

  const matrix = await parseFileToMatrix(fileName, buffer)
  const { mapping, rows } = parseMatrix(matrix)

  if (rows.length === 0) {
    throw new AppError('文件中没有识别出有效数据行', 400, 'IMPORT_NO_ROWS')
  }

  // 先建批次(文件已由调用方存 storage)
  const [batch] = await db
    .insert(hrImportBatch)
    .values({
      periodMonth,
      storageFileId,
      fileName,
      fileHash,
      status: 'parsing',
      totalRows: rows.length,
      mappingConfig: mapping,
      uploadedBy: uploadedBy ?? null,
    })
    .returning()
  if (!batch) throw new AppError('创建导入批次失败', 500, 'IMPORT_BATCH_CREATE_FAILED')

  try {
    await matchAndStageRows(batch.id, rows, mapping)
    const [updated] = await db
      .select()
      .from(hrImportBatch)
      .where(eq(hrImportBatch.id, batch.id))
      .limit(1)
    return {
      batch: updated ?? batch,
      preview: rows.slice(0, 20),
      mapping,
    }
  } catch (err) {
    // 解析失败 → 批次标记 rejected,避免半成品批次挂在 pending
    await db
      .update(hrImportBatch)
      .set({ status: 'rejected', updatedAt: new Date() })
      .where(eq(hrImportBatch.id, batch.id))
    logger.error('考勤导入解析失败', { err, batchId: batch.id })
    throw err
  }
}

/**
 * 逐行匹配并落暂存表。
 * 匹配键:工号(hr_employee.employee_no,唯一索引 uq_hr_emp_no)。
 * 比对对象:同员工同日期的现有 hr_attendance_record。
 *
 * 导出(2026-11-13):考勤同步器(attendance-sync)复用本函数落暂存行,
 * 确保判重/conflict/notFound 口径单一真相源,同步与文件导入不漂移。
 */
export async function matchAndStageRows(
  batchId: string,
  rows: HrImportParsedRow[],
  _mapping: HrImportMapping,
): Promise<void> {
  // 一次性取回本批涉及的所有工号对应员工(避免 N+1)
  const employeeNos = [...new Set(rows.map((r) => r.parsed.employeeNo).filter(Boolean))] as string[]
  const employees =
    employeeNos.length > 0
      ? await db
          .select({
            id: hrEmployee.id,
            employeeNo: hrEmployee.employeeNo,
            name: hrEmployee.name,
            departmentId: hrEmployee.departmentId,
            status: hrEmployee.status,
          })
          .from(hrEmployee)
          .where(and(inArray(hrEmployee.employeeNo, employeeNos), isNull(hrEmployee.deletedAt)))
      : []
  const empByNo = new Map(employees.map((e) => [e.employeeNo, e]))

  // 取回已有打卡记录(同员工 + 日期落在本批范围内)
  const dateKeys = [
    ...new Set(rows.map((r) => normalizeDateCell(r.parsed.date)).filter(Boolean)),
  ] as string[]
  const empIds = employees.map((e) => e.id)
  const existingRecords =
    empIds.length > 0 && dateKeys.length > 0
      ? await db
          .select({
            id: hrAttendanceRecord.id,
            employeeId: hrAttendanceRecord.employeeId,
            departmentId: hrAttendanceRecord.departmentId,
            date: hrAttendanceRecord.date,
            checkInTime: hrAttendanceRecord.checkInTime,
            checkOutTime: hrAttendanceRecord.checkOutTime,
            status: hrAttendanceRecord.status,
          })
          .from(hrAttendanceRecord)
          .where(
            and(
              inArray(hrAttendanceRecord.employeeId, empIds),
              inArray(hrAttendanceRecord.date, dateKeys),
              isNull(hrAttendanceRecord.deletedAt),
            ),
          )
      : []
  const recordByEmpDate = new Map(
    existingRecords.map((r) => [`${r.employeeId}|${r.date}`, r] as const),
  )

  const staged: (typeof hrImportRow.$inferInsert)[] = []
  const seenKeys = new Set<string>()
  let matched = 0
  let conflict = 0
  let notFound = 0

  for (const row of rows) {
    const employeeNo = row.parsed.employeeNo?.trim() ?? ''
    const dateKey = normalizeDateCell(row.parsed.date)
    const checkInTime = normalizeTimeCell(row.parsed.checkInTime, dateKey)
    const checkOutTime = normalizeTimeCell(row.parsed.checkOutTime, dateKey)

    const parsedNorm = {
      employeeNo: employeeNo || null,
      employeeName: row.parsed.employeeName?.trim() ?? null,
      date: dateKey,
      checkInTime,
      checkOutTime,
      rawStatus: row.parsed.rawStatus?.trim() ?? null,
    }

    // 工号缺失 → not_found(无法定位人,必须人工看)
    if (!employeeNo) {
      notFound++
      staged.push({
        batchId,
        rowNumber: row.rowNumber,
        employeeNo: null,
        raw: row.raw,
        parsed: parsedNorm,
        matchStatus: 'not_found',
        diffDetail: [{ field: 'employeeNo', systemValue: null, importValue: null }],
      })
      continue
    }

    const emp = empByNo.get(employeeNo)
    if (!emp || emp.status !== 'active') {
      notFound++
      staged.push({
        batchId,
        rowNumber: row.rowNumber,
        employeeNo,
        raw: row.raw,
        parsed: parsedNorm,
        matchStatus: 'not_found',
        diffDetail: [
          {
            field: 'employeeNo',
            systemValue: null,
            importValue: employeeNo,
          },
        ],
      })
      continue
    }

    // 同批同工号同日期重复 → duplicate
    const dedupeKey = `${emp.id}|${dateKey ?? ''}`
    if (dateKey && seenKeys.has(dedupeKey)) {
      staged.push({
        batchId,
        rowNumber: row.rowNumber,
        employeeNo,
        raw: row.raw,
        parsed: parsedNorm,
        matchStatus: 'duplicate',
        diffDetail: [{ field: 'date', systemValue: null, importValue: dateKey }],
      })
      continue
    }
    if (dateKey) seenKeys.add(dedupeKey)

    const existing = dateKey ? recordByEmpDate.get(`${emp.id}|${dateKey}`) : undefined
    if (!existing) {
      // 系统无记录 → matched(可直接写入)
      matched++
      staged.push({
        batchId,
        rowNumber: row.rowNumber,
        employeeNo,
        raw: row.raw,
        parsed: parsedNorm,
        matchStatus: 'matched',
      })
      continue
    }

    // 系统已有记录 → 比字段,有差异即 conflict(绝不自动覆盖)
    const diffs: DiffItem[] = []
    const sysIn = existing.checkInTime ? existing.checkInTime.toISOString() : null
    const sysOut = existing.checkOutTime ? existing.checkOutTime.toISOString() : null
    if (checkInTime && sysIn !== checkInTime) {
      diffs.push({ field: 'checkInTime', systemValue: sysIn, importValue: checkInTime })
    }
    if (checkOutTime && sysOut !== checkOutTime) {
      diffs.push({ field: 'checkOutTime', systemValue: sysOut, importValue: checkOutTime })
    }
    if (diffs.length > 0) {
      conflict++
      staged.push({
        batchId,
        rowNumber: row.rowNumber,
        employeeNo,
        raw: row.raw,
        parsed: parsedNorm,
        matchStatus: 'conflict',
        diffDetail: diffs,
      })
    } else {
      // 完全一致 → matched(幂等,无需裁决)
      matched++
      staged.push({
        batchId,
        rowNumber: row.rowNumber,
        employeeNo,
        raw: row.raw,
        parsed: parsedNorm,
        matchStatus: 'matched',
      })
    }
  }

  // 分批插入,避免单条 SQL 参数超限
  const CHUNK = 500
  for (let i = 0; i < staged.length; i += CHUNK) {
    await db.insert(hrImportRow).values(staged.slice(i, i + CHUNK))
  }

  await db
    .update(hrImportBatch)
    .set({
      status: 'pending_review',
      matchedRows: matched,
      conflictRows: conflict,
      notFoundRows: notFound,
      updatedAt: new Date(),
    })
    .where(eq(hrImportBatch.id, batchId))
}

/** 列出导入批次 */
export async function listImportBatches(params: {
  periodMonth?: string | undefined
  limit?: number | undefined
}): Promise<(typeof hrImportBatch.$inferSelect)[]> {
  const limit = Math.min(params.limit ?? 50, 200)
  const rows = await db
    .select()
    .from(hrImportBatch)
    .where(params.periodMonth ? eq(hrImportBatch.periodMonth, params.periodMonth) : undefined)
    .orderBy(hrImportBatch.createdAt)
    .limit(limit)
  return rows
}

/** 批次详情(含行明细,支持按状态过滤) */
export async function getImportBatchDetail(
  batchId: string,
  opts?: { matchStatus?: string | undefined; limit?: number | undefined },
): Promise<{
  batch: typeof hrImportBatch.$inferSelect
  rows: (typeof hrImportRow.$inferSelect)[]
}> {
  const [batch] = await db
    .select()
    .from(hrImportBatch)
    .where(eq(hrImportBatch.id, batchId))
    .limit(1)
  if (!batch) throw new AppError('导入批次不存在', 404, 'IMPORT_BATCH_NOT_FOUND')

  const limit = Math.min(opts?.limit ?? 500, 2000)
  const filters = [eq(hrImportRow.batchId, batchId)]
  if (opts?.matchStatus) filters.push(eq(hrImportRow.matchStatus, opts.matchStatus))
  const rows = await db
    .select()
    .from(hrImportRow)
    .where(and(...filters))
    .orderBy(hrImportRow.rowNumber)
    .limit(limit)
  return { batch, rows }
}

/**
 * 人工裁决单行。
 * resolution: adopt_import(采用导入值) / keep_system(保留系统值) / manual(人工填写 finalValue)
 */
export async function resolveImportRow(params: {
  rowId: string
  resolution: 'adopt_import' | 'keep_system' | 'manual'
  finalValue?: HrImportParsedFields | undefined
  resolvedBy?: string | undefined
}): Promise<typeof hrImportRow.$inferSelect> {
  const { rowId, resolution, finalValue, resolvedBy } = params
  const [row] = await db.select().from(hrImportRow).where(eq(hrImportRow.id, rowId)).limit(1)
  if (!row) throw new AppError('导入行不存在', 404, 'IMPORT_ROW_NOT_FOUND')

  const [batch] = await db
    .select()
    .from(hrImportBatch)
    .where(eq(hrImportBatch.id, row.batchId))
    .limit(1)
  if (!batch) throw new AppError('导入批次不存在', 404, 'IMPORT_BATCH_NOT_FOUND')
  if (batch.status === 'verified') {
    throw new AppError('该批次已写入正式考勤,不能再改裁决', 409, 'IMPORT_BATCH_VERIFIED')
  }

  let adopted: HrImportParsedFields | null = null
  if (resolution === 'adopt_import') {
    adopted = (row.parsed ?? {}) as HrImportParsedFields
  } else if (resolution === 'keep_system') {
    adopted = null
  } else {
    if (!finalValue) {
      throw new AppError('人工裁决必须提供 finalValue', 400, 'IMPORT_MANUAL_VALUE_REQUIRED')
    }
    adopted = finalValue
  }

  const [updated] = await db
    .update(hrImportRow)
    .set({
      resolved: true,
      resolution,
      finalValue: adopted,
      resolvedBy: resolvedBy ?? null,
      resolvedAt: new Date(),
    })
    .where(eq(hrImportRow.id, rowId))
    .returning()
  if (!updated) throw new AppError('裁决写入失败', 500, 'IMPORT_ROW_RESOLVE_FAILED')
  return updated
}

/**
 * 确认批次:把暂存行写入正式考勤记录。
 *
 * 前置:本批所有 conflict 行必须已 resolved(否则拒绝,不让差异悄悄漏过)。
 * 写入口径:
 *   · matched 行 → insert(系统原本无记录)
 *   · conflict + adopt_import/manual → 覆盖系统记录(update)
 *   · conflict + keep_system → 跳过
 *   · not_found / duplicate → 一律不写,留给人处理
 */
export async function confirmImportBatch(params: {
  batchId: string
  operatedBy?: string | undefined
}): Promise<{
  batchId: string
  inserted: number
  updated: number
  skipped: number
  unresolvedConflicts: number
}> {
  const { batchId, operatedBy } = params

  const [batch] = await db
    .select()
    .from(hrImportBatch)
    .where(eq(hrImportBatch.id, batchId))
    .limit(1)
  if (!batch) throw new AppError('导入批次不存在', 404, 'IMPORT_BATCH_NOT_FOUND')
  if (batch.status === 'verified') {
    throw new AppError('该批次已确认写入,不可重复确认', 409, 'IMPORT_BATCH_ALREADY_VERIFIED')
  }

  const rows = await db.select().from(hrImportRow).where(eq(hrImportRow.batchId, batchId))

  // 未裁决的 conflict 必须拦住
  const unresolved = rows.filter((r) => r.matchStatus === 'conflict' && !r.resolved)
  if (unresolved.length > 0) {
    throw new AppError(
      `还有 ${unresolved.length} 条差异行未裁决,必须先逐条处理才能确认`,
      409,
      'IMPORT_HAS_UNRESOLVED_CONFLICTS',
    )
  }

  const employeeNos = [...new Set(rows.map((r) => r.employeeNo).filter(Boolean))] as string[]
  const employees =
    employeeNos.length > 0
      ? await db
          .select({
            id: hrEmployee.id,
            employeeNo: hrEmployee.employeeNo,
            departmentId: hrEmployee.departmentId,
          })
          .from(hrEmployee)
          .where(and(inArray(hrEmployee.employeeNo, employeeNos), isNull(hrEmployee.deletedAt)))
      : []
  const empByNo = new Map(employees.map((e) => [e.employeeNo, e]))

  let inserted = 0
  let updated = 0
  let skipped = 0

  for (const row of rows) {
    const payload = ((row.resolved ? row.finalValue : null) ??
      row.parsed ??
      {}) as HrImportParsedFields
    const employeeNo = payload.employeeNo ?? row.employeeNo
    const dateKey = normalizeDateCell(payload.date)
    const checkInTime = normalizeTimeCell(payload.checkInTime, dateKey)
    const checkOutTime = normalizeTimeCell(payload.checkOutTime, dateKey)

    // keep_system → 明确跳过
    if (row.matchStatus === 'conflict' && row.resolution === 'keep_system') {
      skipped++
      continue
    }
    // not_found / duplicate 不写
    if (row.matchStatus === 'not_found' || row.matchStatus === 'duplicate') {
      skipped++
      continue
    }

    const emp = employeeNo ? empByNo.get(employeeNo) : undefined
    if (!emp || !dateKey) {
      skipped++
      continue
    }

    const rule = await loadEnabledHrRule(emp.departmentId)
    const inDate = checkInTime ? new Date(checkInTime) : null
    const outDate = checkOutTime ? new Date(checkOutTime) : null
    const status = judgeStatus({
      lateAfter: rule?.lateAfter ?? null,
      earlyBefore: rule?.earlyBefore ?? null,
      checkInTime: inDate,
      checkOutTime: outDate,
    })

    const [existing] = await db
      .select({ id: hrAttendanceRecord.id })
      .from(hrAttendanceRecord)
      .where(
        and(
          eq(hrAttendanceRecord.employeeId, emp.id),
          eq(hrAttendanceRecord.departmentId, emp.departmentId),
          eq(hrAttendanceRecord.date, dateKey),
          isNull(hrAttendanceRecord.deletedAt),
        ),
      )
      .limit(1)

    if (existing) {
      await db
        .update(hrAttendanceRecord)
        .set({
          checkInTime: inDate,
          checkOutTime: outDate,
          status,
          operatedBy: operatedBy ?? null,
          remark: `考勤导入批次 ${batchId} 第 ${row.rowNumber} 行`,
          updatedAt: new Date(),
        })
        .where(eq(hrAttendanceRecord.id, existing.id))
      updated++
    } else {
      await db
        .insert(hrAttendanceRecord)
        .values({
          employeeId: emp.id,
          departmentId: emp.departmentId,
          date: dateKey,
          checkInTime: inDate,
          checkOutTime: outDate,
          status,
          checkInMethod: 'import',
          checkOutMethod: 'import',
          operatedBy: operatedBy ?? null,
          remark: `考勤导入批次 ${batchId} 第 ${row.rowNumber} 行`,
        })
        .onConflictDoNothing()
      inserted++
    }
  }

  await db
    .update(hrImportBatch)
    .set({ status: 'verified', updatedAt: new Date() })
    .where(eq(hrImportBatch.id, batchId))

  logger.info('考勤导入已确认写入', { batchId, inserted, updated, skipped })

  return { batchId, inserted, updated, skipped, unresolvedConflicts: 0 }
}

/** 删除/作废批次(仅未 verified 的批次可作废) */
export async function discardImportBatch(batchId: string): Promise<void> {
  const [batch] = await db
    .select()
    .from(hrImportBatch)
    .where(eq(hrImportBatch.id, batchId))
    .limit(1)
  if (!batch) throw new AppError('导入批次不存在', 404, 'IMPORT_BATCH_NOT_FOUND')
  if (batch.status === 'verified') {
    throw new AppError('已写入正式考勤的批次不可作废', 409, 'IMPORT_BATCH_VERIFIED')
  }
  await db
    .update(hrImportBatch)
    .set({ status: 'rejected', updatedAt: new Date() })
    .where(eq(hrImportBatch.id, batchId))
}

/** 供路由层做部门存在性校验用 */
export async function assertDepartmentExists(departmentId: string): Promise<void> {
  const [dept] = await db
    .select({ id: hrDepartment.id })
    .from(hrDepartment)
    .where(eq(hrDepartment.id, departmentId))
    .limit(1)
  if (!dept) throw new AppError('部门不存在', 404, 'HR_DEPARTMENT_NOT_FOUND')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
