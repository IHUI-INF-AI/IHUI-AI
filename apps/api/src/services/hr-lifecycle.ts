// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 人事生命周期 —— 合同 / 试用转正 / 离职 / 招聘(2026-11-23 立)。
 *
 * 补齐的主干:招聘岗位 → 候选人 → 面试 → 录用转员工 → 签合同 → 试用到期评估 → 转正 → 离职办结。
 * 每一步都是"有状态单据 + 只允许服务层推进",路由只做入参校验与权限,不直接写状态。
 *
 * 纪律:
 *   · 日期一律 `YYYY-MM-DD` 字符串,月运算走 UTC(避免本地时区把月末算成前一天);
 *   · 员工主档只在两处被写:转正(pass → regular_date)、离职办结(status=left + resign_date),
 *     其余动作不碰 hr_employee 的业务列;
 *   · 离职办结要求交接清单全勾:缺项直接拒绝,不允许"先办结后补勾";
 *   · 招聘闭环只到"录用建员工+建合同草稿",不发 offer 邮件、不签电子合同(那是下游能力);
 *   · 纯函数(日期/状态机/证明文本)与 IO 混排但都可单独 import,单测只测纯函数段。
 */

import { and, desc, eq, isNull, lte, sql } from 'drizzle-orm'

import { db } from '../db/index.js'
import { AppError } from '../errors/AppError.js'
import {
  hrContract,
  hrDepartment,
  hrEmployee,
  hrProbationReview,
  hrResignation,
} from '@ihui/database'

// 招聘看板在拆分出的 hr-recruit.ts(单文件行数门);本文件 lifecycleOverview 消费它
import { recruitmentSummary } from './hr-recruit.js'
import { autoDecreaseOnResign } from './hr-social-change.js'

import {
  addDays,
  buildCertificateNo,
  buildResignCertificateText,
  canTransitContract,
  canTransitResignation,
  computeProbationEndDate,
  contractExpiryState,
  fmtDate,
  summarizeContractStates,
  toUtcDate,
} from './hr-lifecycle-core.js'

// 纯函数段统一在 hr-lifecycle-core.ts(单一真相源),此处 re-export 供路由/外部使用
export * from './hr-lifecycle-core.js'

/* ------------------------------------------------------------------ *
 * 合同
 * ------------------------------------------------------------------ */

export interface CreateContractInput {
  employeeId: string
  contractNo?: string | null
  contractType?: string
  startDate: string
  endDate?: string | null
  probationMonths?: number
  probationSalaryRate?: string | null
  fileUrl?: string | null
  remark?: string | null
  createdBy?: string | null
}

const CONTRACT_TYPES = ['fixed', 'indefinite', 'internship', 'parttime', 'labor']

function assertContractInput(input: {
  contractType: string
  startDate: string
  endDate?: string | null
  probationMonths: number
}) {
  if (!CONTRACT_TYPES.includes(input.contractType)) {
    throw new AppError(
      `合同类型只能是 ${CONTRACT_TYPES.join('/')}`,
      400,
      'HR_CONTRACT_TYPE_INVALID',
    )
  }
  toUtcDate(input.startDate)
  const indefinite = input.contractType === 'indefinite'
  if (indefinite && input.endDate) {
    throw new AppError('无固定期限合同不应填写结束日期', 400, 'HR_CONTRACT_END_NOT_ALLOWED')
  }
  if (!indefinite) {
    if (!input.endDate)
      throw new AppError('固定期限合同必须填写结束日期', 400, 'HR_CONTRACT_END_REQUIRED')
    toUtcDate(input.endDate)
    if (input.endDate <= input.startDate) {
      throw new AppError('合同结束日期必须晚于开始日期', 400, 'HR_CONTRACT_RANGE_INVALID')
    }
  }
  if (input.probationMonths < 0 || input.probationMonths > 6) {
    throw new AppError('试用期月数只能是 0~6', 400, 'HR_CONTRACT_PROBATION_INVALID')
  }
}

