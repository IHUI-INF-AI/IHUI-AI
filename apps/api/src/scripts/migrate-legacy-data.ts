/**
 * 历史数据迁移脚本(P0-MIG-2)。
 *
 * 用法:
 *   pnpm --filter @ihui/api tsx src/scripts/migrate-legacy-data.ts --dry-run
 *   LEGACY_DATABASE_URL=mysql://user:pass@host:port/dbname \
 *     pnpm --filter @ihui/api tsx src/scripts/migrate-legacy-data.ts --batch 20260717-001
 *
 * 模式:
 * - --dry-run: 输出导入计划(表/预估行数/映射关系),不写库,不需要 legacy DB
 * - --batch <batchId>: 实际导入模式,需配置 LEGACY_DATABASE_URL,自动创建 mysql2 fetcher
 *
 * 依赖顺序(Java 旧表 → TS 新表):
 *   member → course → chapter → enrollment → exam_record → wrong_question → point_record
 *
 * 断点续传: 每条记录导入前调 shouldSkip 跳过已完成。
 * 外键重建: 每步导入前查 id_mapping 获取关联 ID 映射,替换外键。
 * 错误隔离: 单条失败不阻塞批次,记录 failed 计数后继续。
 *
 * 生产依赖: --batch 模式需先安装 mysql2(`pnpm --filter @ihui/api add mysql2`)。
 */
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { eq } from 'drizzle-orm'
import { hasBeenMigrated, getNewId, createMapping } from '../db/id-mapping-queries.js'
import { db } from '../db/index.js'
import {
  users,
  lessons,
  lessonChapters,
  lessonSignUps,
  examRecords,
  examQuestions,
  examWrongQuestion,
  eduPointRecords,
} from '@ihui/database'
import { logger } from '../utils/logger.js'

// =============================================================================
// Legacy row types(Java MySQL 表,宽松类型)
// =============================================================================

export interface LegacyMember {
  id: number
  username: string
  mobile: string
  email: string
  name: string
  avatar: string
  birthday: string | null
  password: string
  gender: string
  status: string
  create_time: Date
}

export interface LegacyCourse {
  id: number
  name: string
  image: string
  introduction: string
  phrase: string
  price: string
  original_price: string
  create_user_id: number | null
  status: string
  create_time: Date
}

export interface LegacyChapter {
  id: number
  lesson_id: number
  title: string
  phrase: string
  sort_order: number
  create_time: Date
}

export interface LegacyEnrollment {
  id: number
  member_id: number
  lesson_id: number
  status: string
  completed_time: Date | null
  create_time: Date
}

export interface LegacyExamRecord {
  id: number
  member_id: number
  exam_id: number
  start_time: Date | null
  end_time: Date | null
  score: string
  status: string
  answer: string
  create_time: Date
}

export interface LegacyWrongQuestion {
  id: number
  question_id: number
  title: string
  type: string
  member_id: number
  score: string
  scored: string
  result: number
  answer: string
  create_time: Date
}

export interface LegacyPointRecord {
  id: number
  point_id: number
  channel_id: number
  point_num: number
  type: string
  member_id: number
  mobile: string
  remark: string
  topic_id: number
  topic_type: string
  create_time: Date
}

// =============================================================================
// Legacy DB fetcher(可注入,测试用 setLegacyFetcher)
// =============================================================================

export type LegacyFetcher = (sql: string) => Promise<Record<string, unknown>[]>

let legacyFetcher: LegacyFetcher | null = null

/** 注入 legacy 数据读取器(测试用);传 null 清除。 */
export function setLegacyFetcher(fetcher: LegacyFetcher | null): void {
  legacyFetcher = fetcher
}

