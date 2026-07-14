import { eq, and, desc, asc, sql } from 'drizzle-orm'
import { db } from './index.js'
import {
  examCategories,
  examPapers,
  examQuestions,
  examRecords,
  users,
  type ExamCategory,
  type ExamPaper,
  type ExamQuestion,
  type ExamRecord,
} from '@ihui/database'

// =============================================================================
// Exam Categories
// =============================================================================

export async function findPublishedExamCategories(): Promise<ExamCategory[]> {
  return db
    .select()
    .from(examCategories)
    .where(eq(examCategories.status, 1))
    .orderBy(asc(examCategories.sort), asc(examCategories.createdAt))
}

export async function findAllExamCategories(): Promise<ExamCategory[]> {
  return db
    .select()
    .from(examCategories)
    .orderBy(asc(examCategories.sort), asc(examCategories.createdAt))
}

export async function findExamCategoryById(id: string): Promise<ExamCategory | undefined> {
  const rows = await db.select().from(examCategories).where(eq(examCategories.id, id)).limit(1)
  return rows[0]
}

export interface CreateExamCategoryInput {
  name: string
  pid?: string | null
  sort?: number
  status?: number
}

export async function createExamCategory(data: CreateExamCategoryInput): Promise<ExamCategory> {
  const rows = await db
    .insert(examCategories)
    .values({
      name: data.name,
      pid: data.pid,
      sort: data.sort,
      status: data.status,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建试卷分类失败')
  return row
}

export interface UpdateExamCategoryInput {
  name?: string
  pid?: string | null
  sort?: number
  status?: number
}

export async function updateExamCategory(
  id: string,
  data: UpdateExamCategoryInput,
): Promise<ExamCategory | undefined> {
  const rows = await db
    .update(examCategories)
    .set({
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.pid !== undefined ? { pid: data.pid } : {}),
      ...(data.sort !== undefined ? { sort: data.sort } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    })
    .where(eq(examCategories.id, id))
    .returning()
  return rows[0]
}

export async function deleteExamCategory(id: string): Promise<void> {
  await db.delete(examCategories).where(eq(examCategories.id, id))
}

// =============================================================================
// Exam Papers
// =============================================================================

export interface PaperWithCategory extends ExamPaper {
  categoryName: string | null
}

/**
 * 分页查询已发布试卷。
 * 仅返回 is_published=true 的试卷，支持关键词搜索(title/description)与 categoryId 筛选。
 */
export async function findPublishedPapers(opts: {
  page: number
  pageSize: number
  search?: string
  categoryId?: string
  paperType?: string
}): Promise<{ list: PaperWithCategory[]; total: number }> {
  const conds = [eq(examPapers.isPublished, true)]
  if (opts.search) {
    conds.push(
      sql`(${examPapers.title} ILIKE ${`%${opts.search}%`} OR ${examPapers.description} ILIKE ${`%${opts.search}%`})`,
    )
  }
  if (opts.categoryId) conds.push(eq(examPapers.categoryId, opts.categoryId))
  if (opts.paperType) conds.push(eq(examPapers.paperType, opts.paperType))
  const where = and(...conds)
  const [rows, totalRows] = await Promise.all([
    db
      .select({ paper: examPapers, categoryName: examCategories.name })
      .from(examPapers)
      .leftJoin(examCategories, eq(examPapers.categoryId, examCategories.id))
      .where(where)
      .orderBy(desc(examPapers.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(examPapers)
      .where(where),
  ])
  const list: PaperWithCategory[] = rows.map((r) => ({ ...r.paper, categoryName: r.categoryName }))
  return { list, total: Number(totalRows[0]?.count ?? 0) }
}

/** 管理员分页查询全部试卷(含未发布),支持 categoryId 筛选。 */
export async function findAllPapers(opts: {
  page: number
  pageSize: number
  search?: string
  categoryId?: string
  paperType?: string
}): Promise<{ list: PaperWithCategory[]; total: number }> {
  const conds = []
  if (opts.search) {
    conds.push(
      sql`(${examPapers.title} ILIKE ${`%${opts.search}%`} OR ${examPapers.description} ILIKE ${`%${opts.search}%`})`,
    )
  }
  if (opts.categoryId) conds.push(eq(examPapers.categoryId, opts.categoryId))
  if (opts.paperType) conds.push(eq(examPapers.paperType, opts.paperType))
  const where = conds.length ? and(...conds) : undefined
  const [rows, totalRows] = await Promise.all([
    db
      .select({ paper: examPapers, categoryName: examCategories.name })
      .from(examPapers)
      .leftJoin(examCategories, eq(examPapers.categoryId, examCategories.id))
      .where(where)
      .orderBy(desc(examPapers.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(examPapers)
      .where(where),
  ])
  const list: PaperWithCategory[] = rows.map((r) => ({ ...r.paper, categoryName: r.categoryName }))
  return { list, total: Number(totalRows[0]?.count ?? 0) }
}

export async function findPaperById(id: string): Promise<ExamPaper | undefined> {
  const rows = await db.select().from(examPapers).where(eq(examPapers.id, id)).limit(1)
  return rows[0]
}

export interface CreatePaperInput {
  title: string
  description?: string
  categoryId?: string
  paperType?: string
  totalScore?: string
  passScore?: string
  duration?: number
  isPublished?: boolean
  isRandom?: boolean
  status?: number
  createdBy?: string
}

export async function createPaper(data: CreatePaperInput): Promise<ExamPaper> {
  const rows = await db
    .insert(examPapers)
    .values({
      title: data.title,
      description: data.description,
      categoryId: data.categoryId,
      totalScore: data.totalScore,
      passScore: data.passScore,
      duration: data.duration,
      isPublished: data.isPublished,
      isRandom: data.isRandom,
      status: data.status,
      createdBy: data.createdBy,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建试卷失败')
  return row
}

export interface UpdatePaperInput {
  title?: string
  description?: string | null
  categoryId?: string | null
  paperType?: string
  totalScore?: string
  passScore?: string
  duration?: number
  isPublished?: boolean
  isRandom?: boolean
  questionCount?: number
  status?: number
}

export async function updatePaper(
  id: string,
  data: UpdatePaperInput,
): Promise<ExamPaper | undefined> {
  const rows = await db
    .update(examPapers)
    .set({
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
      ...(data.paperType !== undefined ? { paperType: data.paperType } : {}),
      ...(data.totalScore !== undefined ? { totalScore: data.totalScore } : {}),
      ...(data.passScore !== undefined ? { passScore: data.passScore } : {}),
      ...(data.duration !== undefined ? { duration: data.duration } : {}),
      ...(data.isPublished !== undefined ? { isPublished: data.isPublished } : {}),
      ...(data.isRandom !== undefined ? { isRandom: data.isRandom } : {}),
      ...(data.questionCount !== undefined ? { questionCount: data.questionCount } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      updatedAt: new Date(),
    })
    .where(eq(examPapers.id, id))
    .returning()
  return rows[0]
}

export async function deletePaper(id: string): Promise<void> {
  await db.delete(examPapers).where(eq(examPapers.id, id))
}

// =============================================================================
// Exam Questions
// =============================================================================

export async function findQuestionsByPaperId(paperId: string): Promise<ExamQuestion[]> {
  return db
    .select()
    .from(examQuestions)
    .where(eq(examQuestions.paperId, paperId))
    .orderBy(asc(examQuestions.sortOrder), asc(examQuestions.createdAt))
}

export async function findQuestionById(id: string): Promise<ExamQuestion | undefined> {
  const rows = await db.select().from(examQuestions).where(eq(examQuestions.id, id)).limit(1)
  return rows[0]
}

export interface CreateQuestionInput {
  type: string
  title: string
  options?: unknown
  answer?: unknown
  analysis?: string
  score?: string
  sortOrder?: number
}

export async function createQuestion(
  paperId: string,
  data: CreateQuestionInput,
): Promise<ExamQuestion> {
  const rows = await db
    .insert(examQuestions)
    .values({
      paperId,
      type: data.type,
      title: data.title,
      options: data.options,
      answer: data.answer,
      analysis: data.analysis,
      score: data.score,
      sortOrder: data.sortOrder,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建题目失败')
  // 同步题目数量到试卷
  await syncQuestionCount(paperId)
  return row
}

export interface UpdateQuestionInput {
  type?: string
  title?: string
  options?: unknown
  answer?: unknown
  analysis?: string | null
  score?: string
  sortOrder?: number
}

export async function updateQuestion(
  id: string,
  data: UpdateQuestionInput,
): Promise<ExamQuestion | undefined> {
  const rows = await db
    .update(examQuestions)
    .set({
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.options !== undefined ? { options: data.options } : {}),
      ...(data.answer !== undefined ? { answer: data.answer } : {}),
      ...(data.analysis !== undefined ? { analysis: data.analysis } : {}),
      ...(data.score !== undefined ? { score: data.score } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
    })
    .where(eq(examQuestions.id, id))
    .returning()
  return rows[0]
}

export async function deleteQuestion(id: string): Promise<void> {
  const question = await findQuestionById(id)
  await db.delete(examQuestions).where(eq(examQuestions.id, id))
  if (question) {
    await syncQuestionCount(question.paperId)
  }
}

/** 同步试卷的题目数量(question_count)。 */
async function syncQuestionCount(paperId: string): Promise<void> {
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(examQuestions)
    .where(eq(examQuestions.paperId, paperId))
  const count = Number(rows[0]?.count ?? 0)
  await db
    .update(examPapers)
    .set({ questionCount: count, updatedAt: new Date() })
    .where(eq(examPapers.id, paperId))
}

// =============================================================================
// Exam Records
// =============================================================================

/**
 * 分页查询当前用户的答题记录。
 */
export async function findMyExamRecords(
  userId: string,
  opts: { page: number; pageSize: number },
): Promise<{ list: ExamRecord[]; total: number }> {
  const where = eq(examRecords.userId, userId)
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(examRecords)
      .where(where)
      .orderBy(desc(examRecords.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(examRecords)
      .where(where),
  ])
  return { list, total: Number(totalRows[0]?.count ?? 0) }
}

export async function findExamRecordById(id: string): Promise<ExamRecord | undefined> {
  const rows = await db.select().from(examRecords).where(eq(examRecords.id, id)).limit(1)
  return rows[0]
}

/**
 * 管理员查询全站答题记录(分页,支持搜索)。
 */
export async function findAdminExamRecords(opts: {
  page: number
  pageSize: number
  search?: string
}): Promise<{ list: ExamRecord[]; total: number }> {
  const where = opts.search
    ? sql`${examRecords.userId} IN (SELECT id FROM users WHERE nickname ILIKE ${'%' + opts.search + '%'} OR phone ILIKE ${'%' + opts.search + '%'})`
    : sql`TRUE`
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(examRecords)
      .where(where)
      .orderBy(desc(examRecords.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(examRecords)
      .where(where),
  ])
  return { list, total: Number(totalRows[0]?.count ?? 0) }
}

/**
 * 开始答题：创建一条 pending 记录。
 * 同一用户同一试卷可多次答题(每次创建新记录)。
 */
export async function createExamRecord(paperId: string, userId: string): Promise<ExamRecord> {
  const rows = await db
    .insert(examRecords)
    .values({
      paperId,
      userId,
      status: 'pending',
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建答题记录失败')
  return row
}

export interface GradedAnswer {
  questionId: string
  answer: unknown
  isCorrect: boolean
  score: number
}

/**
 * 提交试卷并自动判分(客观题)。
 * - single_choice/judgment: 直接比较答案。
 * - multi_choice: 排序后比较数组。
 * - fill_blank: 逐空比较(去空格)。
 * - subjective: 不自动判分,isCorrect=false,score=0,需人工评分。
 *
 * 返回判分结果(得分/是否通过/用时/逐题明细)。
 */
export async function submitExamRecord(
  id: string,
  userId: string,
  answers: Array<{ questionId: string; answer: unknown }>,
): Promise<{ score: number; isPassed: boolean; duration: number; answers: GradedAnswer[] }> {
  const record = await findExamRecordById(id)
  if (!record) throw new Error('答题记录不存在')
  if (record.userId !== userId) throw new Error('无权操作该答题记录')
  if (record.status === 'submitted' || record.status === 'graded') throw new Error('该试卷已提交')

  const questions = await findQuestionsByPaperId(record.paperId)
  let totalScore = 0
  let hasSubjective = false
  const gradedAnswers: GradedAnswer[] = answers.map((a) => {
    const q = questions.find((qq) => qq.id === a.questionId)
    if (!q) return { questionId: a.questionId, answer: a.answer, isCorrect: false, score: 0 }
    let isCorrect = false
    if (q.type === 'single_choice' || q.type === 'judgment') {
      isCorrect = JSON.stringify(a.answer) === JSON.stringify(q.answer)
    } else if (q.type === 'multi_choice') {
      const ans = Array.isArray(a.answer) ? [...a.answer].sort() : []
      const correct = Array.isArray(q.answer) ? [...q.answer].sort() : []
      isCorrect = JSON.stringify(ans) === JSON.stringify(correct)
    } else if (q.type === 'fill_blank') {
      const ans = Array.isArray(a.answer) ? a.answer : [a.answer]
      const correct = Array.isArray(q.answer) ? q.answer : [q.answer]
      isCorrect =
        ans.length === correct.length &&
        ans.every((v, i) => String(v).trim() === String(correct[i]).trim())
    } else if (q.type === 'subjective') {
      // 主观题不自动判分,标记待人工评分
      hasSubjective = true
    }
    const score = isCorrect ? Number(q.score) : 0
    totalScore += score
    return { questionId: a.questionId, answer: a.answer, isCorrect, score }
  })

  const paper = await findPaperById(record.paperId)
  const isPassed = totalScore >= Number(paper?.passScore ?? 60)
  const duration = Math.floor((Date.now() - record.startedAt.getTime()) / 1000)
  const finalStatus = hasSubjective ? 'graded' : 'submitted'

  await db
    .update(examRecords)
    .set({
      answers: gradedAnswers,
      score: String(totalScore),
      isPassed,
      status: finalStatus,
      submittedAt: new Date(),
      duration,
    })
    .where(eq(examRecords.id, id))

  return { score: totalScore, isPassed, duration, answers: gradedAnswers }
}

// =============================================================================
// Admin: 主观题人工评分 + 记录管理
// =============================================================================

export interface ManualGradeItem {
  questionId: string
  score: number // 该题得分(0 ~ 题目分值)
  isCorrect?: boolean
}

/**
 * 管理员对主观题进行人工评分。
 * - 仅更新主观题答案的 score/isCorrect,其余答案保持不变。
 * - 重新汇总总分与是否通过,将状态置为 'submitted'(全部判分完成)。
 */
export async function gradeSubjectiveAnswers(
  recordId: string,
  grades: ManualGradeItem[],
): Promise<{ score: number; isPassed: boolean; status: string }> {
  const record = await findExamRecordById(recordId)
  if (!record) throw new Error('答题记录不存在')
  if (record.status === 'pending') throw new Error('该试卷尚未提交,无法评分')

  const questions = await findQuestionsByPaperId(record.paperId)
  const existingAnswers = (record.answers as GradedAnswer[] | null) ?? []
  const gradeMap = new Map(grades.map((g) => [g.questionId, g]))

  let totalScore = 0
  const updatedAnswers: GradedAnswer[] = existingAnswers.map((a) => {
    const q = questions.find((qq) => qq.id === a.questionId)
    const grade = gradeMap.get(a.questionId)
    if (grade && q) {
      const finalScore = Math.min(Math.max(0, grade.score), Number(q.score))
      totalScore += finalScore
      return { ...a, score: finalScore, isCorrect: grade.isCorrect ?? finalScore > 0 }
    }
    // 非主观题或未传入评分的答案保持原分
    totalScore += a.score
    return a
  })

  const paper = await findPaperById(record.paperId)
  const isPassed = totalScore >= Number(paper?.passScore ?? 60)

  await db
    .update(examRecords)
    .set({
      answers: updatedAnswers,
      score: String(totalScore),
      isPassed,
      status: 'submitted', // 人工评分完成,最终状态
    })
    .where(eq(examRecords.id, recordId))

  return { score: totalScore, isPassed, status: 'submitted' }
}

/** Admin: 删除答题记录。 */
export async function deleteExamRecord(id: string): Promise<void> {
  await db.delete(examRecords).where(eq(examRecords.id, id))
}

/**
 * Admin: 分页查询答题记录(含试卷标题 + 用户昵称)。
 * 替代原 findAdminExamRecords,返回更丰富的关联信息。
 */
export interface AdminExamRecordRow extends ExamRecord {
  paperTitle: string | null
  nickname: string | null
}

export async function findAdminExamRecordsRich(opts: {
  page: number
  pageSize: number
  search?: string
  paperId?: string
  status?: string
}): Promise<{ list: AdminExamRecordRow[]; total: number }> {
  const conds = []
  if (opts.paperId) conds.push(eq(examRecords.paperId, opts.paperId))
  if (opts.status) conds.push(eq(examRecords.status, opts.status))
  let where = conds.length ? and(...conds) : undefined
  if (opts.search) {
    const searchCond = sql`${examRecords.userId} IN (SELECT id FROM users WHERE nickname ILIKE ${`%${opts.search}%`} OR phone ILIKE ${`%${opts.search}%`})`
    where = where ? and(where, searchCond) : searchCond
  }
  const [rows, totalRows] = await Promise.all([
    db
      .select({
        record: examRecords,
        paperTitle: examPapers.title,
        nickname: users.nickname,
      })
      .from(examRecords)
      .innerJoin(examPapers, eq(examRecords.paperId, examPapers.id))
      .leftJoin(users, eq(examRecords.userId, users.id))
      .where(where)
      .orderBy(desc(examRecords.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(examRecords)
      .where(where),
  ])
  const list: AdminExamRecordRow[] = rows.map((r) => ({
    ...r.record,
    paperTitle: r.paperTitle,
    nickname: r.nickname,
  }))
  return { list, total: Number(totalRows[0]?.count ?? 0) }
}
