// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const GROUP_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OWNER_ID = '11111111-1111-4111-8111-111111111111'
const MEMBER_ID = '22222222-2222-4222-8222-222222222222'
const OUTSIDER_ID = '33333333-3333-4333-8333-333333333333'

const h = vi.hoisted(() => {
  const state = {
    results: [] as unknown[][],
    currentUser: '',
    isAdmin: false,
  }
  function makeChain(): Record<string, unknown> {
    const chain: Record<string, unknown> = {}
    chain.from = () => chain
    chain.where = () => chain
    chain.leftJoin = () => chain
    chain.orderBy = () => chain
    // `.limit(1)` 与 `.orderBy(...)` 都是终结调用:统一用 thenable 在 await 时取结果。
    chain.limit = () => chain
    chain.then = (resolve: (v: unknown[]) => void) =>
      Promise.resolve(state.results.shift() ?? []).then(resolve)
    return chain
  }
  return {
    state,
    db: {
      select: () => makeChain(),
    },
  }
})

vi.mock('../../db/index.js', () => ({ db: h.db }))

vi.mock('../../plugins/require-permission.js', () => ({
  requireAuth: async (request: { userId?: string }) => {
    request.userId = h.state.currentUser
  },
  isSystemAdmin: () => h.state.isAdmin,
}))

import groupsRoutes from '../groups.js'

function queue(...results: unknown[][]) {
  h.state.results = results
}

describe('GET /groups/:id/members — 成员归属闸', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(groupsRoutes, { prefix: '/api/groups' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    h.state.currentUser = OUTSIDER_ID
    h.state.isAdmin = false
    h.state.results = []
  })

  it('非成员越权读取成员名单:403,且不得返回昵称/头像', async () => {
    queue(
      [{ id: GROUP_ID, ownerId: OWNER_ID, name: '私密组' }],
      [],
      [
        {
          id: 'row-1',
          groupId: GROUP_ID,
          userId: MEMBER_ID,
          role: 'member',
          name: '张三',
          avatar: 'https://cdn/x.png',
        },
      ],
    )
    const res = await app.inject({ method: 'GET', url: `/api/groups/${GROUP_ID}/members` })
    expect(res.statusCode).toBe(403)
    expect(JSON.stringify(res.json())).not.toContain('张三')
  })

  it('正向对照:组所有者可读取', async () => {
    h.state.currentUser = OWNER_ID
    queue(
      [{ id: GROUP_ID, ownerId: OWNER_ID, name: '私密组' }],
      [
        {
          id: 'row-1',
          groupId: GROUP_ID,
          userId: MEMBER_ID,
          role: 'member',
          name: '张三',
          avatar: null,
        },
      ],
    )
    const res = await app.inject({ method: 'GET', url: `/api/groups/${GROUP_ID}/members` })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.list).toHaveLength(1)
  })

  it('正向对照:在册成员可读取', async () => {
    h.state.currentUser = MEMBER_ID
    queue(
      [{ id: GROUP_ID, ownerId: OWNER_ID, name: '私密组' }],
      [{ id: 'membership-1' }],
      [
        {
          id: 'row-1',
          groupId: GROUP_ID,
          userId: MEMBER_ID,
          role: 'member',
          name: '张三',
          avatar: null,
        },
      ],
    )
    const res = await app.inject({ method: 'GET', url: `/api/groups/${GROUP_ID}/members` })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.list).toHaveLength(1)
  })

  it('正向对照:系统管理员可读取', async () => {
    h.state.isAdmin = true
    queue(
      [{ id: GROUP_ID, ownerId: OWNER_ID, name: '私密组' }],
      [
        {
          id: 'row-1',
          groupId: GROUP_ID,
          userId: MEMBER_ID,
          role: 'member',
          name: '张三',
          avatar: null,
        },
      ],
    )
    const res = await app.inject({ method: 'GET', url: `/api/groups/${GROUP_ID}/members` })
    expect(res.statusCode).toBe(200)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
