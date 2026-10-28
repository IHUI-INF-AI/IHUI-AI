// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import { circles, circleMembers } from '@ihui/database'

const USER_ID = '00000000-0000-4000-8000-000000000001'
const CIRCLE_ID = '44444444-4444-4444-8444-444444444444'
const PREFIX = '/api'

/**
 * 链式夹具:读走队列,**写按原表对象入册**。表身份只能在断言时换算(那两份 drizzle
 * 表常量是被 import 进来的,而 vi.mock 的工厂比 import 更早求值 —— 在工厂里读它们会撞 TDZ)。
 * 这样本文件断言的是"成员数那一次 +1 到底有没有发生",而不是只断返回值:
 * §5「认证不等于授权」与 §134「不把请求侧长度当 affected」同一族纪律 —— 副作用没发生要能证。
 * 判据不复制进测试,直接跑生产 handler(§22c)。
 */
const state = vi.hoisted(() => {
  const queue: { items: unknown[][] } = { items: [] }
  const writes: Array<{ op: string; table: unknown }> = []
  function makeChain(): Record<string, unknown> {
    const chain: Record<string, unknown> = {
      then: (resolve: (v: unknown[]) => unknown) => {
        const result = state.queue.items.length > 0 ? state.queue.items.shift()! : []
        return Promise.resolve(result).then(resolve)
      },
    }
    for (const m of [
      'from',
      'where',
      'limit',
      'orderBy',
      'values',
      'set',
      'returning',
      'onConflictDoNothing',
    ]) {
      chain[m] = () => chain
    }
    return chain
  }
  const dbMock = {
    select: () => makeChain(),
    insert: (t: unknown) => {
      writes.push({ op: 'insert', table: t })
      return makeChain()
    },
    update: (t: unknown) => {
      writes.push({ op: 'update', table: t })
      return makeChain()
    },
  }
  return { queue, writes, dbMock }
})
vi.mock('../src/db/index.js', () => ({
  db: state.dbMock,
  dbRead: { select: () => state.dbMock.select() },
}))

import { activityRoutes } from '../src/routes/other/activity-routes.js'

function writesNamed() {
  return state.writes.map((w) => ({
    op: w.op,
    table: w.table === circles ? 'circles' : w.table === circleMembers ? 'circleMembers' : 'other',
  }))
}

