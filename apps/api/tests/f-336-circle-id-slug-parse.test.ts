// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-336 回归锁(2026-11-13)。
 *
 * 病灶:GET /api/circles/:id 与 GET /api/circles/:id/posts 在调用 findCircleByIdOrSlug 之前
 * 先 `if (!isUuidString(id)) return 404`,slug 分支成死代码 —— 用创建接口返回的 slug 拼链接
 * 恒 404;同时非 uuid/非 slug 的畸形段(含 %、空格、超长)没有统一口径。
 *
 * 本文件锁:
 *  - parseCircleIdentifier:纯数字/UUID → id,合法 slug → slug,其余 → null;
 *  - 两个端点共用该判据:非法段 400 且**零查询**;合法 slug 真的按 slug 列查(不再 404);
 *  - 纯数字段走 id 分支但不喂 uuid 列(零查询、404,不出现 22P02/500)。
 * 隔离:mock auth / db / 敏感词,不连库。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyError } from 'fastify'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const CIRCLE_ID = '33333333-3333-4333-8333-333333333333'
const SLUG = 'hello-circle'
const PREFIX = '/api'

const h = vi.hoisted(() => {
  const queue: { items: unknown[][] } = { items: [] }
  const state = { selectCalls: 0, wheres: [] as unknown[] }
  function makeChain(): Record<string, unknown> {
    const chain: Record<string, unknown> = {
      then: (resolve: (v: unknown[]) => unknown) => {
        const result = queue.items.length > 0 ? queue.items.shift()! : []
        return Promise.resolve(result).then(resolve)
      },
    }
    for (const m of [
      'from',
      'limit',
      'orderBy',
      'offset',
      'leftJoin',
      'values',
      'set',
      'returning',
      'onConflictDoNothing',
    ]) {
      chain[m] = () => chain
    }
    chain.where = (cond: unknown) => {
      state.wheres.push(cond)
      return chain
    }
    return chain
  }
  const dbMock = {
    select: () => {
      state.selectCalls += 1
      return makeChain()
    },
    insert: () => makeChain(),
    update: () => makeChain(),
    delete: () => makeChain(),
    execute: async () => [],
  }
  return { queue, state, dbMock }
})

const authMock = vi.hoisted(() => ({
  authenticate: vi.fn(async (request: { userId?: string }) => {
    request.userId = undefined
  }),
  hasHumanJwtCredential: vi.fn(() => false),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: authMock.authenticate,
  hasHumanJwtCredential: authMock.hasHumanJwtCredential,
}))

vi.mock('../src/db/index.js', () => ({
  db: h.dbMock,
  dbRead: { select: () => h.dbMock.select() },
}))

vi.mock('../src/db/sensitive-words-queries.js', () => ({
  sanitizeUgcInput: vi.fn(),
}))

import circlesRoutes from '../src/routes/community/circles.js'
import { parseCircleIdentifier } from '../src/db/community-queries.js'

