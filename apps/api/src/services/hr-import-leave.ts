// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import ExcelJS from 'exceljs'

import {
  hrAttendanceRecord,
  hrDepartment,
  hrEmployee,
  hrImportRow,
  hrLeaveBalance,
  hrLeaveRequest,
  hrOutgoingRecord,
  hrOvertimeRecord,
} from '@ihui/database'
import { db } from '../db/index.js'
import { logger } from '../utils/logger.js'
import { AppError } from '../errors/AppError.js'
import { normalizeDateCell } from './hr-import.js'

/**
 * 请假 / 加班导入服务(HR-5 第 3 期,2026-11-12 立)。
 *
 * 与打卡导入共用「解析 → 匹配 → 裁决 → 确认」框架,差异在于:
 *   · 字段表不同(请假看起止日期+假别,加班看日期+时长)
 *   · 落点不同(请假 → hr_leave_request + 额度账;加班 → hr_overtime_record)
 *   · 匹配键不同(请假按人+起止区间;加班按人+日期)
 *
 * 铁律与打卡导入一致:先暂存、差异必须人工裁决、绝不自动覆盖。
 *
 * 请假导入的**既有事实假设**:能导出的请假单在企业侧通常已经走过审批,
 * 所以导入默认落 approved(而不是 pending),否则等于让 HR 把批过的事再批一遍。
 * 但正因为是既成事实,才更要做差异核对 —— 系统里可能已有不同的记录。
 */

/** 请假导入的标准化字段 */
export interface HrLeaveImportFields {
  employeeNo?: string | null
  employeeName?: string | null
  /** 假别原文(年假/事假/病假...) */
  leaveTypeText?: string | null
  /** YYYY-MM-DD */
  startDate?: string | null
  endDate?: string | null
  /** 天数(可空,空时按起止日期推算) */
  totalDays?: string | null
  reason?: string | null
  /** 审批状态原文(已通过/审批中/已拒绝) */
  statusText?: string | null
  /** 外部单号(用于去重) */
  externalId?: string | null
}

/** 加班导入的标准化字段 */
export interface HrOvertimeImportFields {
  employeeNo?: string | null
  employeeName?: string | null
  /** YYYY-MM-DD */
  date?: string | null
  /** 时长原文(2小时 / 120分钟 / 2.5) */
  durationText?: string | null
  overtimeTypeText?: string | null
  reason?: string | null
  /** 外部单号 */
  externalId?: string | null
}

/** 外出导入的标准化字段 */
export interface HrOutgoingImportFields {
  employeeNo?: string | null
  employeeName?: string | null
  /** YYYY-MM-DD */
  startDate?: string | null
  endDate?: string | null
  /** HH:mm */
  startTime?: string | null
  endTime?: string | null
  /** 时长原文(4小时 / 240分钟) */
  durationText?: string | null
  destination?: string | null
  reason?: string | null
  /** 审批状态原文 */
  statusText?: string | null
  /** 外部单号 */
  externalId?: string | null
}

/** 请假表头别名 */
const LEAVE_HEADERS: Record<keyof HrLeaveImportFields, readonly string[]> = {
  employeeNo: ['工号', '员工工号', '员工编号', '人员编号', 'employeeid', 'employeeno'],
  employeeName: ['姓名', '员工姓名', '人员姓名', 'name'],
  leaveTypeText: ['假别', '假期类型', '请假类型', '假期种类', '类型', 'leavetype'],
  startDate: ['开始日期', '起始日期', '开始时间', '请假开始', 'startdate', 'starttime'],
  endDate: ['结束日期', '截止日期', '结束时间', '请假结束', 'enddate', 'endtime'],
  totalDays: ['请假天数', '天数', '时长', 'totaldays', 'days'],
  reason: ['请假事由', '事由', '原因', '备注', 'reason'],
  statusText: ['审批状态', '状态', '审批结果', 'status'],
  externalId: ['审批单号', '单号', '申请单号', '实例编号', 'externalid'],
}

/** 加班表头别名 */
const OVERTIME_HEADERS: Record<keyof HrOvertimeImportFields, readonly string[]> = {
  employeeNo: ['工号', '员工工号', '员工编号', '人员编号', 'employeeid', 'employeeno'],
  employeeName: ['姓名', '员工姓名', '人员姓名', 'name'],
  date: ['日期', '加班日期', '加班时间', 'date'],
  durationText: ['加班时长', '时长', '加班小时', '小时数', 'duration', 'hours'],
  overtimeTypeText: ['加班类型', '类型', 'overtimetype'],
  reason: ['加班事由', '事由', '原因', '备注', 'reason'],
  externalId: ['审批单号', '单号', '申请单号', '实例编号', 'externalid'],
}

/** 外出表头别名 */
const OUTGOING_HEADERS: Record<keyof HrOutgoingImportFields, readonly string[]> = {
  employeeNo: ['工号', '员工工号', '员工编号', '人员编号', 'employeeid', 'employeeno'],
  employeeName: ['姓名', '员工姓名', '人员姓名', 'name'],
  startDate: ['开始日期', '外出日期', '日期', '起始日期', 'startdate'],
  endDate: ['结束日期', '截止日期', 'enddate'],
  startTime: ['开始时间', '起始时间', 'starttime'],
  endTime: ['结束时间', '截止时间', 'endtime'],
  durationText: ['外出时长', '时长', '小时数', 'duration'],
  destination: ['外出地点', '地点', '目的地', 'destination'],
  reason: ['外出事由', '事由', '原因', '备注', 'reason'],
  statusText: ['审批状态', '状态', '审批结果', 'status'],
  externalId: ['审批单号', '单号', '申请单号', '实例编号', 'externalid'],
}