describe('POST /api/circles/:id/join —— 加入圈子(与既有 leave 成对;RN CircleDetailScreen 的加入按钮)', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.setErrorHandler((err, _request, reply) => {
      const statusCode =
        err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500
      reply.status(statusCode).send({ code: statusCode, message: err.message })
    })
    // 承载层身份注入:真实 app 由鉴权层写 request.userId,测试走同一条通道
    server.addHook('onRequest', async (request) => {
      request.userId = USER_ID
    })
    await server.register(activityRoutes, { prefix: PREFIX })
    await server.ready()
  })
  afterAll(async () => {
    await server.close()
  })
  beforeEach(() => {
    state.queue.items.length = 0
    state.writes.length = 0
  })

  const post = (circleId = CIRCLE_ID) =>
    server.inject({ method: 'POST', url: `${PREFIX}/circles/${circleId}/join` })

  it('未登录:401 且一次库操作都没发生', async () => {
    const anon = Fastify({ logger: false })
    await anon.register(activityRoutes, { prefix: PREFIX })
    await anon.ready()
    const res = await anon.inject({ method: 'POST', url: `${PREFIX}/circles/${CIRCLE_ID}/join` })
    expect(res.statusCode).toBe(401)
    expect(writesNamed()).toEqual([])
    await anon.close()
  })

  it('圈子不存在:404,且不写成员表(不给幽灵圈子加人)', async () => {
    state.queue.items.push([])
    const res = await post()
    expect(res.statusCode).toBe(404)
    expect(writesNamed()).toEqual([])
  })

  it('首次加入:插成员行 + 成员数 +1,两笔写按序点名', async () => {
    state.queue.items.push(
      [{ id: CIRCLE_ID }],
      [],
      [{ id: 'm1', circleId: CIRCLE_ID, userId: USER_ID, role: 'member', status: 1 }],
      [{ id: CIRCLE_ID }],
    )
    const res = await post()
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.data.joined).toBe(true)
    expect(body.data.already).toBe(false)
    expect(body.data.member.id).toBe('m1')
    expect(writesNamed()).toEqual([
      { op: 'insert', table: 'circleMembers' },
      { op: 'update', table: 'circles' },
    ])
  })

  it('重复点"加入"不是第二次加入:already=true 且成员数那笔写根本没发生', async () => {
    state.queue.items.push(
      [{ id: CIRCLE_ID }],
      [{ id: 'm1', circleId: CIRCLE_ID, userId: USER_ID, role: 'member', status: 1 }],
    )
    const res = await post()
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toMatchObject({ joined: true, already: true })
    expect(writesNamed()).toEqual([])
  })

  it('上次退出的那一行(status=0)复活,而不是新建第二行;成员数仍 +1', async () => {
    state.queue.items.push(
      [{ id: CIRCLE_ID }],
      [{ id: 'm-old', circleId: CIRCLE_ID, userId: USER_ID, role: 'member', status: 0 }],
      [{ id: 'm-old', status: 1 }],
      [{ id: CIRCLE_ID }],
    )
    const res = await post()
    expect(res.statusCode).toBe(201)
    expect(res.json().data.member.id).toBe('m-old')
    expect(writesNamed()).toEqual([
      { op: 'update', table: 'circleMembers' },
      { op: 'update', table: 'circles' },
    ])
  })

  it('并发撞唯一索引(insert returning 空)⇒ 报 already 而不是报新建成功,成员数不 +1', async () => {
    state.queue.items.push([{ id: CIRCLE_ID }], [], [])
    const res = await post()
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toMatchObject({ joined: true, already: true })
    expect(writesNamed()).toEqual([{ op: 'insert', table: 'circleMembers' }])
  })

  it('真退出(status=1 ⇒ 0):成员行与成员数两笔写按序点名', async () => {
    state.queue.items.push(
      [{ id: 'm1', circleId: CIRCLE_ID, userId: USER_ID, role: 'member', status: 1 }],
      [{ id: 'm1', status: 0 }],
      [{ id: CIRCLE_ID }],
    )
    const res = await server.inject({ method: 'POST', url: `${PREFIX}/circles/${CIRCLE_ID}/leave` })
    expect(res.statusCode).toBe(201)
    expect(res.json().data).toMatchObject({ left: true })
    expect(writesNamed()).toEqual([
      { op: 'update', table: 'circleMembers' },
      { op: 'update', table: 'circles' },
    ])
  })

  it('重复点"退出"不是第二次退出:already=true 且一笔写都没发生(成员数不再 -1、updatedAt 不被盖)', async () => {
    state.queue.items.push([
      { id: 'm-left', circleId: CIRCLE_ID, userId: USER_ID, role: 'member', status: 0 },
    ])
    const res = await server.inject({ method: 'POST', url: `${PREFIX}/circles/${CIRCLE_ID}/leave` })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toMatchObject({ left: true, already: true })
    // 与上一条成对做阳性对照:同样的夹具形状,差别只在 status 已是 0 ⇒ 这里必须零写
    expect(writesNamed()).toEqual([])
  })

  it('在册且与 leave 成对(printRoutes 前缀树叶子 + 同插件既有路由做阳性对照)', async () => {
    const tree = server.printRoutes()
    expect(tree).toMatch(/join \(POST/)
    expect(tree).toMatch(/leave \(POST/)
    // 阳性对照:同插件另一条既有 POST 路由的节点必须在同一棵树里,
    // 否则"看不见"是清单本身坏了,而不是没注册
    expect(tree).toMatch(/activities\//)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