export async function createContract(input: CreateContractInput) {
  const contractType = input.contractType ?? 'fixed'
  const probationMonths = input.probationMonths ?? 0
  assertContractInput({
    contractType,
    startDate: input.startDate,
    endDate: input.endDate,
    probationMonths,
  })

  const [emp] = await db
    .select({
      id: hrEmployee.id,
      name: hrEmployee.name,
      employeeNo: hrEmployee.employeeNo,
      deletedAt: hrEmployee.deletedAt,
    })
    .from(hrEmployee)
    .where(eq(hrEmployee.id, input.employeeId))
  if (!emp || emp.deletedAt) throw new AppError('员工不存在', 404, 'HR_EMPLOYEE_NOT_FOUND')

  const nRows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(hrContract)
    .where(eq(hrContract.employeeId, input.employeeId))
  const n = Number(nRows[0]?.n ?? 0)
  const contractNo =
    input.contractNo?.trim() ||
    `HT-${input.startDate.replace(/-/g, '')}-${emp.employeeNo}-${String(Number(n) + 1).padStart(2, '0')}`

  const [row] = await db
    .insert(hrContract)
    .values({
      employeeId: input.employeeId,
      contractNo,
      contractType,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      probationMonths,
      probationEndDate: computeProbationEndDate(input.startDate, probationMonths),
      probationSalaryRate: input.probationSalaryRate ?? null,
      status: 'draft',
      fileUrl: input.fileUrl ?? null,
      remark: input.remark ?? null,
      createdBy: input.createdBy ?? null,
    })
    .returning()
  if (!row) throw new AppError('合同创建失败', 500, 'HR_CONTRACT_CREATE_FAILED')
  return row
}

export async function listContracts(params: {
  employeeId?: string
  status?: string
  expiringWithinDays?: number
  today?: string
}) {
  const today = params.today ?? fmtDate(new Date())
  const conds = [isNull(hrContract.deletedAt)]
  if (params.employeeId) conds.push(eq(hrContract.employeeId, params.employeeId))
  if (params.status) conds.push(eq(hrContract.status, params.status))
  if (params.expiringWithinDays !== undefined) {
    conds.push(lte(hrContract.endDate, addDays(today, params.expiringWithinDays)))
  }
  const rows = await db
    .select()
    .from(hrContract)
    .where(and(...conds))
    .orderBy(desc(hrContract.startDate))
    .limit(500)
  return rows.map((r) => ({ ...r, expiryState: contractExpiryState(r.endDate, today) }))
}

async function loadContract(id: string) {
  const [row] = await db.select().from(hrContract).where(eq(hrContract.id, id))
  if (!row || row.deletedAt) throw new AppError('合同不存在', 404, 'HR_CONTRACT_NOT_FOUND')
  return row
}

/** 通用状态推进:签名/终止/到期/续签标记都走这里,非法转移一律拒绝。 */
export async function transitContract(
  id: string,
  to: 'signed' | 'expired' | 'terminated' | 'renewed',
  extra: { terminateReason?: string | null } = {},
) {
  const row = await loadContract(id)
  if (!canTransitContract(row.status, to)) {
    throw new AppError(
      `合同状态不能从 ${row.status} 变为 ${to}`,
      400,
      'HR_CONTRACT_TRANSIT_INVALID',
    )
  }
  if (to === 'terminated' && !extra.terminateReason?.trim()) {
    throw new AppError('解除合同必须填写原因', 400, 'HR_CONTRACT_TERMINATE_REASON_REQUIRED')
  }
  const patch: Record<string, unknown> = { status: to, updatedAt: new Date() }
  if (to === 'signed') patch.signedAt = new Date()
  if (to === 'terminated') patch.terminateReason = extra.terminateReason?.trim() ?? null
  const [updated] = await db.update(hrContract).set(patch).where(eq(hrContract.id, id)).returning()
  return updated
}