/**
 * 从 LEGACY_DATABASE_URL 创建 mysql2 fetcher(生产模式自动调用)。
 * 动态 import mysql2,未安装时抛出清晰错误。
 * URL 格式:mysql://user:pass@host:port/dbname
 *
 * 注:mysql2 为可选依赖(仅生产迁移时按需 `pnpm add mysql2`),
 * typecheck 时不要求安装,故用宽松类型 + @ts-expect-error。
 */
type MysqlPool = {
  query: <T = Record<string, unknown>[]>(sql: string) => Promise<[T, unknown]>
}
type MysqlModule = {
  createPool: (opts: { uri: string; connectionLimit: number }) => MysqlPool
}

export async function createLegacyFetcherFromEnv(): Promise<LegacyFetcher> {
  const url = process.env.LEGACY_DATABASE_URL
  if (!url) {
    throw new Error('LEGACY_DATABASE_URL 未配置,无法创建 legacy fetcher')
  }
  let mysql: MysqlModule
  try {
    // @ts-expect-error mysql2 为可选依赖,未安装时模块类型不存在
    mysql = await import('mysql2/promise.js')
  } catch {
    throw new Error(
      'mysql2 未安装,请运行 `pnpm --filter @ihui/api add mysql2` 后重试(仅在需要真实 legacy MySQL 导入时安装)',
    )
  }
  const pool = mysql.createPool({ uri: url, connectionLimit: 5 })
  return async (sql: string) => {
    const [rows] = await pool.query<Record<string, unknown>[]>(sql)
    return rows
  }
}

async function fetchLegacy<T>(sql: string): Promise<T[]> {
  if (!legacyFetcher) {
    throw new Error(
      'Legacy fetcher 未初始化,请通过 setLegacyFetcher 注入(测试)或配置 LEGACY_DATABASE_URL(生产)',
    )
  }
  const rows = await legacyFetcher(sql)
  return rows as unknown as T[]
}

// =============================================================================
// Migration step types
// =============================================================================

export interface StepResult {
  total: number
  migrated: number
  skipped: number
  failed: number
}

interface MigrationStep {
  legacyTable: string
  newTable: string
  dependsOn: string[]
  importFn: (batch: string, dryRun: boolean) => Promise<StepResult>
}

/** 断点续传检查:已迁移记录返回 true,importFn 应跳过。 */
export async function shouldSkip(legacyTable: string, legacyId: number): Promise<boolean> {
  return hasBeenMigrated(legacyTable, legacyId)
}

// =============================================================================
// Helpers
// =============================================================================

function statusToCode(s: string | undefined | null): number {
  return s === 'normal' || s === undefined || s === null ? 1 : 0
}

function genderToCode(s: string | undefined | null): number {
  if (s === '男' || s === '1' || s === 'male') return 1
  if (s === '女' || s === '2' || s === 'female') return 2
  return 0
}

function examStatusToCode(s: string | undefined | null): string {
  if (s === 'completed' || s === 'graded') return 'graded'
  if (s === 'in_progress' || s === 'submitted') return 'submitted'
  return 'pending'
}

function safeParseJson(s: string | null | undefined): unknown {
  if (!s) return null
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

function computeDuration(start: Date | null, end: Date | null): number {
  if (!start || !end) return 0
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000))
}

// =============================================================================
// Step 1: Users (t_member → users)
// =============================================================================

export async function importUsers(batch: string, dryRun: boolean): Promise<StepResult> {
  const rows = await fetchLegacy<LegacyMember>('SELECT * FROM t_member ORDER BY id')
  const result: StepResult = { total: rows.length, migrated: 0, skipped: 0, failed: 0 }

  if (dryRun) {
    logger.info('[dry-run] Step 1: t_member → users', {
      total: rows.length,
      mapping: 'member.id → users.id (uuid 重新生成)',
    })
    return result
  }

  for (const row of rows) {
    try {
      if (await shouldSkip('member', row.id)) {
        result.skipped++
        continue
      }
      const newId = randomUUID()
      await db
        .insert(users)
        .values({
          id: newId,
          phone: row.mobile || null,
          email: row.email || null,
          username: row.username || null,
          passwordHash: row.password || null,
          nickname: row.name || null,
          avatar: row.avatar || null,
          gender: genderToCode(row.gender),
          birthday: row.birthday ?? null,
          status: statusToCode(row.status),
          createdAt: row.create_time,
          updatedAt: row.create_time,
        })
        .onConflictDoNothing()
      await createMapping('member', row.id, newId, batch)
      result.migrated++
    } catch (err) {
      result.failed++
      logger.warn('importUsers 单条失败', { legacyId: row.id, error: (err as Error).message })
    }
  }
  return result
}

