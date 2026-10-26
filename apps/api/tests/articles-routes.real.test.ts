// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

  // 2026-10-26:RN ArticleDetailScreen 一直在打 /api/articles/:id,而这条路由此前不存在
  // (详情 100% 404)。下面三条钉住「路由存在 + RN 契约字段 + 边界」,摘掉任一条即翻红。
  it('GET /api/articles/:id — 详情返回 RN 契约字段(author/views/publishedAt)', async () => {
    const cat = await createCategory('科技')
    const row = await createArticle({ title: '详情A', content: '正文A', categoryId: cat.id })
    const res = await server.inject({ method: 'GET', url: `/api/articles/${row.id}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.id).toBe(row.id)
    expect(body.data.content).toBe('正文A')
    expect(body.data.author).toBe('')
    expect(body.data.views).toBe(0)
    expect(typeof body.data.publishedAt).toBe('string')
    expect(body.data.categoryName).toBe('科技')
  })

  it('GET /api/articles/:id — 未发布与不存在均 404', async () => {
    const draft = await createArticle({ title: '草稿', isPublished: false })
    const r1 = await server.inject({ method: 'GET', url: `/api/articles/${draft.id}` })
    expect(r1.statusCode).toBe(404)
    const r2 = await server.inject({
      method: 'GET',
      url: '/api/articles/00000000-0000-4000-8000-000000000000',
    })
    expect(r2.statusCode).toBe(404)
  })

  it('GET /api/articles/:id — 非法 id 返回 400', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/articles/not-a-uuid' })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe(400)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
