// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 人事招聘 —— 岗位 / 候选人 / 面试 / 录用入职(2026-11-23 从 hr-lifecycle.ts 拆出)。
 *
 * 为什么单独一份:hr-lifecycle.ts 曾到 999 行(招聘占近 380 行),超出单文件守门;
 * 招聘与"在职期"两个域的读改面几乎不重叠,拆开后各自可独立演进。
 * 纪律与主文件一致:状态只由服务层推进、路由只校验入参;录用必须走 hireCandidate
 * (裸推进 hired 会被拒绝,因为"已入职"却没有员工主档是最难补的脏数据)。
 */
import { and, desc, eq, isNull, sql } from 'drizzle-orm'

import { db } from '../db/index.js'
import { AppError } from '../errors/AppError.js'
import { hrCandidate, hrDepartment, hrEmployee, hrInterview, hrJobOpening } from '@ihui/database'

import { canTransitCandidate, fmtDate } from './hr-lifecycle-core.js'
import { autoIncreaseOnHire } from './hr-social-change.js'
// 合同草稿的创建口径与在职期共用一份实现(offer → 员工 + 合同不能有两套默认值)
import { createContract } from './hr-lifecycle.js'

/* ------------------------------------------------------------------ *
 * 招聘:岗位 / 候选人 / 面试 / 录用入职
 * ------------------------------------------------------------------ */

export interface OpeningInput {
  code?: string | null
  title: string
  departmentId: string
  headCount?: number
  employmentType?: string
  salaryMin?: number | null
  salaryMax?: number | null
  requirements?: string | null
  createdBy?: string | null
  status?: string
}

export async function createOpening(input: OpeningInput) {
  if (input.title.trim().length < 2)
    throw new AppError('岗位名称必填', 400, 'HR_OPENING_TITLE_REQUIRED')
  if (typeof input.headCount === 'number' && input.headCount <= 0) {
    throw new AppError('招聘人数必须大于 0', 400, 'HR_OPENING_HEADCOUNT_INVALID')
  }
  if (
    typeof input.salaryMin === 'number' &&
    typeof input.salaryMax === 'number' &&
    input.salaryMin > input.salaryMax
  ) {
    throw new AppError('薪资下限不能高于上限', 400, 'HR_OPENING_SALARY_RANGE_INVALID')
  }
  const [dept] = await db
    .select({ id: hrDepartment.id })
    .from(hrDepartment)
    .where(eq(hrDepartment.id, input.departmentId))
  if (!dept) throw new AppError('部门不存在', 404, 'HR_DEPARTMENT_NOT_FOUND')

  const nRows = await db.select({ n: sql<number>`count(*)::int` }).from(hrJobOpening)
  const n = Number(nRows[0]?.n ?? 0)
  const code =
    input.code?.trim() ||
    `JOB-${fmtDate(new Date()).replace(/-/g, '')}-${String(n + 1).padStart(2, '0')}`
  const status = input.status ?? 'draft'
  const [row] = await db
    .insert(hrJobOpening)
    .values({
      code,
      title: input.title.trim(),
      departmentId: input.departmentId,
      headCount: input.headCount ?? 1,
      employmentType: input.employmentType ?? 'fulltime',
      salaryMin: input.salaryMin ?? null,
      salaryMax: input.salaryMax ?? null,
      requirements: input.requirements ?? null,
      status,
      openedAt: status === 'open' ? new Date() : null,
      createdBy: input.createdBy ?? null,
    })
    .returning()
  return row
}

export async function listOpenings(params: { status?: string; departmentId?: string } = {}) {
  const conds = [isNull(hrJobOpening.deletedAt)]
  if (params.status) conds.push(eq(hrJobOpening.status, params.status))
  if (params.departmentId) conds.push(eq(hrJobOpening.departmentId, params.departmentId))
  return db
    .select()
    .from(hrJobOpening)
    .where(and(...conds))
    .orderBy(desc(hrJobOpening.createdAt))
    .limit(300)
}