// =============================================================================
// Step 2: Courses (learn_lesson → lessons)
// =============================================================================

export async function importCourses(batch: string, dryRun: boolean): Promise<StepResult> {
  const rows = await fetchLegacy<LegacyCourse>('SELECT * FROM learn_lesson ORDER BY id')
  const result: StepResult = { total: rows.length, migrated: 0, skipped: 0, failed: 0 }

  if (dryRun) {
    logger.info('[dry-run] Step 2: learn_lesson → lessons', {
      total: rows.length,
      fkMapping: 'learn_lesson.create_user_id → id_mapping(member) → lessons.lecturer_id',
    })
    return result
  }

  for (const row of rows) {
    try {
      if (await shouldSkip('course', row.id)) {
        result.skipped++
        continue
      }
      let lecturerId: string | null = null
      if (row.create_user_id) {
        lecturerId = await getNewId('member', row.create_user_id)
      }
      const newId = randomUUID()
      await db
        .insert(lessons)
        .values({
          id: newId,
          title: row.name,
          coverImage: row.image || null,
          intro: row.introduction || row.phrase || null,
          lecturerId,
          price: row.price ?? '0',
          originalPrice: row.original_price ?? null,
          isFree: !row.price || Number(row.price) === 0,
          isPublished: row.status === 'normal',
          status: statusToCode(row.status),
          createdAt: row.create_time,
          updatedAt: row.create_time,
        })
        .onConflictDoNothing()
      await createMapping('course', row.id, newId, batch)
      result.migrated++
    } catch (err) {
      result.failed++
      logger.warn('importCourses 单条失败', { legacyId: row.id, error: (err as Error).message })
    }
  }
  return result
}

// =============================================================================
// Step 3: Chapters (learn_lesson_chapter → lesson_chapters)
// =============================================================================

export async function importChapters(batch: string, dryRun: boolean): Promise<StepResult> {
  const rows = await fetchLegacy<LegacyChapter>('SELECT * FROM learn_lesson_chapter ORDER BY id')
  const result: StepResult = { total: rows.length, migrated: 0, skipped: 0, failed: 0 }

  if (dryRun) {
    logger.info('[dry-run] Step 3: learn_lesson_chapter → lesson_chapters', {
      total: rows.length,
      fkMapping: 'lesson_id → id_mapping(course) → lesson_chapters.lesson_id',
    })
    return result
  }

  for (const row of rows) {
    try {
      if (await shouldSkip('chapter', row.id)) {
        result.skipped++
        continue
      }
      const lessonId = await getNewId('course', row.lesson_id)
      if (!lessonId) {
        result.failed++
        logger.warn('importChapters: 课程映射缺失,跳过', {
          legacyId: row.id,
          lessonId: row.lesson_id,
        })
        continue
      }
      const newId = randomUUID()
      await db
        .insert(lessonChapters)
        .values({
          id: newId,
          lessonId,
          title: row.title,
          sortOrder: row.sort_order ?? 0,
          createdAt: row.create_time,
        })
        .onConflictDoNothing()
      await createMapping('chapter', row.id, newId, batch)
      result.migrated++
    } catch (err) {
      result.failed++
      logger.warn('importChapters 单条失败', { legacyId: row.id, error: (err as Error).message })
    }
  }
  return result
}

