// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * GET /api/articles/:id 与 RN 字段契约对账(2026-10-26 立)。
 *
 * 立因不是"想加接口",而是盘点跨端覆盖时量出来的一个**结构性断链**:
 * ① 路由缺席。apps/mobile-rn/src/screens/ArticleDetailScreen.tsx:82 早就在打
 *    `/api/articles/:id`,而 apps/api/src/routes/articles.ts 里只有列表 —— 详情 100% 404。
 *    反证它"本该存在":apps/api/src/plugins/watch-aspect.ts:27 早已预置这条 URL 的
 *    浏览计数拦截 ⇒ 缺的是路由本身,不是"屏还没写"。
 * ② 字段不同名。即使补上路由,表列是 authorName/coverImage/viewCount(news_articles),
 *    而 packages/types 的 ArticleDetailItem 读 author/cover/views —— 少一层映射,RN
 *    拿到 200 仍渲染空标题以外的全部字段。所以本文件同时钉「200」与「契约字段取值」。
 *
 * 它钉四件事,摘掉任一条即翻红:
 *   A 路由存在且按 id 命中(404 断言是它的阳性对照:同一条夹具改 isPublished=false 就必须 404);
 *   B RN 契约字段齐备且取值正确(author/cover/views/likes/publishedAt 为 ISO 字符串);
 *   C 表原字段不删(web/admin 与既有 real 测试仍按 categoryName/authorName 断言 —— 只增不改);
 *   D 三档边界:未发布 404 / 不存在 404 / 非法 id 400。
 *
 * 隔离:全程 mock 查询函数,不连库、不连 Redis(AGENTS §5 测试隔离铁律)。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const ARTICLE_ID = '3f2a1b6c-0000-4000-8000-abcdef000001'
const MISSING_ID = '00000000-0000-4000-8000-000000000000'

const store = vi.hoisted(() => ({
  published: true,
  found: true,
}))

function tableRow() {
  return {
    id: ARTICLE_ID,
    title: '跨端详情标题',
    content: '正文若干',
    summary: '摘要',
    authorName: '张三',
    coverImage: 'https://cdn.example.com/cover.png',
    viewCount: 7,
    publishedAt: new Date('2026-10-26T00:00:00.000Z'),
    isPublished: store.published,
    categoryId: 'c1',
    categoryName: '科技',
    status: 1,
  }
}

vi.mock('../../db/news-queries.js', () => ({
  findPublishedArticles: vi.fn(async () => ({
    list: [tableRow()],
    total: 1,
    page: 1,
    pageSize: 20,
  })),
  findArticleById: vi.fn(async (id: string) => {
    if (id !== ARTICLE_ID || !store.found) return undefined
    return tableRow()
  }),
}))

describe('articles 详情路由 — RN 字段契约', () => {
  const server: FastifyInstance = Fastify({ logger: false })

  beforeAll(async () => {
    const { articleRoutes } = await import('../../routes/articles.js')
    await server.register(articleRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  it('A 已发布文章按 id 命中 200(路由不存在时这里就是 404)', async () => {
    store.published = true
    store.found = true
    const res = await server.inject({ method: 'GET', url: `/api/articles/${ARTICLE_ID}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.id).toBe(ARTICLE_ID)
  })

  it('B RN 契约字段齐备:author/cover/views/likes/publishedAt(ISO 字符串)', async () => {
    store.published = true
    store.found = true
    const res = await server.inject({ method: 'GET', url: `/api/articles/${ARTICLE_ID}` })
    const d = res.json().data
    expect(d.content).toBe('正文若干')
    expect(d.author).toBe('张三')
    expect(d.cover).toBe('https://cdn.example.com/cover.png')
    expect(d.views).toBe(7)
    expect(d.likes).toBe(0)
    expect(typeof d.publishedAt).toBe('string')
    expect(d.publishedAt.startsWith('2026-10-26')).toBe(true)
  })

  it('C 表原字段保留(只增补,不删既有消费者的键)', async () => {
    store.published = true
    store.found = true
    const res = await server.inject({ method: 'GET', url: `/api/articles/${ARTICLE_ID}` })
    const d = res.json().data
    expect(d.authorName).toBe('张三')
    expect(d.viewCount).toBe(7)
    expect(d.categoryName).toBe('科技')
  })

  it('D1 未发布 ⇒ 404(与 A 同一条夹具,构成阳性对照)', async () => {
    store.published = false
    store.found = true
    const res = await server.inject({ method: 'GET', url: `/api/articles/${ARTICLE_ID}` })
    expect(res.statusCode).toBe(404)
    store.published = true
  })

  it('D2 id 不存在 ⇒ 404', async () => {
    store.found = true
    const res = await server.inject({ method: 'GET', url: `/api/articles/${MISSING_ID}` })
    expect(res.statusCode).toBe(404)
  })

  it('D3 非法 id ⇒ 400 且不落到查询层', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/articles/not-a-uuid' })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe(400)
  })

  it('列表侧同样补齐 RN 契约字段(ArticleListItem 读的也是别名)', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/articles' })
    expect(res.statusCode).toBe(200)
    const d = res.json().data[0]
    expect(d.author).toBe('张三')
    expect(d.views).toBe(7)
    expect(typeof d.publishedAt).toBe('string')
    expect(d.categoryName).toBe('科技')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
