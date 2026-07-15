import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { sql } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { users, userPoints, agents, lessons } from '@ihui/database'
import rankingRoutes from '../src/routes/ranking.js'

async function createUser(phone: string, nickname?: string) {
  const [row] = await db.insert(users).values({ phone, nickname }).returning()
  return row
}

async function createUserPoints(data: {
  userId: string
  points?: number
  level?: number
  experience?: number
}) {
  const [row] = await db
    .insert(userPoints)
    .values({
      userId: data.userId,
      points: data.points ?? 0,
      level: data.level ?? 1,
      experience: data.experience ?? 0,
    })
    .returning()
  return row
}

async function createAgent(data: {
  name: string
  status?: string
  usageCount?: number
  likeCount?: number
  shareCount?: number
  avatar?: string
}) {
  const [row] = await db
    .insert(agents)
    .values({
      name: data.name,
      status: data.status ?? 'published',
      usageCount: data.usageCount ?? 0,
      likeCount: data.likeCount ?? 0,
      shareCount: data.shareCount ?? 0,
      avatar: data.avatar,
    })
    .returning()
  return row
}

async function createLesson(data: {
  title: string
  isPublished?: boolean
  signupCount?: number
  viewCount?: number
  coverImage?: string
}) {
  const [row] = await db
    .insert(lessons)
    .values({
      title: data.title,
      isPublished: data.isPublished ?? false,
      signupCount: data.signupCount ?? 0,
      viewCount: data.viewCount ?? 0,
      coverImage: data.coverImage,
    })
    .returning()
  return row
}

