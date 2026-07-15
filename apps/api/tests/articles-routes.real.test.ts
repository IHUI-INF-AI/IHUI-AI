import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { sql } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { newsArticles, newsCategories } from '@ihui/database'
import { articleRoutes } from '../src/routes/articles.js'

async function createCategory(name: string, sort = 0, status = 1) {
  const [row] = await db.insert(newsCategories).values({ name, sort, status }).returning()
  return row
}

async function createArticle(data: {
  title: string
  content?: string
  categoryId?: string
  isPublished?: boolean
  status?: number
  isPinned?: boolean
  summary?: string
}) {
  const [row] = await db
    .insert(newsArticles)
    .values({
      title: data.title,
      content: data.content ?? '正文',
      categoryId: data.categoryId,
      isPublished: data.isPublished ?? true,
      status: data.status ?? 1,
      isPinned: data.isPinned ?? false,
      summary: data.summary,
    })
    .returning()
  return row
}

describe('articles-routes — 路由层真实 DB 集成测试', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(articleRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(async () => {
    await db.execute(sql`DELETE FROM news_articles`)
    await db.execute(sql`DELETE FROM news_categories`)
  })

  it('GET /api/articles — 空表返回空数组', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/articles' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.message).toBe('success')
    expect(body.data).toEqual([])
  })

  it('GET /api/articles — 仅返回 isPublished=true + status=1', async () => {
    await createArticle({ title: '已发布', isPublished: true, status: 1 })
    await createArticle({ title: '草稿', isPublished: false, status: 1 })
    await createArticle({ title: '已下线', isPublished: true, status: 0 })
    const res = await server.inject({ method: 'GET', url: '/api/articles' })
    const body = res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].title).toBe('已发布')
  })

  it('GET /api/articles — categoryId 过滤', async () => {
    const cat = await createCategory('科技')
    await createArticle({ title: 'A1', categoryId: cat.id })
    await createArticle({ title: 'A2' })
    const res = await server.inject({
      method: 'GET',
      url: `/api/articles?categoryId=${cat.id}`,
    })
    const body = res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].title).toBe('A1')
    expect(body.data[0].categoryName).toBe('科技')
  })

  it('GET /api/articles — search 模糊搜索标题', async () => {
    await createArticle({ title: 'TypeScript 入门指南' })
    await createArticle({ title: 'Python 基础教程' })
    const res = await server.inject({
      method: 'GET',
      url: '/api/articles?search=TypeScript',
    })
    const body = res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].title).toContain('TypeScript')
  })

  it('GET /api/articles — limit 参数限制返回数量', async () => {
    await createArticle({ title: 'A1' })
    await createArticle({ title: 'A2' })
    await createArticle({ title: 'A3' })
    const res = await server.inject({ method: 'GET', url: '/api/articles?limit=2' })
    const body = res.json()
    expect(body.data).toHaveLength(2)
  })

  it('GET /api/articles — 非法 categoryId 返回 400', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/articles?categoryId=not-a-uuid',
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.code).toBe(400)
    expect(body.message).toContain('分类')
  })

  it('GET /api/articles — page/pageSize 分页', async () => {
    for (let i = 1; i <= 5; i++) {
      await createArticle({ title: `A${i}` })
    }
    const res = await server.inject({
      method: 'GET',
      url: '/api/articles?page=2&pageSize=2',
    })
    const body = res.json()
    expect(body.data).toHaveLength(2)
  })

  it('GET /api/articles — 响应格式符合 { code, message, data } 规范', async () => {
    await createArticle({ title: 'X' })
    const res = await server.inject({ method: 'GET', url: '/api/articles' })
    const body = res.json()
    expect(body).toHaveProperty('code')
    expect(body).toHaveProperty('message')
    expect(body).toHaveProperty('data')
    expect(typeof body.code).toBe('number')
    expect(typeof body.message).toBe('string')
    expect(Array.isArray(body.data)).toBe(true)
  })
})