/** 开/暂停/关闭:open 记 opened_at,closed 记 closed_at 且为终态。 */
export async function setOpeningStatus(id: string, status: 'draft' | 'open' | 'paused' | 'closed') {
  const [row] = await db.select().from(hrJobOpening).where(eq(hrJobOpening.id, id))
  if (!row || row.deletedAt) throw new AppError('招聘岗位不存在', 404, 'HR_OPENING_NOT_FOUND')
  if (row.status === 'closed')
    throw new AppError('岗位已关闭,不能再改状态', 400, 'HR_OPENING_CLOSED')
  const patch: Record<string, unknown> = { status, updatedAt: new Date() }
  if (status === 'open' && !row.openedAt) patch.openedAt = new Date()
  if (status === 'closed') patch.closedAt = new Date()
  const [updated] = await db
    .update(hrJobOpening)
    .set(patch)
    .where(eq(hrJobOpening.id, id))
    .returning()
  return updated
}

export interface CandidateInput {
  openingId: string
  name: string
  phone?: string | null
  email?: string | null
  resumeUrl?: string | null
  source?: string
  expectedSalary?: number | null
  remark?: string | null
}

export async function createCandidate(input: CandidateInput) {
  if (input.name.trim().length < 1)
    throw new AppError('候选人姓名必填', 400, 'HR_CANDIDATE_NAME_REQUIRED')
  const [opening] = await db
    .select({ id: hrJobOpening.id, status: hrJobOpening.status })
    .from(hrJobOpening)
    .where(eq(hrJobOpening.id, input.openingId))
  if (!opening) throw new AppError('招聘岗位不存在', 404, 'HR_OPENING_NOT_FOUND')
  if (opening.status !== 'open') {
    throw new AppError(
      `岗位当前为 ${opening.status},只有 open 状态才能收候选人`,
      400,
      'HR_OPENING_NOT_OPEN',
    )
  }
  const [row] = await db
    .insert(hrCandidate)
    .values({
      openingId: input.openingId,
      name: input.name.trim(),
      phone: input.phone ?? null,
      email: input.email ?? null,
      resumeUrl: input.resumeUrl ?? null,
      source: input.source ?? 'other',
      expectedSalary: input.expectedSalary ?? null,
      remark: input.remark ?? null,
    })
    .returning()
  return row
}

export async function listCandidates(params: { openingId?: string; stage?: string } = {}) {
  const conds = [isNull(hrCandidate.deletedAt)]
  if (params.openingId) conds.push(eq(hrCandidate.openingId, params.openingId))
  if (params.stage) conds.push(eq(hrCandidate.stage, params.stage))
  return db
    .select()
    .from(hrCandidate)
    .where(and(...conds))
    .orderBy(desc(hrCandidate.appliedAt))
    .limit(300)
}

/** 候选人阶段推进(淘汰必须给原因)。 */
export async function advanceCandidate(
  id: string,
  to: string,
  opts: { rejectReason?: string | null } = {},
) {
  // hired 不能裸推进:录用要建员工 + 建合同(hireCandidate),否则候选人"已入职"却没有主档
  if (to === 'hired') {
    throw new AppError(
      '录用请调用 hireCandidate(需带工号与部门,同时建员工与合同)',
      400,
      'HR_CANDIDATE_USE_HIRE',
    )
  }
  const [row] = await db.select().from(hrCandidate).where(eq(hrCandidate.id, id))
  if (!row || row.deletedAt) throw new AppError('候选人不存在', 404, 'HR_CANDIDATE_NOT_FOUND')
  if (!canTransitCandidate(row.stage, to)) {
    throw new AppError(`候选人不能从 ${row.stage} 变为 ${to}`, 400, 'HR_CANDIDATE_TRANSIT_INVALID')
  }
  if ((to === 'rejected' || to === 'withdrawn') && !opts.rejectReason?.trim()) {
    throw new AppError('淘汰/放弃必须填写原因', 400, 'HR_CANDIDATE_REASON_REQUIRED')
  }
  const patch: Record<string, unknown> = { stage: to, updatedAt: new Date() }
  if (to === 'rejected' || to === 'withdrawn')
    patch.rejectReason = opts.rejectReason?.trim() ?? null
  const [updated] = await db
    .update(hrCandidate)
    .set(patch)
    .where(eq(hrCandidate.id, id))
    .returning()
  return updated
}

