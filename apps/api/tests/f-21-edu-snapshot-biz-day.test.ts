// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-21 回归:排名快照 edu_ranking_snapshot.snapshot_date 必须写上海业务日。
 *
 * 原缺陷:POST /exam-score/snapshot 用 `new Date().toISOString().split('T')[0]`
 * 写 snapshot_date(上海业务日列),上海 00:00–08:00 生成的快照会落到 UTC 的前一天,
 * 与 edu-ledger / 考勤用的 bizDayKey() 口径分叉。
 *
 * 不连库(§5 测试隔离):db 层用脚本化链式桩,权限守卫整桩替身,HTTP 面走真路由 inject。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { bizDayKey } from '../src/utils/biz-day.js'

const CLASS_ID = 'aaaaaaaa-4111-8111-8111-111111111111'
const STUDENT_A = 'bbbbbbbb-4222-8222-8222-222222222222'
const STUDENT_B = 'cccccccc-4333-8333-8333-333333333333'
const PREFIX = '/api/edu-ai-management'

const H = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
  insertValues: [] as unknown[],
}))

vi.mock('../src/db/index.js', () => {
  const makeChain = (rows: unknown[]) => {
    const step: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'groupBy', 'orderBy', 'limit', 'offset']) {
      step[m] = vi.fn(() => step)
    }
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(rows).then(resolve, reject)
    return step
  }
  const dbMock = {
    select: vi.fn(() => makeChain(H.selectQueue.shift() ?? [])),
    insert: vi.fn(() => ({
      values: vi.fn((values: unknown) => {
        H.insertValues.push(values)
        return Promise.resolve([])
      }),
    })),
    update: vi.fn(() => makeChain([])),
    delete: vi.fn(() => makeChain([])),
    execute: vi.fn().mockResolvedValue([]),
    transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(dbMock)),
  }
  return { db: dbMock, dbRead: dbMock }
})

vi.mock('../src/plugins/require-permission.js', () => ({
  requirePermission: () => async () => {},
  requireAnyPermission: () => async () => {},
  requireAdmin: async () => {},
}))

vi.mock('../src/plugins/auth.js', () => ({
  checkAuthOrInternalService: vi.fn(async () => ({ valid: true, userId: STUDENT_A })),
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  setFastify: vi.fn(),
  serializeErrorFields: vi.fn((m: unknown) => m),
}))

vi.mock('../src/db/notification-queries.js', () => ({
  createNotification: vi.fn(async () => ({})),
}))

vi.mock('../src/services/wechat-subscribe-message.js', () => ({
  isSubscribeMessageConfigured: vi.fn(() => false),
  getWechatMiniOpenId: vi.fn(async () => null),
  buildFeeReminderData: vi.fn(() => ({})),
  sendSubscribeMessage: vi.fn(async () => ({ ok: true })),
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:8810/forbidden-in-mock-tests',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
    TBOX_WEBHOOK_SECRET: 'test-secret',
  },
}))

import eduAiManagementRoutes from '../src/routes/edu-ai-management.js'

let app: FastifyInstance

async function buildApp(): Promise<FastifyInstance> {
  const instance = Fastify({ logger: false })
  await instance.register(eduAiManagementRoutes, { prefix: PREFIX })
  await instance.ready()
  return instance
}

/** 聚合查询返回两行,让快照写入两行。 */
function stageRankingRows(): void {
  H.selectQueue.push([
    { studentId: STUDENT_A, totalScore: '180' },
    { studentId: STUDENT_B, totalScore: '160' },
  ])
}

async function createSnapshot(): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  const res = await app.inject({
    method: 'POST',
    url: `${PREFIX}/exam-score/snapshot`,
    payload: { classId: CLASS_ID, examName: '期中考试' },
  })
  return { statusCode: res.statusCode, body: res.json() as Record<string, unknown> }
}

function insertedRows(): Record<string, unknown>[] {
  const last = H.insertValues.at(-1)
  return Array.isArray(last) ? (last as Record<string, unknown>[]) : []
}

beforeEach(async () => {
  H.selectQueue.length = 0
  H.insertValues.length = 0
  app = await buildApp()
})

afterEach(async () => {
  vi.useRealTimers()
  await app.close()
})

describe('bizDayKey 上海日界边界', () => {
  it('上海 00:30(UTC 前一日 16:30)落上海当天 2026-11-11', () => {
    expect(bizDayKey(new Date('2026-11-10T16:30:00.000Z'))).toBe('2026-11-11')
  })

  it('上海 23:30(UTC 同日 15:30)仍落上海当天 2026-11-11', () => {
    expect(bizDayKey(new Date('2026-11-11T15:30:00.000Z'))).toBe('2026-11-11')
  })
})

describe('排名快照写上海业务日', () => {
  it('上海 00:30 生成快照 ⇒ snapshot_date = 2026-11-11(不是 UTC 的 2026-11-10)', async () => {
    // 只伪造 Date,不伪造定时器 —— inject 的流式调度依赖真实定时器
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-10T16:30:00.000Z'))
    stageRankingRows()

    const res = await createSnapshot()

    expect(res.statusCode).toBe(201)
    expect(res.body).toMatchObject({ code: 0, data: { count: 2 } })
    const rows = insertedRows()
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(row.snapshotDate).toBe('2026-11-11')
      expect(row.classId).toBe(CLASS_ID)
      expect(row.examName).toBe('期中考试')
    }
  })

  it('上海 23:30 生成快照 ⇒ snapshot_date 仍 = 2026-11-11', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-11T15:30:00.000Z'))
    stageRankingRows()

    const res = await createSnapshot()

    expect(res.statusCode).toBe(201)
    expect(res.body).toMatchObject({ code: 0, data: { count: 2 } })
    for (const row of insertedRows()) {
      expect(row.snapshotDate).toBe('2026-11-11')
    }
  })
})

describe('edu-ai-management 快照路由源码形状', () => {
  const source = readFileSync(
    fileURLToPath(new URL('../src/routes/edu-ai-management.ts', import.meta.url)),
    'utf8',
  )
  // 文件他处仍有UTC日键(餐食/周区间等),本票只锁快照 handler 这一段
  const block = source.slice(
    source.indexOf('// 创建排名快照'),
    source.indexOf('// 13. 教师时间表'),
  )

  it('快照 handler 段已摘取(锚点在盘上)', () => {
    expect(block.length).toBeGreaterThan(0)
    expect(block).toContain("server.post('/exam-score/snapshot'")
  })

  it('不再用 UTC 日键写 snapshot_date', () => {
    const code = block.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(code).not.toMatch(/toISOString\(\)\s*\.\s*split\(\s*'T'\s*\)/)
    expect(code).not.toMatch(/toISOString\(\)\s*\.\s*slice\(\s*0\s*,\s*10\s*\)/)
  })

  it('复用 utils/biz-day 的唯一出口 bizDayKey()', () => {
    expect(source).toMatch(/import\s*\{\s*bizDayKey\s*\}\s*from\s*'\.\.\/utils\/biz-day\.js'/)
    expect(block).toMatch(/const snapshotDate = bizDayKey\(\)/)
    expect(block).toMatch(/snapshotDate,/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
