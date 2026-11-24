// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 绩效服务(2026-11-24 七波)。判据纯核单测钉死;DB 编排层薄。
 */
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'

import { db } from '../db/index.js'
import {
  hrEmployee,
  hrPerfCycle,
  hrPerfReview,
  type HrPerfReview,
} from '@ihui/database'
import { AppError } from '../errors/AppError.js'
import { createNotificationIdempotent } from '../db/notification-queries.js'
import { bizDayKey } from '../utils/biz-day.js'

/** 默认定级阈值(降序 min→grade);发起/精评可带自定义表,定稿时按当时表算存 grade */
export const DEFAULT_GRADE_THRESHOLDS: ReadonlyArray<{ min: number; grade: string }> = [
  { min: 90, grade: 'S' },
  { min: 80, grade: 'A' },
  { min: 70, grade: 'B' },
  { min: 60, grade: 'C' },
  { min: 0, grade: 'D' },
]

export function gradeFromScore(
  score: number,
  thresholds: ReadonlyArray<{ min: number; grade: string }> = DEFAULT_GRADE_THRESHOLDS,
): string {
  if (!Number.isInteger(score) || score < 0 || score > 100) {
    throw new AppError('绩效分必须是 0~100 的整数', 400, 'PERF_SCORE_INVALID')
  }
  const hit = [...thresholds].sort((a, b) => b.min - a.min).find((t) => score >= t.min)
  if (!hit) throw new AppError('阈值表未覆盖该分数(最后一档 min 应为 0)', 400, 'PERF_THRESHOLDS_GAP')
  return hit.grade
}

/**
 * 状态流转纯核(测试钉死)。actor 身份由路由传入,本函数只管"谁能对哪个状态做什么"。
 * 纪律:自评只能本人;评分只能指派上级;确认只能本人;refused 后上级重评 rounds+1。
 */
export function reviewTransition(
  review: Pick<HrPerfReview, 'status' | 'employeeId' | 'reviewerId'>,
  actor: { kind: 'employee' | 'manager' | 'admin'; employeeId?: string; userId?: string },
  action: 'self_submit' | 'manager_score' | 'confirm' | 'refuse',
): { status: string; roundsDelta: number; lockFinal: boolean } {
  if (actor.kind !== 'admin' && action === 'manager_score' && review.reviewerId !== actor.userId) {
    throw new AppError('只有指派的上级评估人能打分', 403, 'PERF_NOT_REVIEWER')
  }
  if ((action === 'self_submit' || action === 'confirm') && review.employeeId !== actor.employeeId) {
    throw new AppError('自评/确认只能员工本人操作', 403, 'PERF_NOT_SELF')
  }
  const t = (status: string, roundsDelta = 0, lockFinal = false) => ({ status, roundsDelta, lockFinal })
  switch (action) {
    case 'self_submit':
      if (review.status !== 'pending') throw new AppError(`状态 ${review.status} 不可提交自评`, 409, 'PERF_STATE_LOCK')
      return t('self_done')
    case 'manager_score':
      if (review.status !== 'self_done' && review.status !== 'refused') {
        throw new AppError(`状态 ${review.status} 不可评分(需自评完成或被refuse)`, 409, 'PERF_STATE_LOCK')
      }
      return t('reviewed', review.status === 'refused' ? 1 : 0, true)
    case 'confirm':
      if (review.status !== 'reviewed') throw new AppError('仅已评分单可确认', 409, 'PERF_STATE_LOCK')
      return t('confirmed')
    case 'refuse':
      if (review.status !== 'reviewed') throw new AppError('仅已评分单可申诉退回', 409, 'PERF_STATE_LOCK')
      return t('refused')
  }
}

export async function createCycle(input: {
  name: string
  cycleType: 'month' | 'quarter' | 'half' | 'year'
  startFrom: string
  endTo: string
  note?: string | null
}) {
  if (input.endTo < input.startFrom) {
    throw new AppError('周期结束日不得早于开始日', 400, 'PERF_CYCLE_RANGE')
  }
  const [dup] = await db.select({ id: hrPerfCycle.id }).from(hrPerfCycle).where(eq(hrPerfCycle.name, input.name))
  if (dup) throw new AppError(`考核周期 ${input.name} 已存在`, 409, 'PERF_CYCLE_EXISTS')
  const [row] = await db
    .insert(hrPerfCycle)
    .values({ ...input, status: 'draft' })
    .returning()
  return row!
}

export async function listCycles(status?: string) {
  if (status) {
    return db
      .select()
      .from(hrPerfCycle)
      .where(eq(hrPerfCycle.status, status))
      .orderBy(asc(hrPerfCycle.startFrom))
  }
  return db.select().from(hrPerfCycle).orderBy(asc(hrPerfCycle.startFrom))
}

