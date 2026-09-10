// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { sql } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { aiWorldItems } from '@ihui/database'
import { aiWorldRoutes } from '../src/routes/ai-world.js'

/**
 * 2026-09-10 重写:旧用例断言 hotApps(agents 表)契约,而路由早已演进为
 * categories/tools/apps/news(ai_world_items 热榜)。旧契约无任何实现,用例恒红。
 */

async function createItem(data: {
  kind: string
  title: string
  status?: number
  likeCount?: number
}) {
  const [row] = await db
    .insert(aiWorldItems)
    .values({
      kind: data.kind,
      title: data.title,
      source: 'test',
      status: data.status ?? 1,
      likeCount: data.likeCount ?? 0,
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
    await db.execute(sql`DELETE FROM ai_world_items`)
    await db.execute(sql`DELETE FROM ai_world_categories`)
  })

  it('GET /api/ai-world — 空库返回空列表且响应格式符合 { code, message, data } 规范', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/ai-world' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.message).toBe('success')
    expect(body.data.categories).toEqual([])
    expect(body.data.tools).toEqual([])
    expect(body.data.apps).toEqual([])
    expect(body.data.news).toEqual([])
  })

  it('GET /api/ai-world — 仅返回 status=1 的条目', async () => {
    await createItem({ kind: 'app', title: '已发布' })
    await createItem({ kind: 'app', title: '下架', status: 0 })
    const res = await server.inject({ method: 'GET', url: '/api/ai-world' })
    const body = res.json()
    expect(body.data.apps).toHaveLength(1)
    expect(body.data.apps[0].title).toBe('已发布')
  })

  it('GET /api/ai-world — apps 按 likeCount 倒序', async () => {
    await createItem({ kind: 'app', title: '低热度', likeCount: 5 })
    await createItem({ kind: 'app', title: '高热度', likeCount: 100 })
    await createItem({ kind: 'app', title: '中热度', likeCount: 50 })
    const res = await server.inject({ method: 'GET', url: '/api/ai-world' })
    const body = res.json()
    expect(body.data.apps.map((a: { title: string }) => a.title)).toEqual([
      '高热度',
      '中热度',
      '低热度',
    ])
  })

  it('GET /api/ai-world — kind 互不串扰(app/tool/news 各回各的列表)', async () => {
    await createItem({ kind: 'app', title: '应用A' })
    await createItem({ kind: 'tool', title: '工具B' })
    await createItem({ kind: 'news', title: '新闻C' })
    const res = await server.inject({ method: 'GET', url: '/api/ai-world' })
    const body = res.json()
    expect(body.data.apps.map((a: { title: string }) => a.title)).toEqual(['应用A'])
    expect(body.data.tools.map((a: { title: string }) => a.title)).toEqual(['工具B'])
    expect(body.data.news.map((a: { title: string }) => a.title)).toEqual(['新闻C'])
  })

  it('GET /api/ai-world — 热榜每个 kind 最多 6 条', async () => {
    for (let i = 0; i < 8; i++) {
      await createItem({ kind: 'app', title: `应用${i}`, likeCount: 100 - i })
    }
    const res = await server.inject({ method: 'GET', url: '/api/ai-world' })
    const body = res.json()
    expect(body.data.apps).toHaveLength(6)
    expect(body.data.apps[0].title).toBe('应用0')
    expect(body.data.apps[5].title).toBe('应用5')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
