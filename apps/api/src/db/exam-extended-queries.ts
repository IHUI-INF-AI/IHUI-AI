import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { db } from './index.js';
import {
  examChapters,
  examChapterSections,
  examSignups,
  examRecords,
  examPapers,
  users,
  type ExamChapter,
  type ExamChapterSection,
  type ExamSignup,
  type ExamRecord,
} from '@ihui/database';

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
