import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from './index.js'
import {
  lessonRecords,
  lessonRecordLogs,
  lessonChapterSections,
  lessonSignUps,
  lessons,
  learnCategories,
  users,
  type LessonRecord,
  type LessonRecordLog,
} from '@ihui/database'

// =============================================================================
// 常量与类型
// =============================================================================

/** 自动完成阈值:进度 >= 90% 且累计观看时长 >= 总时长 * 90% */
const AUTO_COMPLETE_PROGRESS = 90
const AUTO_COMPLETE_DURATION_RATIO = 0.9

export type RecordAction = 'heartbeat' | 'seek' | 'pause' | 'complete'

export interface UpsertRecordInput {
  userId: string
  lessonId: string
  sectionId?: string | null
  chapterId?: string | null
  watchDuration?: number
  totalDuration?: number
  progress?: number
  status?: number
  lastPosition?: number
}

// =============================================================================
// 1. upsertRecord — 创建或更新学习记录(幂等)
// =============================================================================

/**
 * 创建或更新学习记录。
 * 幂等:同用户同 lesson 同 section 仅一条记录。
 * 若 sectionId 提供,自动查询 section.duration 作为 totalDuration(未显式传入时)。
 */
export async function upsertRecord(input: UpsertRecordInput): Promise<LessonRecord> {
  const { userId, lessonId, sectionId, chapterId } = input

  // 若未显式传入 totalDuration 且有 sectionId,查询 section.duration
  let totalDuration = input.totalDuration ?? 0
  if (sectionId && totalDuration === 0) {
    const section = await db
      .select({ duration: lessonChapterSections.duration })
      .from(lessonChapterSections)
      .where(eq(lessonChapterSections.id, sectionId))
      .limit(1)
    totalDuration = section[0]?.duration ?? 0
  }

  // 查询现有记录(幂等判定)
  const conds = [eq(lessonRecords.userId, userId), eq(lessonRecords.lessonId, lessonId)]
  if (sectionId) conds.push(eq(lessonRecords.sectionId, sectionId))
  else conds.push(sql`${lessonRecords.sectionId} IS NULL`)

  const existing = await db.select().from(lessonRecords).where(and(...conds)).limit(1)

  if (existing[0]) {
    // 更新
    const set: Partial<LessonRecord> = { updatedAt: new Date() }
    if (chapterId !== undefined) set.chapterId = chapterId
    if (input.watchDuration !== undefined) set.watchDuration = input.watchDuration
    if (totalDuration > 0) set.totalDuration = totalDuration
    if (input.progress !== undefined) set.progress = input.progress
    if (input.status !== undefined) set.status = input.status
    if (input.lastPosition !== undefined) set.lastPosition = input.lastPosition
    const rows = await db
      .update(lessonRecords)
      .set(set)
      .where(eq(lessonRecords.id, existing[0].id))
      .returning()
    const row = rows[0]
    if (!row) throw new Error('更新学习记录失败')
    return row
  }

  // 新建
  const rows = await db
    .insert(lessonRecords)
    .values({
      userId,
      lessonId,
      chapterId: chapterId ?? null,
      sectionId: sectionId ?? null,
      watchDuration: input.watchDuration ?? 0,
      totalDuration,
      progress: input.progress ?? 0,
      status: input.status ?? 0,
      lastPosition: input.lastPosition ?? 0,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建学习记录失败')
  return row
}

// =============================================================================
// 2. appendRecordLog — 追加日志
// =============================================================================

/**
 * 追加一条学习记录日志。
 */
export async function appendRecordLog(data: {
  recordId: string
  userId: string
  action?: RecordAction
  position?: number
  duration?: number
}): Promise<LessonRecordLog> {
  const rows = await db
    .insert(lessonRecordLogs)
    .values({
      recordId: data.recordId,
      userId: data.userId,
      action: data.action ?? 'heartbeat',
      position: data.position ?? 0,
      duration: data.duration ?? 0,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('追加学习日志失败')
  return row
}

// =============================================================================
// 3. checkAutoComplete — 自动完成判定
// =============================================================================

/**
 * 自动完成判定:progress >= 90% 且 watchDuration >= totalDuration * 0.9 → status=2, completedAt=now。
 * 仅当当前状态非已完成时才判定(避免重复设置)。
 * 返回更新后的记录。
 */
export async function checkAutoComplete(recordId: string): Promise<LessonRecord | undefined> {
  const rows = await db.select().from(lessonRecords).where(eq(lessonRecords.id, recordId)).limit(1)
  const record = rows[0]
  if (!record) return undefined
  // 已完成则跳过
  if (record.status === 2) return record

  const meetProgress = record.progress >= AUTO_COMPLETE_PROGRESS
  const meetDuration =
    record.totalDuration > 0
      ? record.watchDuration >= Math.floor(record.totalDuration * AUTO_COMPLETE_DURATION_RATIO)
      : record.progress >= 100

  if (meetProgress && meetDuration) {
    const updated = await db
      .update(lessonRecords)
      .set({ status: 2, completedAt: new Date(), updatedAt: new Date() })
      .where(eq(lessonRecords.id, recordId))
      .returning()
    return updated[0]
  }
  return record
}

// =============================================================================
// 4. getLessonProgress — 查某课程整体进度(聚合所有 section)
// =============================================================================

export interface SectionProgress {
  sectionId: string | null
  progress: number
  status: number
  watchDuration: number
  lastPosition: number
}

export interface LessonProgressResult {
  progress: number
  status: number
  watchDuration: number
  totalDuration: number
  lastPosition: number
  sectionProgress: SectionProgress[]
}

/**
 * 查询用户在某课程的整体学习进度。
 * progress: 所有 section 进度的平均值(0-100)。
 * status: 任一 section 进行中→1,全部完成→2,无记录→0。
 */
export async function getLessonProgress(
  userId: string,
  lessonId: string,
): Promise<LessonProgressResult | undefined> {
  const records = await db
    .select()
    .from(lessonRecords)
    .where(and(eq(lessonRecords.userId, userId), eq(lessonRecords.lessonId, lessonId)))

  if (records.length === 0) {
    return {
      progress: 0,
      status: 0,
      watchDuration: 0,
      totalDuration: 0,
      lastPosition: 0,
      sectionProgress: [],
    }
  }

  const totalDuration = records.reduce((s, r) => s + r.totalDuration, 0)
  const watchDuration = records.reduce((s, r) => s + r.watchDuration, 0)
  const progress =
    records.length > 0
      ? Math.floor(records.reduce((s, r) => s + r.progress, 0) / records.length)
      : 0
  // 任一进行中→1,全部完成→2,否则→0
  const status = records.every((r) => r.status === 2)
    ? 2
    : records.some((r) => r.status >= 1)
      ? 1
      : 0
  const lastPosition = records.reduce((m, r) => Math.max(m, r.lastPosition), 0)

  return {
    progress,
    status,
    watchDuration,
    totalDuration,
    lastPosition,
    sectionProgress: records.map((r) => ({
      sectionId: r.sectionId,
      progress: r.progress,
      status: r.status,
      watchDuration: r.watchDuration,
      lastPosition: r.lastPosition,
    })),
  }
}

// =============================================================================
// 5. getRanking — 课程排行榜(SQL 聚合,按完成度/时长排序)
// =============================================================================

export interface RankingRow {
  userId: string
  nickname: string | null
  avatar: string | null
  progress: number
  watchDuration: number
  completedCount: number
}

/**
 * 课程学习排行榜:按平均 progress 降序、累计 watchDuration 降序排序。
 * 使用 SQL 聚合,非应用层循环。
 */
export async function getRanking(lessonId: string, limit = 50): Promise<RankingRow[]> {
  const rows = await db
    .select({
      userId: lessonRecords.userId,
      nickname: users.nickname,
      avatar: users.avatar,
      progress: sql<number>`COALESCE(avg(${lessonRecords.progress})::int, 0)`,
      watchDuration: sql<number>`COALESCE(sum(${lessonRecords.watchDuration})::int, 0)`,
      completedCount: sql<number>`count(*) FILTER (WHERE ${lessonRecords.status} = 2)::int`,
    })
    .from(lessonRecords)
    .innerJoin(users, eq(lessonRecords.userId, users.id))
    .where(eq(lessonRecords.lessonId, lessonId))
    .groupBy(lessonRecords.userId, users.nickname, users.avatar)
    .orderBy(
      desc(sql`avg(${lessonRecords.progress})`),
      desc(sql`sum(${lessonRecords.watchDuration})`),
    )
    .limit(limit)
  return rows as RankingRow[]
}

// =============================================================================
// 6. updateWatchPosition — 心跳上报(更新 lastPosition + watchDuration + progress,追加 log,检查自动完成)
// =============================================================================

export interface UpdateWatchPositionResult {
  record: LessonRecord
  log: LessonRecordLog
  autoCompleted: boolean
}

/**
 * 心跳上报:更新 lastPosition + watchDuration += duration + 重新计算 progress,
 * 追加一条 heartbeat 日志,检查自动完成。
 * 返回更新后的 record、新增的 log、是否触发自动完成。
 */
export async function updateWatchPosition(
  recordId: string,
  position: number,
  duration: number,
): Promise<UpdateWatchPositionResult | undefined> {
  const rows = await db.select().from(lessonRecords).where(eq(lessonRecords.id, recordId)).limit(1)
  const record = rows[0]
  if (!record) return undefined

  // 累加 watchDuration(仅当 duration > 0 时)
  const newWatchDuration = record.watchDuration + Math.max(0, duration)
  // progress 基于 position/totalDuration(若 totalDuration=0 则保持原值)
  const newProgress =
    record.totalDuration > 0
      ? Math.min(100, Math.max(record.progress, Math.floor((position / record.totalDuration) * 100)))
      : record.progress
  // status: 有心跳即为进行中(除非已完成)
  const newStatus = record.status === 2 ? 2 : 1

  const updatedRows = await db
    .update(lessonRecords)
    .set({
      lastPosition: position,
      watchDuration: newWatchDuration,
      progress: newProgress,
      status: newStatus,
      updatedAt: new Date(),
    })
    .where(eq(lessonRecords.id, recordId))
    .returning()
  const updatedRecord = updatedRows[0]
  if (!updatedRecord) throw new Error('更新学习记录位置失败')

  // 追加日志
  const log = await appendRecordLog({
    recordId,
    userId: record.userId,
    action: 'heartbeat',
    position,
    duration,
  })

  // 检查自动完成
  const beforeStatus = updatedRecord.status
  const afterRecord = await checkAutoComplete(recordId)
  const autoCompleted = !!afterRecord && afterRecord.status === 2 && beforeStatus !== 2

  return {
    record: afterRecord ?? updatedRecord,
    log,
    autoCompleted,
  }
}

// =============================================================================
// 7. getProgressOverview — 学习进度概览(聚合统计,供 /edu/progress 使用)
// =============================================================================

export interface ProgressOverview {
  totalStudyHours: number
  totalCourses: number
  completedCourses: number
  avgProgress: number
  weeklyHours: { date: string; hours: number }[]
  categoryProgress: { name: string; total: number; completed: number; progress: number }[]
  recentMilestones: { id: string; title: string; type: string; achievedAt: string }[]
}

/**
 * 聚合用户的整体学习进度概览。
 * 从 lessonRecords(学习时长)、lessonRecordLogs(每周时长)、lessonSignUps(课程进度/分类)计算。
 */
export async function getProgressOverview(userId: string): Promise<ProgressOverview> {
  // 1. 总学习时长(秒→小时)
  const durationRows = await db
    .select({ total: sql<number>`COALESCE(sum(${lessonRecords.watchDuration})::int, 0)` })
    .from(lessonRecords)
    .where(eq(lessonRecords.userId, userId))
  const totalSeconds = durationRows[0]?.total ?? 0
  const totalStudyHours = Math.round((totalSeconds / 3600) * 10) / 10

  // 2. 报名课程统计
  const signups = await db
    .select({
      id: lessonSignUps.id,
      lessonId: lessonSignUps.lessonId,
      progress: lessonSignUps.progress,
      status: lessonSignUps.status,
      title: lessons.title,
      categoryName: learnCategories.name,
    })
    .from(lessonSignUps)
    .innerJoin(lessons, eq(lessonSignUps.lessonId, lessons.id))
    .leftJoin(learnCategories, eq(lessons.categoryId, learnCategories.id))
    .where(eq(lessonSignUps.userId, userId))

  const totalCourses = signups.length
  const completedCourses = signups.filter((s) => s.status === 2).length
  const avgProgress =
    totalCourses > 0
      ? Math.round(signups.reduce((sum, s) => sum + (s.progress ?? 0), 0) / totalCourses)
      : 0

  // 3. 分类进度聚合
  const categoryMap = new Map<string, { total: number; completed: number; progress: number }>()
  for (const s of signups) {
    // 处理分类名,含中文逗号分隔的多个分类
    const names = s.categoryName ? s.categoryName.split(/[,，]/).map((n) => n.trim()).filter(Boolean) : ['未分类']
    for (const name of names) {
      const entry = categoryMap.get(name) ?? { total: 0, completed: 0, progress: 0 }
      entry.total++
      if (s.status === 2) entry.completed++
      entry.progress += s.progress ?? 0
      categoryMap.set(name, entry)
    }
  }
  const categoryProgress = Array.from(categoryMap.entries()).map(([name, data]) => ({
    name,
    total: data.total,
    completed: data.completed,
    progress: data.total > 0 ? Math.round(data.progress / data.total) : 0,
  }))

  // 4. 最近7天每周学习时长(从 lessonRecordLogs 读取)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  sevenDaysAgo.setHours(0, 0, 0, 0)
  const logRows = await db
    .select({
      date: sql<string>`to_char(${lessonRecordLogs.createdAt}::date, 'YYYY-MM-DD')`,
      duration: sql<number>`COALESCE(sum(${lessonRecordLogs.duration})::int, 0)`,
    })
    .from(lessonRecordLogs)
    .where(
      and(
        eq(lessonRecordLogs.userId, userId),
        sql`${lessonRecordLogs.createdAt} >= ${sevenDaysAgo.toISOString()}::timestamptz`,
      ),
    )
    .groupBy(sql`to_char(${lessonRecordLogs.createdAt}::date, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${lessonRecordLogs.createdAt}::date, 'YYYY-MM-DD')`)
  const logMap = new Map<string, number>()
  for (const r of logRows) {
    logMap.set(r.date, Math.round((r.duration / 3600) * 10) / 10)
  }
  const weeklyHours: { date: string; hours: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    weeklyHours.push({ date: dateStr, hours: logMap.get(dateStr) ?? 0 })
  }

  // 5. 最近完成的课程(里程碑)
  const completedLessons = signups
    .filter((s) => s.status === 2)
    .slice(0, 10)
    .map((s) => ({
      id: s.lessonId,
      title: s.title,
      type: 'course_completed' as const,
      achievedAt: new Date().toISOString(), // lessonSignUps 无 completedAt,用当前时间代理
    }))

  return {
    totalStudyHours,
    totalCourses,
    completedCourses,
    avgProgress,
    weeklyHours,
    categoryProgress,
    recentMilestones: completedLessons,
  }
}

// =============================================================================
// 辅助:查报名记录(用于心跳端点校验)
// =============================================================================

/**
 * 查询用户在某课程的报名记录(复用 lessonSignUps)。
 */
export async function findSignUpRecord(
  userId: string,
  lessonId: string,
): Promise<{ id: string } | undefined> {
  const rows = await db
    .select({ id: lessonSignUps.id })
    .from(lessonSignUps)
    .where(and(eq(lessonSignUps.userId, userId), eq(lessonSignUps.lessonId, lessonId)))
    .limit(1)
  return rows[0]
}
