import { eq, and, desc, asc, sql, ilike } from 'drizzle-orm'
import { db } from './index.js'
import {
  learnCategories,
  lessons,
  lessonChapters,
  lessonChapterSections,
  lessonSignUps,
  users,
  type LearnCategory,
  type Lesson,
  type LessonChapter,
  type LessonChapterSection,
  type LessonSignUp,
} from '@ihui/database'

// =============================================================================
// Categories
// =============================================================================

/**
 * 公开查询启用分类列表（status=1），按 sort 升序、createdAt 升序。
 */
export async function findPublishedCategories(): Promise<LearnCategory[]> {
  return db
    .select()
    .from(learnCategories)
    .where(eq(learnCategories.status, 1))
    .orderBy(asc(learnCategories.sort), asc(learnCategories.createdAt))
}

/**
 * 查询所有分类（admin 用），按 sort 升序、createdAt 升序。
 */
export async function findAllCategories(): Promise<LearnCategory[]> {
  return db
    .select()
    .from(learnCategories)
    .orderBy(asc(learnCategories.sort), asc(learnCategories.createdAt))
}

export async function findLearnCategoryById(id: string): Promise<LearnCategory | undefined> {
  const rows = await db.select().from(learnCategories).where(eq(learnCategories.id, id)).limit(1)
  return rows[0]
}

export interface CreateLearnCategoryInput {
  name: string
  pid?: string | null
  sort?: number
  status?: number
}