export async function setCycleStatus(cycleId: string, status: 'open' | 'reviewing') {
  const [c] = await db.select().from(hrPerfCycle).where(eq(hrPerfCycle.id, cycleId))
  if (!c) throw new AppError('周期不存在', 404, 'PERF_CYCLE_NOT_FOUND')
  const flow: Record<string, string[]> = { draft: ['open'], open: ['reviewing'], reviewing: ['open'] }
  if (!(flow[c.status] ?? []).includes(status)) {
    throw new AppError(`周期状态 ${c.status} 不可直接到 ${status}`, 409, 'PERF_CYCLE_FLOW')
  }
  const [row] = await db.update(hrPerfCycle).set({ status, updatedAt: new Date() }).where(eq(hrPerfCycle.id, cycleId)).returning()
  return row!
}

/** 发起评估:批量(员工,上级)配对;已存在单跳过点名(幂等,不撞唯一索引) */
export async function launchReviews(cycleId: string, assignments: Array<{ employeeId: string, reviewerId: string }>) {
  const [c] = await db.select().from(hrPerfCycle).where(eq(hrPerfCycle.id, cycleId))
  if (!c) throw new AppError('周期不存在', 404, 'PERF_CYCLE_NOT_FOUND')
  if (c.status !== 'open' && c.status !== 'reviewing') {
    throw new AppError('周期未开放,不能发起评估', 409, 'PERF_CYCLE_NOT_OPEN')
  }
  const empIds = assignments.map((a) => a.employeeId)
  const emps = empIds.length
    ? await db.select({ id: hrEmployee.id }).from(hrEmployee).where(and(inArray(hrEmployee.id, empIds), isNull(hrEmployee.deletedAt)))
    : []
  const empSet = new Set(emps.map((e) => e.id))
  const existing = assignments.length
    ? await db
        .select({ employeeId: hrPerfReview.employeeId })
        .from(hrPerfReview)
        .where(and(eq(hrPerfReview.cycleId, cycleId), inArray(hrPerfReview.employeeId, empIds), isNull(hrPerfReview.deletedAt)))
    : []
  const existingSet = new Set(existing.map((r) => r.employeeId))
  const created: HrPerfReview[] = []
  const skipped: string[] = []
  for (const a of assignments) {
    if (!empSet.has(a.employeeId)) {
      skipped.push(`${a.employeeId}:员工不存在`)
      continue
    }
    if (existingSet.has(a.employeeId)) {
      skipped.push(`${a.employeeId}:本周期已有单`)
      continue
    }
    const [row] = await db
      .insert(hrPerfReview)
      .values({ cycleId, employeeId: a.employeeId, reviewerId: a.reviewerId, status: 'pending' })
      .returning()
    created.push(row!)
    existingSet.add(a.employeeId)
    await notify(a.reviewerId, '有新的绩效评估待处理', `${c.name}:请通知员工完成自评`, row!.id)
  }
  // 周期自动进入 reviewing
  const firstOpen = c.status === 'open' && created.length > 0
  if (firstOpen) {
    await db.update(hrPerfCycle).set({ status: 'reviewing', updatedAt: new Date() }).where(eq(hrPerfCycle.id, cycleId))
  }
  return { created: created.length, skipped, ids: created.map((r) => r.id) }
}

async function notify(userId: string, title: string, content: string, reviewId: string) {
  await createNotificationIdempotent({
    userId,
    type: 'hr.perf',
    title,
    content,
    data: { reviewId },
    idempotencyKey: `hr-perf:${reviewId}:${title.slice(0, 12)}:${bizDayKey(new Date())}`,
  })
}

export async function getReview(id: string) {
  const [row] = await db
    .select()
    .from(hrPerfReview)
    .where(and(eq(hrPerfReview.id, id), isNull(hrPerfReview.deletedAt)))
  if (!row) throw new AppError('评估单不存在', 404, 'PERF_REVIEW_NOT_FOUND')
  return row
}

export async function selfSubmit(id: string, actor: { employeeId?: string; userId?: string }, score: number, comment: string) {
  const review = await getReview(id)
  const tr = reviewTransition(review, { kind: 'employee', employeeId: actor.employeeId }, 'self_submit')
  const [row] = await db
    .update(hrPerfReview)
    .set({
      status: tr.status,
      selfScore: score,
      selfComment: comment.slice(0, 2000),
      updatedAt: new Date(),
    })
    .where(eq(hrPerfReview.id, id))
    .returning()
  await notify(review.reviewerId, '员工自评已完成,请评分', `自评 ${score} 分`, id)
  return row!
}

