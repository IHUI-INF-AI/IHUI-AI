import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import { sql, eq } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { users, projects, files, searchHistory } from '@ihui/database'
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

const { searchRoutes } = await import('../src/routes/search.js')

async function createUser(phone: string, nickname?: string) {
  const [row] = await db.insert(users).values({ phone, nickname }).returning()
  return row
}

async function createProject(data: {
  userId: string
  name: string
  description?: string
  status?: number
}) {
  const [row] = await db
    .insert(projects)
    .values({
      userId: data.userId,
      name: data.name,
      description: data.description,
      status: data.status ?? 1,
    })
    .returning()
  return row
}

async function createFile(data: {
  projectId: string
  name: string
  path?: string
  mimeType?: string
  size?: number
}) {
  const [row] = await db
    .insert(files)
    .values({
      projectId: data.projectId,
      name: data.name,
      path: data.path ?? `/uploads/${data.name}`,
      mimeType: data.mimeType ?? 'text/plain',
      size: data.size ?? 100,
    })
    .returning()
  return row
}

async function createSearchHistory(data: { userId: string; query: string; resultsCount?: number }) {
  const [row] = await db
    .insert(searchHistory)
    .values({
      userId: data.userId,
      query: data.query,
      resultsCount: data.resultsCount ?? 0,
    })
    .returning()
  return row
}

