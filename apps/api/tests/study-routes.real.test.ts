/**
 * study-routes — /api/study/* 路由层真实 DB 集成测试。
 *
 * 覆盖 7 个端点(鉴权 + 业务逻辑):
 *   1. GET  /api/study/records           — 分页 list
 *   2. GET  /api/study/records/:id       — 单条详情 + IDOR 防护
 *   3. POST /api/study/records           — 幂等报名
 *   4. PUT  /api/study/records/:id       — 更新 progress / status
 *   5. GET  /api/study/progress          — 平均进度 / 空数据 progress=0
 *   6. GET  /api/study/progress/all      — 全部分页
 *   7. GET  /api/study/statistics        — 总学时 / 课程数 / 连续天数
 *
 * P0 回归覆盖(2026-07-26 已修):
 *   - calcContinuousDays 跨日 SQL 边界(UTC 23:59 / 00:01 / 隔日 24h+ 不连续)
 *   - 时区错位(用户 +08:00 vs DB UTC 8h 偏移,streak 不被错算)
 *   - 幂等冲突(连续报名同日应正确处理,不得重复插入)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import { sql, eq } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import {
  lessons,
  learnCategories,
  lessonChapters,
  lessonChapterSections,
  lessonSignUps,
} from '@ihui/database'
import { mockAuthenticate, setMockUser, setMockUnauthorized, resetMockAuth } from './helpers/mock-auth.js'
import { userAuthPreHandler } from '../src/routes/user/_shared.ts'

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: (...args: unknown[]) => mockAuthenticate(...args),
  requireActiveUser: vi.fn(),
}))

const studyRoutes = (await import('../src/routes/user/study-routes.ts')).default

// 注册 SQL 事件监听,打印每条 SQL 查询,便于定位 schema drift 等问题
const { sqlEventBus } = await import('../src/db/sql-event-bus.ts')
import { appendFileSync } from 'node:fs'
const debugLogPath = process.env.TEST_DEBUG_LOG
sqlEventBus.on((e) => {
  // eslint-disable-next-line no-console
  console.log('SQL>', e.query)
  if (debugLogPath) {
    try {
      appendFileSync(debugLogPath, `[SQL] ${e.query}\n`)
    } catch {
      // ignore
    }
  }
})

// 把 unhandled rejection 打到 stderr,方便定位 500 原因(测试需要时启用 TEST_DEBUG_LOG)
process.on('unhandledRejection', (err) => {
  // eslint-disable-next-line no-console
  console.error('UNHANDLED REJECTION:', err)
  if (debugLogPath) {
    try {
      appendFileSync(debugLogPath, `[UNHANDLED] ${(err as Error)?.stack ?? String(err)}\n`)
    } catch {
      // ignore
    }
  }
})

// =============================================================================
// 测试夹具(直接走真实 DB,不 mock 任何数据层)
// =============================================================================

async function createUser(phone: string, nickname?: string) {
  // 使用原生 SQL 而非 Drizzle .insert():DB schema 缺 two_factor_* 列,
  // Drizzle 默认会展开全列 INSERT 触发 "column does not exist" 错误
  const [row] = (await db.execute(
    sql`INSERT INTO users (phone, nickname) VALUES (${phone}, ${nickname ?? phone}) RETURNING id`,
  )) as unknown as Array<{ id: string }>
  return row!
}

async function createCategory(name: string) {
  const [row] = await db
    .insert(learnCategories)
    .values({ name, status: 1, sort: 0 })
    .returning()
  return row
}

async function createLesson(data: { title: string; categoryId?: string | null; isPublished?: boolean }) {
  const [row] = await db
    .insert(lessons)
    .values({
      title: data.title,
      categoryId: data.categoryId ?? null,
      isPublished: data.isPublished ?? true,
      status: 1,
    })
    .returning()
  return row
}

async function createChapter(lessonId: string, title: string) {
  const [row] = await db
    .insert(lessonChapters)
    .values({ lessonId, title, sortOrder: 0 })
    .returning()
  return row
}

async function createSection(chapterId: string, title: string, duration: number) {
  const [row] = await db
    .insert(lessonChapterSections)
    .values({ chapterId, title, duration, sortOrder: 0 })
    .returning()
  return row
}

/** 插入一条带指定 createdAt 的报名记录(用于 streak 时区 SQL 测试) */
async function createSignUpAt(
  userId: string,
  lessonId: string,
  createdAt: Date,
  status: number = 1,
  progress: number = 0,
) {
  const [row] = await db
    .insert(lessonSignUps)
    .values({ userId, lessonId, status, progress, createdAt })
    .returning()
  return row
}

