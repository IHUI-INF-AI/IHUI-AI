import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import { sql, eq } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { users, eduNotes } from '@ihui/database'
import {
  mockAuthenticate,
  setMockUser,
  setMockUnauthorized,
  resetMockAuth,
} from './helpers/mock-auth.js'

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: (...args: unknown[]) => mockAuthenticate(...args),
  requireActiveUser: vi.fn(),
}))

const { eduPublicRoutes } = await import('../src/routes/edu-public.js')

async function createUser(phone: string, nickname?: string) {
  const [row] = await db.insert(users).values({ phone, nickname }).returning()
  return row
}

async function createNote(data: {
  userId: string
  title?: string
  content: string
  isPublic?: boolean
  lessonId?: string
}) {
  const [row] = await db
    .insert(eduNotes)
    .values({
      userId: data.userId,
      title: data.title,
      content: data.content,
      isPublic: data.isPublic ?? false,
      lessonId: data.lessonId,
    })
    .returning()
  return row
}

describe('edu-notes-routes — 学员笔记 CRUD 需鉴权真实 DB 集成测试', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(eduPublicRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(async () => {
    resetMockAuth()
    await db.execute(sql`DELETE FROM edu_notes`)
    await db.execute(sql`DELETE FROM users WHERE is_system_admin = false`)
  })

  // =====================================================================
  // 鉴权
  // =====================================================================

  it('GET /api/edu/my-notes — 未登录返回 401', async () => {
    setMockUnauthorized()
    const res = await server.inject({ method: 'GET', url: '/api/edu/my-notes' })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/edu/notes — 未登录返回 401', async () => {
    setMockUnauthorized()
    const res = await server.inject({
      method: 'POST',
      url: '/api/edu/notes',
      body: { content: '测试' },
    })
    expect(res.statusCode).toBe(401)
  })

  // =====================================================================
  // GET /api/edu/my-notes
  // =====================================================================

  it('GET /api/edu/my-notes — 空表返回空列表', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/edu/my-notes' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.list).toEqual([])
    expect(body.data.total).toBe(0)
    expect(body.data.page).toBe(1)
    expect(body.data.pageSize).toBe(20)
  })

  it('GET /api/edu/my-notes — 按当前 userId 筛选', async () => {
    const userA = await createUser('1001', '用户A')
    const userB = await createUser('1002', '用户B')
    await createNote({ userId: userA.id, title: 'A 的笔记', content: '内容A' })
    await createNote({ userId: userB.id, title: 'B 的笔记', content: '内容B' })
    setMockUser(userA.id)
    const res = await server.inject({ method: 'GET', url: '/api/edu/my-notes' })
    const body = res.json()
    expect(body.data.list).toHaveLength(1)
    expect(body.data.list[0].title).toBe('A 的笔记')
  })

  it('GET /api/edu/my-notes — search 模糊搜索 title', async () => {
    const user = await createUser('1001', '用户')
    await createNote({ userId: user.id, title: 'React 入门', content: '内容' })
    await createNote({ userId: user.id, title: 'Vue 实战', content: '内容' })
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/edu/my-notes?search=React' })
    const body = res.json()
    expect(body.data.list).toHaveLength(1)
    expect(body.data.list[0].title).toBe('React 入门')
  })

  it('GET /api/edu/my-notes — 分页', async () => {
    const user = await createUser('1001', '用户')
    for (let i = 0; i < 5; i++) {
      await createNote({ userId: user.id, title: `笔记${i}`, content: '内容' })
    }
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/edu/my-notes?page=2&pageSize=2' })
    const body = res.json()
    expect(body.data.list).toHaveLength(2)
    expect(body.data.total).toBe(5)
    expect(body.data.page).toBe(2)
    expect(body.data.pageSize).toBe(2)
  })

  // =====================================================================
  // POST /api/edu/notes
  // =====================================================================

  it('POST /api/edu/notes — 成功创建笔记', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/edu/notes',
      body: { title: '新笔记', content: '新内容', isPublic: true },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.note.title).toBe('新笔记')
    expect(body.data.note.content).toBe('新内容')
    expect(body.data.note.isPublic).toBe(true)
    expect(body.data.note.userId).toBe(user.id)
  })

  it('POST /api/edu/notes — 缺 content 返回 400', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/edu/notes',
      body: { title: '无内容' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST /api/edu/notes — content 超过 10000 字符返回 400', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/edu/notes',
      body: { content: 'a'.repeat(10001) },
    })
    expect(res.statusCode).toBe(400)
  })

  // =====================================================================
  // PUT /api/edu/notes/:id
  // =====================================================================

  it('PUT /api/edu/notes/:id — 成功更新笔记', async () => {
    const user = await createUser('1001', '用户')
    const note = await createNote({ userId: user.id, title: '旧标题', content: '旧内容' })
    setMockUser(user.id)
    const res = await server.inject({
      method: 'PUT',
      url: `/api/edu/notes/${note.id}`,
      body: { title: '新标题', content: '新内容' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.note.title).toBe('新标题')
    expect(body.data.note.content).toBe('新内容')
  })

  it('PUT /api/edu/notes/:id — 不存在返回 404', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({
      method: 'PUT',
      url: '/api/edu/notes/00000000-0000-0000-0000-000000000000',
      body: { title: '新标题' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('PUT /api/edu/notes/:id — 更新他人笔记返回 403', async () => {
    const userA = await createUser('1001', '用户A')
    const userB = await createUser('1002', '用户B')
    const note = await createNote({ userId: userB.id, title: 'B 的笔记', content: '内容' })
    setMockUser(userA.id)
    const res = await server.inject({
      method: 'PUT',
      url: `/api/edu/notes/${note.id}`,
      body: { title: '篡改' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('PUT /api/edu/notes/:id — 非法 UUID 返回 400', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({
      method: 'PUT',
      url: '/api/edu/notes/not-a-uuid',
      body: { title: '新标题' },
    })
    expect(res.statusCode).toBe(400)
  })

  // =====================================================================
  // DELETE /api/edu/notes/:id
  // =====================================================================

  it('DELETE /api/edu/notes/:id — 成功删除笔记', async () => {
    const user = await createUser('1001', '用户')
    const note = await createNote({ userId: user.id, title: '待删除', content: '内容' })
    setMockUser(user.id)
    const res = await server.inject({ method: 'DELETE', url: `/api/edu/notes/${note.id}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.deleted).toBe(true)

    const [remaining] = await db.select().from(eduNotes).where(eq(eduNotes.id, note.id)).limit(1)
    expect(remaining).toBeUndefined()
  })

  it('DELETE /api/edu/notes/:id — 不存在返回 404', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({
      method: 'DELETE',
      url: '/api/edu/notes/00000000-0000-0000-0000-000000000000',
    })
    expect(res.statusCode).toBe(404)
  })

  it('DELETE /api/edu/notes/:id — 删除他人笔记返回 403', async () => {
    const userA = await createUser('1001', '用户A')
    const userB = await createUser('1002', '用户B')
    const note = await createNote({ userId: userB.id, title: 'B 的笔记', content: '内容' })
    setMockUser(userA.id)
    const res = await server.inject({ method: 'DELETE', url: `/api/edu/notes/${note.id}` })
    expect(res.statusCode).toBe(403)
  })

  it('响应格式符合 { code, message, data } 规范', async () => {
    const user = await createUser('1001', '格式校验')
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/edu/my-notes' })
    const body = res.json()
    expect(body).toHaveProperty('code')
    expect(body).toHaveProperty('message')
    expect(body).toHaveProperty('data')
    expect(body.code).toBe(0)
    expect(body.message).toBe('success')
  })
})