// =============================================================================
// Step 4: Enrollments (learn_sign_up → lesson_sign_ups)
// =============================================================================

export async function importEnrollments(batch: string, dryRun: boolean): Promise<StepResult> {
  const rows = await fetchLegacy<LegacyEnrollment>('SELECT * FROM learn_sign_up ORDER BY id')
  const result: StepResult = { total: rows.length, migrated: 0, skipped: 0, failed: 0 }

  if (dryRun) {
    logger.info('[dry-run] Step 4: learn_sign_up → lesson_sign_ups', {
      total: rows.length,
      fkMapping: 'member_id → id_mapping(member), lesson_id → id_mapping(course)',
    })
    return result
  }

  for (const row of rows) {
    try {
      if (await shouldSkip('enrollment', row.id)) {
        result.skipped++
        continue
      }
      const userId = await getNewId('member', row.member_id)
      const lessonId = await getNewId('course', row.lesson_id)
      if (!userId || !lessonId) {
        result.failed++
        logger.warn('importEnrollments: 外键映射缺失,跳过', {
          legacyId: row.id,
          memberId: row.member_id,
          lessonId: row.lesson_id,
        })
        continue
      }
      const newId = randomUUID()
      await db
        .insert(lessonSignUps)
        .values({
          id: newId,
          lessonId,
          userId,
          status: row.status === 'completed' ? 2 : 1,
          progress: row.status === 'completed' ? 100 : 0,
          createdAt: row.create_time,
        })
        .onConflictDoNothing()
      await createMapping('enrollment', row.id, newId, batch)
      result.migrated++
    } catch (err) {
      result.failed++
      logger.warn('importEnrollments 单条失败', { legacyId: row.id, error: (err as Error).message })
    }
  }
  return result
}

// =============================================================================
// Step 5: Answers (exam_record → exam_records)
// =============================================================================

export async function importAnswers(batch: string, dryRun: boolean): Promise<StepResult> {
  const rows = await fetchLegacy<LegacyExamRecord>('SELECT * FROM exam_record ORDER BY id')
  const result: StepResult = { total: rows.length, migrated: 0, skipped: 0, failed: 0 }

  if (dryRun) {
    logger.info('[dry-run] Step 5: exam_record → exam_records', {
      total: rows.length,
      fkMapping: 'member_id → id_mapping(member), exam_id → id_mapping(exam)',
    })
    return result
  }

  for (const row of rows) {
    try {
      if (await shouldSkip('exam_record', row.id)) {
        result.skipped++
        continue
      }
      const userId = await getNewId('member', row.member_id)
      const paperId = await getNewId('exam', row.exam_id)
      if (!userId || !paperId) {
        result.failed++
        logger.warn('importAnswers: 外键映射缺失,跳过', {
          legacyId: row.id,
          memberId: row.member_id,
          examId: row.exam_id,
        })
        continue
      }
      const scoreNum = Number(row.score) || 0
      const newId = randomUUID()
      await db
        .insert(examRecords)
        .values({
          id: newId,
          paperId,
          userId,
          answers: safeParseJson(row.answer),
          score: row.score ?? '0',
          isPassed: scoreNum >= 60,
          status: examStatusToCode(row.status),
          startedAt: row.start_time ?? row.create_time,
          submittedAt: row.end_time ?? null,
          duration: computeDuration(row.start_time, row.end_time),
          createdAt: row.create_time,
        })
        .onConflictDoNothing()
      await createMapping('exam_record', row.id, newId, batch)
      result.migrated++
    } catch (err) {
      result.failed++
      logger.warn('importAnswers 单条失败', { legacyId: row.id, error: (err as Error).message })
    }
  }
  return result
}

// =============================================================================
// Step 6: Wrong questions (exam_wrong_question → exam_wrong_question)
// =============================================================================

