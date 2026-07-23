/**
 * SRS 间隔复习业务逻辑(对接 SM-2 算法引擎 + database)。
 *
 * 依赖:
 * - spaced-repetition.ts: SM-2 纯算法
 * - @ihui/database: examWrongQuestion(错题本,含 SRS 字段) + examQuestions(题目内容)
 *
 * 字段映射(examWrongQuestion):
 * - easeFactor/interval/repetition/dueDate/lastReviewAt 为 SM-2 持久化状态
 */

import { eq, and, lte, isNotNull, sql, desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { examWrongQuestion, examQuestions } from '@ihui/database'
import {
  sm2Calculate,
  createInitialSM2State,
  getDueDateThreshold,
  type SM2State,
} from './spaced-repetition.js'

/** 待复习项(匹配 packages/types/src/education.ts SRSReviewItem 形状)。 */
export interface SRSReviewItem {
  id: string
  userId: string
  questionId: string
  questionText: string
  questionType: string
  dueDate: string
  easeFactor: number
  interval: number
  repetition: number
  lastReviewAt: string | null
}

/** 复习提交响应(匹配 SRSReviewResponse 形状)。 */
export interface SRSReviewResponse {
  success: boolean
  nextReviewDate: string
  interval: number
  easeFactor: number
  repetition: number
}

/** 复习统计。 */
export interface SRSReviewStats {
  totalDue: number
  totalReviewed: number
  streak: number
  avgEaseFactor: number
}

/** 获取用户今日待复习的错题列表(dueDate <= now 且未掌握)。 */
export async function getDueReviews(userId: string, page = 1, pageSize = 20) {
  const threshold = getDueDateThreshold()
  const offset = (page - 1) * pageSize
  const where = and(
    eq(examWrongQuestion.userId, userId),
    eq(examWrongQuestion.isMastered, false),
    lte(examWrongQuestion.dueDate, threshold),
  )

  const rows = await db
    .select({
      wrong: examWrongQuestion,
      question: examQuestions,
    })
    .from(examWrongQuestion)
    .leftJoin(examQuestions, eq(examWrongQuestion.questionId, examQuestions.id))
    .where(where)
    .orderBy(desc(examWrongQuestion.dueDate))
    .limit(pageSize)
    .offset(offset)

  const totalRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(examWrongQuestion)
    .where(where)

  const list: SRSReviewItem[] = rows.map((r) => ({
    id: r.wrong.id,
    userId: r.wrong.userId,
    questionId: r.wrong.questionId,
    questionText: r.question?.title ?? '',
    questionType: r.question?.type ?? '',
    dueDate: r.wrong.dueDate ? r.wrong.dueDate.toISOString() : new Date().toISOString(),
    easeFactor: r.wrong.easeFactor,
    interval: r.wrong.interval,
    repetition: r.wrong.repetition,
    lastReviewAt: r.wrong.lastReviewAt ? r.wrong.lastReviewAt.toISOString() : null,
  }))

  return {
    list,
    total: totalRows[0]?.count ?? 0,
    page,
    pageSize,
  }
}

/** 提交复习结果,根据 SM-2 计算新状态并更新 database。 */
export async function submitReview(
  userId: string,
  questionId: string,
  quality: number,
): Promise<SRSReviewResponse> {
  const rows = await db
    .select()
    .from(examWrongQuestion)
    .where(
      and(eq(examWrongQuestion.userId, userId), eq(examWrongQuestion.questionId, questionId)),
    )
    .limit(1)

  const wrong = rows[0]
  if (!wrong) {
    throw new Error('错题记录不存在')
  }

  const currentState: SM2State = {
    easeFactor: wrong.easeFactor,
    interval: wrong.interval,
    repetition: wrong.repetition,
  }

  const result = sm2Calculate(currentState, quality)
  const now = new Date()

  await db
    .update(examWrongQuestion)
    .set({
      easeFactor: result.easeFactor,
      interval: result.interval,
      repetition: result.repetition,
      dueDate: result.nextReviewDate,
      lastReviewAt: now,
      updatedAt: now,
    })
    .where(
      and(eq(examWrongQuestion.userId, userId), eq(examWrongQuestion.questionId, questionId)),
    )

  return {
    success: true,
    nextReviewDate: result.nextReviewDate.toISOString(),
    interval: result.interval,
    easeFactor: result.easeFactor,
    repetition: result.repetition,
  }
}

/** 初始化错题的 SM-2 状态(首次加入错题本时调用,dueDate 置为今天)。 */
export async function initSRSForWrongQuestion(userId: string, questionId: string) {
  const initialState = createInitialSM2State()
  const now = new Date()
  await db
    .update(examWrongQuestion)
    .set({
      easeFactor: initialState.easeFactor,
      interval: initialState.interval,
      repetition: initialState.repetition,
      dueDate: now,
      updatedAt: now,
    })
    .where(
      and(eq(examWrongQuestion.userId, userId), eq(examWrongQuestion.questionId, questionId)),
    )
}

/** 获取复习统计:待复习数 / 已复习数 / 连续天数 / 平均难度因子。 */
export async function getReviewStats(userId: string): Promise<SRSReviewStats> {
  const threshold = getDueDateThreshold()

  const dueRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(examWrongQuestion)
    .where(
      and(
        eq(examWrongQuestion.userId, userId),
        eq(examWrongQuestion.isMastered, false),
        lte(examWrongQuestion.dueDate, threshold),
      ),
    )
  const totalDue = dueRows[0]?.count ?? 0

  const reviewedRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(examWrongQuestion)
    .where(
      and(eq(examWrongQuestion.userId, userId), isNotNull(examWrongQuestion.lastReviewAt)),
    )
  const totalReviewed = reviewedRows[0]?.count ?? 0

  const avgRows = await db
    .select({
      avg: sql<number>`coalesce(avg(${examWrongQuestion.easeFactor}), 2.5)::float8`,
    })
    .from(examWrongQuestion)
    .where(eq(examWrongQuestion.userId, userId))
  const avgEaseFactor = Number(avgRows[0]?.avg ?? 2.5)

  // streak:基于 lastReviewAt 日期去重,从今天/昨天倒推连续链
  const dateRows = await db
    .select({
      d: sql<string>`distinct to_char(${examWrongQuestion.lastReviewAt}, 'YYYY-MM-DD')`,
    })
    .from(examWrongQuestion)
    .where(
      and(eq(examWrongQuestion.userId, userId), isNotNull(examWrongQuestion.lastReviewAt)),
    )
  const reviewDates = new Set(dateRows.map((r) => r.d).filter(Boolean))

  let streak = 0
  const today = new Date()
  const todayStr = formatDay(today)
  const yesterdayStr = formatDay(new Date(today.getTime() - 86400000))
  if (reviewDates.has(todayStr) || reviewDates.has(yesterdayStr)) {
    let cursor = reviewDates.has(todayStr)
      ? new Date(today)
      : new Date(today.getTime() - 86400000)
    while (reviewDates.has(formatDay(cursor))) {
      streak += 1
      cursor = new Date(cursor.getTime() - 86400000)
    }
  }

  return { totalDue, totalReviewed, streak, avgEaseFactor }
}

function formatDay(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
