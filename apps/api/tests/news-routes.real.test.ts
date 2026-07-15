import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { eq, sql } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { newsCategories, newsArticles, newsTops, newsRecommends } from '@ihui/database'
import { newsRoutes } from '../src/routes/news.js'

async function createCategory(data: { name: string; sort?: number; status?: number }) {
  const [row] = await db
    .insert(newsCategories)
    .values({
      name: data.name,
      sort: data.sort ?? 0,
      status: data.status ?? 1,
    })
    .returning()
  return row
}

async function createArticle(data: {
  title: string
  categoryId?: string
  content?: string
  summary?: string
  coverImage?: string
  authorName?: string
  isPublished?: boolean
  isPinned?: boolean
  viewCount?: number
  sort?: number
  status?: number
  publishedAt?: Date
}) {
  const [row] = await db
    .insert(newsArticles)
    .values({
      title: data.title,
      categoryId: data.categoryId,
      content: data.content ?? '正文',
      summary: data.summary,
      coverImage: data.coverImage,
      authorName: data.authorName,
      isPublished: data.isPublished ?? false,
      isPinned: data.isPinned ?? false,
      viewCount: data.viewCount ?? 0,
      sort: data.sort ?? 0,
      status: data.status ?? 0,
      publishedAt: data.publishedAt,
    })
    .returning()
  return row
}

async function createNewsTop(data: { newsId: string; sort?: number }) {
  const [row] = await db
    .insert(newsTops)
    .values({ newsId: data.newsId, sort: data.sort ?? 0 })
    .returning()
  return row
}

async function createNewsRecommend(data: { newsId: string; sort?: number }) {
  const [row] = await db
    .insert(newsRecommends)
    .values({ newsId: data.newsId, sort: data.sort ?? 0 })
    .returning()
  return row
}