/** 续签:旧合同置 renewed,新合同 parent_contract_id 指向旧合同。 */
export async function renewContract(
  id: string,
  input: {
    startDate: string
    endDate?: string | null
    probationMonths?: number
    fileUrl?: string | null
  },
) {
  const old = await loadContract(id)
  if (old.status !== 'signed') {
    throw new AppError(
      `只有生效中的合同可续签,当前为 ${old.status}`,
      400,
      'HR_CONTRACT_NOT_RENEWABLE',
    )
  }
  const newContract = await createContract({
    employeeId: old.employeeId,
    contractType: old.contractType,
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    probationMonths: input.probationMonths ?? 0,
    fileUrl: input.fileUrl ?? null,
  })
  if (!newContract) throw new AppError('续签合同创建失败', 500, 'HR_CONTRACT_RENEW_FAILED')
  await db
    .update(hrContract)
    .set({ status: 'renewed', updatedAt: new Date() })
    .where(eq(hrContract.id, id))
  await db.update(hrContract).set({ parentContractId: id }).where(eq(hrContract.id, newContract.id))
  return {
    previous: { ...old, status: 'renewed' },
    current: { ...newContract, parentContractId: id },
  }
}

export async function contractSummary(today = fmtDate(new Date())) {
  const rows = await db
    .select({ status: hrContract.status, endDate: hrContract.endDate })
    .from(hrContract)
    .where(isNull(hrContract.deletedAt))
  return { ...summarizeContractStates(rows, today), today }
}

/* ------------------------------------------------------------------ *
 * 试用期转正
 * ------------------------------------------------------------------ */

export interface ProbationReviewInput {
  employeeId: string
  contractId?: string | null
  result: 'pass' | 'extend' | 'fail'
  score?: number | null
  selfSummary?: string | null
  managerComment?: string | null
  extendedUntil?: string | null
  decidedBy?: string | null
}

export async function submitProbationReview(input: ProbationReviewInput) {
  if (!['pass', 'extend', 'fail'].includes(input.result)) {
    throw new AppError('转正结论只能是 pass/extend/fail', 400, 'HR_PROBATION_RESULT_INVALID')
  }
  if (typeof input.score === 'number' && (input.score < 0 || input.score > 100)) {
    throw new AppError('评估得分应在 0~100', 400, 'HR_PROBATION_SCORE_INVALID')
  }
  if (input.result === 'extend' && !input.extendedUntil) {
    throw new AppError(
      '延长试用必须填写延长后的试用结束日',
      400,
      'HR_PROBATION_EXTEND_DATE_REQUIRED',
    )
  }

  const [emp] = await db
    .select({
      id: hrEmployee.id,
      name: hrEmployee.name,
      regularDate: hrEmployee.regularDate,
      deletedAt: hrEmployee.deletedAt,
    })
    .from(hrEmployee)
    .where(eq(hrEmployee.id, input.employeeId))
  if (!emp || emp.deletedAt) throw new AppError('员工不存在', 404, 'HR_EMPLOYEE_NOT_FOUND')
  if (input.result === 'pass' && emp.regularDate) {
    throw new AppError(`该员工已于 ${emp.regularDate} 转正,不能重复转正`, 409, 'HR_ALREADY_REGULAR')
  }

  const decidedAt = new Date()
  const [row] = await db
    .insert(hrProbationReview)
    .values({
      employeeId: input.employeeId,
      contractId: input.contractId ?? null,
      result: input.result,
      score: input.score ?? null,
      selfSummary: input.selfSummary ?? null,
      managerComment: input.managerComment ?? null,
      extendedUntil: input.result === 'extend' ? (input.extendedUntil ?? null) : null,
      decidedBy: input.decidedBy ?? null,
      decidedAt,
    })
    .returning()

  // extend:把该合同的试用结束日顺延,让"试用到期未评估"清单不再误报
  if (input.result === 'extend' && input.contractId) {
    await db
      .update(hrContract)
      .set({ probationEndDate: input.extendedUntil ?? null, updatedAt: new Date() })
      .where(eq(hrContract.id, input.contractId))
  }
  if (input.result === 'pass') {
    await db
      .update(hrEmployee)
      .set({ regularDate: fmtDate(decidedAt), updatedAt: decidedAt })
      .where(eq(hrEmployee.id, input.employeeId))
  }
  return row
}