// =============================================================================
// 测试套件
// =============================================================================

describe('study-routes — 学习记录需鉴权真实 DB 集成测试', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    // study-routes 在 routes/user/index.ts 中由 missingUserRoutes 包裹,
    // 鉴权 preHandler 通过 server.addHook 注册;此处显式注册以保持等价
    server.addHook('preHandler', userAuthPreHandler)
    await server.register(studyRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(async () => {
    resetMockAuth()
    // 业务表按 FK 反向顺序清空,确保外键不阻断
    await db.execute(sql`DELETE FROM lesson_chapter_sections`)
    await db.execute(sql`DELETE FROM lesson_chapters`)
    await db.execute(sql`DELETE FROM lesson_sign_ups`)
    await db.execute(sql`DELETE FROM lessons`)
    await db.execute(sql`DELETE FROM learn_categories`)
    await db.execute(sql`DELETE FROM users WHERE is_system_admin = false`)
  })

  // =====================================================================
  // 鉴权:所有 7 端点都需登录
  // =====================================================================

  it('GET /api/study/records — 未登录返回 401', async () => {
    setMockUnauthorized()
    const res = await server.inject({ method: 'GET', url: '/api/study/records' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/study/records/:id — 未登录返回 401', async () => {
    setMockUnauthorized()
    const res = await server.inject({
      method: 'GET',
      url: '/api/study/records/00000000-0000-0000-0000-000000000000',
    })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/study/records — 未登录返回 401', async () => {
    setMockUnauthorized()
    const res = await server.inject({
      method: 'POST',
      url: '/api/study/records',
      body: { lessonId: '00000000-0000-0000-0000-000000000000' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('PUT /api/study/records/:id — 未登录返回 401', async () => {
    setMockUnauthorized()
    const res = await server.inject({
      method: 'PUT',
      url: '/api/study/records/00000000-0000-0000-0000-000000000000',
      body: { progress: 50 },
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/study/progress — 未登录返回 401', async () => {
    setMockUnauthorized()
    const res = await server.inject({ method: 'GET', url: '/api/study/progress' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/study/progress/all — 未登录返回 401', async () => {
    setMockUnauthorized()
    const res = await server.inject({ method: 'GET', url: '/api/study/progress/all' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/study/statistics — 未登录返回 401', async () => {
    setMockUnauthorized()
    const res = await server.inject({ method: 'GET', url: '/api/study/statistics' })
    expect(res.statusCode).toBe(401)
  })

  // =====================================================================
  // 1. GET /api/study/records — 分页 list
  // =====================================================================

  it('GET /api/study/records — 无记录返回空列表', async () => {
    const user = await createUser('1001', '用户A')
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/study/records' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.list).toEqual([])
    expect(body.data.total).toBe(0)
    expect(body.data.page).toBe(1)
    expect(body.data.pageSize).toBe(20)
  })

  it('GET /api/study/records — 按 userId 隔离 + 业务字段正确', async () => {
    const userA = await createUser('1001', '用户A')
    const userB = await createUser('1002', '用户B')
    const cat = await createCategory('编程')
    const lesson = await createLesson({ title: 'TS 入门', categoryId: cat.id })
    await db.insert(lessonSignUps).values({ userId: userA.id, lessonId: lesson.id, progress: 30, status: 1 })
    await db.insert(lessonSignUps).values({ userId: userB.id, lessonId: lesson.id, progress: 80, status: 1 })

    setMockUser(userA.id)
    const res = await server.inject({ method: 'GET', url: '/api/study/records' })
    const body = res.json()
    expect(body.data.list).toHaveLength(1)
    expect(body.data.total).toBe(1)
    const item = body.data.list[0]
    expect(item.userId).toBe(userA.id)
    expect(item.lessonTitle).toBe('TS 入门')
    expect(item.progress).toBe(30)
    expect(item.status).toBe('in_progress')
  })

  it('GET /api/study/records — progress=100 映射 status=completed', async () => {
    const user = await createUser('1001', '用户')
    const cat = await createCategory('设计')
    const lesson = await createLesson({ title: '设计基础', categoryId: cat.id })
    await db.insert(lessonSignUps).values({ userId: user.id, lessonId: lesson.id, progress: 100, status: 2 })

    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/study/records' })
    const body = res.json()
    expect(body.data.list[0].status).toBe('completed')
  })

  it('GET /api/study/records — 分页 pageSize=2', async () => {
    const user = await createUser('1001', '用户')
    // 每条用不同 lesson 避免 lesson_sign_ups_lesson_user_unique 唯一约束
    for (let i = 0; i < 5; i++) {
      const lesson = await createLesson({ title: `通用课程${i}` })
      await db.insert(lessonSignUps).values({ userId: user.id, lessonId: lesson.id, status: 1 })
    }
    setMockUser(user.id)
    const res = await server.inject({
      method: 'GET',
      url: '/api/study/records?page=1&pageSize=2',
    })
    const body = res.json()
    expect(body.data.list).toHaveLength(2)
    expect(body.data.total).toBe(5)
    expect(body.data.pageSize).toBe(2)
  })

  // =====================================================================
  // 2. GET /api/study/records/:id — 单条详情 + IDOR
  // =====================================================================

  it('GET /api/study/records/:id — 存在返回 200 + 业务字段', async () => {
    const user = await createUser('1001', '用户')
    const lesson = await createLesson({ title: 'TS 课程' })
    const [signup] = await db
      .insert(lessonSignUps)
      .values({ userId: user.id, lessonId: lesson.id, progress: 50, status: 1 })
      .returning()

    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: `/api/study/records/${signup.id}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.record.id).toBe(signup.id)
    expect(body.data.record.userId).toBe(user.id)
    expect(body.data.record.lessonId).toBe(lesson.id)
    expect(body.data.record.progress).toBe(50)
  })

  it('GET /api/study/records/:id — 不存在返回 404', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({
      method: 'GET',
      url: '/api/study/records/00000000-0000-0000-0000-000000000000',
    })
    expect(res.statusCode).toBe(404)
    const body = res.json()
    expect(body.code).toBe(404)
    expect(body.message).toBe('学习记录不存在')
  })

  it('GET /api/study/records/:id — 他人记录 IDOR 防护返回 404', async () => {
    const userA = await createUser('1001', '用户A')
    const userB = await createUser('1002', '用户B')
    const lesson = await createLesson({ title: '课程' })
    const [signupA] = await db
      .insert(lessonSignUps)
      .values({ userId: userA.id, lessonId: lesson.id, status: 1 })
      .returning()

    setMockUser(userB.id)
    const res = await server.inject({ method: 'GET', url: `/api/study/records/${signupA.id}` })
    expect(res.statusCode).toBe(404)
  })

  // =====================================================================
  // 3. POST /api/study/records — 幂等报名
  // =====================================================================

  it('POST /api/study/records — 首次报名返回 201 + 业务字段', async () => {
    const user = await createUser('1001', '用户')
    const lesson = await createLesson({ title: '新课程' })
    setMockUser(user.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/study/records',
      body: { lessonId: lesson.id, duration: 600, progress: 0 },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.record.userId).toBe(user.id)
    expect(body.data.record.lessonId).toBe(lesson.id)
    expect(body.data.record.progress).toBe(0)
    expect(body.data.record.status).toBe('in_progress')

    const all = await db.select().from(lessonSignUps).where(eq(lessonSignUps.userId, user.id))
    expect(all).toHaveLength(1)
  })

  it('POST /api/study/records — 重复报名幂等(不重复插入)', async () => {
    const user = await createUser('1001', '用户')
    const lesson = await createLesson({ title: '幂等课程' })
    setMockUser(user.id)
    await server.inject({
      method: 'POST',
      url: '/api/study/records',
      body: { lessonId: lesson.id, progress: 10 },
    })
    const res = await server.inject({
      method: 'POST',
      url: '/api/study/records',
      body: { lessonId: lesson.id, progress: 20 },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    // 第二次报名 progress 应保留第一次(因为 signUpLesson 幂等后 updateProgress 才生效)
    // 实际上 signUpLesson 不更新 progress,updateProgress 才更新;两次都跑完了
    // 但 signUpLesson onConflictDoNothing,不会插入新行
    const all = await db.select().from(lessonSignUps).where(eq(lessonSignUps.userId, user.id))
    expect(all).toHaveLength(1)
    expect(body.data.record.progress).toBe(20)
  })

  it('POST /api/study/records — 缺 lessonId/courseId 返回 400', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/study/records',
      body: { progress: 50 },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.code).toBe(400)
    expect(body.message).toBe('缺少 lessonId/courseId')
  })

  it('POST /api/study/records — courseId 作为 lessonId 兜底', async () => {
    const user = await createUser('1001', '用户')
    const lesson = await createLesson({ title: '兜底课程' })
    setMockUser(user.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/study/records',
      body: { courseId: lesson.id, progress: 0 },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.data.record.lessonId).toBe(lesson.id)
  })

  // =====================================================================
  // 4. PUT /api/study/records/:id — 更新 progress / status
  // =====================================================================

  it('PUT /api/study/records/:id — 更新 progress 成功', async () => {
    const user = await createUser('1001', '用户')
    const lesson = await createLesson({ title: '更新课程' })
    const [signup] = await db
      .insert(lessonSignUps)
      .values({ userId: user.id, lessonId: lesson.id, progress: 0, status: 1 })
      .returning()

    setMockUser(user.id)
    const res = await server.inject({
      method: 'PUT',
      url: `/api/study/records/${signup.id}`,
      body: { progress: 75 },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.record.progress).toBe(75)
    expect(body.data.record.status).toBe('in_progress')

    const [updated] = await db.select().from(lessonSignUps).where(eq(lessonSignUps.id, signup.id))
    expect(updated.progress).toBe(75)
  })

  it('PUT /api/study/records/:id — progress=100 自动标记 completed', async () => {
    const user = await createUser('1001', '用户')
    const lesson = await createLesson({ title: '完成课程' })
    const [signup] = await db
      .insert(lessonSignUps)
      .values({ userId: user.id, lessonId: lesson.id, progress: 50, status: 1 })
      .returning()

    setMockUser(user.id)
    const res = await server.inject({
      method: 'PUT',
      url: `/api/study/records/${signup.id}`,
      body: { progress: 100 },
    })
    const body = res.json()
    expect(body.data.record.status).toBe('completed')
  })

  it('PUT /api/study/records/:id — 不存在返回 404', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({
      method: 'PUT',
      url: '/api/study/records/00000000-0000-0000-0000-000000000000',
      body: { progress: 50 },
    })
    expect(res.statusCode).toBe(404)
  })

  it('PUT /api/study/records/:id — status 枚举值 accepted', async () => {
    const user = await createUser('1001', '用户')
    const lesson = await createLesson({ title: '状态课程' })
    const [signup] = await db
      .insert(lessonSignUps)
      .values({ userId: user.id, lessonId: lesson.id, progress: 0, status: 1 })
      .returning()

    setMockUser(user.id)
    for (const status of ['in_progress', 'completed', 'paused'] as const) {
      const res = await server.inject({
        method: 'PUT',
        url: `/api/study/records/${signup.id}`,
        body: { status },
      })
      expect(res.statusCode).toBe(200)
    }
  })

  // =====================================================================
  // 5. GET /api/study/progress — 平均进度
  // =====================================================================

  it('GET /api/study/progress — 无记录返回 progress=0 + totalCourses=0', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/study/progress' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.progress).toBe(0)
    expect(body.data.totalCourses).toBe(0)
    expect(body.data.completedCourses).toBe(0)
  })

  it('GET /api/study/progress — 多课平均 progress 四舍五入', async () => {
    const user = await createUser('1001', '用户')
    const lesson1 = await createLesson({ title: '课1' })
    const lesson2 = await createLesson({ title: '课2' })
    const lesson3 = await createLesson({ title: '课3' })
    await db.insert(lessonSignUps).values({ userId: user.id, lessonId: lesson1.id, progress: 100, status: 2 })
    await db.insert(lessonSignUps).values({ userId: user.id, lessonId: lesson2.id, progress: 50, status: 1 })
    await db.insert(lessonSignUps).values({ userId: user.id, lessonId: lesson3.id, progress: 0, status: 1 })

    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/study/progress' })
    const body = res.json()
    // (100+50+0)/3 = 50
    expect(body.data.progress).toBe(50)
    expect(body.data.totalCourses).toBe(3)
    expect(body.data.completedCourses).toBe(1)
  })

  // =====================================================================
  // 6. GET /api/study/progress/all — 全部分页
  // =====================================================================

  it('GET /api/study/progress/all — 无记录返回空 list', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/study/progress/all' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.list).toEqual([])
    expect(body.data.total).toBe(0)
  })

  it('GET /api/study/progress/all — 返回完整 list + 业务字段', async () => {
    const user = await createUser('1001', '用户')
    const cat = await createCategory('艺术')
    const lesson = await createLesson({ title: '绘画', categoryId: cat.id })
    await db.insert(lessonSignUps).values({ userId: user.id, lessonId: lesson.id, progress: 60, status: 1 })

    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/study/progress/all' })
    const body = res.json()
    expect(body.data.list).toHaveLength(1)
    expect(body.data.list[0].title).toBe('绘画')
    expect(body.data.list[0].categoryName).toBe('艺术')
    expect(body.data.list[0].progress).toBe(60)
    expect(body.data.list[0].signupStatus).toBe(1)
  })

  // =====================================================================
  // 7. GET /api/study/statistics — 总学时 / 课程数 / 连续天数
  // =====================================================================

  it('GET /api/study/statistics — 无记录返回全 0', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/study/statistics' })
    if (debugLogPath) {
      try {
        appendFileSync(debugLogPath, `[RESP] statusCode=${res.statusCode} body=${res.body}\n`)
      } catch {
        // ignore
      }
    }
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.totalDuration).toBe(0)
    expect(body.data.totalCourses).toBe(0)
    expect(body.data.completedCourses).toBe(0)
    expect(body.data.totalLessons).toBe(0)
    expect(body.data.continuousDays).toBe(0)
  })

  it('GET /api/study/statistics — totalDuration 累加章节 duration', async () => {
    const user = await createUser('1001', '用户')
    const lesson = await createLesson({ title: '时长课程' })
    const ch1 = await createChapter(lesson.id, '第1章')
    const ch2 = await createChapter(lesson.id, '第2章')
    await createSection(ch1.id, '小节1', 600)
    await createSection(ch1.id, '小节2', 300)
    await createSection(ch2.id, '小节3', 900)
    await db.insert(lessonSignUps).values({ userId: user.id, lessonId: lesson.id, status: 1 })

    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/study/statistics' })
    const body = res.json()
    expect(body.data.totalDuration).toBe(1800) // 600+300+900
    expect(body.data.totalCourses).toBe(1)
    expect(body.data.completedCourses).toBe(0)
  })

  it('GET /api/study/statistics — completedCourses 统计 status=2', async () => {
    const user = await createUser('1001', '用户')
    const l1 = await createLesson({ title: '完成' })
    const l2 = await createLesson({ title: '进行中' })
    await db.insert(lessonSignUps).values({ userId: user.id, lessonId: l1.id, status: 2 })
    await db.insert(lessonSignUps).values({ userId: user.id, lessonId: l2.id, status: 1 })

    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/study/statistics' })
    const body = res.json()
    expect(body.data.completedCourses).toBe(1)
    expect(body.data.totalCourses).toBe(2)
  })

  it('GET /api/study/statistics — status=3 退款不计入(连续天数/课程数)', async () => {
    const user = await createUser('1001', '用户')
    // 退款(status=3)课程:不算入 totalCourses 也不计入 streak
    const refundedLesson = await createLesson({ title: '退款课程' })
    await createSignUpAt(user.id, refundedLesson.id, new Date(Date.now() - 86400_000), 3)
    // 正常签到课(今天):算入 streak
    const activeLesson = await createLesson({ title: '正常课程' })
    await createSignUpAt(user.id, activeLesson.id, new Date(), 1)

    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/study/statistics' })
    const body = res.json()
    // 退款(status=3)不计入:activeCond = status != 3 → totalCourses 应为 1
    expect(body.data.totalCourses).toBe(1)
    // streak:今天有(1) + 昨天退款不算(中断),所以 streak=1
    expect(body.data.continuousDays).toBe(1)
  })

  // =====================================================================
  // P0 回归 #1:calcContinuousDays 跨日 SQL 边界
  // =====================================================================

  it('P0 #1 — 跨日连续(UTC 23:59 + UTC 00:01)streak=2', async () => {
    const user = await createUser('1001', '用户')
    // 每天用不同 lesson:lesson_sign_ups_lesson_user_unique 唯一约束
    const lessonA = await createLesson({ title: '跨日课程A' })
    const lessonB = await createLesson({ title: '跨日课程B' })
    const today = new Date()
    const yyyy = today.getUTCFullYear()
    const mm = String(today.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(today.getUTCDate()).padStart(2, '0')
    // 昨天 23:59 UTC
    const yesterday = new Date(`${yyyy}-${mm}-${dd}T23:59:00Z`)
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    // 今天 00:01 UTC
    const todayEarly = new Date(`${yyyy}-${mm}-${dd}T00:01:00Z`)

    await createSignUpAt(user.id, lessonA.id, yesterday, 1)
    await createSignUpAt(user.id, lessonB.id, todayEarly, 1)

    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/study/statistics' })
    const body = res.json()
    expect(body.data.continuousDays).toBe(2)
  })

  it('P0 #1 — 隔日 24h+1min(UTC)不连续 streak=1', async () => {
    const user = await createUser('1001', '用户')
    // 每天用不同 lesson 避免唯一约束
    const lessonA = await createLesson({ title: '不连续A' })
    const lessonB = await createLesson({ title: '不连续B' })
    // P0 验证:D-2 23:59 UTC 签到后,跳过 D-1(无任何签到),D-0 00:01 UTC 再签到
    // → 中间跨日缺一天,streak 终止,只算 D-0 一天(连续 1)
    // 上一版测试误把 D-1 00:00 也插了一条 → 实际三连签到 streak=3,与"不连续"语义矛盾
    const twoDaysAgoLate = new Date(Date.now() - 2 * 86400_000)
    twoDaysAgoLate.setUTCHours(23, 59, 0, 0)
    const todayEarly = new Date()
    todayEarly.setUTCHours(0, 1, 0, 0) // 今天 00:01 UTC

    await createSignUpAt(user.id, lessonA.id, twoDaysAgoLate, 1)
    // 故意跳过 D-1(昨天),不插任何记录
    await createSignUpAt(user.id, lessonB.id, todayEarly, 1)

    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/study/statistics' })
    const body = res.json()
    // streak:D-0 有(1) + D-1 没有(中断),终止 → streak=1
    expect(body.data.continuousDays).toBe(1)
  })

  // =====================================================================
  // P0 回归 #2:时区错位(用户视角 +08:00 vs DB UTC)
  // =====================================================================

  it('P0 #2 — 跨时区(用户 +08:00 视角)streak 不被错算', async () => {
    const user = await createUser('1001', '用户')
    // 每天不同 lesson
    const lessonA = await createLesson({ title: '时区课程A' })
    const lessonB = await createLesson({ title: '时区课程B' })
    // 用户视角:今天 00:30(+08:00) ≈ 昨天 16:30 UTC
    // 这条 createdAt 落在"昨天"的 UTC 日期,但客户端认为是"今天"
    // 修复后:SQL 用 DATE(createdAt) UTC,与 today(UTC)比较;用户视角错位不影响 streak
    const today = new Date()
    const yyyy = today.getUTCFullYear()
    const mm = String(today.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(today.getUTCDate()).padStart(2, '0')
    // 客户端认为是"今天 +08:00 00:30",对应 UTC "昨天 16:30"
    const userTodayAsUtcYesterday = new Date(`${yyyy}-${mm}-${dd}T16:30:00Z`)
    userTodayAsUtcYesterday.setUTCDate(userTodayAsUtcYesterday.getUTCDate() - 1)
    await createSignUpAt(user.id, lessonA.id, userTodayAsUtcYesterday, 1)

    // 同时在"今天 UTC"再加一条,确保 streak 至少为 1
    const todayMid = new Date()
    todayMid.setUTCHours(12, 0, 0, 0)
    await createSignUpAt(user.id, lessonB.id, todayMid, 1)

    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/study/statistics' })
    const body = res.json()
    // streak:今天 UTC(1) + 昨天 UTC(2)
    // P0 修复目标:即使客户端时区 +08:00 把"昨天 16:30 UTC"误判为"今天",streak 仍按 UTC 计算正确
    expect(body.data.continuousDays).toBe(2)
  })

  it('P0 #2 — 连续 3 天(D-2/D-1/D-0 UTC)streak=3', async () => {
    const user = await createUser('1001', '用户')
    for (let i = 0; i < 3; i++) {
      const d = new Date()
      d.setUTCDate(d.getUTCDate() - i)
      d.setUTCHours(10, 0, 0, 0)
      // 每天用不同 lesson 避免唯一约束
      const lesson = await createLesson({ title: `3 连续课程${i}` })
      await createSignUpAt(user.id, lesson.id, d, 1)
    }

    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/study/statistics' })
    const body = res.json()
    expect(body.data.continuousDays).toBe(3)
  })

  // =====================================================================
  // P0 回归 #3:幂等冲突(同 userId+lessonId 多次报名)
  // =====================================================================

  it('P0 #3 — 同 lesson 多次 POST 不重复插入(幂等)', async () => {
    const user = await createUser('1001', '用户')
    const lesson = await createLesson({ title: '幂等测试' })
    setMockUser(user.id)
    // 0..100 步进 20:0,20,40,60,80,100 → 最后一次为 100 应触发 completed
    for (let i = 0; i <= 5; i++) {
      const res = await server.inject({
        method: 'POST',
        url: '/api/study/records',
        body: { lessonId: lesson.id, progress: i * 20 },
      })
      expect(res.statusCode).toBe(201)
    }
    const all = await db.select().from(lessonSignUps).where(eq(lessonSignUps.userId, user.id))
    expect(all).toHaveLength(1) // 唯一约束:同 user+lesson 只有 1 条
    // 最后一次 progress 100 应为 completed
    const [final] = all
    expect(final.progress).toBe(100)
    expect(final.status).toBe(2)
  })

  it('P0 #3 — 同日多次签到/报名,DB 唯一约束触发 onConflictDoNothing', async () => {
    const user = await createUser('1001', '用户')
    const lesson = await createLesson({ title: '同日幂等' })
    setMockUser(user.id)
    const res1 = await server.inject({
      method: 'POST',
      url: '/api/study/records',
      body: { lessonId: lesson.id, progress: 0 },
    })
    const res2 = await server.inject({
      method: 'POST',
      url: '/api/study/records',
      body: { lessonId: lesson.id, progress: 50 },
    })
    expect(res1.statusCode).toBe(201)
    expect(res2.statusCode).toBe(201)
    // DB 应只有 1 条
    const all = await db.select().from(lessonSignUps).where(eq(lessonSignUps.userId, user.id))
    expect(all).toHaveLength(1)
  })

  // =====================================================================
  // 响应格式校验
  // =====================================================================

  it('响应格式符合 { code, message, data } 规范', async () => {
    const user = await createUser('1001', '格式校验')
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/study/progress' })
    const body = res.json()
    expect(body).toHaveProperty('code')
    expect(body).toHaveProperty('message')
    expect(body).toHaveProperty('data')
    expect(body.code).toBe(0)
    expect(body.message).toBe('success')
  })
})
