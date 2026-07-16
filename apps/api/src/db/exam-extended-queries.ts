import { eq, and, desc, asc, sql, inArray } from 'drizzle-orm';
import { db } from './index.js';
import {
  examChapters,
  examChapterSections,
  examSignups,
  examRecords,
  examPapers,
  examQuestions,
  examWrongQuestion,
  users,
  type ExamChapter,
  type ExamChapterSection,
  type ExamSignup,
  type ExamRecord,
  type ExamWrongQuestion,
} from '@ihui/database';
import { AppError } from '../errors/AppError.js';

// =============================================================================
// Chapters - 试卷章节
// =============================================================================

/** 查询某试卷下的全部章节(按 sort 升序)。 */
export async function findChapterList(paperId: string): Promise<ExamChapter[]> {
  return db
    .select()
    .from(examChapters)
    .where(eq(examChapters.paperId, paperId))
    .orderBy(asc(examChapters.sort), asc(examChapters.createdAt));
}

export async function findChapterById(id: string): Promise<ExamChapter | undefined> {
  const rows = await db.select().from(examChapters).where(eq(examChapters.id, id)).limit(1);
  return rows[0];
}

export interface CreateChapterInput {
  paperId: string;
  title: string;
  description?: string | null;
  sort?: number;
}

export async function createChapter(data: CreateChapterInput): Promise<ExamChapter> {
  const rows = await db
    .insert(examChapters)
    .values({
      paperId: data.paperId,
      title: data.title,
      description: data.description,
      sort: data.sort,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建章节失败');
  return row;
}

export interface UpdateChapterInput {
  title?: string;
  description?: string | null;
  sort?: number;
}

export async function updateChapter(id: string, data: UpdateChapterInput): Promise<ExamChapter | undefined> {
  const set: Record<string, unknown> = {};
  if (data.title !== undefined) set.title = data.title;
  if (data.description !== undefined) set.description = data.description;
  if (data.sort !== undefined) set.sort = data.sort;
  set.updatedAt = new Date();
  const rows = await db.update(examChapters).set(set).where(eq(examChapters.id, id)).returning();
  return rows[0];
}

export async function deleteChapter(id: string): Promise<void> {
  await db.delete(examChapters).where(eq(examChapters.id, id));
}

// =============================================================================
// Sections - 章节小节
// =============================================================================

/** 查询某章节下的全部小节(按 sort 升序)。 */
export async function findSectionList(chapterId: string): Promise<ExamChapterSection[]> {
  return db
    .select()
    .from(examChapterSections)
    .where(eq(examChapterSections.chapterId, chapterId))
    .orderBy(asc(examChapterSections.sort), asc(examChapterSections.createdAt));
}

export async function findSectionById(id: string): Promise<ExamChapterSection | undefined> {
  const rows = await db
    .select()
    .from(examChapterSections)
    .where(eq(examChapterSections.id, id))
    .limit(1);
  return rows[0];
}

export interface CreateSectionInput {
  chapterId: string;
  title: string;
  description?: string | null;
  questionIds?: unknown;
  sort?: number;
}

export async function createSection(data: CreateSectionInput): Promise<ExamChapterSection> {
  const rows = await db
    .insert(examChapterSections)
    .values({
      chapterId: data.chapterId,
      title: data.title,
      description: data.description,
      questionIds: data.questionIds,
      sort: data.sort,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建小节失败');
  return row;
}

export interface UpdateSectionInput {
  title?: string;
  description?: string | null;
  questionIds?: unknown;
  sort?: number;
}

export async function updateSection(
  id: string,
  data: UpdateSectionInput,
): Promise<ExamChapterSection | undefined> {
  const set: Record<string, unknown> = {};
  if (data.title !== undefined) set.title = data.title;
  if (data.description !== undefined) set.description = data.description;
  if (data.questionIds !== undefined) set.questionIds = data.questionIds;
  if (data.sort !== undefined) set.sort = data.sort;
  set.updatedAt = new Date();
  const rows = await db
    .update(examChapterSections)
    .set(set)
    .where(eq(examChapterSections.id, id))
    .returning();
  return rows[0];
}

export async function deleteSection(id: string): Promise<void> {
  await db.delete(examChapterSections).where(eq(examChapterSections.id, id));
}

// =============================================================================
// Sort Order - 批量排序
// =============================================================================

/** 批量更新章节排序,逐条更新以保证顺序。 */
export async function updateChapterSortOrder(items: Array<{ id: string; sort: number }>): Promise<void> {
  await Promise.all(
    items.map((item) =>
      db
        .update(examChapters)
        .set({ sort: item.sort, updatedAt: new Date() })
        .where(eq(examChapters.id, item.id)),
    ),
  );
}

/** 批量更新小节排序,逐条更新以保证顺序。 */
export async function updateSectionSortOrder(items: Array<{ id: string; sort: number }>): Promise<void> {
  await Promise.all(
    items.map((item) =>
      db
        .update(examChapterSections)
        .set({ sort: item.sort, updatedAt: new Date() })
        .where(eq(examChapterSections.id, item.id)),
    ),
  );
}

// =============================================================================
// Signups - 考试报名
// =============================================================================

/** 查询报名列表,支持按 paperId/userId 筛选。 */
export async function findSignupList(opts: {
  paperId?: string;
  userId?: string;
}): Promise<ExamSignup[]> {
  const conds = [];
  if (opts.paperId) conds.push(eq(examSignups.paperId, opts.paperId));
  if (opts.userId) conds.push(eq(examSignups.userId, opts.userId));
  const where = conds.length ? and(...conds) : undefined;
  return db.select().from(examSignups).where(where).orderBy(desc(examSignups.createdAt));
}

export interface CreateSignupInput {
  paperId: string;
  userId: string;
  status?: string;
}

export async function createSignup(data: CreateSignupInput): Promise<ExamSignup> {
  const rows = await db
    .insert(examSignups)
    .values({
      paperId: data.paperId,
      userId: data.userId,
      status: data.status,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建报名记录失败');
  return row;
}

export async function deleteSignup(id: string): Promise<void> {
  await db.delete(examSignups).where(eq(examSignups.id, id));
}

// =============================================================================
// Mark Records - 待评分答题记录
// =============================================================================

/** 待评分答题记录(含试卷标题 + 用户昵称),查询 status='pending' 的记录。 */
export interface MarkRecordRow extends ExamRecord {
  paperTitle: string | null;
  nickname: string | null;
}

/**
 * 分页查询待评分答题记录(exam_records 中 status='pending')。
 * 支持 paperId 筛选与关键词搜索(用户昵称/手机号)。
 */
export async function findMarkRecordList(opts: {
  page: number;
  pageSize: number;
  paperId?: string;
  search?: string;
}): Promise<{ list: MarkRecordRow[]; total: number }> {
  const conds = [eq(examRecords.status, 'pending')];
  if (opts.paperId) conds.push(eq(examRecords.paperId, opts.paperId));
  let where = and(...conds);
  if (opts.search) {
    const searchCond = sql`${examRecords.userId} IN (SELECT id FROM users WHERE nickname ILIKE ${`%${opts.search}%`} OR phone ILIKE ${`%${opts.search}%`})`;
    where = and(where, searchCond);
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
    db.select({ count: sql<number>`COUNT(*)` }).from(examRecords).where(where),
  ]);
  const list: MarkRecordRow[] = rows.map((r) => ({
    ...r.record,
    paperTitle: r.paperTitle,
    nickname: r.nickname,
  }));
  return { list, total: Number(totalRows[0]?.count ?? 0) };
}

// =============================================================================
// Wrong Questions - 错题本(自动入库 + 幂等 + 统计)
// =============================================================================

export interface CreateOrUpdateWrongQuestionInput {
  userId: string;
  questionId: string;
  paperId: string;
  paperTitle?: string | null;
  userAnswer: string;
  rightAnswer: string;
}

/**
 * 创建或更新错题(幂等):同题同用户只一条记录。
 * - 存在:wrongCount+1 + 更新 lastWrongTime/userAnswer/rightAnswer + isMastered=false(重新答错则取消掌握标记)
 * - 不存在:新建 wrongCount=1
 */
export async function createOrUpdateWrongQuestion(
  data: CreateOrUpdateWrongQuestionInput,
): Promise<ExamWrongQuestion> {
  const existing = await db
    .select()
    .from(examWrongQuestion)
    .where(
      and(
        eq(examWrongQuestion.userId, data.userId),
        eq(examWrongQuestion.questionId, data.questionId),
      ),
    )
    .limit(1);

  const now = new Date();

  if (existing[0]) {
    const [updated] = await db
      .update(examWrongQuestion)
      .set({
        wrongCount: (existing[0].wrongCount ?? 1) + 1,
        lastWrongTime: now,
        userAnswer: data.userAnswer,
        rightAnswer: data.rightAnswer,
        paperId: data.paperId,
        paperTitle: data.paperTitle ?? existing[0].paperTitle,
        isMastered: false,
        updatedAt: now,
      })
      .where(eq(examWrongQuestion.id, existing[0].id))
      .returning();
    if (!updated) throw new Error('更新错题失败');
    return updated;
  }

  const [created] = await db
    .insert(examWrongQuestion)
    .values({
      userId: data.userId,
      questionId: data.questionId,
      paperId: data.paperId,
      paperTitle: data.paperTitle,
      userAnswer: data.userAnswer,
      rightAnswer: data.rightAnswer,
      wrongCount: 1,
      lastWrongTime: now,
      isMastered: false,
    })
    .returning();
  if (!created) throw new Error('创建错题失败');
  return created;
}

/**
 * 批量创建错题(提交试卷时一次性处理所有错题)。
 * 并行调用 createOrUpdateWrongQuestion 实现幂等,避免 N 次串行查询。
 */
export async function batchCreateWrongQuestions(
  records: CreateOrUpdateWrongQuestionInput[],
): Promise<ExamWrongQuestion[]> {
  if (records.length === 0) return [];
  return Promise.all(records.map((r) => createOrUpdateWrongQuestion(r)));
}

/** 错题列表行(含题目内容)。 */
export interface WrongQuestionRow extends ExamWrongQuestion {
  questionTitle: string | null;
  questionType: string | null;
  questionOptions: unknown;
  questionAnalysis: string | null;
  questionScore: string | null;
}

/**
 * 分页查询用户错题列表,支持按 paperId/isMastered 筛选。
 * 关联 exam_questions 获取题目内容(标题/选项/解析)。
 */
export async function findWrongQuestionsByUser(
  userId: string,
  opts: {
    page: number;
    pageSize: number;
    paperId?: string;
    isMastered?: boolean;
  },
): Promise<{ list: WrongQuestionRow[]; total: number }> {
  const conds = [eq(examWrongQuestion.userId, userId)];
  if (opts.paperId) conds.push(eq(examWrongQuestion.paperId, opts.paperId));
  if (opts.isMastered !== undefined) conds.push(eq(examWrongQuestion.isMastered, opts.isMastered));
  const where = and(...conds);

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        wrong: examWrongQuestion,
        questionTitle: examQuestions.title,
        questionType: examQuestions.type,
        questionOptions: examQuestions.options,
        questionAnalysis: examQuestions.analysis,
        questionScore: examQuestions.score,
      })
      .from(examWrongQuestion)
      .leftJoin(examQuestions, eq(examWrongQuestion.questionId, examQuestions.id))
      .where(where)
      .orderBy(desc(examWrongQuestion.lastWrongTime))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ count: sql<number>`COUNT(*)` }).from(examWrongQuestion).where(where),
  ]);

  const list: WrongQuestionRow[] = rows.map((r) => ({
    ...r.wrong,
    questionTitle: r.questionTitle,
    questionType: r.questionType,
    questionOptions: r.questionOptions,
    questionAnalysis: r.questionAnalysis,
    questionScore: r.questionScore,
  }));
  return { list, total: Number(totalRows[0]?.count ?? 0) };
}