export async function scheduleInterview(
  candidateId: string,
  input: {
    round?: number
    scheduledAt: string
    mode?: string
    interviewerName?: string | null
    interviewerId?: string | null
  },
) {
  const [cand] = await db.select().from(hrCandidate).where(eq(hrCandidate.id, candidateId))
  if (!cand || cand.deletedAt) throw new AppError('候选人不存在', 404, 'HR_CANDIDATE_NOT_FOUND')
  if (!['screening', 'interview', 'offer'].includes(cand.stage)) {
    throw new AppError(`候选人当前为 ${cand.stage},不能安排面试`, 400, 'HR_CANDIDATE_STAGE_INVALID')
  }
  const scheduledAt = new Date(input.scheduledAt)
  if (Number.isNaN(scheduledAt.getTime())) {
    throw new AppError('面试时间格式不正确', 400, 'HR_INTERVIEW_TIME_INVALID')
  }
  const nRows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(hrInterview)
    .where(eq(hrInterview.candidateId, candidateId))
  const round = input.round ?? Number(nRows[0]?.n ?? 0) + 1
  const mode = input.mode ?? 'onsite'
  if (!['onsite', 'phone', 'video'].includes(mode)) {
    throw new AppError('面试方式只能是 onsite/phone/video', 400, 'HR_INTERVIEW_MODE_INVALID')
  }
  const [row] = await db
    .insert(hrInterview)
    .values({
      candidateId,
      round,
      scheduledAt,
      mode,
      interviewerName: input.interviewerName ?? null,
      interviewerId: input.interviewerId ?? null,
    })
    .returning()
  // 第一次安排面试 ⇒ 候选人进入 interview 阶段
  if (cand.stage === 'screening') {
    await db
      .update(hrCandidate)
      .set({ stage: 'interview', updatedAt: new Date() })
      .where(eq(hrCandidate.id, candidateId))
  }
  return row
}

/** 面评提交:pass 时把候选人推到 interview(若还在 screening);是否发 offer 仍是人的决策。 */
export async function submitInterviewFeedback(
  interviewId: string,
  input: { result: 'pass' | 'fail' | 'pending'; score?: number | null; feedback?: string | null },
) {
  if (!['pass', 'fail', 'pending'].includes(input.result)) {
    throw new AppError('面评结论只能是 pass/fail/pending', 400, 'HR_INTERVIEW_RESULT_INVALID')
  }
  if (typeof input.score === 'number' && (input.score < 0 || input.score > 100)) {
    throw new AppError('面试评分应在 0~100', 400, 'HR_INTERVIEW_SCORE_INVALID')
  }
  const [row] = await db.select().from(hrInterview).where(eq(hrInterview.id, interviewId))
  if (!row) throw new AppError('面试安排不存在', 404, 'HR_INTERVIEW_NOT_FOUND')
  const decidedAt = new Date()
  const [updated] = await db
    .update(hrInterview)
    .set({
      result: input.result,
      score: input.score ?? null,
      feedback: input.feedback ?? null,
      decidedAt: input.result === 'pending' ? null : decidedAt,
      updatedAt: decidedAt,
    })
    .where(eq(hrInterview.id, interviewId))
    .returning()
  if (input.result === 'pass') {
    const [cand] = await db.select().from(hrCandidate).where(eq(hrCandidate.id, row.candidateId))
    if (cand && cand.stage === 'screening') {
      await db
        .update(hrCandidate)
        .set({ stage: 'interview', updatedAt: decidedAt })
        .where(eq(hrCandidate.id, cand.id))
    }
  }
  return updated
}

/** 面试安排列表(面试官/候选人都能查)。 */
export async function listInterviews(params: { candidateId?: string; pending?: boolean } = {}) {
  const conds = []
  if (params.candidateId) conds.push(eq(hrInterview.candidateId, params.candidateId))
  if (params.pending) conds.push(eq(hrInterview.result, 'pending'))
  return db
    .select()
    .from(hrInterview)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(hrInterview.scheduledAt))
    .limit(300)
}

export interface HireInput {
  employeeNo: string
  departmentId: string
  position?: string | null
  hireDate?: string
  phone?: string | null
  idNumber?: string | null
  contractStartDate?: string
  contractEndDate?: string | null
  contractType?: string
  probationMonths?: number
  /** 试用期工资比例(%,如 80) */
  probationSalaryRate?: string | null
}