export async function listProbationReviews(employeeId?: string) {
  const conds = employeeId ? [eq(hrProbationReview.employeeId, employeeId)] : []
  return db
    .select()
    .from(hrProbationReview)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(hrProbationReview.decidedAt))
    .limit(300)
}

/**
 * 试用到期未评估清单:生效合同中试用结束日 <= 截止日、且该员工尚无 pass 记录。
 * 这是人事最容易漏的一步(到期不评估 = 自动转正的争议风险)。
 */
export async function probationDueList(asOf = fmtDate(new Date())) {
  const rows = await db
    .select({
      contractId: hrContract.id,
      employeeId: hrEmployee.id,
      employeeNo: hrEmployee.employeeNo,
      employeeName: hrEmployee.name,
      departmentId: hrEmployee.departmentId,
      probationEndDate: hrContract.probationEndDate,
      startDate: hrContract.startDate,
    })
    .from(hrContract)
    .innerJoin(hrEmployee, eq(hrContract.employeeId, hrEmployee.id))
    .where(
      and(
        isNull(hrContract.deletedAt),
        eq(hrContract.status, 'signed'),
        lte(hrContract.probationEndDate, asOf),
        isNull(hrEmployee.deletedAt),
        isNull(hrEmployee.regularDate),
      ),
    )
    .orderBy(hrContract.probationEndDate)
    .limit(300)

  const passed = await db
    .select({ employeeId: hrProbationReview.employeeId })
    .from(hrProbationReview)
    .where(eq(hrProbationReview.result, 'pass'))
  const passedSet = new Set(passed.map((p) => p.employeeId))
  return { asOf, rows: rows.filter((r) => !passedSet.has(r.employeeId)) }
}

/* ------------------------------------------------------------------ *
 * 离职
 * ------------------------------------------------------------------ */

export interface ResignationInput {
  employeeId: string
  applyDate?: string
  lastWorkDate: string
  reasonType?: string
  reason?: string | null
  handoverTo?: string | null
  handoverNote?: string | null
  lastSalaryPeriod?: string | null
}

const RESIGN_REASONS = ['voluntary', 'contract_end', 'dismissal', 'mutual', 'retire', 'other']

export async function applyResignation(input: ResignationInput) {
  const applyDate = input.applyDate ?? fmtDate(new Date())
  toUtcDate(applyDate)
  toUtcDate(input.lastWorkDate)
  if (input.lastWorkDate < applyDate) {
    throw new AppError('最后工作日不得早于申请日', 400, 'HR_RESIGN_DATE_INVALID')
  }
  const reasonType = input.reasonType ?? 'voluntary'
  if (!RESIGN_REASONS.includes(reasonType)) {
    throw new AppError(
      `离职原因只能是 ${RESIGN_REASONS.join('/')}`,
      400,
      'HR_RESIGN_REASON_INVALID',
    )
  }

  const [emp] = await db
    .select({ id: hrEmployee.id, status: hrEmployee.status, deletedAt: hrEmployee.deletedAt })
    .from(hrEmployee)
    .where(eq(hrEmployee.id, input.employeeId))
  if (!emp || emp.deletedAt) throw new AppError('员工不存在', 404, 'HR_EMPLOYEE_NOT_FOUND')
  if (emp.status === 'left') throw new AppError('该员工已离职', 409, 'HR_EMPLOYEE_ALREADY_LEFT')
  if (input.handoverTo === input.employeeId) {
    throw new AppError('交接人不能是本人', 400, 'HR_RESIGN_HANDOVER_SELF')
  }

  const [pending] = await db
    .select({ id: hrResignation.id })
    .from(hrResignation)
    .where(and(eq(hrResignation.employeeId, input.employeeId), eq(hrResignation.status, 'applied')))
  if (pending) throw new AppError('该员工已有待批离职申请', 409, 'HR_RESIGN_DUPLICATED')

  const [row] = await db
    .insert(hrResignation)
    .values({
      employeeId: input.employeeId,
      applyDate,
      lastWorkDate: input.lastWorkDate,
      reasonType,
      reason: input.reason ?? null,
      handoverTo: input.handoverTo ?? null,
      handoverNote: input.handoverNote ?? null,
      lastSalaryPeriod: input.lastSalaryPeriod ?? null,
      status: 'applied',
    })
    .returning()
  return row
}