/**
 * 标记错题已掌握(isMastered=true)。
 * 按 userId + questionId 定位,确保用户只能标记自己的错题。
 */
export async function markWrongQuestionResolved(
  userId: string,
  questionId: string,
): Promise<ExamWrongQuestion | undefined> {
  const [updated] = await db
    .update(examWrongQuestion)
    .set({ isMastered: true, updatedAt: new Date() })
    .where(
      and(
        eq(examWrongQuestion.userId, userId),
        eq(examWrongQuestion.questionId, questionId),
      ),
    )
    .returning();
  return updated;
}

export interface WrongQuestionStats {
  total: number;
  unresolved: number;
  resolved: number;
  byType: Array<{ type: string; count: number }>;
}

/**
 * 错题统计:总数/未掌握数/已掌握数/按题型分布。
 * 按题型分布需关联 exam_questions 获取 type 字段。
 */
export async function getWrongQuestionStats(userId: string): Promise<WrongQuestionStats> {
  const where = eq(examWrongQuestion.userId, userId);

  const [totalRows, resolvedRows, typeRows] = await Promise.all([
    db.select({ count: sql<number>`COUNT(*)` }).from(examWrongQuestion).where(where),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(examWrongQuestion)
      .where(and(where, eq(examWrongQuestion.isMastered, true))),
    db
      .select({ type: examQuestions.type, count: sql<number>`COUNT(*)` })
      .from(examWrongQuestion)
      .leftJoin(examQuestions, eq(examWrongQuestion.questionId, examQuestions.id))
      .where(where)
      .groupBy(examQuestions.type),
  ]);

  const total = Number(totalRows[0]?.count ?? 0);
  const resolved = Number(resolvedRows[0]?.count ?? 0);
  return {
    total,
    unresolved: total - resolved,
    resolved,
    byType: typeRows.map((r) => ({ type: r.type ?? 'unknown', count: Number(r.count) })),
  };
}

