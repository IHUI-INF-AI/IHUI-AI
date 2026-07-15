import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { sql, eq } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { announcements, helpArticles, helpCategories, docs } from '@ihui/database'
import { contentRoutes } from '../src/routes/content.js'

async function createAnnouncement(data: {
  title: string
  content?: string
  isPublished?: boolean
  isPinned?: boolean
  type?: string
  expiresAt?: Date | null
  publishedAt?: Date | null
}) {
  const [row] = await db
    .insert(announcements)
    .values({
      title: data.title,
      content: data.content ?? '正文',
      isPublished: data.isPublished ?? true,
      isPinned: data.isPinned ?? false,
      type: data.type ?? 'info',
      expiresAt: data.expiresAt ?? null,
      publishedAt: data.publishedAt,
    })
    .returning()
  return row
}

async function createHelpCategory(data: {
  name: string
  slug: string
  description?: string
  sortOrder?: number
}) {
  const [row] = await db
    .insert(helpCategories)
    .values({
      name: data.name,
      slug: data.slug,
      description: data.description,
      sortOrder: data.sortOrder ?? 0,
    })
    .returning()
  return row
}

async function createHelpArticle(data: {
  title: string
  slug: string
  content?: string
  category?: string
  isPublished?: boolean
  sortOrder?: number
}) {
  const [row] = await db
    .insert(helpArticles)
    .values({
      title: data.title,
      slug: data.slug,
      content: data.content ?? '正文',
      category: data.category ?? 'other',
      isPublished: data.isPublished ?? true,
      sortOrder: data.sortOrder ?? 0,
    })
    .returning()
  return row
}

async function createDoc(data: {
  title: string
  slug: string
  content?: string
  category?: string
  status?: string
  sortOrder?: number
}) {
  const [row] = await db
    .insert(docs)
    .values({
      title: data.title,
      slug: data.slug,
      content: data.content ?? '正文',
      category: data.category ?? 'guide',
      status: data.status ?? 'published',
      sortOrder: data.sortOrder ?? 0,
    })
    .returning()
  return row
}