function normalizeHeader(raw: string): string {
  return raw
    .replace(/\s+/g, '')
    .replace(/[（）]/g, (m) => (m === '（' ? '(' : ')'))
    .toLowerCase()
}

function detectMappingFor<T extends object>(
  headers: string[],
  table: Record<keyof T, readonly string[]>,
): Partial<Record<string, keyof T>> {
  const mapping: Partial<Record<string, keyof T>> = {}
  for (const header of headers) {
    const normalized = normalizeHeader(header)
    if (!normalized || mapping[header]) continue
    for (const [field, aliases] of Object.entries(table) as [keyof T, readonly string[]][]) {
      if (aliases.some((a) => normalizeHeader(a) === normalized)) {
        mapping[header] = field
        break
      }
    }
  }
  return mapping
}

/** 假别原文 → 系统词表(sick/personal/annual/marriage/maternity/other) */
export function normalizeLeaveType(text: string | null | undefined): string {
  const raw = (text ?? '').trim()
  if (!raw) return 'other'
  if (/年假|annual/i.test(raw)) return 'annual'
  if (/病假|sick/i.test(raw)) return 'sick'
  if (/事假|personal/i.test(raw)) return 'personal'
  if (/婚假|marriage/i.test(raw)) return 'marriage'
  if (/产假|maternity|陪产/i.test(raw)) return 'maternity'
  return 'other'
}

/** 加班类型原文 → workday/weekend/holiday */
export function normalizeOvertimeType(text: string | null | undefined): string {
  const raw = (text ?? '').trim()
  if (/法定|节假日|holiday/i.test(raw)) return 'holiday'
  if (/休息|周末|weekend/i.test(raw)) return 'weekend'
  return 'workday'
}

/** 加班时长原文 → 分钟数。支持 "2小时" / "120分钟" / "2.5" / "2:30" */
export function normalizeDurationToMinutes(text: string | null | undefined): number | null {
  const raw = (text ?? '').trim()
  if (!raw) return null
  // 2:30 → 2 小时 30 分
  const colon = /^(\d{1,2}):(\d{2})$/.exec(raw)
  if (colon) return Number(colon[1]) * 60 + Number(colon[2])
  const hourMatch = /(\d+(?:\.\d+)?)\s*(?:小时|h|hour)/i.exec(raw)
  if (hourMatch) return Math.round(Number(hourMatch[1]) * 60)
  const minMatch = /(\d+)\s*(?:分钟|min)/i.exec(raw)
  if (minMatch) return Number(minMatch[1])
  // 纯数字:默认按小时(加班表最常见口径)
  if (/^\d+(?:\.\d+)?$/.test(raw)) return Math.round(Number(raw) * 60)
  return null
}

/** 审批状态原文 → approved/pending/rejected */
export function normalizeLeaveStatus(text: string | null | undefined): string {
  const raw = (text ?? '').trim()
  if (!raw) return 'approved' // 导入默认视为已批(见文件头说明)
  if (/拒绝|驳回|不同意|reject/i.test(raw)) return 'rejected'
  if (/审批中|待审批|处理中|pending/i.test(raw)) return 'pending'
  if (/通过|已同意|同意|approved|agree/i.test(raw)) return 'approved'
  return 'approved'
}

/** 从二维表读取为矩阵(与打卡导入同口径) */
async function readMatrix(fileName: string, buffer: Buffer): Promise<string[][]> {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.csv')) {
    const { parseCsvBuffer } = await import('./hr-import.js')
    return parseCsvBuffer(buffer)
  }
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer as unknown as ArrayBuffer)
    const sheet = wb.worksheets[0]
    if (!sheet) throw new AppError('文件中没有可读取的工作表', 400, 'IMPORT_EMPTY_SHEET')
    const matrix: string[][] = []
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = []
      const values = row.values as ExcelJS.CellValue[]
      for (let c = 1; c < values.length; c++) {
        const v = values[c]
        cells.push(v === null || v === undefined ? '' : String(v).trim())
      }
      matrix.push(cells)
    })
    return matrix
  }
  throw new AppError('仅支持 .xlsx / .xls / .csv', 400, 'IMPORT_UNSUPPORTED_FORMAT')
}

/** 通用:探测表头行并返回 {headers, mapping, dataRows} */
function findHeader<T extends object>(
  matrix: string[][],
  table: Record<keyof T, readonly string[]>,
): { headers: string[]; mapping: Partial<Record<string, keyof T>>; startRow: number } {
  let best = { score: 0, index: -1, mapping: {} as Partial<Record<string, keyof T>> }
  const limit = Math.min(matrix.length, 10)
  for (let i = 0; i < limit; i++) {
    const row = matrix[i] ?? []
    if (row.length === 0) continue
    const mapping = detectMappingFor<T>(row, table)
    const score = new Set(Object.values(mapping)).size
    if (score > best.score) best = { score, index: i, mapping }
  }
  if (best.index < 0 || best.score < 2) {
    throw new AppError(
      '无法识别表头,请确认文件包含工号与日期列',
      400,
      'IMPORT_HEADER_NOT_RECOGNIZED',
    )
  }
  return {
    headers: (matrix[best.index] ?? []).map((h) => h.trim()),
    mapping: best.mapping,
    startRow: best.index + 1,
  }
}

/** 请假解析结果 */
export interface ParsedLeaveRow {
  rowNumber: number
  raw: Record<string, string>
  fields: HrLeaveImportFields
  /** 解析后的规范化值 */
  normalized: {
    startDate: string | null
    endDate: string | null
    totalDays: number | null
    leaveType: string
    status: string
  }
}