describe('ranking-routes — 路由层真实 DB 集成测试', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(rankingRoutes, { prefix: '/api/ranking' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(async () => {
    await db.execute(sql`DELETE FROM user_points`)
    await db.execute(sql`DELETE FROM agents`)
    await db.execute(sql`DELETE FROM lessons`)
    await db.execute(sql`DELETE FROM users WHERE is_system_admin = false`)
  })

  it('GET /api/ranking/users — 空表返回空列表', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/ranking/users' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.list).toEqual([])
    expect(body.data.period).toBe('total')
  })

  it('GET /api/ranking/users — period=total 按 points 降序', async () => {
    const u1 = await createUser('1001', '低分用户')
    const u2 = await createUser('1002', '高分用户')
    const u3 = await createUser('1003', '中分用户')
    await createUserPoints({ userId: u1.id, points: 10 })
    await createUserPoints({ userId: u2.id, points: 1000 })
    await createUserPoints({ userId: u3.id, points: 500 })
    const res = await server.inject({
      method: 'GET',
      url: '/api/ranking/users?period=total',
    })
    const body = res.json()
    expect(body.data.list.map((u: { points: number }) => u.points)).toEqual([1000, 500, 10])
  })

  it('GET /api/ranking/users — period=day/week/month 按 experience 降序', async () => {
    const u1 = await createUser('1001', '低经验')
    const u2 = await createUser('1002', '高经验')
    await createUserPoints({ userId: u1.id, points: 1000, experience: 10 })
    await createUserPoints({ userId: u2.id, points: 10, experience: 5000 })
    const res = await server.inject({
      method: 'GET',
      url: '/api/ranking/users?period=week',
    })
    const body = res.json()
    expect(body.data.period).toBe('week')
    expect(body.data.list[0].experience).toBe(5000)
    expect(body.data.list[1].experience).toBe(10)
  })

  it('GET /api/ranking/users — limit 限制返回数量', async () => {
    for (let i = 0; i < 5; i++) {
      const u = await createUser(`100${i}`, `用户${i}`)
      await createUserPoints({ userId: u.id, points: 100 - i })
    }
    const res = await server.inject({
      method: 'GET',
      url: '/api/ranking/users?limit=3',
    })
    const body = res.json()
    expect(body.data.list).toHaveLength(3)
  })

  it('GET /api/ranking/users — 字段格式 (userId/points/level/experience)', async () => {
    const u = await createUser('1001', '测试')
    await createUserPoints({ userId: u.id, points: 500, level: 5, experience: 2500 })
    const res = await server.inject({ method: 'GET', url: '/api/ranking/users' })
    const body = res.json()
    expect(body.data.list[0]).toEqual({
      userId: u.id,
      points: 500,
      level: 5,
      experience: 2500,
    })
  })

  it('GET /api/ranking/users — 非法 period 返回 400', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/ranking/users?period=invalid',
    })
    expect(res.statusCode).toBe(400)
  })

  it('GET /api/ranking/agents — 空表返回空列表', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/ranking/agents' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.list).toEqual([])
  })

  it('GET /api/ranking/agents — 仅返回 status=published', async () => {
    await createAgent({ name: '已发布', status: 'published', usageCount: 100 })
    await createAgent({ name: '草稿', status: 'draft', usageCount: 9999 })
    const res = await server.inject({ method: 'GET', url: '/api/ranking/agents' })
    const body = res.json()
    expect(body.data.list).toHaveLength(1)
    expect(body.data.list[0].name).toBe('已发布')
  })

  it('GET /api/ranking/agents — 按 usageCount 降序', async () => {
    await createAgent({ name: '低热度', usageCount: 5 })
    await createAgent({ name: '高热度', usageCount: 1000 })
    await createAgent({ name: '中热度', usageCount: 500 })
    const res = await server.inject({ method: 'GET', url: '/api/ranking/agents' })
    const body = res.json()
    expect(body.data.list.map((a: { name: string }) => a.name)).toEqual([
      '高热度',
      '中热度',
      '低热度',
    ])
  })

  it('GET /api/ranking/agents — limit 限制返回数量', async () => {
    for (let i = 0; i < 5; i++) {
      await createAgent({ name: `应用${i}`, usageCount: 100 - i })
    }
    const res = await server.inject({
      method: 'GET',
      url: '/api/ranking/agents?limit=2',
    })
    const body = res.json()
    expect(body.data.list).toHaveLength(2)
  })

  it('GET /api/ranking/agents — 字段格式 (agentId/name/avatar/usageCount/likeCount/shareCount)', async () => {
    const agent = await createAgent({
      name: '完整字段',
      usageCount: 100,
      likeCount: 50,
      shareCount: 25,
      avatar: 'https://example.com/avatar.png',
    })
    const res = await server.inject({ method: 'GET', url: '/api/ranking/agents' })
    const body = res.json()
    expect(body.data.list[0]).toEqual({
      agentId: agent.agentId,
      name: '完整字段',
      avatar: 'https://example.com/avatar.png',
      usageCount: 100,
      likeCount: 50,
      shareCount: 25,
    })
  })

  it('GET /api/ranking/courses — 空表返回空列表', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/ranking/courses' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.list).toEqual([])
  })

  it('GET /api/ranking/courses — 仅返回 isPublished=true', async () => {
    await createLesson({ title: '已发布', isPublished: true, signupCount: 100 })
    await createLesson({ title: '未发布', isPublished: false, signupCount: 9999 })
    const res = await server.inject({ method: 'GET', url: '/api/ranking/courses' })
    const body = res.json()
    expect(body.data.list).toHaveLength(1)
    expect(body.data.list[0].title).toBe('已发布')
  })

  it('GET /api/ranking/courses — 按 signupCount 降序', async () => {
    await createLesson({ title: '低报名', isPublished: true, signupCount: 5 })
    await createLesson({ title: '高报名', isPublished: true, signupCount: 500 })
    await createLesson({ title: '中报名', isPublished: true, signupCount: 100 })
    const res = await server.inject({ method: 'GET', url: '/api/ranking/courses' })
    const body = res.json()
    expect(body.data.list.map((c: { title: string }) => c.title)).toEqual([
      '高报名',
      '中报名',
      '低报名',
    ])
  })

  it('GET /api/ranking/courses — limit 限制返回数量', async () => {
    for (let i = 0; i < 5; i++) {
      await createLesson({
        title: `课程${i}`,
        isPublished: true,
        signupCount: 100 - i,
      })
    }
    const res = await server.inject({
      method: 'GET',
      url: '/api/ranking/courses?limit=2',
    })
    const body = res.json()
    expect(body.data.list).toHaveLength(2)
  })

  it('GET /api/ranking/courses — 字段格式 (id/title/coverImage/signupCount/viewCount)', async () => {
    const lesson = await createLesson({
      title: '字段测试',
      isPublished: true,
      signupCount: 88,
      viewCount: 999,
      coverImage: 'https://example.com/cover.png',
    })
    const res = await server.inject({ method: 'GET', url: '/api/ranking/courses' })
    const body = res.json()
    expect(body.data.list[0]).toEqual({
      id: lesson.id,
      title: '字段测试',
      coverImage: 'https://example.com/cover.png',
      signupCount: 88,
      viewCount: 999,
    })
  })

  it('GET /api/ranking/lists — 返回静态榜单列表', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/ranking/lists' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.lists).toHaveLength(3)
    expect(body.data.lists.map((l: { key: string }) => l.key)).toEqual([
      'users',
      'agents',
      'courses',
    ])
  })

  it('GET /api/ranking/lists — 字段格式 (key/name/periods)', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/ranking/lists' })
    const body = res.json()
    const usersList = body.data.lists.find((l: { key: string }) => l.key === 'users')
    expect(usersList).toEqual({
      key: 'users',
      name: '用户积分榜',
      periods: ['day', 'week', 'month', 'total'],
    })
    const agentsList = body.data.lists.find((l: { key: string }) => l.key === 'agents')
    expect(agentsList.periods).toEqual(['total'])
  })

  it('响应格式符合 { code, message, data } 规范', async () => {
    const urls = [
      '/api/ranking/users',
      '/api/ranking/agents',
      '/api/ranking/courses',
      '/api/ranking/lists',
    ]
    for (const url of urls) {
      const res = await server.inject({ method: 'GET', url })
      const body = res.json()
      expect(body).toHaveProperty('code')
      expect(body).toHaveProperty('message')
      expect(body).toHaveProperty('data')
      expect(body.code).toBe(0)
      expect(body.message).toBe('success')
    }
  })
})
