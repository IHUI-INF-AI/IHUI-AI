// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'

/**
 * 库层用可编排队列夹具(与 notes-crud.test.ts 同一套链式形态):
 * 这样跑的是真实的投影与查询代码,而不是把映射也 mock 掉自证(§22c 镜像纪律)。
 */
const dbQueue: { items: unknown[][] } = { items: [] }
vi.mock('../src/db/index.js', () => {
  function createChain() {
    const chain: {
      then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>
      [m: string]: unknown
    } = {
      then: (resolve) => {
        const result = dbQueue.items.length > 0 ? dbQueue.items.shift()! : []
        return Promise.resolve(result).then(resolve)
      },
    }
    for (const m of [
      'from',
      'where',
      'orderBy',
      'limit',
      'offset',
      'select',
      'innerJoin',
      'leftJoin',
    ]) {
      chain[m] = () => chain
    }
    return chain
  }
  const dbMock = {
    execute: vi.fn().mockResolvedValue([]),
    select: vi.fn(createChain),
  }
  return { db: dbMock, dbRead: dbMock }
})

import { miniappPublicFallbackRoutes } from '../src/routes/miniapp-public-fallback-routes.js'

const LESSON_ID = '11111111-1111-4111-8111-111111111111'
const PREFIX = '/api'

function lessonRow() {
  return {
    id: LESSON_ID,
    title: '数据结构与算法',
    coverImage: 'https://cdn/cover.png',
    intro: '从数组到图的一门课',
    categoryId: null,
    lecturerId: '22222222-2222-4222-8222-222222222222',
    lecturerName: '李老师',
    difficulty: 'beginner',
    price: '39.90',
    originalPrice: '99.00',
    isFree: false,
    viewCount: 12,
    signupCount: 3,
    lessonCount: 8,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  }
}

describe('小程序课程公开 fallback —— /content/course/list 与新增的 /content/course/:id', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.setErrorHandler((err, _request, reply) => {
      const statusCode =
        err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500
      reply
        .status(statusCode)
        .send({ code: statusCode, message: statusCode >= 500 ? '服务器错误' : err.message })
    })
    await server.register(miniappPublicFallbackRoutes, { prefix: PREFIX })
    await server.ready()
  })
  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    // 队列跨用例残留会把"下一次查询的输入"错位供给上一条用例 ⇒ 每条用例从空队列开始
    dbQueue.items.length = 0
  })

  it('详情按端上读取名出键:coverUrl/teacher/description 在位,库列名不得外泄', async () => {
    dbQueue.items.push([lessonRow()], [{ title: '第一章 线性表' }, { title: '第二章 树' }])
    const res = await server.inject({ method: 'GET', url: `${PREFIX}/content/course/${LESSON_ID}` })
    expect(res.statusCode).toBe(200)
    const d = res.json().data
    expect(d).toMatchObject({
      id: LESSON_ID,
      title: '数据结构与算法',
      coverUrl: 'https://cdn/cover.png',
      teacher: '李老师',
      teacherId: '22222222-2222-4222-8222-222222222222',
      description: '从数组到图的一门课',
      level: 'beginner',
      price: 39.9,
      originalPrice: 99,
      outline: [{ title: '第一章 线性表' }, { title: '第二章 树' }],
    })
    // 详情页读的是 course.coverUrl —— 后端过去发的是 coverImage,于是封面恒空
    for (const leaked of ['coverImage', 'lecturerName', 'intro', 'lecturerId']) {
      expect(d).not.toHaveProperty(leaked)
    }
    // numeric 列在 drizzle 里是字符串 ⇒ 投影必须落成数字
    expect(typeof d.price).toBe('number')
  })

  it('库里没有 subtitle 这一列 ⇒ 不发这个键(端上是 optional,缺键即不渲染,胜过造一行假简介)', async () => {
    dbQueue.items.push([lessonRow()], [])
    const d = (
      await server.inject({ method: 'GET', url: `${PREFIX}/content/course/${LESSON_ID}` })
    ).json().data
    expect(d).not.toHaveProperty('subtitle')
    expect(d.outline).toEqual([])
  })

  it('查无此课 ⇒ 404,且不发章节查询(队列里留给大纲那条查询的哨兵必须原样在位)', async () => {
    dbQueue.items.push([], [{ title: '不该被读到的章' }])
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/content/course/33333333-3333-4333-8333-333333333333`,
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().data).toBeUndefined()
    // 第一条被课程查询取走(返回空),第二条留给 findLessonChapters ⇒ 它还挂着 = 大纲查询没发生
    expect(dbQueue.items).toEqual([[{ title: '不该被读到的章' }]])
  })

  it('非 UUID 的 id 走 400,且不进数据库查询', async () => {
    dbQueue.items.push([{ id: '哨兵:若被取走说明参数校验没拦住查询' }])
    const res = await server.inject({ method: 'GET', url: `${PREFIX}/content/course/not-a-uuid` })
    expect(res.statusCode).toBe(400)
    expect(dbQueue.items).toHaveLength(1)
  })

  it('列表与详情共用同一投影:同一行在两个页面上键集一致', async () => {
    dbQueue.items.push([lessonRow()], [{ total: 1 }])
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/content/course/list?page=1&pageSize=20`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Object.keys(body.data).sort()).toEqual(['list', 'page', 'pageSize', 'total'])
    const row = body.data.list[0]
    expect(row).toMatchObject({ coverUrl: 'https://cdn/cover.png', teacher: '李老师', price: 39.9 })
    expect(row).not.toHaveProperty('coverImage')
    expect(row).not.toHaveProperty('intro')
  })

  it('两条路由都在册(printRoutes 前缀树形态 + 同插件既有路由做阳性对照)', async () => {
    const tree = server.printRoutes()
    expect(tree).toMatch(/home \(GET/)
    expect(tree).toMatch(/list \(GET/)
    // :id 挂在 course 节点下,与 list 同层
    expect(tree).toMatch(/:id \(GET/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