/** 解析请假表 */
export function parseLeaveMatrix(matrix: string[][]): {
  mapping: Partial<Record<string, keyof HrLeaveImportFields>>
  rows: ParsedLeaveRow[]
} {
  const { headers, mapping, startRow } = findHeader<HrLeaveImportFields>(matrix, LEAVE_HEADERS)
  const rows: ParsedLeaveRow[] = []
  for (let i = startRow; i < matrix.length; i++) {
    const cells = matrix[i] ?? []
    if (cells.every((c) => !c || !c.trim())) continue
    const raw: Record<string, string> = {}
    headers.forEach((h, idx) => {
      if (h) raw[h] = (cells[idx] ?? '').trim()
    })
    const fields: HrLeaveImportFields = {}
    for (const [header, field] of Object.entries(mapping)) {
      fields[field as keyof HrLeaveImportFields] = raw[header] ?? null
    }
    const startDate = normalizeDateCell(fields.startDate)
    // 请假必须有开始日期,否则不是有效行(合计行/说明行)
    if (!startDate) continue
    const endDate = normalizeDateCell(fields.endDate) ?? startDate
    const totalDaysRaw = fields.totalDays ? Number(fields.totalDays.replace(/[^\d.]/g, '')) : NaN
    let totalDays: number | null = Number.isFinite(totalDaysRaw) ? Math.round(totalDaysRaw) : null
    if (totalDays === null) {
      // 按起止日期天数推算(含首尾)
      const s = new Date(`${startDate}T00:00:00Z`).getTime()
      const e = new Date(`${endDate}T00:00:00Z`).getTime()
      totalDays =
        Number.isFinite(s) && Number.isFinite(e)
          ? Math.max(1, Math.round((e - s) / 86400000) + 1)
          : 1
    }
    rows.push({
      rowNumber: i + 1,
      raw,
      fields,
      normalized: {
        startDate,
        endDate,
        totalDays,
        leaveType: normalizeLeaveType(fields.leaveTypeText),
        status: normalizeLeaveStatus(fields.statusText),
      },
    })
  }
  return { mapping, rows }
}

/** 加班解析结果 */
export interface ParsedOvertimeRow {
  rowNumber: number
  raw: Record<string, string>
  fields: HrOvertimeImportFields
  normalized: {
    date: string | null
    minutes: number | null
    overtimeType: string
  }
}

/** 解析加班表 */
export function parseOvertimeMatrix(matrix: string[][]): {
  mapping: Partial<Record<string, keyof HrOvertimeImportFields>>
  rows: ParsedOvertimeRow[]
} {
  const { headers, mapping, startRow } = findHeader<HrOvertimeImportFields>(
    matrix,
    OVERTIME_HEADERS,
  )
  const rows: ParsedOvertimeRow[] = []
  for (let i = startRow; i < matrix.length; i++) {
    const cells = matrix[i] ?? []
    if (cells.every((c) => !c || !c.trim())) continue
    const raw: Record<string, string> = {}
    headers.forEach((h, idx) => {
      if (h) raw[h] = (cells[idx] ?? '').trim()
    })
    const fields: HrOvertimeImportFields = {}
    for (const [header, field] of Object.entries(mapping)) {
      fields[field as keyof HrOvertimeImportFields] = raw[header] ?? null
    }
    const dateKey = normalizeDateCell(fields.date)
    if (!dateKey) continue
    rows.push({
      rowNumber: i + 1,
      raw,
      fields,
      normalized: {
        date: dateKey,
        minutes: normalizeDurationToMinutes(fields.durationText),
        overtimeType: normalizeOvertimeType(fields.overtimeTypeText),
      },
    })
  }
  return { mapping, rows }
}

/** 外出解析结果 */
export interface ParsedOutgoingRow {
  rowNumber: number
  raw: Record<string, string>
  fields: HrOutgoingImportFields
  normalized: {
    startDate: string | null
    endDate: string | null
    startTime: string | null
    endTime: string | null
    minutes: number
    status: string
  }
}

/** 时刻归一为 HH:mm(:ss);支持 9:05 / 09:05 / 09:05:00 */
export function normalizeTimeOfDay(value: string | null | undefined): string | null {
  const raw = (value ?? '').trim()
  if (!raw) return null
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(raw)
  if (!m) return null
  const h = Number(m[1])
  const mi = Number(m[2])
  const sec = Number(m[3] ?? '0')
  if (h > 23 || mi > 59 || sec > 59) return null
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

/**
 * 由起止时刻算分钟数;跨天(结束早于开始)按次日处理。
 * 缺时刻时返回 null,由调用方兜底。
 */
export function minutesBetween(startTime: string | null, endTime: string | null): number | null {
  if (!startTime || !endTime) return null
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h! * 60 + m!
  }
  let diff = toMin(endTime) - toMin(startTime)
  if (diff < 0) diff += 24 * 60 // 跨天外出
  return diff
}