describe('news-routes — 路由层真实 DB 集成测试', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(newsRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(async () => {
    await db.execute(sql`DELETE FROM news_tops`)
    await db.execute(sql`DELETE FROM news_recommends`)
    await db.execute(sql`DELETE FROM news_articles`)
    await db.execute(sql`DELETE FROM news_categories`)
  })

  it('GET /api/news/categories — 空表返回空数组', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/news/categories' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.list).toEqual([])
  })

  it('GET /api/news/categories — 仅返回 status=1 的分类', async () => {
    await createCategory({ name: '启用', sort: 1, status: 1 })
    await createCategory({ name: '禁用', sort: 2, status: 0 })
    const res = await server.inject({ method: 'GET', url: '/api/news/categories' })
    const body = res.json()
    expect(body.data.list).toHaveLength(1)
    expect(body.data.list[0].name).toBe('启用')
  })

  it('GET /api/news/categories — 按 sort 升序、createdAt 升序排序', async () => {
    await createCategory({ name: 'B', sort: 2 })
    await createCategory({ name: 'A', sort: 1 })
    await createCategory({ name: 'C', sort: 3 })
    const res = await server.inject({ method: 'GET', url: '/api/news/categories' })
    const body = res.json()
    expect(body.data.list.map((c: { name: string }) => c.name)).toEqual(['A', 'B', 'C'])
  })

  it('GET /api/news/hot — 空表返回空数组', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/news/hot' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data).toEqual([])
  })

  it('GET /api/news/hot — 仅返回已发布资讯 (isPublished+status=1)', async () => {
    await createArticle({ title: '已发布', isPublished: true, status: 1, viewCount: 10 })
    await createArticle({ title: '未发布', isPublished: false, status: 0 })
    await createArticle({ title: '已发布但 status=0', isPublished: true, status: 0 })
    const res = await server.inject({ method: 'GET', url: '/api/news/hot' })
    const body = res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].title).toBe('已发布')
  })

  it('GET /api/news/hot — limit 参数限制返回数量', async () => {
    for (let i = 0; i < 5; i++) {
      await createArticle({
        title: `文章${i}`,
        isPublished: true,
        status: 1,
        viewCount: 100 - i,
      })
    }
    const res = await server.inject({ method: 'GET', url: '/api/news/hot?limit=3' })
    const body = res.json()
    expect(body.data).toHaveLength(3)
  })

  it('GET /api/news/hot — 字段格式 (id/title/viewCount/publishedAt)', async () => {
    const publishedAt = new Date('2026-01-01T00:00:00Z')
    const article = await createArticle({
      title: '热门文章',
      isPublished: true,
      status: 1,
      viewCount: 999,
      publishedAt,
    })
    const res = await server.inject({ method: 'GET', url: '/api/news/hot' })
    const body = res.json()
    expect(body.data[0]).toEqual({
      id: article.id,
      title: '热门文章',
      viewCount: 999,
      publishedAt: publishedAt.toISOString(),
    })
  })

  it('GET /api/news/hot — 无 publishedAt 时回退当前时间', async () => {
    await createArticle({ title: '无发布时间', isPublished: true, status: 1 })
    const res = await server.inject({ method: 'GET', url: '/api/news/hot' })
    const body = res.json()
    expect(body.data[0].publishedAt).toBeDefined()
    expect(() => new Date(body.data[0].publishedAt).toISOString()).not.toThrow()
  })

  it('GET /api/news/articles — 空表返回空列表', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/news/articles' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.list).toEqual([])
    expect(body.data.total).toBe(0)
    expect(body.data.page).toBe(1)
    expect(body.data.pageSize).toBe(20)
  })

  it('GET /api/news/articles — 仅返回 isPublished=true + status=1', async () => {
    await createArticle({ title: '已发布', isPublished: true, status: 1 })
    await createArticle({ title: '草稿', isPublished: false, status: 0 })
    await createArticle({ title: '已发布但下线', isPublished: true, status: 0 })
    const res = await server.inject({ method: 'GET', url: '/api/news/articles' })
    const body = res.json()
    expect(body.data.list).toHaveLength(1)
    expect(body.data.list[0].title).toBe('已发布')
  })

  it('GET /api/news/articles — 按 categoryId 筛选', async () => {
    const cat = await createCategory({ name: '技术' })
    await createArticle({ title: '分类内', categoryId: cat.id, isPublished: true, status: 1 })
    await createArticle({ title: '分类外', isPublished: true, status: 1 })
    const res = await server.inject({
      method: 'GET',
      url: `/api/news/articles?categoryId=${cat.id}`,
    })
    const body = res.json()
    expect(body.data.list).toHaveLength(1)
    expect(body.data.list[0].title).toBe('分类内')
    expect(body.data.list[0].categoryName).toBe('技术')
  })

  it('GET /api/news/articles — 联表返回 categoryName', async () => {
    const cat = await createCategory({ name: '设计' })
    await createArticle({ title: '文章', categoryId: cat.id, isPublished: true, status: 1 })
    const res = await server.inject({ method: 'GET', url: '/api/news/articles' })
    const body = res.json()
    expect(body.data.list[0].categoryName).toBe('设计')
  })

  it('GET /api/news/articles — search 模糊搜索 title', async () => {
    await createArticle({ title: 'React 入门指南', isPublished: true, status: 1 })
    await createArticle({ title: 'Vue 实战', isPublished: true, status: 1 })
    const res = await server.inject({
      method: 'GET',
      url: '/api/news/articles?search=React',
    })
    const body = res.json()
    expect(body.data.list).toHaveLength(1)
    expect(body.data.list[0].title).toBe('React 入门指南')
  })

  it('GET /api/news/articles — 分页 (page/pageSize)', async () => {
    for (let i = 0; i < 5; i++) {
      await createArticle({
        title: `文章${i}`,
        isPublished: true,
        status: 1,
        publishedAt: new Date(2026, 0, i + 1),
      })
    }
    const res = await server.inject({
      method: 'GET',
      url: '/api/news/articles?page=2&pageSize=2',
    })
    const body = res.json()
    expect(body.data.list).toHaveLength(2)
    expect(body.data.total).toBe(5)
    expect(body.data.page).toBe(2)
    expect(body.data.pageSize).toBe(2)
  })

  it('GET /api/news/articles — 置顶文章排在前面 (isPinned desc)', async () => {
    await createArticle({
      title: '普通',
      isPublished: true,
      status: 1,
      publishedAt: new Date('2026-01-03'),
    })
    await createArticle({
      title: '置顶',
      isPublished: true,
      status: 1,
      isPinned: true,
      publishedAt: new Date('2026-01-01'),
    })
    const res = await server.inject({ method: 'GET', url: '/api/news/articles' })
    const body = res.json()
    expect(body.data.list[0].title).toBe('置顶')
    expect(body.data.list[1].title).toBe('普通')
  })

  it('GET /api/news/articles/pinned — 空置顶列表返回空数组', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/news/articles/pinned' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.list).toEqual([])
  })

  it('GET /api/news/articles/pinned — 返回置顶文章列表', async () => {
    const article = await createArticle({
      title: '置顶文章',
      isPublished: true,
      status: 1,
    })
    await createNewsTop({ newsId: article.id, sort: 1 })
    const res = await server.inject({ method: 'GET', url: '/api/news/articles/pinned' })
    const body = res.json()
    expect(body.data.list).toHaveLength(1)
    expect(body.data.list[0].title).toBe('置顶文章')
  })

  it('GET /api/news/articles/pinned — 未发布的置顶文章不返回', async () => {
    const article = await createArticle({
      title: '未发布置顶',
      isPublished: false,
      status: 0,
    })
    await createNewsTop({ newsId: article.id, sort: 1 })
    const res = await server.inject({ method: 'GET', url: '/api/news/articles/pinned' })
    const body = res.json()
    expect(body.data.list).toEqual([])
  })

  it('GET /api/news/articles/recommended — 空推荐列表返回空数组', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/news/articles/recommended' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.list).toEqual([])
  })

  it('GET /api/news/articles/recommended — 返回推荐文章列表', async () => {
    const article = await createArticle({
      title: '推荐文章',
      isPublished: true,
      status: 1,
    })
    await createNewsRecommend({ newsId: article.id, sort: 1 })
    const res = await server.inject({ method: 'GET', url: '/api/news/articles/recommended' })
    const body = res.json()
    expect(body.data.list).toHaveLength(1)
    expect(body.data.list[0].title).toBe('推荐文章')
  })

  it('GET /api/news/articles/:id — 返回详情', async () => {
    const article = await createArticle({
      title: '详情测试',
      content: '详细内容',
      isPublished: true,
      status: 1,
    })
    const res = await server.inject({ method: 'GET', url: `/api/news/articles/${article.id}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.article.title).toBe('详情测试')
    expect(body.data.article.content).toBe('详细内容')
  })

  it('GET /api/news/articles/:id — 不存在返回 404', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/news/articles/00000000-0000-0000-0000-000000000000',
    })
    expect(res.statusCode).toBe(404)
    const body = res.json()
    expect(body.code).toBe(404)
    expect(body.message).toBe('资讯不存在')
  })

  it('GET /api/news/articles/:id — 未发布资讯返回 404', async () => {
    const article = await createArticle({
      title: '未发布',
      isPublished: false,
      status: 0,
    })
    const res = await server.inject({ method: 'GET', url: `/api/news/articles/${article.id}` })
    expect(res.statusCode).toBe(404)
  })

  it('GET /api/news/articles/:id — 访问详情时自增 viewCount', async () => {
    const article = await createArticle({
      title: '浏览测试',
      isPublished: true,
      status: 1,
      viewCount: 5,
    })
    const before = article.viewCount
    const res = await server.inject({ method: 'GET', url: `/api/news/articles/${article.id}` })
    expect(res.statusCode).toBe(200)
    const [updated] = await db
      .select({ viewCount: newsArticles.viewCount })
      .from(newsArticles)
      .where(eq(newsArticles.id, article.id))
      .limit(1)
    expect(updated.viewCount).toBe(before + 1)
  })

  it('GET /api/news/articles/:id — 非法 UUID 返回 400', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/news/articles/not-a-uuid' })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.code).toBe(400)
  })

  it('所有端点响应格式符合 { code, message, data } 规范', async () => {
    const article = await createArticle({
      title: '格式校验',
      isPublished: true,
      status: 1,
    })
    const urls = [
      '/api/news/categories',
      '/api/news/hot',
      '/api/news/articles',
      '/api/news/articles/pinned',
      '/api/news/articles/recommended',
      `/api/news/articles/${article.id}`,
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