async function loadResignation(id: string) {
  const [row] = await db.select().from(hrResignation).where(eq(hrResignation.id, id))
  if (!row) throw new AppError('离职申请不存在', 404, 'HR_RESIGN_NOT_FOUND')
  return row
}

export async function approveResignation(id: string, approvedBy: string | null) {
  const row = await loadResignation(id)
  if (!canTransitResignation(row.status, 'approved')) {
    throw new AppError(`离职申请当前为 ${row.status},不能批准`, 400, 'HR_RESIGN_TRANSIT_INVALID')
  }
  const [updated] = await db
    .update(hrResignation)
    .set({ status: 'approved', approvedBy, approvedAt: new Date(), updatedAt: new Date() })
    .where(eq(hrResignation.id, id))
    .returning()
  return updated
}

export async function cancelResignation(id: string) {
  const row = await loadResignation(id)
  if (!canTransitResignation(row.status, 'cancelled')) {
    throw new AppError(`离职申请当前为 ${row.status},不能撤销`, 400, 'HR_RESIGN_TRANSIT_INVALID')
  }
  const [updated] = await db
    .update(hrResignation)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(hrResignation.id, id))
    .returning()
  return updated
}

/**
 * 办结:approved → settled。
 * 前置:交接清单 checklist 必须**全部为 true**(键由调用方给出,缺键即缺项 ⇒ 拒绝);
 * 副作用:员工 status='left' + resign_date=lastWorkDate、生成离职证明编号与正文。
 */
export async function settleResignation(id: string, checklist: Record<string, boolean>) {
  const row = await loadResignation(id)
  if (!canTransitResignation(row.status, 'settled')) {
    throw new AppError(
      `离职申请当前为 ${row.status},不能办结(须先批准)`,
      400,
      'HR_RESIGN_TRANSIT_INVALID',
    )
  }
  const keys = Object.keys(checklist)
  if (keys.length === 0)
    throw new AppError('办结前请提交交接清单', 400, 'HR_RESIGN_CHECKLIST_REQUIRED')
  const missing = keys.filter((k) => checklist[k] !== true)
  if (missing.length > 0) {
    throw new AppError(
      `交接清单未完成:${missing.join('、')}`,
      400,
      'HR_RESIGN_CHECKLIST_INCOMPLETE',
    )
  }

  const [emp] = await db
    .select({
      id: hrEmployee.id,
      name: hrEmployee.name,
      employeeNo: hrEmployee.employeeNo,
      position: hrEmployee.position,
      hireDate: hrEmployee.hireDate,
      departmentId: hrEmployee.departmentId,
    })
    .from(hrEmployee)
    .where(eq(hrEmployee.id, row.employeeId))
  if (!emp) throw new AppError('员工不存在', 404, 'HR_EMPLOYEE_NOT_FOUND')
  const [dept] = await db
    .select({ name: hrDepartment.name })
    .from(hrDepartment)
    .where(eq(hrDepartment.id, emp.departmentId))

  const settledAt = new Date()
  const certificateNo = buildCertificateNo(settledAt.toISOString(), id)
  const [updated] = await db
    .update(hrResignation)
    .set({ status: 'settled', settledAt, certificateNo, checklist, updatedAt: settledAt })
    .where(eq(hrResignation.id, id))
    .returning()
  await db
    .update(hrEmployee)
    .set({ status: 'left', resignDate: row.lastWorkDate, updatedAt: settledAt })
    .where(eq(hrEmployee.id, row.employeeId))
  // 在职合同随离职终止(draft 直接终止,不留悬挂待签合同)
  await db
    .update(hrContract)
    .set({ status: 'terminated', terminateReason: '员工离职', updatedAt: settledAt })
    .where(and(eq(hrContract.employeeId, row.employeeId), eq(hrContract.status, 'signed')))

  // 离职办结 → 社保减员待办(幂等). 账期 = 最后工作日所在月
  const socialDecrease = await autoDecreaseOnResign(
    row.employeeId,
    row.lastWorkDate,
    row.approvedBy ?? null,
  )

  const certificate = buildResignCertificateText({
    companyName: process.env.HR_COMPANY_NAME?.trim() || '公司',
    employeeName: emp.name,
    employeeNo: emp.employeeNo,
    departmentName: dept?.name ?? '',
    position: emp.position,
    hireDate: emp.hireDate,
    lastWorkDate: row.lastWorkDate,
    lastSalaryPeriod: row.lastSalaryPeriod,
    certificateNo,
    issueDate: fmtDate(settledAt),
  })
  return {
    resignation: updated,
    certificate,
    socialInsuranceDecrease: {
      created: socialDecrease.created,
      changeId: socialDecrease.change.id,
      effectiveMonth: socialDecrease.change.effectiveMonth,
      status: socialDecrease.change.status,
    },
  }
}

