// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const USER_A = 'user-a'
const HISTORY_LIMIT = 100

interface EqNode {
  kind: 'eq'
  column: string | undefined
  value: unknown
}
interface AndNode {
  kind: 'and'
  args: unknown[]
}

const captured = vi.hoisted(() => ({
  where: undefined as unknown,
  limit: undefined as number | undefined,
}))

const dbChain = vi.hoisted(() => {
  const chain = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    where: vi.fn((predicate: unknown) => {
      captured.where = predicate
      return chain
    }),
    orderBy: vi.fn(() => chain),
    limit: vi.fn((value: number) => {
      captured.limit = value
      return Promise.resolve([])
    }),
  }
  return chain
})

vi.mock('../../db/index.js', () => ({ db: dbChain }))
vi.mock('../../plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: { userId?: string }) => {
    request.userId = USER_A
    return { userId: USER_A }
  }),
}))
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    // 仅记录谓词形状,便于断言查询是否带 authorId 归属条件。
    eq: (column: { name?: string }, value: unknown): EqNode => ({
      kind: 'eq',
      column: column.name,
      value,
    }),
    and: (...args: unknown[]): AndNode => ({ kind: 'and', args }),
    desc: () => ({ kind: 'desc' }),
  }
})

import { selfMediaRoutes } from '../self-media-routes.js'

function hasAuthorEq(predicate: unknown, userId: string): boolean {
  if (!predicate || typeof predicate !== 'object') return false
  const node = predicate as EqNode | AndNode
  if (node.kind === 'eq') {
    return (node.column === 'authorId' || node.column === 'author_id') && node.value === userId
  }
  return node.args.some((arg) => hasAuthorEq(arg, userId))
}

describe('F-170 self-media records 越权与 limit', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(selfMediaRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    captured.where = undefined
    captured.limit = undefined
    vi.clearAllMocks()
  })

  it('查询必须带当前用户 authorId 谓词,不返回全站记录', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/self-media/records' })
    expect(res.statusCode).toBe(200)
    expect(hasAuthorEq(captured.where, USER_A)).toBe(true)
  })

  it('负数 limit 被夹到 1,不会把非法值送进 SQL', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/self-media/records?limit=-5' })
    expect(res.statusCode).toBe(200)
    expect(captured.limit).toBe(1)
  })

  it('超大 limit 被夹到 HISTORY_LIMIT', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/self-media/records?limit=9999' })
    expect(res.statusCode).toBe(200)
    expect(captured.limit).toBe(HISTORY_LIMIT)
  })
})
