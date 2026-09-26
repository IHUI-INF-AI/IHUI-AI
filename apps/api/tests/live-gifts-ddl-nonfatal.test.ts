// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 钉住 2026-09-26 07:58 线上哑火的修复:
// apps/api/src/routes/live-gifts.ts 在**注册期**执行幂等建表 DDL,该查询在 PG 崩溃
// 恢复窗口抛 PostgresError("the database system is starting up"),而注册期抛错 =
// avvio boot 失败 = server.listen() 永不 bind,进程却被 unhandledRejection 处理器
// 留下 → 46 分钟里 `sc query` 显示 RUNNING、8802 无人监听、面板上一切"正常"。
// 本文件的三条判据互相咬合:
//   ① 阳性对照:注册期抛错**确实**能打掉 bind(否则后两例的绿是空断言);
//   ② 失败路径:不冒到进程级 + listen 照常 bind + warn 如实留痕;
//   ③ 成功路径:建表 SQL 仍被发出(修法不是"把建表删掉",AGENTS §7)。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const { mockExecute, mockSelectResult } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
  mockSelectResult: vi.fn(),
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:8810/test',
    REDIS_URL: 'redis://localhost:8811',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-token'),
  verifyAccessToken: vi.fn().mockResolvedValue({ userId: 'u1', roleId: 1, type: 'access' }),
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-4000-8000-000000000002'),
}))

vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))

vi.mock('jose', () => ({
  decodeJwt: vi.fn(() => ({ type: 'access' })),
}))

vi.mock('../src/db/index.js', () => {
  const make = (): unknown => {
    const thenFn = (resolve: (v: unknown) => void) => mockSelectResult().then(resolve)
    return new Proxy({} as Record<string, unknown>, {
      get(_target, prop: string) {
        if (prop === 'then') return thenFn
        return vi.fn(() => make())
      },
    })
  }

  const dbMock = {
    select: vi.fn(() => make()),
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })) })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })) })),
    })),
    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
    execute: mockExecute,
    transaction: vi.fn(async (cb: (tx: Record<string, unknown>) => Promise<unknown>) =>
      cb({ select: dbMock.select, insert: dbMock.insert, execute: mockExecute }),
    ),
  }
  return { db: dbMock, dbRead: dbMock, dbClient: {} }
})

// vi.mock 由 vitest 提升到所有 import 之上,因此这里可以按常规静态导入
import { liveGiftsRoutes } from '../src/routes/live-gifts.js'

/** PG 崩溃恢复窗口返回的那个错误(线上日志里的原话)。 */
function pgStartingUp(): Error {
  return new Error(
    'Failed query: CREATE TABLE IF NOT EXISTS live_gift_catalog … params: : the database system is starting up',
  )
}

/** 建一个把 server.log 收进数组的 app(留痕必须可断言,不是"应该会有日志")。 */
function makeApp(): { app: FastifyInstance; logLines: string[] } {
  const logLines: string[] = []
  const app = Fastify({
    logger: {
      level: 'warn',
      stream: { write: (chunk: string) => void logLines.push(chunk) },
    },
  })
  return { app, logLines }
}

/** 把 drizzle sql 模板还原成文本,便于断言建表语句真被发出。 */
function sqlText(sqlObj: unknown): string {
  const obj = sqlObj as { queryChunks?: unknown[] }
  if (!Array.isArray(obj?.queryChunks)) return String(sqlObj)
  return obj.queryChunks
    .map((chunk) => {
      if (typeof chunk === 'string') return chunk
      const withValue = chunk as { value?: unknown[] }
      if (Array.isArray(withValue.value)) {
        return withValue.value.map((v) => (typeof v === 'string' ? v : '?')).join('')
      }
      return '?'
    })
    .join('')
}

describe('live-gifts 注册期建表 DDL 不得打断 listen(2026-09-26 哑火收口)', () => {
  let rejections: unknown[] = []
  let onRejection: (reason: unknown) => void

  beforeEach(() => {
    mockSelectResult.mockReset()
    mockExecute.mockReset()
    mockSelectResult.mockResolvedValue([])
    mockExecute.mockResolvedValue([])
    rejections = []
    onRejection = (reason: unknown) => void rejections.push(reason)
    process.on('unhandledRejection', onRejection)
  })

  afterEach(() => {
    process.off('unhandledRejection', onRejection)
  })

  it('①阳性对照:注册期抛错确实会让 bind 失败(所以②的绿不是空断言)', async () => {
    const { app } = makeApp()
    app.register(
      async () => {
        throw new Error('registration-time-boom')
      },
      { prefix: '/api' },
    )
    app.get('/health', async () => ({ status: 'ok' }))

    try {
      // 修复前 liveGiftsRoutes 就是这个形态:错误冒到 avvio,listen 直接拒绝。
      await expect(app.listen({ port: 0, host: '127.0.0.1' })).rejects.toThrow(
        'registration-time-boom',
      )
    } finally {
      await app.close()
    }
  })

  it('②DDL 抛错时:不冒到进程级、listen 照常 bind、warn 如实留痕、路由仍可用', async () => {
    mockExecute.mockRejectedValueOnce(pgStartingUp())
    const { app, logLines } = makeApp()
    let addr = ''

    try {
      await app.register(liveGiftsRoutes, { prefix: '/api' })
      addr = await app.listen({ port: 0, host: '127.0.0.1' })
      // 逃逸的异步错误要有机会被 Node 报出来,再断言"没有"才有意义
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(addr).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
      expect(rejections).toEqual([])

      // 留痕:必须点名是哪张表的兜底建表失败,并带上原始错误
      const logged = logLines.join('')
      expect(logged).toContain('live_gift_catalog')
      expect(logged).toContain('the database system is starting up')

      // 路由仍注册可用(不是把这段路由整块摘掉)
      const res = await fetch(`${addr}/api/live-gifts?page=1&pageSize=20`)
      expect(res.status).toBe(200)
    } finally {
      if (addr) await app.close()
    }
  })

  it('③成功路径:建表 SQL 仍被原样发出,且不多打日志(意图未被删)', async () => {
    const { app, logLines } = makeApp()

    try {
      await app.register(liveGiftsRoutes, { prefix: '/api' })
      await app.ready()

      expect(mockExecute).toHaveBeenCalledTimes(1)
      expect(sqlText(mockExecute.mock.calls[0]?.[0])).toContain(
        'CREATE TABLE IF NOT EXISTS live_gift_catalog',
      )
      expect(logLines).toEqual([])
    } finally {
      await app.close()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
