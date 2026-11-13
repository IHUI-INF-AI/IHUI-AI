// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:watermarked

import { apiOrThrow as api } from '@/lib/api'

/** 导入批次 */
export interface ImportBatch {
  id: string
  periodMonth: string
  importKind: string
  fileName: string
  status: string
  totalRows: number
  matchedRows: number
  conflictRows: number
  notFoundRows: number
  createdAt: string
}

/** 导入行明细 */
export interface ImportRow {
  id: string
  rowNumber: number
  employeeNo: string | null
  raw: Record<string, string> | null
  parsed: Record<string, unknown> | null
  matchStatus: string
  diffDetail: { field: string; systemValue: string | null; importValue: string | null }[] | null
  resolved: boolean
  resolution: string | null
  finalValue: Record<string, unknown> | null
}

export interface ImportBatchDetail {
  batch: ImportBatch
  rows: ImportRow[]
}

/** 上传响应 */
export interface UploadResult {
  batchId: string
  importKind: string
  status: string
  totalRows: number
  matchedRows: number
  conflictRows: number
  notFoundRows: number
  mapping: Record<string, string>
  preview: unknown[]
}

/** 结算结果 */
export interface DailyBuildResult {
  periodMonth: string
  employeeDays: number
  inserted: number
  updated: number
}

export interface MonthlyBuildResult {
  periodMonth: string
  employees: number
  inserted: number
  updated: number
  skippedSigned: number
}

/** 月结行 */
export interface MonthlyRow {
  id: string
  employeeId: string
  employeeNo: string | null
  employeeName: string | null
  scheduledDays: string
  actualDays: string
  lateCount: number
  earlyCount: number
  absentDays: string
  leaveDays: Record<string, number> | null
  otHours: string
  otDetail: { weekday?: number; weekend?: number; holiday?: number } | null
  signed: boolean
}

/** 工资单行 */
export interface PayrollRow {
  employeeNo: string | null
  employeeName: string | null
  baseSalary: string
  otAmount: string
  allowance: string
  attendanceDeduction: string
  grossPay: string
  insurancePersonal: string
  housingFundPersonal: string
  incomeTax: string
  netPay: string
  breakdown: {
    steps?: Record<string, number>
    warnings?: string[]
    rates?: { region: string; year: number } | null
  } | null
}

export interface PayrollBuildResult {
  periodMonth: string
  periodId: string
  employees: number
  inserted: number
  updated: number
  skippedNoConfig: number
  totalGross: number
  totalNet: number
}

export interface ListData<T> {
  list: T[]
  total?: number
}

export { api }