/** 解析外出表 */
export function parseOutgoingMatrix(matrix: string[][]): {
  mapping: Partial<Record<string, keyof HrOutgoingImportFields>>
  rows: ParsedOutgoingRow[]
} {
  const { headers, mapping, startRow } = findHeader<HrOutgoingImportFields>(
    matrix,
    OUTGOING_HEADERS,
  )
  const rows: ParsedOutgoingRow[] = []
  for (let i = startRow; i < matrix.length; i++) {
    const cells = matrix[i] ?? []
    if (cells.every((c) => !c || !c.trim())) continue
    const raw: Record<string, string> = {}
    headers.forEach((h, idx) => {
      if (h) raw[h] = (cells[idx] ?? '').trim()
    })
    const fields: HrOutgoingImportFields = {}
    for (const [header, field] of Object.entries(mapping)) {
      fields[field as keyof HrOutgoingImportFields] = raw[header] ?? null
    }
    const startDate = normalizeDateCell(fields.startDate)
    // 外出必须有开始日期,否则不是有效行
    if (!startDate) continue
    const endDate = normalizeDateCell(fields.endDate) ?? startDate
    const startTime = normalizeTimeOfDay(fields.startTime)
    const endTime = normalizeTimeOfDay(fields.endTime)

    // 时长优先级:导入显式时长 > 起止时刻推算 > 按日历天数整天(480 分钟/天)
    let minutes = normalizeDurationToMinutes(fields.durationText)
    if (minutes === null) {
      const byClock = minutesBetween(startTime, endTime)
      if (byClock !== null && byClock > 0) {
        minutes = byClock
      } else {
        const sMs = new Date(`${startDate}T00:00:00Z`).getTime()
        const eMs = new Date(`${endDate}T00:00:00Z`).getTime()
        const days =
          Number.isFinite(sMs) && Number.isFinite(eMs)
            ? Math.max(1, Math.round((eMs - sMs) / 86400000) + 1)
            : 1
        minutes = days * 480
      }
    }

    rows.push({
      rowNumber: i + 1,
      raw,
      fields,
      normalized: {
        startDate,
        endDate,
        startTime,
        endTime,
        minutes,
        status: normalizeLeaveStatus(fields.statusText),
      },
    })
  }
  return { mapping, rows }
}

/** 读取文件为矩阵(供路由层调用) */
export async function readImportMatrix(fileName: string, buffer: Buffer): Promise<string[][]> {
  return readMatrix(fileName, buffer)
}

/**
 * 请假匹配与暂存。
 *
 * 匹配键:员工 + 起止日期完全相同 → 视为同一张请假单。
 *   · 系统无 → matched
 *   · 系统有且天数/假别一致 → matched(幂等)
 *   · 系统有但天数或假别不同 → conflict(必须裁决)
 * 另:同批内同员工+同起止日期重复 → duplicate。
 */
export async function matchAndStageLeaveRows(params: {
  batchId: string
  rows: ParsedLeaveRow[]
}): Promise<{ matched: number; conflict: number; notFound: number }> {
  const { batchId, rows } = params
  const empNos = [...new Set(rows.map((r) => r.fields.employeeNo).filter(Boolean))] as string[]
  const employees =
    empNos.length > 0
      ? await db
          .select({
            id: hrEmployee.id,
            employeeNo: hrEmployee.employeeNo,
            name: hrEmployee.name,
            departmentId: hrEmployee.departmentId,
            status: hrEmployee.status,
          })
          .from(hrEmployee)
          .where(and(inArray(hrEmployee.employeeNo, empNos), isNull(hrEmployee.deletedAt)))
      : []
  const empByNo = new Map(employees.map((e) => [e.employeeNo, e]))

  const empIds = employees.map((e) => e.id)
  const existing =
    empIds.length > 0
      ? await db
          .select()
          .from(hrLeaveRequest)
          .where(and(inArray(hrLeaveRequest.employeeId, empIds), isNull(hrLeaveRequest.deletedAt)))
      : []
  const byKey = new Map<string, (typeof existing)[number]>(
    existing.map((r) => [`${r.employeeId}|${r.startDate}|${r.endDate}`, r]),
  )

  const staged: (typeof hrImportRow.$inferInsert)[] = []
  const seen = new Set<string>()
  let matched = 0
  let conflict = 0
  let notFound = 0

  for (const row of rows) {
    const employeeNo = row.fields.employeeNo?.trim() ?? ''
    const emp = employeeNo ? empByNo.get(employeeNo) : undefined

    if (!emp || emp.status !== 'active') {
      notFound++
      staged.push({
        batchId,
        rowNumber: row.rowNumber,
        employeeNo: employeeNo || null,
        raw: row.raw,
        parsed: { ...row.fields, ...row.normalized },
        matchStatus: 'not_found',
        diffDetail: [{ field: 'employeeNo', systemValue: null, importValue: employeeNo || null }],
      })
      continue
    }

    const key = `${emp.id}|${row.normalized.startDate}|${row.normalized.endDate}`
    if (seen.has(key)) {
      staged.push({
        batchId,
        rowNumber: row.rowNumber,
        employeeNo,
        raw: row.raw,
        parsed: { ...row.fields, ...row.normalized },
        matchStatus: 'duplicate',
        diffDetail: [{ field: 'dateRange', systemValue: null, importValue: key }],
      })
      continue
    }
    seen.add(key)

    const sys = byKey.get(key)
    if (!sys) {
      matched++
      staged.push({
        batchId,
        rowNumber: row.rowNumber,
        employeeNo,
        raw: row.raw,
        parsed: { ...row.fields, ...row.normalized },
        matchStatus: 'matched',
      })
      continue
    }

    const diffs: { field: string; systemValue: string | null; importValue: string | null }[] = []
    if (sys.totalDays !== row.normalized.totalDays) {
      diffs.push({
        field: 'totalDays',
        systemValue: String(sys.totalDays),
        importValue: String(row.normalized.totalDays),
      })
    }
    if (sys.leaveType !== row.normalized.leaveType) {
      diffs.push({
        field: 'leaveType',
        systemValue: sys.leaveType,
        importValue: row.normalized.leaveType,
      })
    }
    if (diffs.length > 0) {
      conflict++
      staged.push({
        batchId,
        rowNumber: row.rowNumber,
        employeeNo,
        raw: row.raw,
        parsed: { ...row.fields, ...row.normalized },
        matchStatus: 'conflict',
        diffDetail: diffs,
      })
    } else {
      matched++
      staged.push({
        batchId,
        rowNumber: row.rowNumber,
        employeeNo,
        raw: row.raw,
        parsed: { ...row.fields, ...row.normalized },
        matchStatus: 'matched',
      })
    }
  }

  const CHUNK = 500
  for (let i = 0; i < staged.length; i += CHUNK) {
    await db.insert(hrImportRow).values(staged.slice(i, i + CHUNK))
  }
  return { matched, conflict, notFound }
}