export async function listResignations(params: { employeeId?: string; status?: string }) {
  const conds = []
  if (params.employeeId) conds.push(eq(hrResignation.employeeId, params.employeeId))
  if (params.status) conds.push(eq(hrResignation.status, params.status))
  return db
    .select()
    .from(hrResignation)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(hrResignation.applyDate))
    .limit(300)
}

/** 离职证明(只读重出):要求已办结。 */
export async function resignationCertificate(id: string) {
  const row = await loadResignation(id)
  if (row.status !== 'settled' || !row.certificateNo) {
    throw new AppError('离职尚未办结,无法出证明', 400, 'HR_RESIGN_NOT_SETTLED')
  }
  const [emp] = await db
    .select({
      name: hrEmployee.name,
      employeeNo: hrEmployee.employeeNo,
      position: hrEmployee.position,
      hireDate: hrEmployee.hireDate,
      departmentId: hrEmployee.departmentId,
    })
    .from(hrEmployee)
    .where(eq(hrEmployee.id, row.employeeId))
  if (!emp) throw new AppError('员工不存在', 404, 'HR_EMPLOYEE_NOT_FOUND')
  const [dept] = await db
    .select({ name: hrDepartment.name })
    .from(hrDepartment)
    .where(eq(hrDepartment.id, emp.departmentId))
  return {
    certificateNo: row.certificateNo,
    text: buildResignCertificateText({
      companyName: process.env.HR_COMPANY_NAME?.trim() || '公司',
      employeeName: emp.name,
      employeeNo: emp.employeeNo,
      departmentName: dept?.name ?? '',
      position: emp.position,
      hireDate: emp.hireDate,
      lastWorkDate: row.lastWorkDate,
      lastSalaryPeriod: row.lastSalaryPeriod,
      certificateNo: row.certificateNo,
      issueDate: row.settledAt ? fmtDate(new Date(row.settledAt)) : fmtDate(new Date()),
    }),
  }
}

/* 招聘域已拆到 hr-recruit.ts(行数门);re-export 保持既有导入路径不变 */
export * from './hr-recruit.js'

/* ------------------------------------------------------------------ *
 * 人事总览(把散在各表的"今天该干什么"汇总成一块看板)
 * ------------------------------------------------------------------ */

export async function lifecycleOverview(today = fmtDate(new Date())) {
  const contracts = await db
    .select({ status: hrContract.status, endDate: hrContract.endDate })
    .from(hrContract)
    .where(isNull(hrContract.deletedAt))
  const [due, recruit, resigns] = await Promise.all([
    probationDueList(today),
    recruitmentSummary(),
    db.select({ status: hrResignation.status }).from(hrResignation).limit(1000),
  ])
  const resignByStatus: Record<string, number> = {}
  for (const r of resigns) resignByStatus[r.status] = (resignByStatus[r.status] ?? 0) + 1
  return {
    today,
    contracts: summarizeContractStates(contracts, today),
    probationDue: { count: due.rows.length, employees: due.rows.slice(0, 20) },
    recruitment: recruit,
    resignations: { total: resigns.length, byStatus: resignByStatus },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
