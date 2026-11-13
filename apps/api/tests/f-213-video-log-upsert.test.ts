// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-213 回归锁(2026-11-13)。
 *
 * 病灶:`POST /api/learn/video/log` 首帧心跳只做 UPDATE:首次观看某视频时
 * `lesson_records` 无对应行 ⇒ 0 行受影响,进度/时长静默丢失,接口却返回成功。
 *
 * 本文件锁:
 *   ① 首次上报走「单条 INSERT ... ON CONFLICT (user_id, lesson_id, section_id) DO UPDATE」,
 *      首插即落库,冲突时更新,不再出现"先 SELECT 有行才 UPDATE"的两步写法;
 *   ② 重复上报同样只有 upsert 一条记录语句(没有 select / 裸 update 回潮);
 *   ③ 冲突时的 set 语义不变:只写 last_position(上报了才写)与 updated_at,
 *      不把 duration 当 watch_duration 覆盖;
 *   ④ 响应结构不变:{ code: 0, message: 'success', data: {} }。
 *
 * 零连接:db 用 drizzle pg-proxy 的真 SQL 生成器,driver 回调只记录语句并回假行,
 * 不触达真实 PG/Redis。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const LESSON_ID = '00000000-0000-4000-8000-000000000101'
const VIDEO_ID = '00000000-0000-4000-8000-000000000102'

const state = vi.hoisted(() => ({
  calls: [] as Array<{ sql: string; params: unknown[] }>,
}))

vi.mock('../src/db/index.js', async () => {
  const { drizzle } = await import('drizzle-orm/pg-proxy')
  // driver 永不连库:只采集 SQL/参数,并按 returning 的列序回一行假数据。
  const db = drizzle(async (sqlText: string, params: unknown[]) => {
    state.calls.push({ sql: sqlText, params })
    if (/insert into "lesson_records"/i.test(sqlText)) return { rows: [['f213-record-1']] }
    return { rows: [] }
  })
  return { db, dbRead: db }
})

vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: vi.fn(async (request: { userId?: string }) => {
    request.userId = '00000000-0000-4000-8000-000000000213'
    return true
  }),
  authenticate: vi.fn(),
}))

vi.mock('../src/plugins/require-permission.js', () => ({ requireAdmin: vi.fn() }))

vi.mock('../src/utils/code-store.js', () => ({ verifyCode: vi.fn(async () => true) }))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://127.0.0.1:5399/test',
    REDIS_URL: 'redis://127.0.0.1:6399',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

const { miniappCompatRoutes } = await import('../src/routes/miniapp-compat-routes.js')

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(miniappCompatRoutes, { prefix: '/api' })
  await app.ready()
  return app
}

function postVideoLog(app: FastifyInstance, payload: Record<string, unknown>) {
  return app.inject({ method: 'POST', url: '/api/learn/video/log', payload })
}

/** 只看写 lesson_records 的语句(日志表语句不影响本票结论)。 */
function recordStatements(): Array<{ sql: string; params: unknown[] }> {
  return state.calls.filter((c) => /lesson_records/i.test(c.sql))
}

describe('F-213 POST /api/learn/video/log 首帧心跳必须 upsert', () => {
  beforeEach(() => {
    state.calls.length = 0
  })

  it('首次观看(无历史记录)是单条 onConflictDoUpdate,INSERT 即落库', async () => {
    const app = await buildApp()
    const res = await postVideoLog(app, {
      lessonId: LESSON_ID,
      videoId: VIDEO_ID,
      position: 12,
      duration: 60,
      action: 'heartbeat',
    })
    await app.close()

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ code: 0, message: 'success', data: {} })

    // 一条 upsert + 一条日志;回退成"先 SELECT 再 UPDATE"会变成 3 条且首条是 select
    expect(state.calls).toHaveLength(2)
    const upsert = state.calls[0]!
    expect(upsert.sql).toMatch(/^insert into "lesson_records"/i)
    expect(upsert.sql).toMatch(/on conflict \("user_id",\s*"lesson_id",\s*"section_id"\) do update set/i)
    expect(upsert.sql).toMatch(/returning "id"/i)
    // 首次落库必须带初始进度/时长
    expect(upsert.sql).toMatch(/"last_position"/i)
    expect(upsert.params).toContain(12)
    expect(upsert.params).toContain(60)
    expect(upsert.params).toContain(VIDEO_ID)

    // 冲突时的 set 语义:只更新 last_position + updated_at,不覆盖 watch_duration
    const setClause = upsert.sql.slice(upsert.sql.search(/do update set/i))
    expect(setClause).toMatch(/"last_position" = /i)
    expect(setClause).toMatch(/"updated_at" = /i)
    expect(setClause).not.toMatch(/"watch_duration" = /i)

    // 日志表拿到的 recordId 来自 upsert 的 returning
    const logInsert = state.calls[1]!
    expect(logInsert.sql).toMatch(/^insert into "lesson_record_logs"/i)
    expect(logInsert.params).toContain('f213-record-1')
  })

  it('重复观看仍是 upsert 单语句,无 SELECT/裸 UPDATE 回潮', async () => {
    const app = await buildApp()
    await postVideoLog(app, { lessonId: LESSON_ID, videoId: VIDEO_ID, position: 30, duration: 120 })
    state.calls.length = 0
    const res = await postVideoLog(app, {
      lessonId: LESSON_ID,
      videoId: VIDEO_ID,
      position: 45,
      duration: 60,
    })
    await app.close()

    expect(res.statusCode).toBe(200)
    const records = recordStatements()
    // 只有一条 lesson_records 语句,且是 upsert;不存在"读旧行再写"的 select
    expect(records).toHaveLength(1)
    expect(records[0]!.sql).toMatch(/^insert into "lesson_records"/i)
    expect(records[0]!.sql).toMatch(
      /on conflict \("user_id",\s*"lesson_id",\s*"section_id"\) do update set/i,
    )
    expect(records[0]!.sql).not.toMatch(/^select/i)
    expect(records[0]!.params).toContain(45)
  })

  it('不带 videoId 时(section_id 为 NULL)仍能首次落库', async () => {
    const app = await buildApp()
    const res = await postVideoLog(app, { lessonId: LESSON_ID, position: 5, duration: 20 })
    await app.close()

    expect(res.statusCode).toBe(200)
    const records = recordStatements()
    // NULL 不参与唯一索引冲突判定,保持"先查后写",但首帧必须插入
    expect(records.some((c) => /^insert into "lesson_records"/i.test(c.sql))).toBe(true)
    expect(records.every((c) => !/^update "lesson_records"/i.test(c.sql))).toBe(true)
  })
})