/**
 * 请假确认写入。
 *
 * 落点:
 *   · hr_leave_request:状态按 normalized.status(导入默认 approved)
 *   · 若 approved 且假别属于额度类(annual/sick/personal),
 *     同步累加 hr_leave_balance.used_days(额度账此前**没有任何写入逻辑**,这里补上)
 *   · 若 approved,区间内的考勤记录状态改为 leave(与 approveHrLeave 同口径)
 */
export async function confirmLeaveImport(params: {
  batchId: string
  operatedBy?: string | undefined
}): Promise<{ inserted: number; updated: number; skipped: number; balanceAdjusted: number }> {
  const { batchId, operatedBy } = params
  const rows = await db.select().from(hrImportRow).where(eq(hrImportRow.batchId, batchId))
  const empNos = [...new Set(rows.map((r) => r.employeeNo).filter(Boolean))] as string[]
  const employees =
    empNos.length > 0
      ? await db
          .select({
            id: hrEmployee.id,
            employeeNo: hrEmployee.employeeNo,
            departmentId: hrEmployee.departmentId,
          })
          .from(hrEmployee)
          .where(and(inArray(hrEmployee.employeeNo, empNos), isNull(hrEmployee.deletedAt)))
      : []
  const empByNo = new Map(employees.map((e) => [e.employeeNo, e]))

  let inserted = 0
  let updated = 0
  let skipped = 0
  let balanceAdjusted = 0

  for (const row of rows) {
    if (row.matchStatus === 'conflict' && row.resolution === 'keep_system') {
      skipped++
      continue
    }
    if (row.matchStatus === 'not_found' || row.matchStatus === 'duplicate') {
      skipped++
      continue
    }
    const payload = ((row.resolved ? row.finalValue : null) ?? row.parsed ?? {}) as Record<
      string,
      unknown
    >
    const employeeNo = String(payload.employeeNo ?? row.employeeNo ?? '')
    const emp = employeeNo ? empByNo.get(employeeNo) : undefined
    const startDate = normalizeDateCell(String(payload.startDate ?? ''))
    const endDate = normalizeDateCell(String(payload.endDate ?? '')) ?? startDate
    if (!emp || !startDate || !endDate) {
      skipped++
      continue
    }
    const totalDays = Number(payload.totalDays ?? 1) || 1
    const leaveType = String(payload.leaveType ?? 'other')
    const status = String(payload.status ?? 'approved')
    const reason = String(payload.reason ?? '导入的请假记录')

    const [existing] = await db
      .select({
        id: hrLeaveRequest.id,
        totalDays: hrLeaveRequest.totalDays,
        leaveType: hrLeaveRequest.leaveType,
      })
      .from(hrLeaveRequest)
      .where(
        and(
          eq(hrLeaveRequest.employeeId, emp.id),
          eq(hrLeaveRequest.startDate, startDate),
          eq(hrLeaveRequest.endDate, endDate),
          isNull(hrLeaveRequest.deletedAt),
        ),
      )
      .limit(1)

    let leaveId: string
    if (existing) {
      await db
        .update(hrLeaveRequest)
        .set({ totalDays, leaveType, status, reason, updatedAt: new Date() })
        .where(eq(hrLeaveRequest.id, existing.id))
      leaveId = existing.id
      updated++
    } else {
      const [ins] = await db
        .insert(hrLeaveRequest)
        .values({
          employeeId: emp.id,
          departmentId: emp.departmentId,
          leaveType,
          startDate,
          endDate,
          totalDays,
          reason,
          status,
        })
        .returning({ id: hrLeaveRequest.id })
      leaveId = ins!.id
      inserted++
    }

    // approved 的额度类请假 → 累加 used_days(额度账原先无人维护)
    if (status === 'approved' && ['annual', 'sick', 'personal'].includes(leaveType)) {
      const year = Number(startDate.slice(0, 4))
      const delta = existing ? totalDays - existing.totalDays : totalDays
      if (delta !== 0) {
        const [bal] = await db
          .select({ id: hrLeaveBalance.id, remainingDays: hrLeaveBalance.remainingDays })
          .from(hrLeaveBalance)
          .where(
            and(
              eq(hrLeaveBalance.employeeId, emp.id),
              eq(hrLeaveBalance.leaveType, leaveType),
              eq(hrLeaveBalance.year, year),
            ),
          )
          .limit(1)
        if (bal) {
          await db
            .update(hrLeaveBalance)
            .set({
              usedDays: sql`${hrLeaveBalance.usedDays} + ${delta}`,
              remainingDays: sql`${hrLeaveBalance.remainingDays} - ${delta}`,
              updatedAt: new Date(),
            })
            .where(eq(hrLeaveBalance.id, bal.id))
        } else {
          // 没有额度账就建一条,总额 0、已用 delta、剩余负数 —— 让 HR 一眼看到"额度不够/未设额度"
          await db.insert(hrLeaveBalance).values({
            employeeId: emp.id,
            leaveType,
            year,
            totalDays: 0,
            usedDays: delta,
            frozenDays: 0,
            remainingDays: -delta,
          })
        }
        balanceAdjusted++
      }
    }

    // approved 请假 → 区间内考勤记录标 leave(与 approveHrLeave 同口径)
    if (status === 'approved') {
      await db
        .update(hrAttendanceRecord)
        .set({ status: 'leave', updatedAt: new Date() })
        .where(
          and(
            eq(hrAttendanceRecord.employeeId, emp.id),
            eq(hrAttendanceRecord.departmentId, emp.departmentId),
            sql`${hrAttendanceRecord.date} >= ${startDate}::date`,
            sql`${hrAttendanceRecord.date} <= ${endDate}::date`,
            isNull(hrAttendanceRecord.deletedAt),
            sql`${hrAttendanceRecord.status} <> 'leave'`,
          ),
        )
    }
    logger.debug('请假导入行已写入', { leaveId, operatedBy })
  }

  return { inserted, updated, skipped, balanceAdjusted }
}

