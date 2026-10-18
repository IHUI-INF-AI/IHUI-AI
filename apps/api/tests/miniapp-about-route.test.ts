// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'

const PREFIX = '/api'

/**
 * 读侧夹具:与 notes-crud.test.ts 同一套链式队列 ⇒ 跑的是真实 handler 与真实查询构造,
 * 不把投影 mock 掉自证(§22c)。本路由是公开读出口,无鉴权面。
 */
const queue: { items: unknown[][] } = { items: [] }
vi.mock('../src/db/index.js', () => {
  function chain(): Record<string, unknown> {
    const c: Record<string, unknown> = {
      then: (resolve: (v: unknown[]) => unknown) => {
        const r = queue.items.length > 0 ? queue.items.shift()! : []
        return Promise.resolve(r).then(resolve)
      },
    }
    for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'select']) c[m] = () => c
    return c
  }
  const dbMock = { execute: vi.fn().mockResolvedValue([]), select: () => chain() }
  return { db: dbMock, dbRead: dbMock }
})

import { miniappCompatRoutes } from '../src/routes/miniapp-compat-routes.js'

describe('GET /api/about —— 关于页正文读 docs 已发布文档(不是硬编码桩)', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.setErrorHandler((err, _req, reply) => {
      const sc = err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500
      reply.status(sc).send({ code: sc, message: sc >= 500 ? '服务器错误' : err.message })
    })
    await server.register(miniappCompatRoutes, { prefix: PREFIX })
    await server.ready()
  })
  afterAll(async () => {
    await server.close()
  })
  beforeEach(() => {
    queue.items.length = 0
  })

  it('已发布:原样回文档行,字段就是 docs 的那几列(不发明字段)', async () => {
    queue.items.push([
      {
        title: '关于智汇AI',
        content: '## 一段话介绍\n\n这是首段。\n\n第二段。',
        slug: 'about-us',
        updatedAt: new Date('2026-10-01T00:00:00Z'),
      },
    ])
    const res = await server.inject({ method: 'GET', url: `${PREFIX}/about` })
    expect(res.statusCode).toBe(200)
    expect(Object.keys(res.json().data).sort()).toEqual(['doc'])
    expect(res.json().data.doc).toEqual({
      title: '关于智汇AI',
      content: '## 一段话介绍\n\n这是首段。\n\n第二段。',
      slug: 'about-us',
      updatedAt: '2026-10-01T00:00:00.000Z',
    })
  })

  it('没有已发布文档 ⇒ 404 且不回退成硬编码文案(与同文件 /privacy 那类桩划清界限)', async () => {
    queue.items.push([])
    const res = await server.inject({ method: 'GET', url: `${PREFIX}/about` })
    expect(res.statusCode).toBe(404)
    const body = res.json()
    expect(body.code).toBe(404)
    // 命中的必须是我自己 handler 的那句 404，而不是 Fastify 的 'Route not found'
    expect(String(body.message)).toContain('关于页内容尚未发布')
    // 桩的形态是 data.content 有固定文字 —— 这里必须压根没有 data
    expect(JSON.stringify(body)).not.toMatch(/隐私政策|致力于打造/)
  })

  // 第三条 printRoutes 同树断言已删:前缀树节点合并 + Fastify 打印裁剪让 `about` 不再原样出现,
  // 而路由在册这一事实由上一例用行为学方式证得更强 —— 命中的是本 handler 自己的 404 文案,
  // 不是 Fastify 未注册时的 `Route GET:/api/about not found`。断言强度不该挂在清单文本上。
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
