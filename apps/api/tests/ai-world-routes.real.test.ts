import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { sql } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { agents } from '@ihui/database'
import { aiWorldRoutes } from '../src/routes/ai-world.js'

async function createAgent(data: { name: string; status?: string; usageCount?: number }) {
  const [row] = await db
    .insert(agents)
    .values({
      name: data.name,
      status: data.status ?? 'published',
      usageCount: data.usageCount ?? 0,
    })
    .returning()
  return row
}

describe('ai-world-routes — 路由层真实 DB 集成测试', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(aiWorldRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(async () => {
    await db.execute(sql`DELETE FROM agents`)
  })

  it('GET /api/ai-world — 空表返回 8 个静态分类 + 空 hotApps', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/ai-world' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.message).toBe('success')
    expect(body.data.categories).toHaveLength(8)
    expect(body.data.categories[0]).toEqual({
      id: 'chat',
      name: 'AI对话',
      icon: 'message',
    })
    expect(body.data.hotApps).toEqual([])
  })

  it('GET /api/ai-world — 仅返回 status=published 的 agent', async () => {
    await createAgent({ name: '已发布', status: 'published', usageCount: 10 })
    await createAgent({ name: '草稿', status: 'draft', usageCount: 100 })
    const res = await server.inject({ method: 'GET', url: '/api/ai-world' })
    const body = res.json()
    expect(body.data.hotApps).toHaveLength(1)
    expect(body.data.hotApps[0].name).toBe('已发布')
  })

  it('GET /api/ai-world — 按 usageCount 倒序排序', async () => {
    await createAgent({ name: '低热度', usageCount: 5 })
    await createAgent({ name: '高热度', usageCount: 100 })
    await createAgent({ name: '中热度', usageCount: 50 })
    const res = await server.inject({ method: 'GET', url: '/api/ai-world' })
    const body = res.json()
    expect(body.data.hotApps.map((a: { name: string }) => a.name)).toEqual([
      '高热度',
      '中热度',
      '低热度',
    ])
  })

  it('GET /api/ai-world — 仅返回前 4 个热门应用', async () => {
    for (let i = 0; i < 6; i++) {
      await createAgent({ name: `应用${i}`, usageCount: 100 - i })
    }
    const res = await server.inject({ method: 'GET', url: '/api/ai-world' })
    const body = res.json()
    expect(body.data.hotApps).toHaveLength(4)
    expect(body.data.hotApps[0].name).toBe('应用0')
    expect(body.data.hotApps[3].name).toBe('应用3')
  })

  it('GET /api/ai-world — hotApps 字段格式 (id + name + href)', async () => {
    const agent = await createAgent({ name: '测试应用', usageCount: 1 })
    const res = await server.inject({ method: 'GET', url: '/api/ai-world' })
    const body = res.json()
    expect(body.data.hotApps[0]).toEqual({
      id: agent.agentId,
      name: '测试应用',
      href: `/ai-world/app/${agent.agentId}`,
    })
  })

  it('GET /api/ai-world — usageCount 默认 0 的 agent 也参与排序', async () => {
    await createAgent({ name: '默认热度' })
    await createAgent({ name: '有热度', usageCount: 10 })
    const res = await server.inject({ method: 'GET', url: '/api/ai-world' })
    const body = res.json()
    expect(body.data.hotApps.map((a: { name: string }) => a.name)).toEqual(['有热度', '默认热度'])
  })

  it('GET /api/ai-world — 响应格式符合 { code, message, data } 规范', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/ai-world' })
    const body = res.json()
    expect(body).toHaveProperty('code')
    expect(body).toHaveProperty('message')
    expect(body).toHaveProperty('data')
    expect(body.data).toHaveProperty('categories')
    expect(body.data).toHaveProperty('hotApps')
  })
})