// =============================================================================
// Exam Status Machine - 报名状态机(draft→enrolled→answering→submitted→graded→completed)
// =============================================================================

export const EXAM_STATUS = {
  DRAFT: 'draft',
  ENROLLED: 'enrolled',
  ANSWERING: 'answering',
  SUBMITTED: 'submitted',
  GRADED: 'graded',
  COMPLETED: 'completed',
} as const;

export type ExamStatus = (typeof EXAM_STATUS)[keyof typeof EXAM_STATUS];

/** 允许的状态流转图:currentStatus → 允许的下一状态。 */
const STATUS_TRANSITIONS: Record<string, ExamStatus> = {
  [EXAM_STATUS.DRAFT]: EXAM_STATUS.ENROLLED,
  [EXAM_STATUS.ENROLLED]: EXAM_STATUS.ANSWERING,
  [EXAM_STATUS.ANSWERING]: EXAM_STATUS.SUBMITTED,
  [EXAM_STATUS.SUBMITTED]: EXAM_STATUS.GRADED,
  [EXAM_STATUS.GRADED]: EXAM_STATUS.COMPLETED,
};

/** 未终态(可继续流转)集合,用于报名幂等查询。 */
const ACTIVE_STATUSES: ExamStatus[] = [
  EXAM_STATUS.DRAFT,
  EXAM_STATUS.ENROLLED,
  EXAM_STATUS.ANSWERING,
];

