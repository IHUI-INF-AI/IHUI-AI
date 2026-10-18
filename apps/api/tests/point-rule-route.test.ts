// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'

// checkAuth 走插件层假实现:本文件判的是路由接线与投影,不是 JWT
const mockCheckAuth = vi.fn(async () => true)
vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: (...args: unknown[]) => mockCheckAuth(...args),
}))

// 库层用可编排队列(与 notes-crud.test.ts 同一套链式夹具)—— 这样跑的是真实的
// findActivePointRules 映射代码,而不是把映射也 mock 掉自证。
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
    for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'select']) {
      chain[m] = () => chain
    }
    return chain
  }
  const dbMock = { execute: vi.fn().mockResolvedValue([]), select: vi.fn(createChain) }
  return { db: dbMock, dbRead: dbMock }
})

import { pointRoutes } from '../src/routes/point.js'

const PREFIX = '/api'

function enqueue(...rows: unknown[][]) {
  dbQueue.items.push(...rows)
}

describe('GET /api/point-rule —— 积分规则(RN PointRuleScreen 的数据源)', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(pointRoutes, { prefix: PREFIX })
    await server.ready()
  })
  afterAll(async () => {
    await server.close()
  })

  it('载荷是数组而不是 {list}:客户端就按 res.data ?? [] 取', async () => {
    enqueue([{ id: 7, action: 'sign_in', point: 5, description: '每日签到' }])
    const res = await server.inject({ method: 'GET', url: `${PREFIX}/point-rule` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data).toHaveLength(1)
  })

  it('投影只出契约四键,不外泄 point_rule 内部列', async () => {
    enqueue([
      { id: 7, action: 'sign_in', point: 5, description: '每日签到' },
      { id: 9, action: 'invite', point: 20, description: null },
    ])
    const body = (await server.inject({ method: 'GET', url: `${PREFIX}/point-rule` })).json()
    expect(Object.keys(body.data[0]).sort()).toEqual(['action', 'desc', 'id', 'points'])
    // id 是 serial 数字而契约是字符串 ⇒ 库层一次转换;description 为空要落成空串而不是 null/undefined
    expect(body.data[0]).toEqual({ id: '7', action: 'sign_in', points: 5, desc: '每日签到' })
    expect(body.data[1].id).toBe('9')
    expect(body.data[1].desc).toBe('')
  })

  it('未鉴权不得绕过权限门:该路由必须经 pointRoutes 的 preHandler 问过 checkAuth', async () => {
    // 为什么不断"返回 401":真实 checkAuth 的契约是**自己把 401 发出去**再返回 false,
    // 用假实现只返回 false 会让链路继续走到 handler ⇒ 那样测的是夹具而不是判据。
    // 这里判的是本票真正新增的结构事实:新路由落在**带鉴权 preHandler 的插件内**,
    // 而不是被注册到插件外的公开面上。
    mockCheckAuth.mockClear()
    enqueue([{ id: 7, action: 'sign_in', point: 5, description: '每日签到' }])
    const res = await server.inject({ method: 'GET', url: `${PREFIX}/point-rule` })
    expect(mockCheckAuth).toHaveBeenCalledTimes(1)
    expect(res.statusCode).toBe(200)
  })

  it('这条路径在路由表里在册(门 8 从此看得见它:客户端字面量已写成 /api/ 紧邻形态)', async () => {
    const tree = server.printRoutes()
    // printRoutes 是**前缀树**:注册前缀 /api 自成一节点,叶子只剩段名 + 方法清单
    // (`point-rule (GET, HEAD)`),所以断言按叶子写,不能把整条 URL 当一行去找。
    expect(tree).toMatch(/\/\n\s+└── api\//)
    expect(tree).toMatch(/point-rule \(GET/)
    // 阳性对照:同一插件的既有路由叶子必须在同一棵树里 —— 否则"看不见"是清单本身坏了,不是没注册
    expect(tree).toMatch(/channels \(GET/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
