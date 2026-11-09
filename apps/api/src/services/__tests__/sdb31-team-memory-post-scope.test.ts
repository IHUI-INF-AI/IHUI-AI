// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SDB-31:团队记忆创建接口(POST /api/team-memory)漏挂 scope 成员校验。
 *
 * 立因(2026-11-08 静态取证):GET 列表/详情、PUT、DELETE 均经 `isScopeMember`,
 * 唯独 POST 在 `requireLogin` 后直接 `createTeamMemory` ⇒ 任意登录用户可向别人的
 * 团队作用域(team UUID)写入记忆。
 *
 * 夹具:fastify.inject + mock db/鉴权,不连真实 PG。期望非成员 POST 团队作用域 ⇒ 404
 * 且不产生 insert;成员与自由文本作用域仍可写(防过度拦截)。
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@127.0.0.1:5399/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const authState = vi.hoisted(() => ({ fail: false, userId: 'user-1' }))

vi.mock('../../plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: { userId?: string }) => {
    if (authState.fail) throw new Error('unauthorized')
    request.userId = authState.userId
    return undefined
  }),
}))

vi.mock('@ihui/database', () => ({
  teamMemories: {
    id: 'id',
    scopeId: 'scope_id',
    kind: 'kind',
    title: 'title',
    content: 'content',
    tags: 'tags',
    sourceUserId: 'source_user_id',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  teamMembers: { id: 'id', teamId: 'team_id', userId: 'user_id' },
}))

const store = vi.hoisted(() => ({
  selectQueue: [] as Array<unknown[]>,
  insertQueue: [] as unknown[][],
  insertValues: [] as unknown[],
  reset: () => {
    store.selectQueue.length = 0
    store.insertQueue.length = 0
    store.insertValues.length = 0
  },
}))

vi.mock('../../db/index.js', () => {
  const makeSelect = () => {
    const b: Record<string, unknown> = {}
    b.from = () => b
    b.where = () => b
    b.orderBy = () => b
    b.limit = () => b
    b.then = (onF?: (v: unknown) => unknown, onR?: (e: unknown) => unknown) => {
      const queued = store.selectQueue.shift() ?? []
      return Promise.resolve(queued).then(
        onF as (v: unknown) => unknown,
        onR as (e: unknown) => unknown,
      )
    }
    return b
  }
  const dbMock = {
    select: () => makeSelect(),
    insert: () => {
      const c: Record<string, unknown> = {}
      c.values = (v: unknown) => {
        store.insertValues.push(v)
        return c
      }
      c.returning = () => Promise.resolve(store.insertQueue.shift() ?? [])
      return c
    },
    update: () => {
      const c: Record<string, unknown> = { set: () => c, where: () => c }
      c.returning = () => Promise.resolve([])
      return c
    },
    delete: () => {
      const c: Record<string, unknown> = { where: () => c }
      c.returning = () => Promise.resolve([])
      return c
    },
  }
  return { db: dbMock, dbRead: dbMock }
})

import { teamMemoryRoutes } from '../../routes/team-memory.js'

const MEMORY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const TEAM_UUID = '11111111-1111-4111-8111-111111111111'

function makeMemory(scopeId: string) {
  return {
    id: MEMORY_ID,
    scopeId,
    kind: 'decision',
    title: 't',
    content: 'c',
    tags: '',
    sourceUserId: 'user-1',
    createdAt: new Date('2026-11-08T00:00:00Z'),
    updatedAt: new Date('2026-11-08T00:00:00Z'),
  }
}

describe('SDB-31 团队记忆 POST 的 scope 成员校验', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.setErrorHandler((err, _request, reply) => {
      const e = err as Error & { statusCode?: number }
      const statusCode = e.statusCode && e.statusCode >= 400 ? e.statusCode : 500
      reply.status(statusCode).send({ code: statusCode, message: e.message || '服务器错误' })
    })
    await app.register(teamMemoryRoutes, { prefix: '/api/team-memory' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    store.reset()
    authState.fail = false
    authState.userId = 'user-1'
  })

  it('非团队成员 POST 团队作用域 → 404,且不写库', async () => {
    store.selectQueue.push([]) // 成员枚举为空 ⇒ 非成员
    store.insertQueue.push([makeMemory(TEAM_UUID)]) // 若旧代码放行,这里会 200 写库
    const res = await app.inject({
      method: 'POST',
      url: '/api/team-memory',
      payload: { scopeId: TEAM_UUID, kind: 'convention', title: 'x', content: '任意内容' },
    })
    expect(res.statusCode).toBe(404)
    expect(store.insertValues).toHaveLength(0)
  })

  it('团队成员 POST 团队作用域 → 200 且写入', async () => {
    store.selectQueue.push([{ id: 'm-1' }]) // 成员命中
    store.insertQueue.push([makeMemory(TEAM_UUID)])
    const res = await app.inject({
      method: 'POST',
      url: '/api/team-memory',
      payload: { scopeId: TEAM_UUID, kind: 'convention', title: 'x', content: '合法内容' },
    })
    expect(res.statusCode).toBe(200)
    expect(store.insertValues).toHaveLength(1)
  })

  it('自由文本作用域(非 UUID)按密钥共享,POST 仍可写', async () => {
    store.insertQueue.push([makeMemory('scope-A')])
    const res = await app.inject({
      method: 'POST',
      url: '/api/team-memory',
      payload: { scopeId: 'scope-A', kind: 'convention', title: 'x', content: 'c' },
    })
    expect(res.statusCode).toBe(200)
    expect(store.insertValues).toHaveLength(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
