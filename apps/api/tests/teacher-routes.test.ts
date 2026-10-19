// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import { userFollows } from '@ihui/database'

const state = vi.hoisted(() => ({
  queue: [] as unknown[][],
  writes: [] as Array<{ table: unknown; op: string; values?: unknown }>,
}))

vi.mock('../src/db/index.js', () => {
  function createChain() {
    const chain: {
      then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>
      [m: string]: unknown
    } = {
      then: (resolve) => {
        const result = state.queue.length > 0 ? state.queue.shift()! : []
        return Promise.resolve(result).then(resolve)
      },
    }
    for (const m of ['from', 'where', 'groupBy', 'orderBy', 'limit', 'offset']) {
      chain[m] = () => chain
    }
    return chain
  }
  const dbRead = { select: vi.fn(createChain) }
  const db = {
    select: vi.fn(createChain),
    insert: vi.fn((table: unknown) => ({
      values: (values: unknown) => {
        state.writes.push({ table, op: 'insert', values })
        return { onConflictDoNothing: vi.fn().mockResolvedValue([]) }
      },
    })),
    delete: vi.fn((table: unknown) => ({
      where: vi.fn(() => {
        state.writes.push({ table, op: 'delete' })
        return Promise.resolve([])
      }),
    })),
  }
  return { db, dbRead }
})

const authState = vi.hoisted(() => ({
  authenticate: vi.fn(async (request: { headers: Record<string, unknown>; userId?: string }) => {
    const carrier = request.headers['x-test-user']
    if (typeof carrier === 'string' && carrier) request.userId = carrier
  }),
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

vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: authState.checkAuth,
  authenticate: authState.authenticate,
  hasHumanJwtCredential: (request: { headers: Record<string, unknown> }) =>
    Boolean(request.headers['x-test-user']),
}))

import { teacherRoutes } from '../src/routes/teacher.js'

const PREFIX = '/api'
const TEACHER_ID = '11111111-1111-4111-8111-111111111111'
const VIEWER_ID = '22222222-2222-4222-8222-222222222222'

function enqueue(...rows: unknown[][]) {
  state.queue.push(...rows)
}

describe('讲师目录 /api/teacher/* —— 用户 × 已发布课程 × 关注', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(teacherRoutes, { prefix: PREFIX })
    await server.ready()
  })
  afterAll(async () => {
    await server.close()
  })

  it('列表只出契约八键,name 缺 lecturerName 时回落昵称,不解包用户敏感列', async () => {
    enqueue(
      [
        { id: TEACHER_ID, name: null, courses: 3, students: 42 },
        { id: VIEWER_ID, name: '张老师', courses: 1, students: 7 },
      ],
      [{ total: 2 }],
      [
        { id: TEACHER_ID, nickname: '李老师', avatar: 'a.png', bio: '多年经验' },
        { id: VIEWER_ID, nickname: '张老师', avatar: null, bio: null },
      ],
      [{ id: TEACHER_ID, fans: 5 }],
    )
    const res = await server.inject({ method: 'GET', url: `${PREFIX}/teacher/list` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.total).toBe(2)
    expect(body.data.list).toHaveLength(2)
    expect(Object.keys(body.data.list[0]).sort()).toEqual([
      'avatar',
      'courses',
      'fans',
      'id',
      'intro',
      'name',
      'students',
      'title',
    ])
    expect(body.data.list[0]).toEqual({
      id: TEACHER_ID,
      name: '李老师',
      avatar: 'a.png',
      title: null,
      intro: '多年经验',
      courses: 3,
      students: 42,
      fans: 5,
    })
    expect(body.data.list[1].fans).toBe(0)
    const flat = JSON.stringify(body)
    expect(flat).not.toContain('phone')
    expect(flat).not.toContain('email')
    expect(flat).not.toContain('username')
    expect(flat).not.toContain('password')
  })

  it('列表查询面是严格白名单:夹带未知参数直接 400 且不查询', async () => {
    const before = state.queue.length
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/teacher/list?userId=${VIEWER_ID}`,
    })
    expect(res.statusCode).toBe(400)
    expect(state.queue.length).toBe(before)
  })

  it('详情 404 对"不是讲师"的用户一致成立,且不泄漏用户存在性', async () => {
    enqueue([])
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/teacher/${TEACHER_ID}`,
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().message).toBe('讲师不存在')
  })

  it('详情带载体身份时 isFollowed 来自 user_follows,而不是客户端自报', async () => {
    enqueue(
      [{ id: TEACHER_ID, name: '张老师', courses: 2, students: 30 }],
      [{ id: TEACHER_ID, nickname: '张老师', avatar: null, bio: '简介' }],
      [{ id: TEACHER_ID, fans: 9 }],
      [{ id: 'follow-row' }],
    )
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/teacher/${TEACHER_ID}?isFollowed=false&userId=${VIEWER_ID}`,
      headers: { 'x-test-user': VIEWER_ID },
    })
    expect(res.statusCode).toBe(200)
    const data = res.json().data
    expect(data.isFollowed).toBe(true)
    expect(data.name).toBe('张老师')
    expect(data.fans).toBe(9)
  })

  it('课程投影把库内元价格换算成分,并复用端上既有键名', async () => {
    enqueue([
      {
        id: '33333333-3333-4333-8333-333333333333',
        title: '第一课',
        coverImage: 'cover.png',
        price: '12.50',
        signupCount: 8,
      },
    ])
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/teacher/${TEACHER_ID}/courses`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.list).toEqual([
      {
        id: '33333333-3333-4333-8333-333333333333',
        title: '第一课',
        coverUrl: 'cover.png',
        price: 1250,
        students: 8,
      },
    ])
  })

  it('关注写入以载体身份落 user_follows,客户端 query 里的 userId 不参与', async () => {
    state.writes.length = 0
    enqueue([{ id: TEACHER_ID, name: '张老师', courses: 1, students: 1 }])
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/teacher/${TEACHER_ID}/follow?userId=99999999-9999-4999-8999-999999999999`,
      headers: { 'x-test-user': VIEWER_ID },
      payload: { follow: true },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ following: true })
    const insert = state.writes.find((w) => w.op === 'insert')
    expect(insert?.table).toBe(userFollows)
    expect(insert?.values).toEqual({ followerId: VIEWER_ID, followingId: TEACHER_ID })
  })

  it('取消关注走删除腿', async () => {
    state.writes.length = 0
    enqueue([{ id: TEACHER_ID, name: '张老师', courses: 1, students: 1 }])
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/teacher/${TEACHER_ID}/follow`,
      headers: { 'x-test-user': VIEWER_ID },
      payload: { follow: false },
    })
    expect(res.statusCode).toBe(200)
    const del = state.writes.find((w) => w.op === 'delete')
    expect(del?.table).toBe(userFollows)
    expect(state.writes.some((w) => w.op === 'insert')).toBe(false)
  })

  it('未带载体身份:关注 401,且副作用没有发生', async () => {
    state.writes.length = 0
    const before = state.queue.length
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/teacher/${TEACHER_ID}/follow?userId=${VIEWER_ID}`,
      payload: { follow: true },
    })
    expect(res.statusCode).toBe(401)
    expect(state.writes).toHaveLength(0)
    expect(state.queue.length).toBe(before)
  })

  it('不能关注自己:400 且不落库', async () => {
    state.writes.length = 0
    const before = state.queue.length
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/teacher/${VIEWER_ID}/follow`,
      headers: { 'x-test-user': VIEWER_ID },
      payload: { follow: true },
    })
    expect(res.statusCode).toBe(400)
    expect(state.writes).toHaveLength(0)
    expect(state.queue.length).toBe(before)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