/**
 * 状态机核心:校验当前状态并流转到新状态。
 * - 记录不存在 → 抛 404
 * - 当前状态与 expectedCurrentStatus 不符 → 抛 409(并发/状态漂移)
 * - currentStatus → newStatus 非法跳转 → 抛 409(状态守卫)
 * - 通过则更新 status + updatedAt,返回更新后的记录
 */
export async function checkAndUpdateStatus(
  recordId: string,
  expectedCurrentStatus: ExamStatus,
  newStatus: ExamStatus,
): Promise<ExamRecord> {
  const record = await findExamRecordByIdExtended(recordId);
  if (!record) {
    throw new AppError('答题记录不存在', 404, 'NOT_FOUND');
  }
  if (record.status !== expectedCurrentStatus) {
    throw new AppError(
      `状态校验失败:期望 ${expectedCurrentStatus},实际 ${record.status}`,
      409,
      'CONFLICT',
    );
  }
  const allowed = STATUS_TRANSITIONS[record.status];
  if (allowed !== newStatus) {
    throw new AppError(
      `状态流转非法:不允许从 ${record.status} 跳转到 ${newStatus}`,
      409,
      'CONFLICT',
    );
  }
  const [updated] = await db
    .update(examRecords)
    .set({ status: newStatus })
    .where(eq(examRecords.id, recordId))
    .returning();
  if (!updated) throw new AppError('状态更新失败', 500, 'INTERNAL_ERROR');
  return updated;
}

