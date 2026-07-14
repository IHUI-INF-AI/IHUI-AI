import { eq, and, desc, asc, sql, ilike } from 'drizzle-orm'
import { db } from './index.js'
import {
  learnHomework,
  learnMaps,
  learnInvoiceApplications,
  learnInvoiceTitles,
  lessons,
  lessonSignUps,
  users,
  eduLessonTopics,
  learnLearnMapTopic,
  lessonTask,
  lessonRate,
  lessonAccess,
  learnHomeworkRecord,
  type LearnHomework,
  type LearnMap,
  type LearnInvoiceApplication,
  type LearnInvoiceTitle,
  type LessonTask,
  type LessonRate,
  type LessonAccess,
  type LearnHomeworkRecord,
} from '@ihui/database'

// =============================================================================
// Homework (课程作业)
// =============================================================================

/**
 * 查询某课程下的作业列表,按 sort 升序、createdAt 升序。
 */
export async function findHomeworkList(lessonId: string): Promise<LearnHomework[]> {
  return db
    .select()
    .from(learnHomework)
    .where(eq(learnHomework.lessonId, lessonId))
    .orderBy(asc(learnHomework.sort), asc(learnHomework.createdAt))
}

export async function findHomeworkById(id: string): Promise<LearnHomework | undefined> {
  const rows = await db.select().from(learnHomework).where(eq(learnHomework.id, id)).limit(1)
  return rows[0]
}

export interface CreateHomeworkInput {
  lessonId: string
  chapterId?: string | null
  title: string
  description?: string | null
  content?: unknown
  dueDate?: Date | null
  sort?: number
  status?: string
}