/**
 * 加班确认写入。
 * 匹配键:员工 + 日期。已存在则比较分钟数,不同即 conflict(已在 match 阶段判)。
 * 落点:hr_overtime_record,status=approved(导入默认视为已批),source=import。
 */
export async function confirmOvertimeImport(params: {
  batchId: string
  operatedBy?: string | undefined
}): Promise<{ inserted: number; updated: number; skipped: number }> {
  const { batchId, operatedBy } = params
  const rows = await db.select().from(hrImportRow).where(eq(hrImportRow.batchId, batchId))
  const empNos = [...new Set(rows.map((r) => r.employeeNo).filter(Boolean))] as string[]
  const employees =
    empNos.length > 0
      ? await db
          .select({
            id: hrEmployee.id,
            employeeNo: hrEmployee.employeeNo,
            departmentId: hrEmployee.departmentId,
          })
          .from(hrEmployee)
          .where(and(inArray(hrEmployee.employeeNo, empNos), isNull(hrEmployee.deletedAt)))
      : []
  const empByNo = new Map(employees.map((e) => [e.employeeNo, e]))

  let inserted = 0
  let updated = 0
  let skipped = 0

  for (const row of rows) {
    if (row.matchStatus === 'conflict' && row.resolution === 'keep_system') {
      skipped++
      continue
    }
    if (row.matchStatus === 'not_found' || row.matchStatus === 'duplicate') {
      skipped++
      continue
    }
    const payload = ((row.resolved ? row.finalValue : null) ?? row.parsed ?? {}) as Record<
      string,
      unknown
    >
    const employeeNo = String(payload.employeeNo ?? row.employeeNo ?? '')
    const emp = employeeNo ? empByNo.get(employeeNo) : undefined
    const dateKey = normalizeDateCell(String(payload.date ?? ''))
    const minutes = Number(payload.minutes ?? 0)
    if (!emp || !dateKey || !Number.isFinite(minutes) || minutes <= 0) {
      skipped++
      continue
    }
    const overtimeType = String(payload.overtimeType ?? 'workday')
    const reason = String(payload.reason ?? '导入的加班记录')
    const externalId = payload.externalId ? String(payload.externalId) : null

    const [existing] = await db
      .select({ id: hrOvertimeRecord.id })
      .from(hrOvertimeRecord)
      .where(
        and(
          eq(hrOvertimeRecord.employeeId, emp.id),
          eq(hrOvertimeRecord.date, dateKey),
          isNull(hrOvertimeRecord.deletedAt),
        ),
      )
      .limit(1)

    if (existing) {
      await db
        .update(hrOvertimeRecord)
        .set({
          minutes,
          overtimeType,
          reason,
          status: 'approved',
          source: 'import',
          externalId,
          operatedBy: operatedBy ?? null,
          updatedAt: new Date(),
        })
        .where(eq(hrOvertimeRecord.id, existing.id))
      updated++
    } else {
      await db.insert(hrOvertimeRecord).values({
        employeeId: emp.id,
        departmentId: emp.departmentId,
        date: dateKey,
        minutes,
        overtimeType,
        reason,
        status: 'approved',
        source: 'import',
        externalId,
        operatedBy: operatedBy ?? null,
      })
      inserted++
    }
  }

  return { inserted, updated, skipped }
}

