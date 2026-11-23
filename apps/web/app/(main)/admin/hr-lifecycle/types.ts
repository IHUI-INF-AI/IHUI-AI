// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { apiOrThrow as api } from '@/lib/api'

/** 人事生命周期服务端资源前缀(与 apps/api routes/hr-lifecycle.ts 一致) */
export const HR_RESOURCE = '/api/hr-lifecycle'
/** 发薪闭环资源前缀(与 apps/api routes/hr-payout.ts 一致) */
export const PAYOUT_RESOURCE = '/api/hr-payout'
/** 部门主数据(复用考勤路由的部门端点,不另建) */
export const DEPT_RESOURCE = '/api/hr-attendance'

export const HR_VIEW_PERM = 'hr:employee:view'
export const HR_MANAGE_PERM = 'hr:employee:manage'
export const RECRUIT_PERM = 'hr:recruit:manage'

export { api }

/** 合同状态机:草稿 → 生效 →(到期/解除/续签) */
export const CONTRACT_STATUS = ['draft', 'signed', 'expired', 'terminated', 'renewed'] as const
/** 离职状态机 */
export const RESIGN_STATUS = ['pending', 'approved', 'settled', 'cancelled'] as const
/** 候选人阶段 */
export const CANDIDATE_STAGES = [
  'new',
  'screening',
  'interview',
  'offer',
  'hired',
  'rejected',
] as const
/** 岗位状态 */
export const OPENING_STATUS = ['open', 'paused', 'closed', 'filled'] as const
/** 离职原因(与后端 RESIGN_REASONS 同集) */
export const RESIGN_REASONS = [
  'voluntary',
  'contract_end',
  'dismissal',
  'mutual',
  'retire',
  'other',
] as const
/** 离职交接清单默认项(与后端默认清单同集,页面展示进度用) */
export const CHECKLIST_KEYS = [
  'handover',
  'assets',
  'account',
  'finance',
  'confidentiality',
] as const

export interface HrContract {
  id: string
  employeeId: string
  contractNo: string
  contractType: string
  startDate: string
  endDate: string | null
  probationEndDate: string | null
  status: string
  parentContractId: string | null
  terminateReason: string | null
  expiryState?: string
}

export interface HrProbationDue {
  contractId: string
  employeeId: string
  employeeNo: string
  employeeName: string
  departmentId: string | null
  probationEndDate: string
  startDate: string
}

export interface HrResignation {
  id: string
  employeeId: string
  applyDate: string
  lastWorkDate: string
  reasonType: string
  reason: string | null
  status: string
  checklist: Record<string, boolean> | null
  certificateNo: string | null
}

export interface HrOpening {
  id: string
  code: string
  title: string
  departmentId: string | null
  status: string
  headCount: number
  hiredCount: number
}

export interface HrCandidate {
  id: string
  name: string
  phone: string | null
  email: string | null
  openingId: string
  stage: string
  employeeId: string | null
}

export interface HrDepartment {
  id: string
  name: string
}

export interface HrOverview {
  today: string
  contracts: {
    total: number
    signed: number
    draft: number
    expiring: number
    expired: number
    indefinite: number
  }
  probationDue: { count: number; employees: HrProbationDue[] }
  recruitment: {
    openings: { total: number; byStatus: Record<string, number>; openGap: number }
    candidates: { total: number; byStage: Record<string, number> }
  }
  resignations: { total: number; byStatus: Record<string, number> }
}

export interface PayoutBatch {
  id: string
  periodMonth: string
  status: string
  headCount: number
  totalAmount: string
  fileHash: string | null
  exportedAt: string | null
  submittedAt: string | null
  paidAt: string | null
}

export interface PayoutExport {
  batch: PayoutBatch
  fileName: string
  rows: number
  totalAmount: string
  fileHash: string
  content: string
}

export interface BankCoverage {
  periodMonth?: string
  total?: number
  covered?: number
  missing?: number
  missingList?: Array<{ employeeNo: string; name: string }>
}

/** 发薪汇总(/summary 口径):最新批次 + 批次总数 + 工资条三态 */
export interface PayoutSummary {
  periodMonth: string
  batch: {
    id: string
    status: string
    headCount: number
    totalAmount: string
    fileHash: string | null
    missing: number
    exportedAt: string | null
    submittedAt: string | null
    paidAt: string | null
  } | null
  batches: number
  slips: { total: number; generated: number; pushed: number; acknowledged: number }
}

/** 状态 → 语义色(fin 页同款词表) */
export function hrTone(status: string): 'ok' | 'warn' | 'muted' | 'danger' {
  if (
    status === 'signed' ||
    status === 'approved' ||
    status === 'hired' ||
    status === 'paid' ||
    status === 'open'
  ) {
    return 'ok'
  }
  if (
    status === 'expiring' ||
    status === 'pending' ||
    status === 'draft' ||
    status === 'offer' ||
    status === 'exported'
  ) {
    return 'warn'
  }
  if (
    status === 'terminated' ||
    status === 'expired' ||
    status === 'rejected' ||
    status === 'cancelled'
  ) {
    return 'danger'
  }
  return 'muted'
}

/** 金额格式化(与财务页一致两位小数) */
export function fmtMoney(v: string | number | null | undefined): string {
  const n = Number(v ?? 0)
  if (!Number.isFinite(n)) return '0.00'
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** 今日 YYYY-MM-DD */
export function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

/** 当月 YYYY-MM */
export function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** 交接清单完成度 */
export function checklistProgress(list: Record<string, boolean> | null): {
  done: number
  total: number
} {
  const keys = CHECKLIST_KEYS
  const done = keys.filter((k) => Boolean(list?.[k])).length
  return { done, total: keys.length }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
