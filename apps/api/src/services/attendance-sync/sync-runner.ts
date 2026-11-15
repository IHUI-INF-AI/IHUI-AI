// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 考勤同步器 — 编排器(2026-11-13 立)。
 *
 * 职责:把 provider 拉取的结构化行(SyncRow[])规范化成「标准表头 CSV」,
 * 复用现有 createAnyImportBatch 的判重/解析/暂存全流水线,
 * 产出与「文件上传」一模一样的暂存批次 → 走人工裁决/确认闸。
 *
 * 安全边界(不可违背):
 *   · 只产「暂存批次」,绝不直接写正式考勤;裁决/确认仍走人工闸。
 *   · 复用 createAnyImportBatch 的 SHA-256 幂等 + conflict 不覆盖,不另立写库通道。
 *   · 不复制判重逻辑:标准表头精确对齐 hr-import 别名表,parse* 必然识别。
 *
 * 外部平台 HTTP 端点属未核实事实(design §7),端点实现在各 provider 内,
 * 本文件不感知平台差异,只编排「拉取→CSV→暂存」。
 */

import { saveFile } from '../storage-service.js'
import { createAnyImportBatch } from '../hr-import-entry.js'
import { loadPlatformCredentials } from './im-adapter-credentials.js'
import type { SyncKind, SyncRow, AttendanceProvider } from './types.js'
import { AppError } from '../../errors/AppError.js'

/**
 * 各类记录的 CSV 标准表头(顺序固定)。
 * 每个表头都必须命中 hr-import 的别名表 → parseMatrix/parseLeaveMatrix 等必识别,
 * 同步行因此走与文件上传完全一致的解析与暂存路径。
 */
const HEADERS: Record<SyncKind, readonly string[]> = {
  attendance: ['工号', '姓名', '日期', '上班打卡', '下班打卡', '考勤结果'],
  leave: [
    '工号',
    '姓名',
    '假别',
    '开始日期',
    '结束日期',
    '请假天数',
    '请假事由',
    '审批状态',
    '审批单号',
  ],
  overtime: ['工号', '姓名', '日期', '加班时长', '加班类型', '加班事由', '审批单号'],
  outgoing: [
    '工号',
    '姓名',
    '开始日期',
    '结束日期',
    '外出时长',
    '外出地点',
    '外出事由',
    '审批状态',
    '审批单号',
  ],
}

/** SyncRow → 各类 CSV 列取值(顺序与 HEADERS 严格对应) */
function rowValues(kind: SyncKind, row: SyncRow): (string | null)[] {
  switch (kind) {
    case 'attendance':
      return [
        row.employeeNo,
        row.employeeName,
        row.date,
        row.checkInTime,
        row.checkOutTime,
        row.statusText,
      ]
    case 'leave':
      return [
        row.employeeNo,
        row.employeeName,
        row.typeText,
        row.startDate,
        row.endDate,
        row.totalDays,
        row.reason,
        row.statusText,
        row.externalId,
      ]
    case 'overtime':
      return [
        row.employeeNo,
        row.employeeName,
        row.date,
        row.durationText,
        row.typeText,
        row.reason,
        row.externalId,
      ]
    case 'outgoing':
      return [
        row.employeeNo,
        row.employeeName,
        row.startDate,
        row.endDate,
        row.durationText,
        row.destination,
        row.reason,
        row.statusText,
        row.externalId,
      ]
  }
}

/** CSV 单元格转义:含逗号/引号/换行时加引号,内部引号双写 */
function csvEscape(value: string | null): string {
  const s = (value ?? '').trim()
  if (s === '') return ''
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/** SyncRow[] → 标准 CSV 文本(表头行 + 数据行) */
export function buildSyncCsv(kind: SyncKind, rows: SyncRow[]): string {
  const lines: string[] = [HEADERS[kind].join(',')]
  for (const row of rows) {
    lines.push(rowValues(kind, row).map(csvEscape).join(','))
  }
  return lines.join('\n')
}

export interface SyncRunResult {
  source: AttendanceProvider['source']
  importKind: SyncKind
  periodMonth: string
  /** 0 行时不建批次,直接返回 */
  batchId: string | null
  fetchedRows: number
  matchedRows: number
  conflictRows: number
  notFoundRows: number
  nextCursor: string | null
}

/**
 * 执行一次同步:拉取 → CSV → 存文件 → 走现有暂存流水线。
 *
 * 凭证从 IM 适配器配置单源读取;0 行时不建批次(避免空批次噪声)。
 * 幂等由 createAnyImportBatch 的 SHA-256 判重兜底:同一批数据重复拉取会被拒(409),
 * 调用方(cron)应捕获并视为「已同步过,正常」。
 */
export async function runSyncForKind(params: {
  provider: AttendanceProvider
  importKind: SyncKind
  periodMonth: string
  userId: string
  cursor: string | null
}): Promise<SyncRunResult> {
  const { provider, importKind, periodMonth, userId, cursor } = params

  if (!/^\d{4}-\d{2}$/.test(periodMonth)) {
    throw new AppError('考勤月份格式必须是 YYYY-MM', 400, 'SYNC_BAD_PERIOD')
  }

  // 凭证单源:从 IM 适配器读(未启用/缺凭证会抛,由 cron 决定是否跳过该平台)
  const creds = await loadPlatformCredentials(userId, provider.source)

  // 1. 拉取(端点实现藏在 provider 内,本层不感知)
  const { rows, nextCursor } = await provider.fetchBatch({
    userId,
    creds,
    importKind,
    cursor,
    periodMonth,
  })

  if (rows.length === 0) {
    return {
      source: provider.source,
      importKind,
      periodMonth,
      batchId: null,
      fetchedRows: 0,
      matchedRows: 0,
      conflictRows: 0,
      notFoundRows: 0,
      nextCursor,
    }
  }

  // 2. 规范化成标准 CSV
  const csv = buildSyncCsv(importKind, rows)
  const buffer = Buffer.from(csv, 'utf8')
  const fileName = `sync-${provider.source}-${importKind}-${periodMonth}.csv`

  // 3. 存文件(满足批次 storageFileId/fileHash notNull;同步无真实上传件,用合成件)
  const stored = saveFile(buffer, undefined, {
    purpose: 'hr-attendance-sync',
    source: provider.source,
    importKind,
    periodMonth,
  })

  // 4. 走现有暂存流水线(判重/解析/匹配/暂存全复用,不复制)
  const result = await createAnyImportBatch({
    periodMonth,
    importKind,
    fileName,
    storageFileId: stored.id,
    buffer,
    uploadedBy: userId,
  })

  return {
    source: provider.source,
    importKind,
    periodMonth,
    batchId: result.batch.id,
    fetchedRows: rows.length,
    matchedRows: result.batch.matchedRows,
    conflictRows: result.batch.conflictRows,
    notFoundRows: result.batch.notFoundRows,
    nextCursor,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
