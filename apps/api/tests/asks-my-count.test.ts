// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * GET /api/asks/my/count 与 GET /api/asks/my/answers/count 形状锁
 * (守门 8 裸路径 BP 腿死调用补注册;消费方 = packages/api-client endpoints/community.ts:207,211)。
 *
 * 钉住三件事:
 *  ① data 就是一个数字(对齐 api-client 的 ApiResult<number>,不套 {count} 二层壳);
 *  ② 归属只由 request.userId(JWT 主体)服务端推导:条件参数里出现的是钩子注入的主体,
 *     客户端在 query/body 里自报的 userId 一个都不进 SQL(§5 认证不等于授权);
 *  ③ 可见集口径 = status=1,且数的是对表(asks / ask_answers 自己的 user_id 列)
 *     ——与 findAsks / findAskAnswers 的在册读档一致;回答是软删除(status=-1)⇒ 不过滤会把
 *     已删的回答算进计数。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { asks, askAnswers } from '@ihui/database'

const AUTH_USER_ID = '33333333-3333-4333-8333-333333333333'
const VICTIM_USER_ID = '44444444-4444-4444-8444-444444444444'

const { mockVerifyAccessToken, mockCountRows, chainLog } = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  mockCountRows: vi.fn(),
  chainLog: [] as Array<Record<string, unknown>>,
}))

vi.mock('jose', () => ({ decodeJwt: () => ({}) }))
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}))

vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  verifyAccessToken: mockVerifyAccessToken,
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-4000-8000-000000000002'),
}))

vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))

vi.mock('../src/db/sensitive-words-queries.js', () => ({
  sanitizeUgcInput: vi.fn().mockResolvedValue({ ok: true, fields: { content: { text: '' } } }),
}))

vi.mock('../src/db/community-queries.js', () => ({
  acceptAnswer: vi.fn(),
  createAnswer: vi.fn(),
  createAsk: vi.fn(),
  deleteAsk: vi.fn(),
  deleteCircle: vi.fn(),
  findAskAnswers: vi.fn().mockResolvedValue({ list: [], total: 0 }),
  findAskById: vi.fn().mockResolvedValue(undefined),
  findAsks: vi.fn().mockResolvedValue({ list: [], total: 0 }),
  findCircleById: vi.fn().mockResolvedValue(undefined),
  findPostById: vi.fn(),
  updateAsk: vi.fn(),
  updateCircleShowStatus: vi.fn(),
}))

/**
 * select→from→where 记录器:from 的表对象与 where 的条件对象留给断言,
 * await 出来的是现读的计数行。零真实连接(§5 测试隔离:测试一律禁止连生产库)。
 */
vi.mock('../src/db/index.js', () => {
  const make = (sink: Record<string, unknown>): Record<string, unknown> => ({
    from: (table: unknown) => {
      sink.table = table
      return make(sink)
    },
    where: (cond: unknown) => {
      sink.cond = cond
      chainLog.push(sink)
      return {
        then: (res: (v: unknown) => void) => Promise.resolve(mockCountRows()).then(res),
      }
    },
    orderBy: () => make(sink),
    limit: () => make(sink),
    offset: () => make(sink),
  })
  return {
    db: {
      select: () => make({}),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      execute: vi.fn().mockResolvedValue([]),
    },
    dbRead: { select: () => make({}) },
    dbClient: {},
  }
})

import asksRoutes from '../src/routes/community/asks.js'

const USER_TOKEN = 'Bearer user-token'
let app: FastifyInstance

beforeAll(async () => {
  app = Fastify()
  await app.register(asksRoutes, { prefix: '/api' })
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  chainLog.length = 0
  mockVerifyAccessToken.mockResolvedValue({
    userId: AUTH_USER_ID,
    phone: '13800000002',
    familyId: '00000000-0000-4000-8000-000000000003',
    roleId: 0,
  })
  mockCountRows.mockResolvedValue([{ count: '12' }])
})

/**
 * drizzle 的 SQL 对象没有可裸调的 toString/toQuery(toQuery 需驱动上下文,chat-pinned.test.ts
 * 同注),但 queryChunks 递归里带着列元数据(name = SQL 列名)与 Param(value = 绑定值)。
 * 按此把条件还原成 {columns, params} 供断言 —— 还原的是路由真发出去的条件,不是测试另造一份。
 */
function describeCondition(
  node: unknown,
  seen = new Set<unknown>(),
): { columns: string[]; params: unknown[] } {
  const acc = { columns: [] as string[], params: [] as unknown[] }
  const walk = (n: unknown): void => {
    if (!n || typeof n !== 'object' || seen.has(n)) return
    seen.add(n)
    const o = n as Record<string, unknown>
    if (typeof o.name === 'string' && typeof o.getSQL === 'function') acc.columns.push(o.name)
    if (o.constructor?.name === 'Param') acc.params.push(o.value)
    if (Array.isArray(o.queryChunks)) {
      for (const q of o.queryChunks) walk(typeof q === 'function' ? (q as () => unknown)() : q)
    }
  }
  walk(node)
  return acc
}

function lastQuery(): { table: unknown; columns: string[]; params: unknown[] } {
  const sink = chainLog[chainLog.length - 1]
  expect(sink, '没有捕获到任何查询(未登录/校验失败才该这样)').toBeTruthy()
  const { columns, params } = describeCondition(sink!.cond)
  return { table: sink!.table, columns, params }
}

