import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('../../db/index.js', () => {
  interface DbChain {
    then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>
    from: () => DbChain
    where: () => DbChain
    orderBy: () => DbChain
  }
  function createChain(result: unknown[] = []): DbChain {
    const chain: DbChain = {
      then: (resolve) => Promise.resolve(result).then(resolve),
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
    }
    return chain
  }
  return {
    db: {
      execute: vi.fn().mockResolvedValue([]),
      select: vi.fn(() => createChain([])),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  }
})

import { carouselPublicRoutes } from '../carousel.js'
import { db } from '../../db/index.js'

const ACTIVE_ROW = {
  id: 'c-001',
  position: 'home',
  imageUrl: 'https://cdn.example.com/a.png',
  title: '首页轮播一',
  linkUrl: 'https://example.com/p/1',
  description: '活动一',
  sort: 1,
}
const SIDEBAR_ROW = {
  id: 'c-002',
  position: 'sidebar',
  imageUrl: 'https://cdn.example.com/b.png',
  title: '侧栏轮播二',
  linkUrl: null,
  description: null,
  sort: 2,
}

describe('Carousel Public API — GET /api/carousels', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(carouselPublicRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('未登录可访问(200 非 401)且返回启用状态轮播图列表', async () => {
    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          orderBy: () => Promise.resolve([ACTIVE_ROW, SIDEBAR_ROW]),
        }),
      }),
    } as never)

    const res = await app.inject({ method: 'GET', url: '/api/carousels' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.message).toBe('success')
    expect(Array.isArray(body.data.list)).toBe(true)
    expect(body.data.list).toHaveLength(2)
    expect(body.data.list[0]).toMatchObject({
      id: 'c-001',
      position: 'home',
      imageUrl: 'https://cdn.example.com/a.png',
    })
  })

  it('只返回 status=1 的记录(查询条件含 status=1)', async () => {
    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          orderBy: () => Promise.resolve([ACTIVE_ROW]),
        }),
      }),
    } as never)

    const res = await app.inject({ method: 'GET', url: '/api/carousels' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.list).toHaveLength(1)
    expect(body.data.list[0].id).toBe('c-001')

    expect(db.select).toHaveBeenCalledTimes(1)
  })

  it('position 筛选生效(只返回 home 位置)', async () => {
    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          orderBy: () => Promise.resolve([ACTIVE_ROW]),
        }),
      }),
    } as never)

    const res = await app.inject({ method: 'GET', url: '/api/carousels?position=home' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.list).toHaveLength(1)
    expect(body.data.list[0].position).toBe('home')
  })

  it('无匹配数据时返回空列表(非 404)', async () => {
    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          orderBy: () => Promise.resolve([]),
        }),
      }),
    } as never)

    const res = await app.inject({ method: 'GET', url: '/api/carousels?position=empty' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.list).toEqual([])
  })

  it('返回字段仅包含公开白名单(id/position/imageUrl/title/linkUrl/description/sort)', async () => {
    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          orderBy: () => Promise.resolve([ACTIVE_ROW]),
        }),
      }),
    } as never)

    const res = await app.inject({ method: 'GET', url: '/api/carousels' })
    expect(res.statusCode).toBe(200)
    const item = res.json().data.list[0]
    const allowed = ['id', 'position', 'imageUrl', 'title', 'linkUrl', 'description', 'sort']
    Object.keys(item).forEach((k) => {
      expect(allowed).toContain(k)
    })
    expect(item).not.toHaveProperty('status')
    expect(item).not.toHaveProperty('startAt')
    expect(item).not.toHaveProperty('endAt')
  })
})