const PUBLISHED_CIRCLE = {
  id: CIRCLE_ID,
  name: '公开圈子',
  slug: SLUG,
  description: null,
  coverImage: null,
  categoryId: null,
  cidList: null,
  memberCount: 0,
  postCount: 1,
  isPublished: true,
  createdBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const POST_ROW = {
  id: '44444444-4444-4444-8444-444444444444',
  circleId: CIRCLE_ID,
  userId: '55555555-5555-4555-8555-555555555555',
  title: '帖子',
  content: '正文',
  images: null,
  viewCount: 0,
  likeCount: 0,
  replyCount: 0,
  isPinned: false,
  status: 1,
  visibility: 'public',
  createdAt: new Date(),
  updatedAt: new Date(),
  authorName: null,
}

/** 遍历 drizzle 条件树,收集其中出现的列名(id / slug / is_published...)。 */
function columnNames(node: unknown, out: string[] = []): string[] {
  if (!node || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    for (const n of node) columnNames(n, out)
    return out
  }
  const obj = node as { name?: unknown; queryChunks?: unknown[] }
  if (typeof obj.name === 'string') out.push(obj.name)
  if (Array.isArray(obj.queryChunks)) for (const c of obj.queryChunks) columnNames(c, out)
  return out
}

describe('F-336 parseCircleIdentifier:唯一判定口径', () => {
  it('纯数字与 UUID 走 id 分支', () => {
    expect(parseCircleIdentifier('12345')).toEqual({ kind: 'id', value: '12345' })
    expect(parseCircleIdentifier(CIRCLE_ID)).toEqual({ kind: 'id', value: CIRCLE_ID })
  })

  it('合法 slug 走 slug 分支(含 64 字符边界)', () => {
    expect(parseCircleIdentifier(SLUG)).toEqual({ kind: 'slug', value: SLUG })
    expect(parseCircleIdentifier('a-b-c-2')).toEqual({ kind: 'slug', value: 'a-b-c-2' })
    expect(parseCircleIdentifier('a'.repeat(64))).toEqual({ kind: 'slug', value: 'a'.repeat(64) })
  })

  it('非法形态一律 null(%, 空格, 大写, 空串, 超长)', () => {
    expect(parseCircleIdentifier('bad%slug')).toBeNull()
    expect(parseCircleIdentifier('bad slug')).toBeNull()
    expect(parseCircleIdentifier('Bad-Slug')).toBeNull()
    expect(parseCircleIdentifier('')).toBeNull()
    expect(parseCircleIdentifier('a'.repeat(65))).toBeNull()
  })
})

describe('F-336 GET /circles/:id 与 /posts 共用判据', () => {
  const app = Fastify({ logger: false })

  beforeAll(async () => {
    app.setErrorHandler((err: FastifyError, _request, reply) => {
      const statusCode =
        err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500
      reply.status(statusCode).send({ code: statusCode, message: err.message })
    })
    await app.register(circlesRoutes, { prefix: PREFIX })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    h.queue.items.length = 0
    h.state.selectCalls = 0
    h.state.wheres.length = 0
  })

  it('合法 slug 详情按 slug 列查(不再 404)', async () => {
    h.queue.items.push([PUBLISHED_CIRCLE])
    const res = await app.inject({ method: 'GET', url: `${PREFIX}/circles/${SLUG}` })
    expect(res.statusCode).toBe(200)
    expect(h.state.selectCalls).toBe(1)
    const cols = columnNames(h.state.wheres[0])
    expect(cols).toContain('slug')
    expect(cols).toContain('is_published')
    expect(cols).not.toContain('id')
  })

  it('合法 slug 帖子列表按 slug 列查', async () => {
    h.queue.items.push([PUBLISHED_CIRCLE], [[POST_ROW]], [[{ count: 1 }]])
    const res = await app.inject({ method: 'GET', url: `${PREFIX}/circles/${SLUG}/posts` })
    expect(res.statusCode).toBe(200)
    expect(h.state.selectCalls).toBe(3)
    expect(columnNames(h.state.wheres[0])).toContain('slug')
  })

  it('UUID 详情仍走 id 列', async () => {
    h.queue.items.push([PUBLISHED_CIRCLE])
    const res = await app.inject({ method: 'GET', url: `${PREFIX}/circles/${CIRCLE_ID}` })
    expect(res.statusCode).toBe(200)
    const cols = columnNames(h.state.wheres[0])
    expect(cols).toContain('id')
    expect(cols).not.toContain('slug')
  })

  it('纯数字走 id 分支:不喂 uuid 列 ⇒ 404 且零查询(不是 500)', async () => {
    const detail = await app.inject({ method: 'GET', url: `${PREFIX}/circles/12345` })
    expect(detail.statusCode).toBe(404)
    const posts = await app.inject({ method: 'GET', url: `${PREFIX}/circles/12345/posts` })
    expect(posts.statusCode).toBe(404)
    expect(h.state.selectCalls).toBe(0)
  })

  it.each([
    ['含 %', 'bad%slug'],
    ['含空格', 'bad slug'],
    ['超长', 'a'.repeat(65)],
  ])('%s 的非法段在两个端点都 400 且零查询', async (_label, raw) => {
    const seg = encodeURIComponent(raw)
    const detail = await app.inject({ method: 'GET', url: `${PREFIX}/circles/${seg}` })
    expect(detail.statusCode).toBe(400)
    expect(detail.json().code).toBe(400)
    const posts = await app.inject({ method: 'GET', url: `${PREFIX}/circles/${seg}/posts` })
    expect(posts.statusCode).toBe(400)
    expect(posts.json().code).toBe(400)
    expect(h.state.selectCalls).toBe(0)
  })
})

describe('F-336 源锁:两个端点都经过同一解析函数', () => {
  const src = readFileSync(
    fileURLToPath(new URL('../src/routes/community/circles.ts', import.meta.url)),
    'utf8',
  )

  it('circles.ts 恰有两处 parseCircleIdentifier 调用', () => {
    expect(src.match(/parseCircleIdentifier\(/g)?.length).toBe(2)
  })

  it('查询层导出并复用同一判据', () => {
    expect(typeof parseCircleIdentifier).toBe('function')
    const q = readFileSync(
      fileURLToPath(new URL('../src/db/community-queries.ts', import.meta.url)),
      'utf8',
    )
    expect(q).toContain('export function parseCircleIdentifier')
    expect(q).toMatch(/findCircleByIdOrSlug[\s\S]*?parseCircleIdentifier\(/)
  })
})