/** 查询答题记录(扩展层入口,供状态机内部使用)。 */
async function findExamRecordByIdExtended(id: string): Promise<ExamRecord | undefined> {
  const rows = await db.select().from(examRecords).where(eq(examRecords.id, id)).limit(1);
  return rows[0];
}

/**
 * 报名(draft→enrolled)。
 * - 幂等:同一用户同一试卷已有未终态记录(draft/enrolled/answering)时直接返回现有记录。
 * - 否则创建一条 status=enrolled 的新记录(draft 为隐式初始态,创建即报名)。
 */
export async function enrollExam(userId: string, paperId: string): Promise<ExamRecord> {
  const existing = await db
    .select()
    .from(examRecords)
    .where(
      and(
        eq(examRecords.userId, userId),
        eq(examRecords.paperId, paperId),
        inArray(examRecords.status, ACTIVE_STATUSES),
      ),
    )
    .orderBy(desc(examRecords.createdAt))
    .limit(1);
  if (existing[0]) return existing[0];

  const [created] = await db
    .insert(examRecords)
    .values({
      userId,
      paperId,
      status: EXAM_STATUS.ENROLLED,
    })
    .returning();
  if (!created) throw new AppError('创建报名记录失败', 500, 'INTERNAL_ERROR');
  return created;
}

/** 开始答题(enrolled→answering),同时记录开始时间。 */
export async function startAnswering(recordId: string): Promise<ExamRecord> {
  const record = await findExamRecordByIdExtended(recordId);
  if (!record) throw new AppError('答题记录不存在', 404, 'NOT_FOUND');
  if (record.status !== EXAM_STATUS.ENROLLED) {
    throw new AppError(
      `状态流转非法:仅 enrolled 可开始答题,当前 ${record.status}`,
      409,
      'CONFLICT',
    );
  }
  const [updated] = await db
    .update(examRecords)
    .set({
      status: EXAM_STATUS.ANSWERING,
      startedAt: new Date(),
    })
    .where(eq(examRecords.id, recordId))
    .returning();
  if (!updated) throw new AppError('状态更新失败', 500, 'INTERNAL_ERROR');
  return updated;
}

/** 提交试卷(answering→submitted),记录提交时间。 */
export async function submitExam(recordId: string): Promise<ExamRecord> {
  return checkAndUpdateStatus(recordId, EXAM_STATUS.ANSWERING, EXAM_STATUS.SUBMITTED).then(
    async (record) => {
      const [updated] = await db
        .update(examRecords)
        .set({ submittedAt: new Date() })
        .where(eq(examRecords.id, recordId))
        .returning();
      return updated ?? record;
    },
  );
}

/** 评分完成(submitted→graded),记录分数与是否通过。admin 操作。 */
export async function gradeExam(recordId: string, score: number): Promise<ExamRecord> {
  return checkAndUpdateStatus(recordId, EXAM_STATUS.SUBMITTED, EXAM_STATUS.GRADED).then(
    async (record) => {
      const [updated] = await db
        .update(examRecords)
        .set({
          score: String(score),
          isPassed: score >= 60,
        })
        .where(eq(examRecords.id, recordId))
        .returning();
      return updated ?? record;
    },
  );
}

/** 完成(graded→completed),预留证书生成等后续流程。 */
export async function completeExam(recordId: string): Promise<ExamRecord> {
  return checkAndUpdateStatus(recordId, EXAM_STATUS.GRADED, EXAM_STATUS.COMPLETED);
}

/** 查询答题记录当前状态。 */
export async function getExamRecordStatus(recordId: string): Promise<ExamRecord | undefined> {
  return findExamRecordByIdExtended(recordId);
}