export async function managerScore(
  id: string,
  actor: { userId?: string },
  input: { finalScore: number; comment: string; thresholds?: Array<{ min: number; grade: string }> },
) {
  const review = await getReview(id)
  const tr = reviewTransition(review, { kind: 'manager', userId: actor.userId }, 'manager_score')
  const grade = gradeFromScore(input.finalScore, input.thresholds ?? DEFAULT_GRADE_THRESHOLDS)
  const [row] = await db
    .update(hrPerfReview)
    .set({
      status: tr.status,
      rounds: review.rounds + tr.roundsDelta,
      managerScore: input.finalScore,
      managerComment: input.comment.slice(0, 2000),
      finalScore: tr.lockFinal ? input.finalScore : review.finalScore,
      grade: tr.lockFinal ? grade : review.grade,
      updatedAt: new Date(),
    })
    .where(eq(hrPerfReview.id, id))
    .returning()
  // 通知走提交人关联账号(查不到档案/无关联则跳过,不假成功)
  const [emp] = await db.select({ userId: hrEmployee.userId }).from(hrEmployee).where(eq(hrEmployee.id, review.employeeId))
  if (emp?.userId) {
    await notify(emp.userId, '绩效已评分,请确认或申诉', `定级 ${grade}(${input.finalScore} 分)`, id)
  }
  return { row: row!, notified: Boolean(emp?.userId) }
}

export async function employeeDecide(id: string, actor: { employeeId?: string }, action: 'confirm' | 'refuse') {
  const review = await getReview(id)
  const tr = reviewTransition(review, { kind: 'employee', employeeId: actor.employeeId }, action)
  const [row] = await db.update(hrPerfReview).set({ status: tr.status, updatedAt: new Date() }).where(eq(hrPerfReview.id, id)).returning()
  await notify(review.reviewerId, action === 'refuse' ? '员工申诉退回绩效单' : '员工已确认绩效', row!.grade ?? '', id)
  return row!
}

/** 管理面代操作:走 admin kind,reason 拼进 note 可追责;通知仍按流程发 */
export async function adminReviewDecide(
  id: string,
  action: 'confirm' | 'refuse',
  operatorUserId: string | null,
  reason: string,
) {
  const review = await getReview(id)
  const tr = reviewTransition(review, { kind: 'admin', userId: operatorUserId ?? undefined }, action)
  const stamp = new Date().toISOString()
  const appended = `${review.note ? review.note + '\n' : ''}[admin-${action} @${stamp} op=${operatorUserId ?? '?'}] ${reason}`
  const [row] = await db
    .update(hrPerfReview)
    .set({ status: tr.status, note: appended.slice(0, 4000), updatedAt: new Date() })
    .where(eq(hrPerfReview.id, id))
    .returning()
  await notify(review.reviewerId, `管理员代${action === 'refuse' ? '退回应确认' : '确认'}绩效单`, reason, id)
  return row!
}

/** 周期 close 硬闸:仍有 pending/self_done/reviewed/refused(未终态)评估单 ⇒ 拒 close 并点名数量 */
export function assertCycleCloseable(reviews: ReadonlyArray<Pick<HrPerfReview, 'status'>>, cycleId: string) {
  const unfinished = reviews.filter((r) => r.status !== 'confirmed').length
  if (unfinished > 0) {
    throw new AppError(
      `周期 ${cycleId} 尚有 ${unfinished} 张未确认评估单;close 前须全部走到 confirmed,不 force`,
      409,
      'PERF_CYCLE_CLOSE_BLOCKED',
    )
  }
}

export async function closeCycle(cycleId: string) {
  const [c] = await db.select().from(hrPerfCycle).where(eq(hrPerfCycle.id, cycleId))
  if (!c) throw new AppError('周期不存在', 404, 'PERF_CYCLE_NOT_FOUND')
  const rows = await db
    .select({ status: hrPerfReview.status })
    .from(hrPerfReview)
    .where(and(eq(hrPerfReview.cycleId, cycleId), isNull(hrPerfReview.deletedAt)))
  assertCycleCloseable(rows, c.name)
  const [row] = await db.update(hrPerfCycle).set({ status: 'closed', updatedAt: new Date() }).where(eq(hrPerfCycle.id, cycleId)).returning()
  return row!
}

export async function listReviews(cycleId: string, status?: string) {
  const conds = [eq(hrPerfReview.cycleId, cycleId), isNull(hrPerfReview.deletedAt)]
  if (status) conds.push(eq(hrPerfReview.status, status))
  return db.select().from(hrPerfReview).where(and(...conds)).orderBy(asc(hrPerfReview.employeeId))
}

/** 等级分布报表(定稿单的 grade 计数;只数事实不做强制分布判定) */
export async function gradeDistribution(cycleId: string) {
  return db
    .select({
      grade: hrPerfReview.grade,
      count: sql<number>`count(*)::int`,
      avgScore: sql<string>`round(avg(${hrPerfReview.finalScore})::numeric, 1)::text`,
    })
    .from(hrPerfReview)
    .where(and(eq(hrPerfReview.cycleId, cycleId), sql`${hrPerfReview.finalScore} IS NOT NULL`))
    .groupBy(hrPerfReview.grade)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