export async function createHomework(data: CreateHomeworkInput): Promise<LearnHomework> {
  const rows = await db
    .insert(learnHomework)
    .values({
      lessonId: data.lessonId,
      chapterId: data.chapterId,
      title: data.title,
      description: data.description,
      content: data.content,
      dueDate: data.dueDate,
      sort: data.sort,
      status: data.status,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建作业失败')
  return row
}

export interface UpdateHomeworkInput {
  chapterId?: string | null
  title?: string
  description?: string | null
  content?: unknown
  dueDate?: Date | null
  sort?: number
  status?: string
}

export async function updateHomework(
  id: string,
  data: UpdateHomeworkInput,
): Promise<LearnHomework | undefined> {
  const rows = await db
    .update(learnHomework)
    .set({
      ...(data.chapterId !== undefined ? { chapterId: data.chapterId } : {}),
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.content !== undefined ? { content: data.content } : {}),
      ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
      ...(data.sort !== undefined ? { sort: data.sort } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      updatedAt: new Date(),
    })
    .where(eq(learnHomework.id, id))
    .returning()
  return rows[0]
}

export async function deleteHomework(id: string): Promise<void> {
  await db.delete(learnHomework).where(eq(learnHomework.id, id))
}

// =============================================================================
// Learn Maps (学习地图)
// =============================================================================

/**
 * 查询学习地图列表,按 sort 升序、createdAt 倒序。
 */
export async function findMapList(): Promise<LearnMap[]> {
  return db.select().from(learnMaps).orderBy(asc(learnMaps.sort), desc(learnMaps.createdAt))
}

export async function findMapById(id: string): Promise<LearnMap | undefined> {
  const rows = await db.select().from(learnMaps).where(eq(learnMaps.id, id)).limit(1)
  return rows[0]
}

export interface CreateMapInput {
  title: string
  description?: string | null
  cover?: string | null
  content?: unknown
  sort?: number
  isPublished?: boolean
}

export async function createMap(data: CreateMapInput): Promise<LearnMap> {
  const rows = await db
    .insert(learnMaps)
    .values({
      title: data.title,
      description: data.description,
      cover: data.cover,
      content: data.content,
      sort: data.sort,
      isPublished: data.isPublished,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建学习地图失败')
  return row
}

export interface UpdateMapInput {
  title?: string
  description?: string | null
  cover?: string | null
  content?: unknown
  sort?: number
  isPublished?: boolean
}

export async function updateMap(id: string, data: UpdateMapInput): Promise<LearnMap | undefined> {
  const rows = await db
    .update(learnMaps)
    .set({
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.cover !== undefined ? { cover: data.cover } : {}),
      ...(data.content !== undefined ? { content: data.content } : {}),
      ...(data.sort !== undefined ? { sort: data.sort } : {}),
      ...(data.isPublished !== undefined ? { isPublished: data.isPublished } : {}),
      updatedAt: new Date(),
    })
    .where(eq(learnMaps.id, id))
    .returning()
  return rows[0]
}

export async function deleteMap(id: string): Promise<void> {
  await db.delete(learnMaps).where(eq(learnMaps.id, id))
}

/**
 * 更新学习地图发布状态。
 */
export async function publishMap(id: string, isPublished: boolean): Promise<LearnMap | undefined> {
  const rows = await db
    .update(learnMaps)
    .set({ isPublished, updatedAt: new Date() })
    .where(eq(learnMaps.id, id))
    .returning()
  return rows[0]
}

// =============================================================================
// Invoice Applications (发票申请)
// =============================================================================

export interface FindInvoiceApplicationListOpts {
  page: number
  pageSize: number
  status?: string
  search?: string
}

export interface InvoiceApplicationRow extends LearnInvoiceApplication {
  userNickname: string | null
}

/**
 * 分页查询发票申请列表(含用户昵称),支持 status 筛选与订单号/抬头模糊搜索。
 */
export async function findInvoiceApplicationList(
  opts: FindInvoiceApplicationListOpts,
): Promise<{ list: InvoiceApplicationRow[]; total: number; page: number; pageSize: number }> {
  const { page, pageSize, status, search } = opts
  const conds: ReturnType<typeof eq>[] = []
  if (status) conds.push(eq(learnInvoiceApplications.status, status))
  let searchCond: ReturnType<typeof ilike> | undefined
  if (search) {
    searchCond = ilike(learnInvoiceApplications.orderId, `%${search}%`)
  }
  const baseConds = conds.length ? and(...conds) : undefined
  const whereCond = searchCond ? and(baseConds, searchCond) : baseConds

  const rows = await db
    .select({
      application: learnInvoiceApplications,
      userNickname: users.nickname,
    })
    .from(learnInvoiceApplications)
    .leftJoin(users, eq(learnInvoiceApplications.userId, users.id))
    .where(whereCond)
    .orderBy(desc(learnInvoiceApplications.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const list: InvoiceApplicationRow[] = rows.map((r) => ({
    ...r.application,
    userNickname: r.userNickname,
  }))

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(learnInvoiceApplications)
    .where(whereCond)
  const total = countRows[0]?.count ?? 0

  return { list, total, page, pageSize }
}

export async function findInvoiceApplicationById(
  id: string,
): Promise<LearnInvoiceApplication | undefined> {
  const rows = await db
    .select()
    .from(learnInvoiceApplications)
    .where(eq(learnInvoiceApplications.id, id))
    .limit(1)
  return rows[0]
}

/**
 * 更新发票申请状态。
 */
export async function updateInvoiceApplicationStatus(
  id: string,
  status: string,
): Promise<LearnInvoiceApplication | undefined> {
  const rows = await db
    .update(learnInvoiceApplications)
    .set({ status, updatedAt: new Date() })
    .where(eq(learnInvoiceApplications.id, id))
    .returning()
  return rows[0]
}

// =============================================================================
// Invoice Titles (发票抬头)
// =============================================================================

/**
 * 查询某用户的发票抬头列表,默认抬头优先,按 createdAt 倒序。
 */
export async function findInvoiceTitleList(userId: string): Promise<LearnInvoiceTitle[]> {
  return db
    .select()
    .from(learnInvoiceTitles)
    .where(eq(learnInvoiceTitles.userId, userId))
    .orderBy(desc(learnInvoiceTitles.isDefault), desc(learnInvoiceTitles.createdAt))
}

export async function findInvoiceTitleById(id: string): Promise<LearnInvoiceTitle | undefined> {
  const rows = await db
    .select()
    .from(learnInvoiceTitles)
    .where(eq(learnInvoiceTitles.id, id))
    .limit(1)
  return rows[0]
}

export interface CreateInvoiceTitleInput {
  userId: string
  title: string
  type: string
  taxNo: string
  bank?: string | null
  bankAccount?: string | null
  address?: string | null
  phone?: string | null
  isDefault?: boolean
}

export async function createInvoiceTitle(
  data: CreateInvoiceTitleInput,
): Promise<LearnInvoiceTitle> {
  // 若设为默认,先清除该用户其他默认抬头
  if (data.isDefault) {
    await db
      .update(learnInvoiceTitles)
      .set({ isDefault: false })
      .where(eq(learnInvoiceTitles.userId, data.userId))
  }
  const rows = await db
    .insert(learnInvoiceTitles)
    .values({
      userId: data.userId,
      title: data.title,
      type: data.type,
      taxNo: data.taxNo,
      bank: data.bank,
      bankAccount: data.bankAccount,
      address: data.address,
      phone: data.phone,
      isDefault: data.isDefault,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建发票抬头失败')
  return row
}

export interface UpdateInvoiceTitleInput {
  title?: string
  type?: string
  taxNo?: string
  bank?: string | null
  bankAccount?: string | null
  address?: string | null
  phone?: string | null
  isDefault?: boolean
}

export async function updateInvoiceTitle(
  id: string,
  data: UpdateInvoiceTitleInput,
): Promise<LearnInvoiceTitle | undefined> {
  // 若设为默认,先清除该用户其他默认抬头
  if (data.isDefault) {
    const existing = await findInvoiceTitleById(id)
    if (existing) {
      await db
        .update(learnInvoiceTitles)
        .set({ isDefault: false })
        .where(eq(learnInvoiceTitles.userId, existing.userId))
    }
  }
  const rows = await db
    .update(learnInvoiceTitles)
    .set({
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.taxNo !== undefined ? { taxNo: data.taxNo } : {}),
      ...(data.bank !== undefined ? { bank: data.bank } : {}),
      ...(data.bankAccount !== undefined ? { bankAccount: data.bankAccount } : {}),
      ...(data.address !== undefined ? { address: data.address } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
      updatedAt: new Date(),
    })
    .where(eq(learnInvoiceTitles.id, id))
    .returning()
  return rows[0]
}

export async function deleteInvoiceTitle(id: string): Promise<void> {
  await db.delete(learnInvoiceTitles).where(eq(learnInvoiceTitles.id, id))
}

// =============================================================================
// Reports (报表)
// =============================================================================

export interface CompanyStudyReportQuery {
  startDate?: string
  endDate?: string
  search?: string
}

/**
 * 企业学习报表:聚合统计课程总数、报名总数、完成总数、平均进度、活跃学员数。
 * 支持按时间段与课程标题搜索筛选。
 */
export async function findCompanyStudyReport(
  query: CompanyStudyReportQuery,
): Promise<Record<string, unknown>> {
  const { startDate, endDate, search } = query
  let searchCond: ReturnType<typeof ilike> | undefined
  if (search) {
    searchCond = ilike(lessons.title, `%${search}%`)
  }

  const rows = await db
    .select({
      totalLessons: sql<number>`count(DISTINCT ${lessons.id})::int`,
      totalSignups: sql<number>`count(${lessonSignUps.id})::int`,
      completedCount: sql<number>`count(*) FILTER (WHERE ${lessonSignUps.status} = 2)::int`,
      activeCount: sql<number>`count(*) FILTER (WHERE ${lessonSignUps.status} = 1)::int`,
      refundedCount: sql<number>`count(*) FILTER (WHERE ${lessonSignUps.status} = 3)::int`,
      avgProgress: sql<number>`COALESCE(avg(${lessonSignUps.progress})::int, 0)`,
      activeMembers: sql<number>`count(DISTINCT ${lessonSignUps.userId})::int`,
    })
    .from(lessons)
    .leftJoin(lessonSignUps, eq(lessons.id, lessonSignUps.lessonId))
    .where(searchCond)

  const summary = rows[0] ?? {
    totalLessons: 0,
    totalSignups: 0,
    completedCount: 0,
    activeCount: 0,
    refundedCount: 0,
    avgProgress: 0,
    activeMembers: 0,
  }

  // 时间段筛选的报名趋势(按天聚合)
  let trend: { date: string; signups: number; completed: number }[] = []
  if (startDate && endDate) {
    const trendRows = await db
      .select({
        date: sql<string>`to_char(${lessonSignUps.createdAt}::date, 'YYYY-MM-DD')`,
        signups: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) FILTER (WHERE ${lessonSignUps.status} = 2)::int`,
      })
      .from(lessonSignUps)
      .where(
        and(
          sql`${lessonSignUps.createdAt} >= ${startDate}::timestamptz`,
          sql`${lessonSignUps.createdAt} <= ${endDate}::timestamptz`,
        ),
      )
      .groupBy(sql`to_char(${lessonSignUps.createdAt}::date, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${lessonSignUps.createdAt}::date, 'YYYY-MM-DD')`)
    trend = trendRows as { date: string; signups: number; completed: number }[]
  }

  return { summary, trend }
}

// =============================================================================
// Topics (话题发布状态)
// =============================================================================

/**
 * 更新话题发布状态。
 */
export async function publishTopic(id: string, isPublished: boolean): Promise<void> {
  await db
    .update(eduLessonTopics)
    .set({ isPublished, updatedAt: new Date() })
    .where(eq(eduLessonTopics.id, id))
}

// =============================================================================
// 课程关联数据(试卷/证书) - 存储在 learn_homework 的 jsonb content 中
// =============================================================================

/** 哨兵标题,用于标记存储课程关联数据的作业记录。 */
const LESSON_ASSOC_TITLE = '__lesson_associations__'

/**
 * 读取课程关联的试卷 ID。lessons 表无 examPaperId 字段,从哨兵作业记录的 content 中读取。
 */
export async function getLessonExamPaperId(lessonId: string): Promise<string | null> {
  const rows = await db
    .select({ content: learnHomework.content })
    .from(learnHomework)
    .where(and(eq(learnHomework.lessonId, lessonId), eq(learnHomework.title, LESSON_ASSOC_TITLE)))
    .limit(1)
  const content = rows[0]?.content as Record<string, unknown> | null
  const examPaperId = content?.examPaperId
  return typeof examPaperId === 'string' ? examPaperId : null
}

/**
 * 存储课程关联的试卷 ID 到哨兵作业记录的 content 中。
 */
export async function setLessonExamPaperId(
  lessonId: string,
  examPaperId: string | null,
): Promise<void> {
  await upsertLessonAssociation(lessonId, { examPaperId })
}

/**
 * 存储课程关联的证书模板 ID 到哨兵作业记录的 content 中。
 */
export async function setLessonCertificateId(
  lessonId: string,
  certificateTemplateId: string | null,
): Promise<void> {
  await upsertLessonAssociation(lessonId, { certificateTemplateId })
}

/**
 * 内部:upsert 哨兵作业记录,合并 content。
 */
async function upsertLessonAssociation(
  lessonId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const existing = await db
    .select()
    .from(learnHomework)
    .where(and(eq(learnHomework.lessonId, lessonId), eq(learnHomework.title, LESSON_ASSOC_TITLE)))
    .limit(1)
  const oldContent = (existing[0]?.content as Record<string, unknown> | null) ?? {}
  const newContent = { ...oldContent, ...patch }
  if (existing[0]) {
    await db
      .update(learnHomework)
      .set({ content: newContent, updatedAt: new Date() })
      .where(eq(learnHomework.id, existing[0].id))
  } else {
    await db.insert(learnHomework).values({
      lessonId,
      title: LESSON_ASSOC_TITLE,
      description: '课程关联数据(试卷/证书)',
      content: newContent,
      status: 'draft',
    })
  }
}

// =============================================================================
// Learn Map Extensions (学习地图扩展)
// =============================================================================

export async function findPublishedMaps(limit?: number): Promise<LearnMap[]> {
  const q = db
    .select()
    .from(learnMaps)
    .where(eq(learnMaps.isPublished, true))
    .orderBy(asc(learnMaps.sort), desc(learnMaps.createdAt))
  if (limit) return q.limit(limit)
  return q
}

export interface MapListPagedOpts {
  page: number
  pageSize: number
  search?: string
  isPublished?: boolean
}

export async function findMapListPaged(
  opts: MapListPagedOpts,
): Promise<{ list: LearnMap[]; total: number; page: number; pageSize: number }> {
  const { page, pageSize, search, isPublished } = opts
  const conds: ReturnType<typeof eq>[] = []
  if (isPublished !== undefined) conds.push(eq(learnMaps.isPublished, isPublished))
  let searchCond: ReturnType<typeof ilike> | undefined
  if (search) searchCond = ilike(learnMaps.title, `%${search}%`)
  const baseConds = conds.length ? and(...conds) : undefined
  const whereCond = searchCond ? and(baseConds, searchCond) : baseConds

  const list = await db
    .select()
    .from(learnMaps)
    .where(whereCond)
    .orderBy(asc(learnMaps.sort), desc(learnMaps.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(learnMaps)
    .where(whereCond)
  const total = countRows[0]?.count ?? 0
  return { list, total, page, pageSize }
}

export async function insertMap(data: {
  title: string
  description?: string | null
  cover?: string | null
  content?: unknown
  isPublished?: boolean
}): Promise<LearnMap> {
  const rows = await db
    .insert(learnMaps)
    .values({
      title: data.title,
      description: data.description,
      cover: data.cover,
      content: data.content,
      isPublished: data.isPublished,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建学习地图失败')
  return row
}

export async function findMapTopics(learnMapId: string): Promise<string[]> {
  const rows = await db
    .select({ topicId: learnLearnMapTopic.topicId })
    .from(learnLearnMapTopic)
    .where(eq(learnLearnMapTopic.learnMapId, learnMapId))
  return rows.map((r) => r.topicId)
}

export async function setMapTopics(learnMapId: string, topicIds: string[]): Promise<void> {
  await db.delete(learnLearnMapTopic).where(eq(learnLearnMapTopic.learnMapId, learnMapId))
  if (topicIds.length > 0) {
    await db.insert(learnLearnMapTopic).values(topicIds.map((topicId) => ({ learnMapId, topicId })))
  }
}

// =============================================================================
// Lesson Task (课程任务)
// =============================================================================

export async function findTasksByLesson(lessonId: string): Promise<LessonTask[]> {
  return db
    .select()
    .from(lessonTask)
    .where(eq(lessonTask.lessonId, lessonId))
    .orderBy(asc(lessonTask.createdAt))
}

export async function findTaskById(id: string): Promise<LessonTask | undefined> {
  const rows = await db.select().from(lessonTask).where(eq(lessonTask.id, id)).limit(1)
  return rows[0]
}

export interface CreateTaskInput {
  lessonId: string
  lessonChapterId?: string | null
  lessonChapterSectionId?: string | null
  title: string
  contentType?: string | null
  conditions?: string | null
  status?: string
}

export async function createTask(data: CreateTaskInput): Promise<LessonTask> {
  const rows = await db
    .insert(lessonTask)
    .values({
      lessonId: data.lessonId,
      lessonChapterId: data.lessonChapterId,
      lessonChapterSectionId: data.lessonChapterSectionId,
      title: data.title,
      contentType: data.contentType,
      conditions: data.conditions,
      status: data.status,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建任务失败')
  return row
}

export interface UpdateTaskInput {
  lessonChapterId?: string | null
  lessonChapterSectionId?: string | null
  title?: string
  contentType?: string | null
  conditions?: string | null
  status?: string
}

export async function updateTask(
  id: string,
  data: UpdateTaskInput,
): Promise<LessonTask | undefined> {
  const rows = await db
    .update(lessonTask)
    .set({
      ...(data.lessonChapterId !== undefined ? { lessonChapterId: data.lessonChapterId } : {}),
      ...(data.lessonChapterSectionId !== undefined
        ? { lessonChapterSectionId: data.lessonChapterSectionId }
        : {}),
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.contentType !== undefined ? { contentType: data.contentType } : {}),
      ...(data.conditions !== undefined ? { conditions: data.conditions } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      updatedAt: new Date(),
    })
    .where(eq(lessonTask.id, id))
    .returning()
  return rows[0]
}

export async function deleteTask(id: string): Promise<void> {
  await db.delete(lessonTask).where(eq(lessonTask.id, id))
}

export async function setTaskStatus(id: string, status: string): Promise<LessonTask | undefined> {
  const rows = await db
    .update(lessonTask)
    .set({ status, updatedAt: new Date() })
    .where(eq(lessonTask.id, id))
    .returning()
  return rows[0]
}

// =============================================================================
// Lesson Rate (课程评价)
// =============================================================================

export interface RateListOpts {
  lessonId: string
  page: number
  pageSize: number
}

export async function findRateList(
  opts: RateListOpts,
): Promise<{ list: LessonRate[]; total: number; page: number; pageSize: number }> {
  const { lessonId, page, pageSize } = opts
  const list = await db
    .select()
    .from(lessonRate)
    .where(and(eq(lessonRate.lessonId, lessonId), eq(lessonRate.status, 'published')))
    .orderBy(desc(lessonRate.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(lessonRate)
    .where(and(eq(lessonRate.lessonId, lessonId), eq(lessonRate.status, 'published')))
  const total = countRows[0]?.count ?? 0
  return { list, total, page, pageSize }
}

export async function findRateById(id: string): Promise<LessonRate | undefined> {
  const rows = await db.select().from(lessonRate).where(eq(lessonRate.id, id)).limit(1)
  return rows[0]
}

export async function findRateByUserLesson(
  userId: string,
  lessonId: string,
  signId?: string,
): Promise<LessonRate | undefined> {
  const conds = [eq(lessonRate.userId, userId), eq(lessonRate.lessonId, lessonId)]
  if (signId) conds.push(eq(lessonRate.signId, signId))
  const rows = await db
    .select()
    .from(lessonRate)
    .where(and(...conds))
    .limit(1)
  return rows[0]
}

export interface CreateRateInput {
  lessonId: string
  userId: string
  signId?: string | null
  content?: string | null
  contentUtilityScore?: number | null
  teacherScore?: number | null
  serviceScore?: number | null
  isAnonymous?: boolean
}

export async function createRate(data: CreateRateInput): Promise<LessonRate> {
  const rows = await db
    .insert(lessonRate)
    .values({
      lessonId: data.lessonId,
      userId: data.userId,
      signId: data.signId,
      content: data.content,
      contentUtilityScore: data.contentUtilityScore,
      teacherScore: data.teacherScore,
      serviceScore: data.serviceScore,
      isAnonymous: data.isAnonymous,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建评价失败')
  return row
}

export async function deleteRate(id: string): Promise<void> {
  await db.delete(lessonRate).where(eq(lessonRate.id, id))
}

// =============================================================================
// Lesson Access (课程访问权限)
// =============================================================================

export async function findAccessByLesson(lessonId: string): Promise<LessonAccess[]> {
  return db.select().from(lessonAccess).where(eq(lessonAccess.lessonId, lessonId))
}

export async function updateLessonAccess(
  lessonId: string,
  accessType: string,
  accessValues: string[],
): Promise<number> {
  await db.delete(lessonAccess).where(eq(lessonAccess.lessonId, lessonId))
  if (accessValues.length > 0 || accessType !== 'all') {
    const rows = await db
      .insert(lessonAccess)
      .values({
        lessonId,
        accessType,
        accessValues: JSON.stringify(accessValues),
      })
      .returning()
    return rows.length
  }
  const rows = await db
    .insert(lessonAccess)
    .values({ lessonId, accessType: 'all', accessValues: '[]' })
    .returning()
  return rows.length
}

// =============================================================================
// Homework Record (作业提交记录)
// =============================================================================

export async function createHomeworkRecord(data: {
  memberId: string
  lessonId: string
  url: string
  signUpId: string
}): Promise<LearnHomeworkRecord> {
  const rows = await db
    .insert(learnHomeworkRecord)
    .values({
      memberId: data.memberId,
      lessonId: data.lessonId,
      url: data.url,
      signUpId: data.signUpId,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建作业记录失败')
  return row
}

export async function findMyHomeworkRecords(
  memberId: string,
  status?: string,
): Promise<LearnHomeworkRecord[]> {
  const conds = [eq(learnHomeworkRecord.memberId, memberId)]
  if (status) conds.push(eq(learnHomeworkRecord.status, status))
  return db
    .select()
    .from(learnHomeworkRecord)
    .where(and(...conds))
    .orderBy(desc(learnHomeworkRecord.createdAt))
}

export async function auditHomeworkRecord(
  id: string,
  status: 'approved' | 'rejected',
): Promise<LearnHomeworkRecord | undefined> {
  const rows = await db
    .update(learnHomeworkRecord)
    .set({ status, updatedAt: new Date() })
    .where(eq(learnHomeworkRecord.id, id))
    .returning()
  return rows[0]
}
