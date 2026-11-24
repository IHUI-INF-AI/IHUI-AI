// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 人事生命周期纯函数(2026-11-23 立)。
 *
 * 与 hr-lifecycle.ts 的关系:本文件零 IO(不 import db),承载日期运算、状态机判据、
 * 离职证明文本、看板汇总;hr-lifecycle.ts re-export 本文件并叠加数据库动作。
 * 单测只 import 本文件,避免拉起连接池(与 fin-accounting/tax-period.ts 同一模式)。
 */

import { AppError } from '../errors/AppError.js'

export function toUtcDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d)
    throw new AppError(`日期格式应为 YYYY-MM-DD,收到 ${s}`, 400, 'HR_DATE_INVALID')
  return new Date(Date.UTC(y, m - 1, d))
}

export function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** 加 N 个自然月,日按"对应日"规则:目标月没有该日则取月末。 */
export function addMonths(date: string, months: number): string {
  const src = toUtcDate(date)
  const y = src.getUTCFullYear()
  const m = src.getUTCMonth()
  const day = src.getUTCDate()
  const lastOfTarget = new Date(Date.UTC(y, m + months + 1, 0)).getUTCDate()
  return fmtDate(new Date(Date.UTC(y, m + months, Math.min(day, lastOfTarget))))
}

export function addDays(date: string, days: number): string {
  return minusDays(date, -days)
}

function minusDays(date: string, days: number): string {
  const d = toUtcDate(date)
  d.setUTCDate(d.getUTCDate() - days)
  return fmtDate(d)
}

/**
 * 期间届满日(含最后一日的口径),用于试用期:
 *   · 起始日不是月末 ⇒ start + N 月 的前一天(1/1 起 3 个月 = 3/31);
 *   · 起始日是月末 ⇒ 取目标月末(1/31 起 3 个月 = 4/30,而不是 4/29)。
 */
export function computePeriodEnd(startDate: string, months: number): string {
  const src = toUtcDate(startDate)
  const day = src.getUTCDate()
  const lastOfStart = new Date(
    Date.UTC(src.getUTCFullYear(), src.getUTCMonth() + 1, 0),
  ).getUTCDate()
  const plus = addMonths(startDate, months)
  return day === lastOfStart ? plus : minusDays(plus, 1)
}

/** 试用期结束日;0 个月 = 无试用期 → null。 */
export function computeProbationEndDate(startDate: string, probationMonths: number): string | null {
  if (!probationMonths || probationMonths <= 0) return null
  return computePeriodEnd(startDate, probationMonths)
}

export type ContractExpiryState = 'indefinite' | 'active' | 'expiring' | 'expired'

/** 合同到期态(派生态,不落库):无 end_date = 无固定期限。 */
export function contractExpiryState(
  endDate: string | null | undefined,
  today: string,
  warnDays = 30,
): ContractExpiryState {
  if (!endDate) return 'indefinite'
  if (endDate < today) return 'expired'
  const warnUntil = addDays(today, warnDays)
  return endDate <= warnUntil ? 'expiring' : 'active'
}

const CONTRACT_TRANSITIONS: Record<string, string[]> = {
  draft: ['signed', 'terminated'],
  signed: ['expired', 'terminated', 'renewed'],
  expired: [],
  terminated: [],
  renewed: [],
}

export function canTransitContract(from: string, to: string): boolean {
  return (CONTRACT_TRANSITIONS[from] ?? []).includes(to)
}

const RESIGN_TRANSITIONS: Record<string, string[]> = {
  applied: ['approved', 'cancelled'],
  approved: ['settled'],
  settled: [],
  cancelled: [],
}

export function canTransitResignation(from: string, to: string): boolean {
  return (RESIGN_TRANSITIONS[from] ?? []).includes(to)
}

const CANDIDATE_TRANSITIONS: Record<string, string[]> = {
  applied: ['screening', 'rejected', 'withdrawn'],
  screening: ['interview', 'rejected', 'withdrawn'],
  interview: ['offer', 'rejected', 'withdrawn'],
  offer: ['hired', 'rejected', 'withdrawn'],
  hired: [],
  rejected: [],
  withdrawn: [],
}

export function canTransitCandidate(from: string, to: string): boolean {
  return (CANDIDATE_TRANSITIONS[from] ?? []).includes(to)
}

/** 离职证明编号:RESIGN-YYMMDD-<uuid 前 6 位(去横线)>。 */
export function buildCertificateNo(settledAtIso: string, resignationId: string): string {
  const d = new Date(settledAtIso)
  const ymd = `${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`
  const tail = resignationId.replace(/-/g, '').slice(0, 6).toUpperCase()
  return `RESIGN-${ymd}-${tail}`
}

export interface CertificateMeta {
  companyName: string
  employeeName: string
  employeeNo: string
  departmentName: string
  position: string | null
  hireDate: string | null
  lastWorkDate: string
  lastSalaryPeriod: string | null
  certificateNo: string
  issueDate: string
}

/**
 * 离职证明正文。
 * 措辞纪律:只陈述事实(入职日/离职日/岗位/交接已办理/薪资结算期),
 * **不写**"双方无任何争议"这类未经核实的免责句 —— 证明越权背书会让企业担责。
 */
export function buildResignCertificateText(meta: CertificateMeta): string {
  const pos = meta.position ? `任${meta.position}岗位` : '在职'
  return [
    '                              离 职 证 明',
    '',
    `兹证明 ${meta.employeeName}(工号 ${meta.employeeNo}),${meta.hireDate ? `于 ${meta.hireDate} 入职我司,` : ''}在${meta.departmentName}${pos}。`,
    `双方劳动合同已于 ${meta.lastWorkDate} 解除/终止,工作交接已办理完毕。`,
    `${meta.lastSalaryPeriod ? `薪资结算至 ${meta.lastSalaryPeriod} 月。` : '薪资按实际出勤结算。'}`,
    '',
    '特此证明。',
    '',
    `证明编号:${meta.certificateNo}`,
    `出具日期:${meta.issueDate}`,
    '',
    `${meta.companyName}(盖章)`,
  ].join('\n')
}

/** 合同到期看板汇总(纯函数,入参为最小行集)。 */
export function summarizeContractStates(
  rows: Array<{ status: string; endDate: string | null }>,
  today: string,
  warnDays = 30,
): {
  total: number
  signed: number
  draft: number
  expiring: number
  expired: number
  indefinite: number
} {
  let signed = 0
  let draft = 0
  let expiring = 0
  let expired = 0
  let indefinite = 0
  for (const r of rows) {
    if (r.status === 'draft') draft += 1
    if (r.status === 'signed') signed += 1
    const state = contractExpiryState(r.endDate, today, warnDays)
    if (state === 'expiring') expiring += 1
    if (state === 'expired') expired += 1
    if (state === 'indefinite') indefinite += 1
  }
  return { total: rows.length, signed, draft, expiring, expired, indefinite }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