/** 加班匹配与暂存(员工 + 日期) */
export async function matchAndStageOvertimeRows(params: {
  batchId: string
  rows: ParsedOvertimeRow[]
}): Promise<{ matched: number; conflict: number; notFound: number }> {
  const { batchId, rows } = params
  const empNos = [...new Set(rows.map((r) => r.fields.employeeNo).filter(Boolean))] as string[]
  const employees =
    empNos.length > 0
      ? await db
          .select({
            id: hrEmployee.id,
            employeeNo: hrEmployee.employeeNo,
            name: hrEmployee.name,
            departmentId: hrEmployee.departmentId,
            status: hrEmployee.status,
          })
          .from(hrEmployee)
          .where(and(inArray(hrEmployee.employeeNo, empNos), isNull(hrEmployee.deletedAt)))
      : []
  const empByNo = new Map(employees.map((e) => [e.employeeNo, e]))
  const empIds = employees.map((e) => e.id)
  const existing =
    empIds.length > 0
      ? await db
          .select()
          .from(hrOvertimeRecord)
          .where(
            and(inArray(hrOvertimeRecord.employeeId, empIds), isNull(hrOvertimeRecord.deletedAt)),
          )
      : []
  const byKey = new Map<string, (typeof existing)[number]>(
    existing.map((r) => [`${r.employeeId}|${r.date}`, r]),
  )

  const staged: (typeof hrImportRow.$inferInsert)[] = []
  const seen = new Set<string>()
  let matched = 0
  let conflict = 0
  let notFound = 0

  for (const row of rows) {
    const employeeNo = row.fields.employeeNo?.trim() ?? ''
    const emp = employeeNo ? empByNo.get(employeeNo) : undefined
    const parsed = { ...row.fields, ...row.normalized }

    if (!emp || emp.status !== 'active') {
      notFound++
      staged.push({
        batchId,
        rowNumber: row.rowNumber,
        employeeNo: employeeNo || null,
        raw: row.raw,
        parsed,
        matchStatus: 'not_found',
        diffDetail: [{ field: 'employeeNo', systemValue: null, importValue: employeeNo || null }],
      })
      continue
    }
    const key = `${emp.id}|${row.normalized.date}`
    if (seen.has(key)) {
      staged.push({
        batchId,
        rowNumber: row.rowNumber,
        employeeNo,
        raw: row.raw,
        parsed,
        matchStatus: 'duplicate',
        diffDetail: [{ field: 'date', systemValue: null, importValue: row.normalized.date }],
      })
      continue
    }
    seen.add(key)

    const sys = byKey.get(key)
    if (!sys) {
      matched++
      staged.push({
        batchId,
        rowNumber: row.rowNumber,
        employeeNo,
        raw: row.raw,
        parsed,
        matchStatus: 'matched',
      })
      continue
    }
    if (sys.minutes !== row.normalized.minutes) {
      conflict++
      staged.push({
        batchId,
        rowNumber: row.rowNumber,
        employeeNo,
        raw: row.raw,
        parsed,
        matchStatus: 'conflict',
        diffDetail: [
          {
            field: 'minutes',
            systemValue: String(sys.minutes),
            importValue: String(row.normalized.minutes ?? ''),
          },
        ],
      })
    } else {
      matched++
      staged.push({
        batchId,
        rowNumber: row.rowNumber,
        employeeNo,
        raw: row.raw,
        parsed,
        matchStatus: 'matched',
      })
    }
  }

  const CHUNK = 500
  for (let i = 0; i < staged.length; i += CHUNK) {
    await db.insert(hrImportRow).values(staged.slice(i, i + CHUNK))
  }
  return { matched, conflict, notFound }
}

/**
 * 外出匹配与暂存。
 * 匹配键:员工 + 开始日期(同一天同一人只应有一张外出单;多段外出需合并成一张单)。
 * 差异维度:结束日期 / 分钟数 / 状态。
 */
export async function matchAndStageOutgoingRows(params: {
  batchId: string
  rows: ParsedOutgoingRow[]
}): Promise<{ matched: number; conflict: number; notFound: number }> {
  const { batchId, rows } = params
  const empNos = [...new Set(rows.map((r) => r.fields.employeeNo).filter(Boolean))] as string[]
  const employees =
    empNos.length > 0
      ? await db
          .select({
            id: hrEmployee.id,
            employeeNo: hrEmployee.employeeNo,
            name: hrEmployee.name,
            departmentId: hrEmployee.departmentId,
            status: hrEmployee.status,
          })
          .from(hrEmployee)
          .where(and(inArray(hrEmployee.employeeNo, empNos), isNull(hrEmployee.deletedAt)))
      : []
  const empByNo = new Map(employees.map((e) => [e.employeeNo, e]))
  const empIds = employees.map((e) => e.id)
  const existing =
    empIds.length > 0
      ? await db
          .select()
          .from(hrOutgoingRecord)
          .where(
            and(inArray(hrOutgoingRecord.employeeId, empIds), isNull(hrOutgoingRecord.deletedAt)),
          )
      : []
  const byKey = new Map<string, (typeof existing)[number]>(
    existing.map((r) => [`${r.employeeId}|${r.startDate}`, r]),
  )

  const staged: (typeof hrImportRow.$inferInsert)[] = []
  const seen = new Set<string>()
  let matched = 0
  let conflict = 0
  let notFound = 0

  for (const row of rows) {
    const employeeNo = row.fields.employeeNo?.trim() ?? ''
    const emp = employeeNo ? empByNo.get(employeeNo) : undefined
    const parsed = { ...row.fields, ...row.normalized }

    if (!emp || emp.status !== 'active') {
      notFound++
      staged.push({
        batchId,
        rowNumber: row.rowNumber,
        employeeNo: employeeNo || null,
        raw: row.raw,
        parsed,
        matchStatus: 'not_found',
        diffDetail: [{ field: 'employeeNo', systemValue: null, importValue: employeeNo || null }],
      })
      continue
    }
    const key = `${emp.id}|${row.normalized.startDate}`
    if (seen.has(key)) {
      staged.push({
        batchId,
        rowNumber: row.rowNumber,
        employeeNo,
        raw: row.raw,
        parsed,
        matchStatus: 'duplicate',
        diffDetail: [
          { field: 'startDate', systemValue: null, importValue: row.normalized.startDate },
        ],
      })
      continue
    }
    seen.add(key)

    const sys = byKey.get(key)
    if (!sys) {
      matched++
      staged.push({
        batchId,
        rowNumber: row.rowNumber,
        employeeNo,
        raw: row.raw,
        parsed,
        matchStatus: 'matched',
      })
      continue
    }

    const diffs: { field: string; systemValue: string | null; importValue: string | null }[] = []
    if (sys.endDate !== row.normalized.endDate) {
      diffs.push({
        field: 'endDate',
        systemValue: sys.endDate,
        importValue: row.normalized.endDate,
      })
    }
    if (sys.minutes !== row.normalized.minutes) {
      diffs.push({
        field: 'minutes',
        systemValue: String(sys.minutes),
        importValue: String(row.normalized.minutes),
      })
    }
    if (sys.status !== row.normalized.status) {
      diffs.push({ field: 'status', systemValue: sys.status, importValue: row.normalized.status })
    }
    if (diffs.length > 0) {
      conflict++
      staged.push({
        batchId,
        rowNumber: row.rowNumber,
        employeeNo,
        raw: row.raw,
        parsed,
        matchStatus: 'conflict',
        diffDetail: diffs,
      })
    } else {
      matched++
      staged.push({
        batchId,
        rowNumber: row.rowNumber,
        employeeNo,
        raw: row.raw,
        parsed,
        matchStatus: 'matched',
      })
    }
  }

  const CHUNK = 500
  for (let i = 0; i < staged.length; i += CHUNK) {
    await db.insert(hrImportRow).values(staged.slice(i, i + CHUNK))
  }
  return { matched, conflict, notFound }
}