export async function createLearnCategory(data: CreateLearnCategoryInput): Promise<LearnCategory> {
  const rows = await db
    .insert(learnCategories)
    .values({
      name: data.name,
      pid: data.pid,
      sort: data.sort,
      status: data.status,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建课程分类失败')
  return row
}

export interface UpdateLearnCategoryInput {
  name?: string
  pid?: string | null
  sort?: number
  status?: number
}

export async function updateLearnCategory(
  id: string,
  data: UpdateLearnCategoryInput,
): Promise<LearnCategory | undefined> {
  const rows = await db
    .update(learnCategories)
    .set({
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.pid !== undefined ? { pid: data.pid } : {}),
      ...(data.sort !== undefined ? { sort: data.sort } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    })
    .where(eq(learnCategories.id, id))
    .returning()
  return rows[0]
}

export async function deleteLearnCategory(id: string): Promise<void> {
  await db.delete(learnCategories).where(eq(learnCategories.id, id))
}

// =============================================================================
// Lessons
// =============================================================================

export interface FindPublishedLessonsOpts {
  page: number
  pageSize: number
  categoryId?: string
  search?: string
}

export interface LessonWithCategory extends Lesson {
  categoryName: string | null
}

/**
 * 分页查询已发布课程（isPublished=true, status=1）。
 * 支持 categoryId 筛选与 title 模糊搜索。
 */
export async function findPublishedLessons(
  opts: FindPublishedLessonsOpts,
): Promise<{ list: LessonWithCategory[]; total: number; page: number; pageSize: number }> {
  const { page, pageSize, categoryId, search } = opts
  const conds = [eq(lessons.isPublished, true), eq(lessons.status, 1)]
  if (categoryId) conds.push(eq(lessons.categoryId, categoryId))
  if (search) conds.push(ilike(lessons.title, `%${search}%`))

  const rows = await db
    .select({
      lesson: lessons,
      categoryName: learnCategories.name,
    })
    .from(lessons)
    .leftJoin(learnCategories, eq(lessons.categoryId, learnCategories.id))
    .where(and(...conds))
    .orderBy(asc(lessons.sort), desc(lessons.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const list: LessonWithCategory[] = rows.map((r) => ({
    ...r.lesson,
    categoryName: r.categoryName,
  }))

  // 统计总数
  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(lessons)
    .where(and(...conds))
  const total = countRows[0]?.count ?? 0

  return { list, total, page, pageSize }
}

/**
 * 分页查询所有课程（admin 用，含未发布），支持 categoryId 筛选与 title 模糊搜索。
 */
export async function findAllLessons(
  opts: FindPublishedLessonsOpts,
): Promise<{ list: LessonWithCategory[]; total: number; page: number; pageSize: number }> {
  const { page, pageSize, categoryId, search } = opts
  const conds = []
  if (categoryId) conds.push(eq(lessons.categoryId, categoryId))
  if (search) conds.push(ilike(lessons.title, `%${search}%`))
  const whereCond = conds.length ? and(...conds) : undefined

  const rows = await db
    .select({
      lesson: lessons,
      categoryName: learnCategories.name,
    })
    .from(lessons)
    .leftJoin(learnCategories, eq(lessons.categoryId, learnCategories.id))
    .where(whereCond)
    .orderBy(asc(lessons.sort), desc(lessons.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const list: LessonWithCategory[] = rows.map((r) => ({
    ...r.lesson,
    categoryName: r.categoryName,
  }))

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(lessons)
    .where(whereCond)
  const total = countRows[0]?.count ?? 0

  return { list, total, page, pageSize }
}

/**
 * 课程详情（含分类名），仅查询已发布课程。
 */
export async function findLessonById(id: string): Promise<LessonWithCategory | undefined> {
  const rows = await db
    .select({
      lesson: lessons,
      categoryName: learnCategories.name,
    })
    .from(lessons)
    .leftJoin(learnCategories, eq(lessons.categoryId, learnCategories.id))
    .where(eq(lessons.id, id))
    .limit(1)
  const row = rows[0]
  if (!row) return undefined
  return { ...row.lesson, categoryName: row.categoryName }
}

/**
 * Admin 用：按 ID 查询课程（不限发布状态）。
 */
export async function findLessonByIdAdmin(id: string): Promise<Lesson | undefined> {
  const rows = await db.select().from(lessons).where(eq(lessons.id, id)).limit(1)
  return rows[0]
}

export interface CreateLessonInput {
  title: string
  coverImage?: string | null
  intro?: string | null
  categoryId?: string | null
  lecturerId?: string | null
  lecturerName?: string | null
  price?: string
  originalPrice?: string | null
  isFree?: boolean
  isPublished?: boolean
  sort?: number
  status?: number
}

export async function createLesson(data: CreateLessonInput): Promise<Lesson> {
  const rows = await db
    .insert(lessons)
    .values({
      title: data.title,
      coverImage: data.coverImage,
      intro: data.intro,
      categoryId: data.categoryId,
      lecturerId: data.lecturerId,
      lecturerName: data.lecturerName,
      price: data.price,
      originalPrice: data.originalPrice,
      isFree: data.isFree,
      isPublished: data.isPublished,
      sort: data.sort,
      status: data.status,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建课程失败')
  return row
}

export interface UpdateLessonInput {
  title?: string
  coverImage?: string | null
  intro?: string | null
  categoryId?: string | null
  lecturerId?: string | null
  lecturerName?: string | null
  price?: string
  originalPrice?: string | null
  isFree?: boolean
  isPublished?: boolean
  sort?: number
  status?: number
}

export async function updateLesson(
  id: string,
  data: UpdateLessonInput,
): Promise<Lesson | undefined> {
  const rows = await db
    .update(lessons)
    .set({
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.coverImage !== undefined ? { coverImage: data.coverImage } : {}),
      ...(data.intro !== undefined ? { intro: data.intro } : {}),
      ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
      ...(data.lecturerId !== undefined ? { lecturerId: data.lecturerId } : {}),
      ...(data.lecturerName !== undefined ? { lecturerName: data.lecturerName } : {}),
      ...(data.price !== undefined ? { price: data.price } : {}),
      ...(data.originalPrice !== undefined ? { originalPrice: data.originalPrice } : {}),
      ...(data.isFree !== undefined ? { isFree: data.isFree } : {}),
      ...(data.isPublished !== undefined ? { isPublished: data.isPublished } : {}),
      ...(data.sort !== undefined ? { sort: data.sort } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      updatedAt: new Date(),
    })
    .where(eq(lessons.id, id))
    .returning()
  return rows[0]
}

export async function deleteLesson(id: string): Promise<void> {
  await db.delete(lessons).where(eq(lessons.id, id))
}

export async function incrementViewCount(id: string): Promise<void> {
  await db
    .update(lessons)
    .set({ viewCount: sql<number>`${lessons.viewCount} + 1` })
    .where(eq(lessons.id, id))
}

// =============================================================================
// Chapters
// =============================================================================

export async function findLessonChapters(lessonId: string): Promise<LessonChapter[]> {
  return db
    .select()
    .from(lessonChapters)
    .where(eq(lessonChapters.lessonId, lessonId))
    .orderBy(asc(lessonChapters.sortOrder), asc(lessonChapters.createdAt))
}

export async function findChapterById(id: string): Promise<LessonChapter | undefined> {
  const rows = await db.select().from(lessonChapters).where(eq(lessonChapters.id, id)).limit(1)
  return rows[0]
}

export interface CreateChapterInput {
  title: string
  sortOrder?: number
}

export async function createChapter(
  lessonId: string,
  data: CreateChapterInput,
): Promise<LessonChapter> {
  const rows = await db
    .insert(lessonChapters)
    .values({
      lessonId,
      title: data.title,
      sortOrder: data.sortOrder,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建章节失败')
  return row
}

export interface UpdateChapterInput {
  title?: string
  sortOrder?: number
}

export async function updateChapter(
  id: string,
  data: UpdateChapterInput,
): Promise<LessonChapter | undefined> {
  const rows = await db
    .update(lessonChapters)
    .set({
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
    })
    .where(eq(lessonChapters.id, id))
    .returning()
  return rows[0]
}

export async function deleteChapter(id: string): Promise<void> {
  await db.delete(lessonChapters).where(eq(lessonChapters.id, id))
}

// =============================================================================
// Sections (小节)
// =============================================================================

export async function findLessonSections(chapterId: string): Promise<LessonChapterSection[]> {
  return db
    .select()
    .from(lessonChapterSections)
    .where(eq(lessonChapterSections.chapterId, chapterId))
    .orderBy(asc(lessonChapterSections.sortOrder), asc(lessonChapterSections.createdAt))
}

export async function findSectionById(id: string): Promise<LessonChapterSection | undefined> {
  const rows = await db
    .select()
    .from(lessonChapterSections)
    .where(eq(lessonChapterSections.id, id))
    .limit(1)
  return rows[0]
}

export interface CreateSectionInput {
  title: string
  content?: string | null
  videoUrl?: string | null
  duration?: number
  sortOrder?: number
  isFree?: boolean
}

export async function createSection(
  chapterId: string,
  data: CreateSectionInput,
): Promise<LessonChapterSection> {
  const rows = await db
    .insert(lessonChapterSections)
    .values({
      chapterId,
      title: data.title,
      content: data.content,
      videoUrl: data.videoUrl,
      duration: data.duration,
      sortOrder: data.sortOrder,
      isFree: data.isFree,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建小节失败')
  return row
}

export interface UpdateSectionInput {
  title?: string
  content?: string | null
  videoUrl?: string | null
  duration?: number
  sortOrder?: number
  isFree?: boolean
}

export async function updateSection(
  id: string,
  data: UpdateSectionInput,
): Promise<LessonChapterSection | undefined> {
  const rows = await db
    .update(lessonChapterSections)
    .set({
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.content !== undefined ? { content: data.content } : {}),
      ...(data.videoUrl !== undefined ? { videoUrl: data.videoUrl } : {}),
      ...(data.duration !== undefined ? { duration: data.duration } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      ...(data.isFree !== undefined ? { isFree: data.isFree } : {}),
    })
    .where(eq(lessonChapterSections.id, id))
    .returning()
  return rows[0]
}

export async function deleteSection(id: string): Promise<void> {
  await db.delete(lessonChapterSections).where(eq(lessonChapterSections.id, id))
}

// =============================================================================
// Signups (报名)
// =============================================================================

/**
 * 用户报名课程（幂等：已报名则直接返回）。
 */
export async function signUpLesson(lessonId: string, userId: string): Promise<void> {
  await db.insert(lessonSignUps).values({ lessonId, userId }).onConflictDoNothing()
}

/**
 * 检查用户是否已报名课程。
 */
export async function isSignedUp(lessonId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: lessonSignUps.id })
    .from(lessonSignUps)
    .where(and(eq(lessonSignUps.lessonId, lessonId), eq(lessonSignUps.userId, userId)))
    .limit(1)
  return rows.length > 0
}

/**
 * 查询用户报名记录。
 */
export async function findSignUp(
  lessonId: string,
  userId: string,
): Promise<LessonSignUp | undefined> {
  const rows = await db
    .select()
    .from(lessonSignUps)
    .where(and(eq(lessonSignUps.lessonId, lessonId), eq(lessonSignUps.userId, userId)))
    .limit(1)
  return rows[0]
}

export interface FindMyLessonsOpts {
  page: number
  pageSize: number
}

export interface MyLessonItem extends Lesson {
  categoryName: string | null
  signupStatus: number
  progress: number
  signupCreatedAt: Date
}

/**
 * 查询当前用户报名的课程列表（分页，按报名时间倒序）。
 */
export async function findMyLessons(
  userId: string,
  opts: FindMyLessonsOpts,
): Promise<{ list: MyLessonItem[]; total: number; page: number; pageSize: number }> {
  const { page, pageSize } = opts
  const rows = await db
    .select({
      lesson: lessons,
      categoryName: learnCategories.name,
      signupStatus: lessonSignUps.status,
      progress: lessonSignUps.progress,
      signupCreatedAt: lessonSignUps.createdAt,
    })
    .from(lessonSignUps)
    .innerJoin(lessons, eq(lessonSignUps.lessonId, lessons.id))
    .leftJoin(learnCategories, eq(lessons.categoryId, learnCategories.id))
    .where(eq(lessonSignUps.userId, userId))
    .orderBy(desc(lessonSignUps.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const list: MyLessonItem[] = rows.map((r) => ({
    ...r.lesson,
    categoryName: r.categoryName,
    signupStatus: r.signupStatus,
    progress: r.progress,
    signupCreatedAt: r.signupCreatedAt,
  }))

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(lessonSignUps)
    .where(eq(lessonSignUps.userId, userId))
  const total = countRows[0]?.count ?? 0

  return { list, total, page, pageSize }
}

/**
 * 更新学习进度（0-100）。
 */
export async function updateProgress(
  lessonId: string,
  userId: string,
  progress: number,
): Promise<LessonSignUp | undefined> {
  const clamped = Math.max(0, Math.min(100, Math.floor(progress)))
  // 完成进度时同步状态为已完成
  const status = clamped >= 100 ? 2 : 1
  const rows = await db
    .update(lessonSignUps)
    .set({ progress: clamped, status })
    .where(and(eq(lessonSignUps.lessonId, lessonId), eq(lessonSignUps.userId, userId)))
    .returning()
  return rows[0]
}

/**
 * 按报名记录 id 查询(含权限校验:仅本人)。
 */
export async function findSignUpById(
  id: string,
  userId: string,
): Promise<LessonSignUp | undefined> {
  const rows = await db
    .select()
    .from(lessonSignUps)
    .where(and(eq(lessonSignUps.id, id), eq(lessonSignUps.userId, userId)))
    .limit(1)
  return rows[0]
}

/**
 * 按报名记录 id 更新进度和状态(含权限校验:仅本人)。
 */
export async function updateSignUpById(
  id: string,
  userId: string,
  data: { progress?: number; status?: number },
): Promise<LessonSignUp | undefined> {
  const set: { progress?: number; status?: number } = {}
  if (data.progress !== undefined) {
    const clamped = Math.max(0, Math.min(100, Math.floor(data.progress)))
    set.progress = clamped
    set.status = clamped >= 100 ? 2 : (data.status ?? 1)
  } else if (data.status !== undefined) {
    set.status = data.status
  }
  if (Object.keys(set).length === 0) return undefined
  const rows = await db
    .update(lessonSignUps)
    .set(set)
    .where(and(eq(lessonSignUps.id, id), eq(lessonSignUps.userId, userId)))
    .returning()
  return rows[0]
}

// =============================================================================
// Admin: Signup 管理
// =============================================================================

export interface FindAdminSignupsOpts {
  page: number
  pageSize: number
  lessonId?: string
  status?: number
  search?: string
}

export interface AdminSignupRow extends LessonSignUp {
  lessonTitle: string | null
  userNickname: string | null
}

/**
 * Admin: 分页查询报名记录(含课程名 + 用户昵称),支持 lessonId/status 筛选。
 */
export async function findAdminSignups(
  opts: FindAdminSignupsOpts,
): Promise<{ list: AdminSignupRow[]; total: number; page: number; pageSize: number }> {
  const { page, pageSize, lessonId, status, search } = opts
  const conds: ReturnType<typeof eq>[] = []
  if (lessonId) conds.push(eq(lessonSignUps.lessonId, lessonId))
  if (status !== undefined) conds.push(eq(lessonSignUps.status, status))
  // search 同时匹配课程标题或用户昵称
  let searchCond: ReturnType<typeof ilike> | undefined
  if (search) {
    searchCond = ilike(lessons.title, `%${search}%`)
  }
  const baseConds = conds.length ? and(...conds) : undefined
  const whereCond = searchCond ? and(baseConds, searchCond) : baseConds

  const rows = await db
    .select({
      signup: lessonSignUps,
      lessonTitle: lessons.title,
      userNickname: users.nickname,
    })
    .from(lessonSignUps)
    .innerJoin(lessons, eq(lessonSignUps.lessonId, lessons.id))
    .leftJoin(users, eq(lessonSignUps.userId, users.id))
    .where(whereCond)
    .orderBy(desc(lessonSignUps.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const list: AdminSignupRow[] = rows.map((r) => ({
    ...r.signup,
    lessonTitle: r.lessonTitle,
    userNickname: r.userNickname,
  }))

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(lessonSignUps)
    .innerJoin(lessons, eq(lessonSignUps.lessonId, lessons.id))
    .where(whereCond)
  const total = countRows[0]?.count ?? 0

  return { list, total, page, pageSize }
}

/**
 * Admin: 更新报名状态(1=已报名 2=已完成 3=已退款)。
 */
export async function updateSignupStatus(
  id: string,
  status: number,
): Promise<LessonSignUp | undefined> {
  const rows = await db
    .update(lessonSignUps)
    .set({ status })
    .where(eq(lessonSignUps.id, id))
    .returning()
  return rows[0]
}

/**
 * Admin: 批量报名(为多个用户报名同一课程,幂等)。
 */
export async function batchSignUp(lessonId: string, userIds: string[]): Promise<number> {
  if (userIds.length === 0) return 0
  const rows = await db
    .insert(lessonSignUps)
    .values(userIds.map((userId) => ({ lessonId, userId })))
    .onConflictDoNothing()
    .returning({ id: lessonSignUps.id })
  return rows.length
}

// =============================================================================
// Admin: 报表
// =============================================================================

/**
 * 课程学习报表:按课程聚合报名数/完成数/完成率/平均进度。
 */
export async function findLessonStudyReport(opts: {
  page: number
  pageSize: number
  categoryId?: string
}): Promise<{ list: Record<string, unknown>[]; total: number; page: number; pageSize: number }> {
  const { page, pageSize, categoryId } = opts
  const conds: ReturnType<typeof eq>[] = []
  if (categoryId) conds.push(eq(lessons.categoryId, categoryId))
  const whereCond = conds.length ? and(...conds) : undefined

  const rows = await db
    .select({
      id: lessons.id,
      title: lessons.title,
      categoryName: learnCategories.name,
      signupCount: lessons.signupCount,
      viewCount: lessons.viewCount,
      completedCount: sql<number>`(
        SELECT count(*)::int FROM ${lessonSignUps}
        WHERE ${lessonSignUps.lessonId} = ${lessons.id} AND ${lessonSignUps.status} = 2
      )`,
      avgProgress: sql<number>`COALESCE((
        SELECT avg(${lessonSignUps.progress})::int FROM ${lessonSignUps}
        WHERE ${lessonSignUps.lessonId} = ${lessons.id}
      ), 0)`,
    })
    .from(lessons)
    .leftJoin(learnCategories, eq(lessons.categoryId, learnCategories.id))
    .where(whereCond)
    .orderBy(desc(lessons.signupCount))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(lessons)
    .where(whereCond)
  const total = countRows[0]?.count ?? 0

  return { list: rows as Record<string, unknown>[], total, page, pageSize }
}

/**
 * 报名统计报表:按时间段聚合报名总数/完成总数/退款总数。
 */
export async function findSignupReport(opts: {
  startDate?: string
  endDate?: string
}): Promise<Record<string, unknown>> {
  if (opts.startDate && opts.endDate) {
    const rows = await db
      .select({
        totalSignups: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) FILTER (WHERE ${lessonSignUps.status} = 2)::int`,
        refunded: sql<number>`count(*) FILTER (WHERE ${lessonSignUps.status} = 3)::int`,
        active: sql<number>`count(*) FILTER (WHERE ${lessonSignUps.status} = 1)::int`,
      })
      .from(lessonSignUps)
      .where(
        and(
          sql`${lessonSignUps.createdAt} >= ${opts.startDate}::timestamptz`,
          sql`${lessonSignUps.createdAt} <= ${opts.endDate}::timestamptz`,
        ),
      )
    return rows[0] ?? { totalSignups: 0, completed: 0, refunded: 0, active: 0 }
  }

  const rows = await db
    .select({
      totalSignups: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) FILTER (WHERE ${lessonSignUps.status} = 2)::int`,
      refunded: sql<number>`count(*) FILTER (WHERE ${lessonSignUps.status} = 3)::int`,
      active: sql<number>`count(*) FILTER (WHERE ${lessonSignUps.status} = 1)::int`,
    })
    .from(lessonSignUps)
  return rows[0] ?? { totalSignups: 0, completed: 0, refunded: 0, active: 0 }
}

/**
 * 学员学习报表:按用户聚合报名课程数/完成课程数/平均进度。
 */
export async function findMemberStudyReport(opts: {
  page: number
  pageSize: number
  search?: string
}): Promise<{ list: Record<string, unknown>[]; total: number; page: number; pageSize: number }> {
  const { page, pageSize, search } = opts

  const rows = await db
    .select({
      userId: users.id,
      nickname: users.nickname,
      avatar: users.avatar,
      signupCount: sql<number>`count(${lessonSignUps.id})::int`,
      completedCount: sql<number>`count(*) FILTER (WHERE ${lessonSignUps.status} = 2)::int`,
      avgProgress: sql<number>`COALESCE(avg(${lessonSignUps.progress})::int, 0)`,
    })
    .from(lessonSignUps)
    .innerJoin(users, eq(lessonSignUps.userId, users.id))
    .where(search ? ilike(users.nickname, `%${search}%`) : undefined)
    .groupBy(users.id, users.nickname, users.avatar)
    .orderBy(desc(sql`count(${lessonSignUps.id})`))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const countRows = await db
    .select({ count: sql<number>`count(DISTINCT ${lessonSignUps.userId})::int` })
    .from(lessonSignUps)
    .innerJoin(users, eq(lessonSignUps.userId, users.id))
    .where(search ? ilike(users.nickname, `%${search}%`) : undefined)
  const total = countRows[0]?.count ?? 0

  return { list: rows as Record<string, unknown>[], total, page, pageSize }
}