export async function importWrongQuestions(batch: string, dryRun: boolean): Promise<StepResult> {
  const rows = await fetchLegacy<LegacyWrongQuestion>(
    'SELECT * FROM exam_wrong_question ORDER BY id',
  )
  const result: StepResult = { total: rows.length, migrated: 0, skipped: 0, failed: 0 }

  if (dryRun) {
    logger.info('[dry-run] Step 6: exam_wrong_question → exam_wrong_question', {
      total: rows.length,
      fkMapping: 'member_id → id_mapping(member), question_id → id_mapping(question)',
    })
    return result
  }

  for (const row of rows) {
    try {
      if (await shouldSkip('wrong_question', row.id)) {
        result.skipped++
        continue
      }
      const userId = await getNewId('member', row.member_id)
      const questionId = await getNewId('question', row.question_id)
      if (!userId || !questionId) {
        result.failed++
        logger.warn('importWrongQuestions: 外键映射缺失,跳过', {
          legacyId: row.id,
          memberId: row.member_id,
          questionId: row.question_id,
        })
        continue
      }
      const questionRows = await db
        .select({ paperId: examQuestions.paperId })
        .from(examQuestions)
        .where(eq(examQuestions.id, questionId))
        .limit(1)
      const paperId = questionRows[0]?.paperId
      if (!paperId) {
        result.failed++
        logger.warn('importWrongQuestions: 题目不存在于 TS,跳过', { legacyId: row.id, questionId })
        continue
      }
      const newId = randomUUID()
      await db
        .insert(examWrongQuestion)
        .values({
          id: newId,
          userId,
          questionId,
          paperId,
          userAnswer: row.answer || null,
          wrongCount: 1,
          lastWrongTime: row.create_time,
          isMastered: false,
          createdAt: row.create_time,
          updatedAt: row.create_time,
        })
        .onConflictDoNothing()
      await createMapping('wrong_question', row.id, newId, batch)
      result.migrated++
    } catch (err) {
      result.failed++
      logger.warn('importWrongQuestions 单条失败', {
        legacyId: row.id,
        error: (err as Error).message,
      })
    }
  }
  return result
}

// =============================================================================
// Step 7: Point records (point_record → edu_point_records)
// =============================================================================

export async function importPointRecords(batch: string, dryRun: boolean): Promise<StepResult> {
  const rows = await fetchLegacy<LegacyPointRecord>('SELECT * FROM point_record ORDER BY id')
  const result: StepResult = { total: rows.length, migrated: 0, skipped: 0, failed: 0 }

  if (dryRun) {
    logger.info('[dry-run] Step 7: point_record → edu_point_records', {
      total: rows.length,
      fkMapping: 'member_id → id_mapping(member)',
    })
    return result
  }

  for (const row of rows) {
    try {
      if (await shouldSkip('point_record', row.id)) {
        result.skipped++
        continue
      }
      const memberId = await getNewId('member', row.member_id)
      if (!memberId) {
        result.failed++
        logger.warn('importPointRecords: 用户映射缺失,跳过', {
          legacyId: row.id,
          memberId: row.member_id,
        })
        continue
      }
      const newId = randomUUID()
      await db
        .insert(eduPointRecords)
        .values({
          id: newId,
          memberId,
          point: row.point_num,
          balance: 0,
          type: row.type,
          description: row.remark || null,
          refId: row.topic_id ? `${row.topic_type}:${row.topic_id}` : null,
          createdAt: row.create_time,
        })
        .onConflictDoNothing()
      await createMapping('point_record', row.id, newId, batch)
      result.migrated++
    } catch (err) {
      result.failed++
      logger.warn('importPointRecords 单条失败', {
        legacyId: row.id,
        error: (err as Error).message,
      })
    }
  }
  return result
}

// =============================================================================
// Migration plan & runner
// =============================================================================