/**
 * 外出确认写入。
 * 落点:hr_outgoing_record,source=import。
 * 副作用:approved 的外出要把区间内的「缺勤」记录改回 present
 * —— 外出的业务含义是「人不在办公室但在办公」,不修正就会被月结算成旷工。
 */
export async function confirmOutgoingImport(params: {
  batchId: string
  operatedBy?: string | undefined
}): Promise<{ inserted: number; updated: number; skipped: number; attendanceFixed: number }> {
  const { batchId, operatedBy } = params
  const rows = await db.select().from(hrImportRow).where(eq(hrImportRow.batchId, batchId))
  const empNos = [...new Set(rows.map((r) => r.employeeNo).filter(Boolean))] as string[]
  const employees =
    empNos.length > 0
      ? await db
          .select({
            id: hrEmployee.id,
            employeeNo: hrEmployee.employeeNo,
            departmentId: hrEmployee.departmentId,
          })
          .from(hrEmployee)
          .where(and(inArray(hrEmployee.employeeNo, empNos), isNull(hrEmployee.deletedAt)))
      : []
  const empByNo = new Map(employees.map((e) => [e.employeeNo, e]))

  let inserted = 0
  let updated = 0
  let skipped = 0
  let attendanceFixed = 0

  for (const row of rows) {
    if (row.matchStatus === 'conflict' && row.resolution === 'keep_system') {
      skipped++
      continue
    }
    if (row.matchStatus === 'not_found' || row.matchStatus === 'duplicate') {
      skipped++
      continue
    }
    const payload = ((row.resolved ? row.finalValue : null) ?? row.parsed ?? {}) as Record<
      string,
      unknown
    >
    const employeeNo = String(payload.employeeNo ?? row.employeeNo ?? '')
    const emp = employeeNo ? empByNo.get(employeeNo) : undefined
    const startDate = normalizeDateCell(String(payload.startDate ?? ''))
    const endDate = normalizeDateCell(String(payload.endDate ?? '')) ?? startDate
    if (!emp || !startDate || !endDate) {
      skipped++
      continue
    }
    const minutes = Number(payload.minutes ?? 0) || 0
    const status = String(payload.status ?? 'approved')
    const destination = payload.destination ? String(payload.destination) : null
    const reason = String(payload.reason ?? '导入的外出记录')
    const externalId = payload.externalId ? String(payload.externalId) : null
    const startTime = normalizeTimeOfDay(payload.startTime ? String(payload.startTime) : null)
    const endTime = normalizeTimeOfDay(payload.endTime ? String(payload.endTime) : null)

    const [existing] = await db
      .select({ id: hrOutgoingRecord.id })
      .from(hrOutgoingRecord)
      .where(
        and(
          eq(hrOutgoingRecord.employeeId, emp.id),
          eq(hrOutgoingRecord.startDate, startDate),
          isNull(hrOutgoingRecord.deletedAt),
        ),
      )
      .limit(1)

    if (existing) {
      await db
        .update(hrOutgoingRecord)
        .set({
          endDate,
          startTime,
          endTime,
          minutes,
          destination,
          reason,
          status,
          source: 'import',
          externalId,
          operatedBy: operatedBy ?? null,
          updatedAt: new Date(),
        })
        .where(eq(hrOutgoingRecord.id, existing.id))
      updated++
    } else {
      await db.insert(hrOutgoingRecord).values({
        employeeId: emp.id,
        departmentId: emp.departmentId,
        startDate,
        endDate,
        startTime,
        endTime,
        minutes,
        destination,
        reason,
        status,
        source: 'import',
        externalId,
        operatedBy: operatedBy ?? null,
      })
      inserted++
    }

    // approved 外出 → 区间内 absent 改回 present(外出不是缺勤)
    if (status === 'approved') {
      const fixed = await db
        .update(hrAttendanceRecord)
        .set({ status: 'present', updatedAt: new Date() })
        .where(
          and(
            eq(hrAttendanceRecord.employeeId, emp.id),
            eq(hrAttendanceRecord.departmentId, emp.departmentId),
            sql`${hrAttendanceRecord.date} >= ${startDate}::date`,
            sql`${hrAttendanceRecord.date} <= ${endDate}::date`,
            isNull(hrAttendanceRecord.deletedAt),
            eq(hrAttendanceRecord.status, 'absent'),
          ),
        )
        .returning({ id: hrAttendanceRecord.id })
      attendanceFixed += fixed.length
    }
  }

  return { inserted, updated, skipped, attendanceFixed }
}

/** 部门存在性(供路由复用) */
export async function assertHrDepartment(departmentId: string): Promise<void> {
  const [d] = await db
    .select({ id: hrDepartment.id })
    .from(hrDepartment)
    .where(eq(hrDepartment.id, departmentId))
    .limit(1)
  if (!d) throw new AppError('部门不存在', 404, 'HR_DEPARTMENT_NOT_FOUND')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
