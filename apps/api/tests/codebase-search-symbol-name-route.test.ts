// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Z36(路由侧):`POST /api/v1/codebase/search` 的可选 `symbolName` 入参契约。
 *
 * 钉四件事:
 * ① 缺省 ⇒ 出参键集与今天逐字等价,且服务层收到 `symbolName: undefined`(不是空串);
 * ② 带上 ⇒ 逐字透传给当次 mode 对应的那条腿;
 * ③ 空串 / 非串 / 超长 ⇒ 该文件既有 400 口径,**服务层一次都不许被调**(不得静默当"无过滤");
 * ④ 归属仍只来自 preHandler 认证结果:请求体里塞 `userId` / `ownerUuid` 一律无效
 *   (AGENTS §5「认证不等于授权」—— symbolName 是被筛的数据列,不是身份)。
 *
 * 零真实 DB / 零网络:服务与 authenticate 都是替身,PG 8810 与 Redis 8811 一概不碰(§5 测试隔离)。
 */
import { describe, expect, it, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import type { FastifyRequest } from 'fastify'

type ServiceOpts = Record<string, unknown>
type Row = Record<string, unknown>

const { authenticate, searchSpy, keywordSpy, hybridSpy } = vi.hoisted(() => ({
  authenticate: vi.fn<(req: FastifyRequest) => Promise<void>>(),
  searchSpy: vi.fn<(o: ServiceOpts) => Promise<Row[]>>(),
  keywordSpy: vi.fn<(o: ServiceOpts) => Promise<Row[]>>(),
  hybridSpy: vi.fn<(o: ServiceOpts) => Promise<Row[]>>(),
}))

vi.mock('../src/plugins/auth.js', () => ({ authenticate }))
vi.mock('../src/services/codebase-index-service.js', () => ({
  codebaseIndexService: { search: searchSpy, keywordSearch: keywordSpy, hybridSearch: hybridSpy },
}))

import { codebaseSearchRoutes } from '../src/routes/v1-codebase-search.js'

const OWNER = 'user-a'
const CHUNK: Row = {
  id: 'c1',
  filePath: 'src/alpha.ts',
  lineStart: 1,
  lineEnd: 8,
  content: 'function alpha() {}',
  language: 'typescript',
  symbolName: 'alpha',
  symbolType: 'function',
  score: 0.61,
  embeddingProvider: 'remote',
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify()
  await app.register(codebaseSearchRoutes, { prefix: '/api/v1/codebase' })
  await app.ready()
  return app
}

function post(app: FastifyInstance, body: unknown) {
  return app.inject({ method: 'POST', url: '/api/v1/codebase/search', body })
}

beforeEach(() => {
  vi.clearAllMocks()
  authenticate.mockImplementation(async (req: FastifyRequest) => {
    ;(req as FastifyRequest & { userId?: string }).userId = OWNER
  })
  hybridSpy.mockResolvedValue([CHUNK])
  searchSpy.mockResolvedValue([CHUNK])
  keywordSpy.mockResolvedValue([CHUNK])
})

describe('symbolName 入参契约', () => {
  it('缺省 ⇒ 200,出参键集逐字不变,服务层收到 symbolName: undefined', async () => {
    const app = await buildApp()
    const res = await post(app, { query: 'alpha' })
    expect(res.statusCode).toBe(200)
    const json = res.json() as Record<string, unknown>
    expect(Object.keys(json).sort()).toEqual(['code', 'data', 'message'])
    const data = json.data as Record<string, unknown>
    expect(Object.keys(data)).toEqual(['chunks'])
    const first = (data.chunks as Row[])[0] as Row
    expect(Object.keys(first).sort()).toEqual(
      [
        'content',
        'embeddingProvider',
        'filePath',
        'id',
        'language',
        'lineEnd',
        'lineStart',
        'score',
        'symbolName',
        'symbolType',
      ].sort(),
    )
    const opts = hybridSpy.mock.calls[0]?.[0] as ServiceOpts
    expect('symbolName' in opts).toBe(true)
    expect(opts.symbolName).toBeUndefined()
    await app.close()
  })

  it('带上 ⇒ 逐字透传给默认(hybrid)腿,不改写不裁空白', async () => {
    const app = await buildApp()
    const res = await post(app, { query: 'alpha', symbolName: 'Alpha_One' })
    expect(res.statusCode).toBe(200)
    expect(hybridSpy.mock.calls[0]?.[0]).toMatchObject({ symbolName: 'Alpha_One' })
    await app.close()
  })

  it('mode=keyword / vector 各自那条腿也拿到过滤位', async () => {
    const app = await buildApp()
    await post(app, { query: 'alpha', symbolName: 'alpha', mode: 'keyword' })
    expect(keywordSpy.mock.calls[0]?.[0]).toMatchObject({ symbolName: 'alpha' })
    expect(hybridSpy).not.toHaveBeenCalled()
    await post(app, { query: 'alpha', symbolName: 'alpha', mode: 'vector' })
    expect(searchSpy.mock.calls[0]?.[0]).toMatchObject({ symbolName: 'alpha' })
    await app.close()
  })

  it('空串 ⇒ 400 且服务层一次都不被调(不静默降级成"无过滤")', async () => {
    const app = await buildApp()
    const res = await post(app, { query: 'alpha', symbolName: '' })
    expect(res.statusCode).toBe(400)
    const json = res.json() as Record<string, unknown>
    expect(json.code).toBe(400)
    expect(typeof json.message).toBe('string')
    expect((json.message as string).length).toBeGreaterThan(0)
    expect(hybridSpy).not.toHaveBeenCalled()
    await app.close()
  })

  it('非串 / 超长 ⇒ 同样是具名 400,不落进业务腿', async () => {
    const app = await buildApp()
    const badNumber = await post(app, { query: 'alpha', symbolName: 123 })
    expect(badNumber.statusCode).toBe(400)
    const tooLong = await post(app, { query: 'alpha', symbolName: 'x'.repeat(201) })
    expect(tooLong.statusCode).toBe(400)
    expect(hybridSpy).not.toHaveBeenCalled()
    await app.close()
  })

  it('归属只认认证结果:请求体里的 userId/ownerUuid 不得成为过滤身份', async () => {
    const app = await buildApp()
    const res = await post(app, {
      query: 'alpha',
      symbolName: 'alpha',
      userId: 'victim',
      ownerUuid: 'victim',
    })
    expect(res.statusCode).toBe(200)
    const opts = hybridSpy.mock.calls[0]?.[0] as ServiceOpts
    expect(opts.ownerUuid).toBe(OWNER)
    expect(Object.keys(opts).sort()).toEqual(
      ['language', 'ownerUuid', 'query', 'repoId', 'scoreThreshold', 'symbolName', 'topK'].sort(),
    )
    await app.close()
  })

  it('认证拿不到身份 ⇒ 401 fail-closed,带不带 symbolName 都一样', async () => {
    authenticate.mockImplementation(async (req: FastifyRequest) => {
      delete (req as FastifyRequest & { userId?: string }).userId
    })
    const app = await buildApp()
    const res = await post(app, { query: 'alpha', symbolName: 'alpha' })
    expect(res.statusCode).toBe(401)
    expect(hybridSpy).not.toHaveBeenCalled()
    await app.close()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
