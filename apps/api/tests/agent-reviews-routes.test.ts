// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { agents, users } from '@ihui/database'

const state = vi.hoisted(() => ({
  queue: [] as unknown[][],
  selectCalls: 0,
  joins: [] as Array<{ table: unknown; condition: unknown }>,
  wheres: [] as unknown[],
  limits: [] as number[],
  offsets: [] as number[],
}))

vi.mock('../src/db/index.js', () => {
  function createChain() {
    const chain: Record<string, unknown> = {
      then: (resolve: (value: unknown[]) => unknown) => {
        const result = state.queue.length > 0 ? state.queue.shift()! : []
        return Promise.resolve(result).then(resolve)
      },
    }
    chain.from = () => chain
    chain.innerJoin = (table: unknown, condition: unknown) => {
      state.joins.push({ table, condition })
      return chain
    }
    chain.leftJoin = (table: unknown, condition: unknown) => {
      state.joins.push({ table, condition })
      return chain
    }
    chain.where = (condition: unknown) => {
      state.wheres.push(condition)
      return chain
    }
    chain.orderBy = () => chain
    chain.limit = (n: number) => {
      state.limits.push(n)
      return chain
    }
    chain.offset = (n: number) => {
      state.offsets.push(n)
      return chain
    }
    return chain
  }
  const select = vi.fn(() => {
    state.selectCalls += 1
    return createChain()
  })
  return { dbRead: { select }, db: { select } }
})

const authState = vi.hoisted(() => ({
  checkAuth: vi.fn(
    async (
      request: { headers: Record<string, unknown>; userId?: string },
      reply: { status: (n: number) => { send: (b: unknown) => void } },
    ) => {
      const carrier = request.headers['x-test-user']
      if (typeof carrier === 'string' && carrier) {
        request.userId = carrier
        return true
      }
      reply.status(401).send({ code: 401, message: 'Authentication required' })
      return false
    },
  ),
}))

vi.mock('../src/plugins/auth.js', () => ({ checkAuth: authState.checkAuth }))

import { agentReviewRoutes } from '../src/routes/agent-reviews.js'

const OWNER_ID = '11111111-1111-4111-8111-111111111111'

function enqueue(...rows: unknown[][]) {
  state.queue.push(...rows)
}

function collectColumnNames(node: unknown, out: string[] = []): string[] {
  if (!node || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    for (const item of node) collectColumnNames(item, out)
    return out
  }
  const obj = node as Record<string, unknown>
  if (typeof obj.name === 'string' && obj.table) {
    out.push(obj.name)
    return out
  }
  if (Array.isArray(obj.queryChunks)) collectColumnNames(obj.queryChunks, out)
  return out
}

describe('用户评价 /api/agent-reviews —— 本人名下智能体 × 真实评价表', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(agentReviewRoutes, { prefix: '/api' })
    await server.ready()
  })
  afterAll(async () => {
    await server.close()
  })
  beforeEach(() => {
    state.queue.length = 0
    state.selectCalls = 0
    state.joins.length = 0
    state.wheres.length = 0
    state.limits.length = 0
    state.offsets.length = 0
  })

  it('无凭据 401 且零读', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/agent-reviews' })
    expect(res.statusCode).toBe(401)
    expect(res.json().code).toBe(401)
    expect(state.selectCalls).toBe(0)
  })

  it('只出契约六键,昵称缺失匿名化、内容缺失补空串、时间走 ISO', async () => {
    enqueue([
      {
        id: 'r1',
        agentName: '写作助手',
        nickname: ' 小王 ',
        rating: 5,
        content: '很好用',
        createdAt: new Date('2026-10-18T12:34:56.000Z'),
      },
      {
        id: 'r2',
        agentName: '翻译助手',
        nickname: null,
        rating: 3,
        content: null,
        createdAt: new Date('2026-10-17T00:00:00.000Z'),
      },
    ])
    const res = await server.inject({
      method: 'GET',
      url: '/api/agent-reviews',
      headers: { 'x-test-user': OWNER_ID },
    })
    expect(res.statusCode).toBe(200)
    const data = res.json().data as Array<Record<string, unknown>>
    expect(data).toHaveLength(2)
    expect(Object.keys(data[0]!).sort()).toEqual(
      ['agentName', 'author', 'content', 'createdAt', 'id', 'rating'].sort(),
    )
    expect(data[0]).toMatchObject({
      id: 'r1',
      agentName: '写作助手',
      author: '小王',
      rating: 5,
      content: '很好用',
      createdAt: '2026-10-18T12:34:56.000Z',
    })
    expect(data[1]).toMatchObject({ author: '匿名用户', content: '', rating: 3 })
  })

  it('查询按本人归属过滤:where 落在 agents.user_id,联结键是 agent_id', async () => {
    enqueue([])
    await server.inject({
      method: 'GET',
      url: '/api/agent-reviews',
      headers: { 'x-test-user': OWNER_ID },
    })
    expect(state.joins[0]?.table).toBe(agents)
    expect(collectColumnNames(state.joins[0]?.condition)).toContain('agent_id')
    expect(state.joins[1]?.table).toBe(users)
    expect(collectColumnNames(state.wheres[0])).toContain('user_id')
    expect(state.limits).toEqual([20])
    expect(state.offsets).toEqual([0])
  })

  it('分页参数落到 limit/offset', async () => {
    enqueue([])
    await server.inject({
      method: 'GET',
      url: '/api/agent-reviews?page=3&pageSize=5',
      headers: { 'x-test-user': OWNER_ID },
    })
    expect(state.limits).toEqual([5])
    expect(state.offsets).toEqual([10])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