/**
 * 录用入职闭环:候选人 → 员工(hr_employee) → 合同草稿(hr_contract)。
 * 员工必须挂在部门下;工号唯一;候选人必须处于 offer 阶段。
 * 建完员工奖金:(opening.hired_count += 1)、候选人 stage=hired、employee_id 回指。
 */
export async function hireCandidate(candidateId: string, input: HireInput) {
  const [cand] = await db.select().from(hrCandidate).where(eq(hrCandidate.id, candidateId))
  if (!cand || cand.deletedAt) throw new AppError('候选人不存在', 404, 'HR_CANDIDATE_NOT_FOUND')
  if (cand.stage !== 'offer') {
    throw new AppError(
      `候选人当前为 ${cand.stage},只有 offer 阶段才能录用`,
      400,
      'HR_CANDIDATE_STAGE_INVALID',
    )
  }
  if (!input.employeeNo?.trim()) throw new AppError('工号必填', 400, 'HR_EMPLOYEE_NO_REQUIRED')
  const [dup] = await db
    .select({ id: hrEmployee.id })
    .from(hrEmployee)
    .where(eq(hrEmployee.employeeNo, input.employeeNo.trim()))
  if (dup) throw new AppError(`工号 ${input.employeeNo} 已被占用`, 409, 'HR_EMPLOYEE_NO_DUPLICATED')

  const hireDate = input.hireDate ?? fmtDate(new Date())
  const [emp] = await db
    .insert(hrEmployee)
    .values({
      employeeNo: input.employeeNo.trim(),
      name: cand.name,
      departmentId: input.departmentId,
      position: input.position ?? null,
      hireDate,
      status: 'active',
      phone: input.phone ?? cand.phone ?? null,
      idNumber: input.idNumber ?? null,
    })
    .returning()

  if (!emp) throw new AppError('员工创建失败', 500, 'HR_EMPLOYEE_CREATE_FAILED')

  // 录用入职 → 社保增员待办(与手工建员工同一口径,幂等)
  await autoIncreaseOnHire(emp.id, hireDate, null)

  const contract = await createContract({
    employeeId: emp.id,
    contractType: input.contractType ?? 'fixed',
    startDate: input.contractStartDate ?? hireDate,
    endDate: input.contractEndDate ?? null,
    probationMonths: input.probationMonths ?? 3,
    probationSalaryRate: input.probationSalaryRate ?? null,
  })

  const now = new Date()
  const [updatedCand] = await db
    .update(hrCandidate)
    .set({ stage: 'hired', employeeId: emp.id, updatedAt: now })
    .where(eq(hrCandidate.id, candidateId))
    .returning()
  await db
    .update(hrJobOpening)
    .set({ hiredCount: sql`${hrJobOpening.hiredCount} + 1`, updatedAt: now })
    .where(eq(hrJobOpening.id, cand.openingId))

  return { employee: emp, contract, candidate: updatedCand }
}

/** 招聘看板:岗位各状态数 + 候选人各阶段数 + 在招岗位的缺口合计。 */
export async function recruitmentSummary() {
  const openings = await db
    .select({
      status: hrJobOpening.status,
      headCount: hrJobOpening.headCount,
      hiredCount: hrJobOpening.hiredCount,
    })
    .from(hrJobOpening)
    .where(isNull(hrJobOpening.deletedAt))
  const candidates = await db
    .select({ stage: hrCandidate.stage })
    .from(hrCandidate)
    .where(isNull(hrCandidate.deletedAt))

  const openingByStatus: Record<string, number> = {}
  let openGap = 0
  for (const o of openings) {
    openingByStatus[o.status] = (openingByStatus[o.status] ?? 0) + 1
    if (o.status === 'open') openGap += Math.max(0, o.headCount - o.hiredCount)
  }
  const candidateByStage: Record<string, number> = {}
  for (const c of candidates) candidateByStage[c.stage] = (candidateByStage[c.stage] ?? 0) + 1
  return {
    openings: { total: openings.length, byStatus: openingByStatus, openGap },
    candidates: { total: candidates.length, byStage: candidateByStage },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