describe('GET /api/asks/my/count', () => {
  it('data 直接是数字(不套二层壳),信封 = {code,message,data}', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/asks/my/count',
      headers: { authorization: USER_TOKEN },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().code).toBe(0)
    expect(res.json().message).toBe('success')
    expect(res.json().data).toBe(12)
  })

  it('数的是 asks 表,条件列 = user_id + status,参数 = [JWT 主体, 1]', async () => {
    await app.inject({
      method: 'GET',
      url: '/api/asks/my/count',
      headers: { authorization: USER_TOKEN },
    })
    const q = lastQuery()
    expect(q.table).toBe(asks)
    expect(q.columns).toEqual(['user_id', 'status'])
    expect(q.params).toEqual([AUTH_USER_ID, 1])
  })

  it('客户端自报 userId 无效:query 里的身份不进 SQL', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/asks/my/count?userId=${VICTIM_USER_ID}&user_id=${VICTIM_USER_ID}`,
      headers: { authorization: USER_TOKEN },
    })
    expect(res.statusCode).toBe(200)
    const q = lastQuery()
    expect(q.params).toEqual([AUTH_USER_ID, 1])
    expect(JSON.stringify(q.params)).not.toContain(VICTIM_USER_ID)
  })

  it('零行时如实给 0,不给 undefined/null', async () => {
    mockCountRows.mockResolvedValue([])
    const res = await app.inject({
      method: 'GET',
      url: '/api/asks/my/count',
      headers: { authorization: USER_TOKEN },
    })
    expect(res.json().data).toBe(0)
  })

  it('未登录 ⇒ 401 且零查询', async () => {
    mockVerifyAccessToken.mockRejectedValue(new Error('invalid token'))
    const res = await app.inject({ method: 'GET', url: '/api/asks/my/count' })
    expect(res.statusCode).toBe(401)
    expect(chainLog.length).toBe(0)
  })
})

describe('GET /api/asks/my/answers/count', () => {
  it('data 直接是数字;计数走 ask_answers 自己的 user_id 列(不是 asks 的)', async () => {
    mockCountRows.mockResolvedValue([{ count: '5' }])
    const res = await app.inject({
      method: 'GET',
      url: '/api/asks/my/answers/count',
      headers: { authorization: USER_TOKEN },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toBe(5)
    const q = lastQuery()
    expect(q.table).toBe(askAnswers)
    expect(q.columns).toEqual(['user_id', 'status'])
    expect(q.params).toEqual([AUTH_USER_ID, 1])
  })

  it('自报身份无效 + 未登录零查询(与问题计数同一套纪律)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/asks/my/answers/count?userId=${VICTIM_USER_ID}`,
      headers: { authorization: USER_TOKEN },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.stringify(lastQuery().params)).not.toContain(VICTIM_USER_ID)
    chainLog.length = 0
    mockVerifyAccessToken.mockRejectedValue(new Error('invalid token'))
    const anon = await app.inject({ method: 'GET', url: '/api/asks/my/answers/count' })
    expect(anon.statusCode).toBe(401)
    expect(chainLog.length).toBe(0)
  })
})

describe('在册形状对账(前缀合成 + 消费方契约)', () => {
  const HERE = dirname(fileURLToPath(import.meta.url))
  const apiRoot = resolve(HERE, '..')
  const REPO_ROOT = resolve(HERE, '../../..')

  it('路由字面量 + 注册 prefix 合成后逐字等于 api-client 两条发布面调用点', () => {
    const routeSrc = readFileSync(join(apiRoot, 'src/routes/community/asks.ts'), 'utf8')
    const inner = new Set(
      [...routeSrc.matchAll(/server\.get\(\s*'([^']*)'/gu)].map((m) => `/api${m[1]}`),
    )
    const clientSrc = readFileSync(
      join(apiRoot, '../../packages/api-client/src/endpoints/community.ts'),
      'utf8',
    )
    const clientCalls = [...clientSrc.matchAll(/fetchApi<number>\(\s*'([^']+)'/gu)].map((m) => m[1])
    expect(clientCalls).toEqual(['/asks/my/count', '/asks/my/answers/count'])
    for (const p of clientCalls) {
      expect(inner.has(`/api${p}`), `/api${p} 未在册`).toBe(true)
    }
  })

  it('双向对照:HEAD 面尚未落地时读不到、已落地时两面同形(判据不是恒真,取材读 HEAD blob)', () => {
    const headSrc = execFileSync(
      'git',
      ['-C', REPO_ROOT, 'show', 'HEAD:apps/api/src/routes/community/asks.ts'],
      {
        encoding: 'utf8',
        maxBuffer: 1 << 26,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      },
    )
    const worktreeSrc = readFileSync(join(apiRoot, 'src/routes/community/asks.ts'), 'utf8')
    expect(/server\.get\('\/asks\/my\/count'/u.test(worktreeSrc)).toBe(true)
    expect(/server\.get\('\/asks\/my\/answers\/count'/u.test(worktreeSrc)).toBe(true)
    if (headSrc === worktreeSrc) {
      expect(/server\.get\('\/asks\/my\/count'/u.test(headSrc)).toBe(true)
    } else {
      expect(/\/asks\/my\/(answers\/)?count/u.test(headSrc)).toBe(false)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