const MIGRATION_PLAN: MigrationStep[] = [
  { legacyTable: 'member', newTable: 'users', dependsOn: [], importFn: importUsers },
  { legacyTable: 'course', newTable: 'lessons', dependsOn: ['member'], importFn: importCourses },
  {
    legacyTable: 'chapter',
    newTable: 'lesson_chapters',
    dependsOn: ['course'],
    importFn: importChapters,
  },
  {
    legacyTable: 'enrollment',
    newTable: 'lesson_sign_ups',
    dependsOn: ['member', 'course'],
    importFn: importEnrollments,
  },
  {
    legacyTable: 'exam_record',
    newTable: 'exam_records',
    dependsOn: ['member', 'exam'],
    importFn: importAnswers,
  },
  {
    legacyTable: 'wrong_question',
    newTable: 'exam_wrong_question',
    dependsOn: ['member', 'question'],
    importFn: importWrongQuestions,
  },
  {
    legacyTable: 'point_record',
    newTable: 'edu_point_records',
    dependsOn: ['member'],
    importFn: importPointRecords,
  },
]

function parseArgs(argv: string[]): { dryRun: boolean; batch: string | null } {
  const dryRun = argv.includes('--dry-run')
  const batchIdx = argv.indexOf('--batch')
  const batch = batchIdx >= 0 ? (argv[batchIdx + 1] ?? null) : null
  return { dryRun, batch }
}

function generateBatchId(): string {
  const d = new Date()
  const ts = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`
  return `mig-${ts}`
}

function printPlan(batch: string): void {
  logger.info('=== 历史数据迁移计划(dry-run)===')
  logger.info(`批次号: ${batch}`)
  logger.info(`步骤数: ${MIGRATION_PLAN.length}`)
  logger.info('依赖顺序:')
  for (const step of MIGRATION_PLAN) {
    const deps = step.dependsOn.length ? ` ← ${step.dependsOn.join(', ')}` : ''
    logger.info(`  - ${step.legacyTable} → ${step.newTable}${deps}`)
  }
  logger.info('提示: 实际导入请使用 --batch <batchId>')
}

async function runMigration(opts: { dryRun: boolean; batch: string }): Promise<void> {
  const { dryRun, batch } = opts
  if (dryRun) {
    printPlan(batch)
    for (let i = 0; i < MIGRATION_PLAN.length; i++) {
      await MIGRATION_PLAN[i]!.importFn(batch, true)
    }
    return
  }

  logger.info(`=== 开始历史数据迁移(批次: ${batch})===`)
  for (let i = 0; i < MIGRATION_PLAN.length; i++) {
    const step = MIGRATION_PLAN[i]!
    logger.info(`[Step ${i + 1}: ${step.legacyTable} → ${step.newTable}]`)
    try {
      const result = await step.importFn(batch, false)
      logger.info(
        `Step ${i + 1}: imported ${result.migrated} records, skipped ${result.skipped}, failed ${result.failed}`,
      )
    } catch (err) {
      logger.error(`Step ${i + 1} 整步失败,跳到下一步`, { error: (err as Error).message })
    }
  }
  logger.info(`=== 迁移结束(批次: ${batch})===`)
}

async function main(): Promise<void> {
  const { dryRun, batch } = parseArgs(process.argv.slice(2))
  const batchId = batch ?? generateBatchId()
  if (!dryRun && !batch) {
    logger.info(`未指定 --batch,自动生成批次号: ${batchId}`)
  }
  // dry-run 不需要 legacy fetcher(只输出计划)
  // 生产模式(--batch)自动从 LEGACY_DATABASE_URL 创建 fetcher
  if (!dryRun && !legacyFetcher) {
    setLegacyFetcher(await createLegacyFetcherFromEnv())
  }
  await runMigration({ dryRun, batch: batchId })
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMainModule) {
  main().catch((err) => {
    logger.error('迁移脚本异常:', { error: err })
    process.exit(1)
  })
}

export { MIGRATION_PLAN, runMigration, parseArgs, generateBatchId, printPlan }
export type { MigrationStep }