describe('content-routes — 路由层真实 DB 集成测试', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(contentRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(async () => {
    await db.execute(sql`DELETE FROM announcement_reads`)
    await db.execute(sql`DELETE FROM announcements`)
    await db.execute(sql`DELETE FROM help_articles`)
    await db.execute(sql`DELETE FROM help_categories`)
    await db.execute(sql`DELETE FROM docs`)
  })

  // ===========================================================================
  // Announcements
  // ===========================================================================

  it('GET /api/announcements — 空表返回空列表', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/announcements' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.list).toEqual([])
  })

  it('GET /api/announcements — 仅返回 isPublished=true 且未过期', async () => {
    await createAnnouncement({ title: '已发布', isPublished: true })
    await createAnnouncement({ title: '草稿', isPublished: false })
    await createAnnouncement({
      title: '已过期',
      isPublished: true,
      expiresAt: new Date('2020-01-01'),
    })
    const res = await server.inject({ method: 'GET', url: '/api/announcements' })
    const body = res.json()
    expect(body.data.list).toHaveLength(1)
    expect(body.data.list[0].title).toBe('已发布')
    expect(body.data.list[0].isRead).toBe(false)
  })

  it('GET /api/announcements — isPinned 置顶排序', async () => {
    await createAnnouncement({ title: '普通', isPinned: false })
    await createAnnouncement({ title: '置顶', isPinned: true })
    const res = await server.inject({ method: 'GET', url: '/api/announcements' })
    const body = res.json()
    expect(body.data.list[0].title).toBe('置顶')
    expect(body.data.list[1].title).toBe('普通')
  })

  it('GET /api/announcements/:id — 返回已发布公告详情', async () => {
    const a = await createAnnouncement({ title: '详情', content: '详细内容' })
    const res = await server.inject({ method: 'GET', url: `/api/announcements/${a.id}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.announcement.title).toBe('详情')
    expect(body.data.announcement.content).toBe('详细内容')
  })

  it('GET /api/announcements/:id — 未发布返回 404', async () => {
    const a = await createAnnouncement({ title: '草稿', isPublished: false })
    const res = await server.inject({ method: 'GET', url: `/api/announcements/${a.id}` })
    expect(res.statusCode).toBe(404)
    expect(res.json().message).toBe('公告不存在')
  })

  it('GET /api/announcements/:id — 非法 UUID 返回 400', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/announcements/not-a-uuid' })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.code).toBe(400)
    expect(body.message).toContain('ID')
  })

  // ===========================================================================
  // Help Categories
  // ===========================================================================

  it('GET /api/help/categories — 返回分类列表(按 sortOrder 排序)', async () => {
    await createHelpCategory({ name: 'B 类', slug: 'b-cat', sortOrder: 2 })
    await createHelpCategory({ name: 'A 类', slug: 'a-cat', sortOrder: 1 })
    const res = await server.inject({ method: 'GET', url: '/api/help/categories' })
    const body = res.json()
    expect(body.data.list).toHaveLength(2)
    expect(body.data.list[0].name).toBe('A 类')
    expect(body.data.list[1].name).toBe('B 类')
  })

  // ===========================================================================
  // Help Articles
  // ===========================================================================

  it('GET /api/help/articles — 返回全部文章(含未发布,公开端点不过滤)', async () => {
    await createHelpArticle({ title: '已发布', slug: 'pub-1', isPublished: true })
    await createHelpArticle({ title: '草稿', slug: 'draft-1', isPublished: false })
    const res = await server.inject({ method: 'GET', url: '/api/help/articles' })
    const body = res.json()
    expect(body.data.list).toHaveLength(2)
  })

  it('GET /api/help/articles — category 筛选', async () => {
    await createHelpArticle({ title: 'A1', slug: 'a1', category: 'account' })
    await createHelpArticle({ title: 'A2', slug: 'a2', category: 'payment' })
    const res = await server.inject({ method: 'GET', url: '/api/help/articles?category=account' })
    const body = res.json()
    expect(body.data.list).toHaveLength(1)
    expect(body.data.list[0].title).toBe('A1')
  })

  it('GET /api/help/articles/:slug — 返回详情并自增 viewCount', async () => {
    const a = await createHelpArticle({ title: '详情', slug: 'detail-slug', content: '内容' })
    const before = a.viewCount
    const res = await server.inject({ method: 'GET', url: '/api/help/articles/detail-slug' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.article.title).toBe('详情')
    // 路由返回 increment 前的快照;验证 DB 中 viewCount 已自增
    const [updated] = await db
      .select({ viewCount: helpArticles.viewCount })
      .from(helpArticles)
      .where(eq(helpArticles.id, a.id))
      .limit(1)
    expect(updated.viewCount).toBe(before + 1)
  })

  it('GET /api/help/articles/:slug — 未发布返回 404', async () => {
    await createHelpArticle({ title: '草稿', slug: 'draft-slug', isPublished: false })
    const res = await server.inject({ method: 'GET', url: '/api/help/articles/draft-slug' })
    expect(res.statusCode).toBe(404)
    expect(res.json().message).toBe('文章不存在')
  })

  // ===========================================================================
  // Docs
  // ===========================================================================

  it('GET /api/docs — 仅返回 status=published', async () => {
    await createDoc({ title: '已发布', slug: 'pub-doc', status: 'published' })
    await createDoc({ title: '草稿', slug: 'draft-doc', status: 'draft' })
    const res = await server.inject({ method: 'GET', url: '/api/docs' })
    const body = res.json()
    expect(body.data.list).toHaveLength(1)
    expect(body.data.list[0].title).toBe('已发布')
  })

  it('GET /api/docs — category 筛选', async () => {
    await createDoc({ title: 'API', slug: 'api-1', category: 'api' })
    await createDoc({ title: 'Guide', slug: 'guide-1', category: 'guide' })
    const res = await server.inject({ method: 'GET', url: '/api/docs?category=api' })
    const body = res.json()
    expect(body.data.list).toHaveLength(1)
    expect(body.data.list[0].title).toBe('API')
  })

  it('GET /api/docs/:slug — 返回详情并自增 viewCount', async () => {
    const d = await createDoc({ title: '详情', slug: 'doc-detail', content: '内容' })
    const before = d.viewCount
    const res = await server.inject({ method: 'GET', url: '/api/docs/doc-detail' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.doc.title).toBe('详情')
    // 路由返回 increment 前的快照;验证 DB 中 viewCount 已自增
    const [updated] = await db
      .select({ viewCount: docs.viewCount })
      .from(docs)
      .where(eq(docs.id, d.id))
      .limit(1)
    expect(updated.viewCount).toBe(before + 1)
  })

  it('GET /api/docs/:slug — 未发布返回 404', async () => {
    await createDoc({ title: '草稿', slug: 'doc-draft', status: 'draft' })
    const res = await server.inject({ method: 'GET', url: '/api/docs/doc-draft' })
    expect(res.statusCode).toBe(404)
    expect(res.json().message).toBe('文档不存在')
  })

  it('所有端点响应格式符合 { code, message, data } 规范', async () => {
    await createAnnouncement({ title: 'A' })
    await createHelpCategory({ name: 'C', slug: 'c' })
    await createHelpArticle({ title: 'H', slug: 'h' })
    await createDoc({ title: 'D', slug: 'd' })
    const urls = ['/api/announcements', '/api/help/categories', '/api/help/articles', '/api/docs']
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