describe('search-routes — 需鉴权路由真实 DB 集成测试', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(searchRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(async () => {
    resetMockAuth()
    await db.execute(sql`DELETE FROM search_history`)
    await db.execute(sql`DELETE FROM files`)
    await db.execute(sql`DELETE FROM projects`)
    await db.execute(sql`DELETE FROM users WHERE is_system_admin = false`)
  })

  // =====================================================================
  // 鉴权
  // =====================================================================

  it('GET /api/search — 未登录返回 401', async () => {
    setMockUnauthorized()
    const res = await server.inject({ method: 'GET', url: '/api/search?q=test' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/search/history — 未登录返回 401', async () => {
    setMockUnauthorized()
    const res = await server.inject({ method: 'GET', url: '/api/search/history' })
    expect(res.statusCode).toBe(401)
  })

  it('DELETE /api/search/history — 未登录返回 401', async () => {
    setMockUnauthorized()
    const res = await server.inject({ method: 'DELETE', url: '/api/search/history' })
    expect(res.statusCode).toBe(401)
  })

  // =====================================================================
  // GET /api/search — 全局搜索
  // =====================================================================

  it('GET /api/search — 缺 q 参数返回 400', async () => {
    const user = await createUser('1001', '测试')
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/search' })
    expect(res.statusCode).toBe(400)
  })

  it('GET /api/search — q 为空字符串返回 400', async () => {
    const user = await createUser('1001', '测试')
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/search?q=' })
    expect(res.statusCode).toBe(400)
  })

  it('GET /api/search — type=all 跨表聚合搜索', async () => {
    const userA = await createUser('1001', 'Alice')
    const proj = await createProject({ userId: userA.id, name: 'Alice 项目' })
    await createFile({ projectId: proj.id, name: 'Alice 文件' })

    setMockUser(userA.id)
    const res = await server.inject({ method: 'GET', url: '/api/search?q=Alice&type=all' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.users.length).toBeGreaterThanOrEqual(1)
    expect(body.data.projects.length).toBe(1)
    expect(body.data.files.length).toBe(1)
    expect(body.data.total).toBeGreaterThanOrEqual(3)
  })

  it('GET /api/search — type=user 仅搜索用户', async () => {
    const user = await createUser('1001', 'Alice')
    await createProject({ userId: user.id, name: 'Alice 项目' })
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/search?q=Alice&type=user' })
    const body = res.json()
    expect(body.data.users.length).toBeGreaterThanOrEqual(1)
    expect(body.data.projects).toEqual([])
    expect(body.data.files).toEqual([])
  })

  it('GET /api/search — type=project 仅搜索项目', async () => {
    const user = await createUser('1001', 'Alice')
    await createProject({ userId: user.id, name: 'Alice 项目' })
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/search?q=Alice&type=project' })
    const body = res.json()
    expect(body.data.projects.length).toBe(1)
    expect(body.data.users).toEqual([])
    expect(body.data.files).toEqual([])
  })

  it('GET /api/search — type=file 仅搜索文件', async () => {
    const user = await createUser('1001', 'Alice')
    const proj = await createProject({ userId: user.id, name: '项目' })
    await createFile({ projectId: proj.id, name: 'Alice 文件' })
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/search?q=Alice&type=file' })
    const body = res.json()
    expect(body.data.files.length).toBe(1)
    expect(body.data.users).toEqual([])
    expect(body.data.projects).toEqual([])
  })

  it('GET /api/search — projects/files 按当前用户隔离', async () => {
    const userA = await createUser('1001', 'Alice')
    const userB = await createUser('1002', 'Bob')
    await createProject({ userId: userB.id, name: 'Alice 私密项目' })
    setMockUser(userA.id)
    const res = await server.inject({ method: 'GET', url: '/api/search?q=Alice&type=project' })
    const body = res.json()
    expect(body.data.projects).toEqual([])
  })

  it('GET /api/search — limit 参数限制返回数量', async () => {
    for (let i = 0; i < 5; i++) {
      await createUser(`100${i}`, `User${i}`)
    }
    const user = await createUser('admin', 'Admin')
    // 搜索需要 admin 角色,因为 RLS 限制了非 admin 只能看自己
    setMockAdmin(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/search?q=User&type=user&limit=2' })
    const body = res.json()
    expect(body.data.users.length).toBe(2)
  })

  it('GET /api/search — limit 超过 50 时 zod 抛错(测试 server 无全局 errorHandler 返回 500)', async () => {
    const user = await createUser('1001', '测试')
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/search?q=test&limit=51' })
    expect(res.statusCode).toBe(500)
  })

  // =====================================================================
  // GET /api/search/suggestions
  // =====================================================================

  it('GET /api/search/suggestions — 缺 q 返回 400', async () => {
    const user = await createUser('1001', '测试')
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/search/suggestions' })
    expect(res.statusCode).toBe(400)
  })

  it('GET /api/search/suggestions — 基于搜索历史前缀匹配', async () => {
    const user = await createUser('1001', '测试')
    await createSearchHistory({ userId: user.id, query: 'React 入门' })
    await createSearchHistory({ userId: user.id, query: 'React 进阶' })
    await createSearchHistory({ userId: user.id, query: 'Vue 实战' })
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/search/suggestions?q=Re' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.suggestions).toContain('React 入门')
    expect(body.data.suggestions).toContain('React 进阶')
    expect(body.data.suggestions).not.toContain('Vue 实战')
  })

  it('GET /api/search/suggestions — 搜索历史按用户隔离', async () => {
    const userA = await createUser('1001', '用户A')
    const userB = await createUser('1002', '用户B')
    await createSearchHistory({ userId: userB.id, query: 'React 入门' })
    setMockUser(userA.id)
    const res = await server.inject({ method: 'GET', url: '/api/search/suggestions?q=Re' })
    const body = res.json()
    expect(body.data.suggestions).not.toContain('React 入门')
  })

  // =====================================================================
  // GET /api/search/history
  // =====================================================================

  it('GET /api/search/history — 返回当前用户搜索历史(按 createdAt 降序)', async () => {
    const userA = await createUser('1001', '用户A')
    const userB = await createUser('1002', '用户B')
    await createSearchHistory({ userId: userA.id, query: 'React' })
    await new Promise((r) => setTimeout(r, 10))
    await createSearchHistory({ userId: userA.id, query: 'Vue' })
    await createSearchHistory({ userId: userB.id, query: 'Bob 搜索' })
    setMockUser(userA.id)
    const res = await server.inject({ method: 'GET', url: '/api/search/history' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.list).toHaveLength(2)
    expect(body.data.list.map((h: { query: string }) => h.query)).toEqual(['Vue', 'React'])
  })

  it('GET /api/search/history — limit 参数', async () => {
    const user = await createUser('1001', '测试')
    for (let i = 0; i < 5; i++) {
      await createSearchHistory({ userId: user.id, query: `query${i}` })
    }
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/search/history?limit=3' })
    const body = res.json()
    expect(body.data.list).toHaveLength(3)
  })

  // =====================================================================
  // DELETE /api/search/history
  // =====================================================================

  it('DELETE /api/search/history — 清空当前用户搜索历史', async () => {
    const userA = await createUser('1001', '用户A')
    const userB = await createUser('1002', '用户B')
    await createSearchHistory({ userId: userA.id, query: 'React' })
    await createSearchHistory({ userId: userB.id, query: 'Vue' })
    setMockUser(userA.id)
    const res = await server.inject({ method: 'DELETE', url: '/api/search/history' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.deletedCount).toBe(1)

    // 验证用户 B 的历史不受影响
    const remaining = await db
      .select()
      .from(searchHistory)
      .where(eq(searchHistory.userId, userB.id))
    expect(remaining).toHaveLength(1)
  })

  // =====================================================================
  // DELETE /api/search/history/:id
  // =====================================================================

  it('DELETE /api/search/history/:id — 删除单条历史', async () => {
    const user = await createUser('1001', '测试')
    const hist = await createSearchHistory({ userId: user.id, query: 'React' })
    setMockUser(user.id)
    const res = await server.inject({ method: 'DELETE', url: `/api/search/history/${hist.id}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.id).toBe(hist.id)
  })

  it('DELETE /api/search/history/:id — 不存在返回 404', async () => {
    const user = await createUser('1001', '测试')
    setMockUser(user.id)
    const res = await server.inject({
      method: 'DELETE',
      url: '/api/search/history/00000000-0000-0000-0000-000000000000',
    })
    expect(res.statusCode).toBe(404)
  })

  it('DELETE /api/search/history/:id — 删除他人历史返回 404', async () => {
    const userA = await createUser('1001', '用户A')
    const userB = await createUser('1002', '用户B')
    const hist = await createSearchHistory({ userId: userB.id, query: 'Bob 私密' })
    setMockUser(userA.id)
    const res = await server.inject({ method: 'DELETE', url: `/api/search/history/${hist.id}` })
    expect(res.statusCode).toBe(404)
  })

  it('DELETE /api/search/history/:id — 非法 UUID 返回 400', async () => {
    const user = await createUser('1001', '测试')
    setMockUser(user.id)
    const res = await server.inject({ method: 'DELETE', url: '/api/search/history/not-a-uuid' })
    expect(res.statusCode).toBe(400)
  })

  it('响应格式符合 { code, message, data } 规范', async () => {
    const user = await createUser('1001', '格式校验')
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/search?q=test' })
    const body = res.json()
    expect(body).toHaveProperty('code')
    expect(body).toHaveProperty('message')
    expect(body).toHaveProperty('data')
    expect(body.code).toBe(0)
    expect(body.message).toBe('success')
  })
})
