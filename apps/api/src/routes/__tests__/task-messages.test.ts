// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Task Messages 路由测试(D25 统一任务运行时看板,2026-09-19 立)。
 *
 * 覆盖:
 * 1. 鉴权:未登录 GET/POST → 401
 * 2. GET /task-messages:taskId 缺失/非法 400 / 任务不存在 404 / 跨团队 404(不泄露存在性)
 *    / 成功 → messages 旧→新(rows.reverse()) + hasMore 分页语义
 * 3. POST /task-messages:body 校验 400 / 任务不存在 404 / @引用不存在 400(按 taskId 去重校验)
 *    / 成功 → 201 + fromType=user + createdBy 审计 + mentions 落库
 *
 * db / 鉴权 / agents-kanban(可见性)均 mock,不连真实 PG。
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

// ─────────────────────────────────────────────────────────────
// Mock:鉴权层(authState.fail 控 401)
// ─────────────────────────────────────────────────────────────
const authState = vi.hoisted(() => ({ fail: false, userId: 'user-1' }))

vi.mock('../../plugins/auth.js', () => ({
  checkAuth: async (
    request: Record<string, unknown>,
    reply: { status: (c: number) => { send: (b: unknown) => unknown } },
  ) => {
    if (authState.fail) {
      reply.status(401).send({ code: 401, message: '未登录' })
      return false
    }
    request.userId = authState.userId
    return true
  },
}))

// ─────────────────────────────────────────────────────────────
// Mock:agents-kanban 可见性判定(teamState.allow 控 P0-4 团队边界)
// ─────────────────────────────────────────────────────────────
const teamState = vi.hoisted(() => ({
  allow: true,
  calls: [] as Array<{ userId: unknown; taskId: string }>,
  reset: () => {
    teamState.allow = true
    teamState.calls.length = 0
  },
}))

vi.mock('../agents-kanban.js', () => ({
  canViewTaskTeam: async (request: { userId?: string }, task: { id: string }) => {
    teamState.calls.push({ userId: request.userId, taskId: task.id })
    return teamState.allow
  },
}))

// ─────────────────────────────────────────────────────────────
// Mock:@ihui/database(列名占位,供 drizzle 操作符引用)
// ─────────────────────────────────────────────────────────────
vi.mock('@ihui/database', () => ({
  agentTasks: { id: 'id', teamId: 'team_id' },
  taskMessages: {
    id: 'id',
    taskId: 'task_id',
    fromType: 'from_type',
    fromId: 'from_id',
    content: 'content',
    mentions: 'mentions',
    createdBy: 'created_by',
    createdAt: 'created_at',
  },
}))

// ─────────────────────────────────────────────────────────────
// Mock:db 层 — 链式 thenable builder,按队列消费预置结果
// ─────────────────────────────────────────────────────────────
const store = vi.hoisted(() => ({
  selectQueue: [] as Array<unknown[] | Error>,
  insertQueue: [] as unknown[][],
  insertValues: [] as unknown[],
  reset: () => {
    store.selectQueue.length = 0
    store.insertQueue.length = 0
    store.insertValues.length = 0
  },
  pushSelect: (r: unknown[] | Error) => store.selectQueue.push(r),
}))

vi.mock('../../db/index.js', () => {
  const makeSelect = () => {
    const b: Record<string, unknown> = {}
    b.from = () => b
    b.where = () => b
    b.orderBy = () => b
    b.limit = () => b
    b.offset = () => b
    b.then = (onF?: (v: unknown) => unknown, onR?: (e: unknown) => unknown) => {
      const queued = store.selectQueue.shift() ?? []
      const p = queued instanceof Error ? Promise.reject(queued) : Promise.resolve(queued)
      return p.then(onF as (v: unknown) => unknown, onR as (e: unknown) => unknown)
    }
    return b
  }
  const dbMock = {
    select: () => makeSelect(),
    insert: () => {
      const c: Record<string, unknown> = {}
      c.values = (v: unknown) => {
        store.insertValues.push(v)
        return c
      }
      c.returning = () => Promise.resolve(store.insertQueue.shift() ?? [])
      return c
    },
  }
  return { db: dbMock, dbRead: dbMock }
})

import { taskMessagesRoutes } from '../task-messages.js'

// ─────────────────────────────────────────────────────────────
// 测试数据
// ─────────────────────────────────────────────────────────────
const ID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ID_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

function makeTask(overrides: Record<string, unknown> = {}) {
  return { id: ID_A, teamId: null, ...overrides }
}

function makeMsg(overrides: Record<string, unknown> = {}) {
  return {
    id: ID_B,
    taskId: ID_A,
    fromType: 'user',
    fromId: 'user-1',
    content: 'hello',
    mentions: [],
    createdBy: 'user-1',
    createdAt: new Date('2026-09-19T00:00:00Z'),
    ...overrides,
  }
}

describe('Task Messages 路由(D25)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.setErrorHandler((err, _request, reply) => {
      const e = err as Error & { statusCode?: number }
      const statusCode = e.statusCode && e.statusCode >= 400 ? e.statusCode : 500
      reply.status(statusCode).send({ code: statusCode, message: e.message || '服务器错误' })
    })
    await app.register(taskMessagesRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    store.reset()
    teamState.reset()
    authState.fail = false
    authState.userId = 'user-1'
  })

  // ───────────────────────────────────────────────────────────
  // 1. 鉴权
  // ───────────────────────────────────────────────────────────
  describe('鉴权', () => {
    it('未登录 GET → 401', async () => {
      authState.fail = true
      const res = await app.inject({ method: 'GET', url: `/api/task-messages?taskId=${ID_A}` })
      expect(res.statusCode).toBe(401)
    })

    it('未登录 POST → 401', async () => {
      authState.fail = true
      const res = await app.inject({
        method: 'POST',
        url: '/api/task-messages',
        payload: { taskId: ID_A, content: 'hi' },
      })
      expect(res.statusCode).toBe(401)
    })
  })

  // ───────────────────────────────────────────────────────────
  // 2. GET 时间线
  // ───────────────────────────────────────────────────────────
  describe('GET /api/task-messages', () => {
    it('缺 taskId / taskId 非法 → 400', async () => {
      const missing = await app.inject({ method: 'GET', url: '/api/task-messages' })
      expect(missing.statusCode).toBe(400)
      const bad = await app.inject({ method: 'GET', url: '/api/task-messages?taskId=xxx' })
      expect(bad.statusCode).toBe(400)
    })

    it('任务不存在 → 404', async () => {
      store.pushSelect([]) // agentTasks 查询:空
      const res = await app.inject({ method: 'GET', url: `/api/task-messages?taskId=${ID_A}` })
      expect(res.statusCode).toBe(404)
      expect(res.json().message).toBe('任务不存在')
    })

    it('跨团队任务 → 404(可见性对齐 kanban P0-4,不泄露存在性)', async () => {
      store.pushSelect([makeTask({ teamId: 't-other' })])
      teamState.allow = false
      const res = await app.inject({ method: 'GET', url: `/api/task-messages?taskId=${ID_A}` })
      expect(res.statusCode).toBe(404)
      expect(res.json().message).toBe('任务不存在') // 与不存在同文案
    })

    it('成功:messages 旧→新(rows.reverse()),默认分页 hasMore:false', async () => {
      store.pushSelect([makeTask()])
      // db 按 desc(created_at) 返回 新→旧;响应须 reverse 为 旧→新
      store.pushSelect([
        makeMsg({ id: ID_B, content: 'newest' }),
        makeMsg({ id: ID_A, content: 'oldest' }),
      ])
      const res = await app.inject({ method: 'GET', url: `/api/task-messages?taskId=${ID_A}` })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.taskId).toBe(ID_A)
      expect(body.data.messages.map((m: { content: string }) => m.content)).toEqual([
        'oldest',
        'newest',
      ])
      expect(body.data.hasMore).toBe(false) // rows.length(2) < limit(默认 50)
    })

    it('rows 恰好等于 limit → hasMore:true(继续分页信号)', async () => {
      store.pushSelect([makeTask()])
      store.pushSelect([makeMsg(), makeMsg()])
      const res = await app.inject({
        method: 'GET',
        url: `/api/task-messages?taskId=${ID_A}&limit=2&offset=0`,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.hasMore).toBe(true)
    })
  })

  // ───────────────────────────────────────────────────────────
  // 3. POST 发消息
  // ───────────────────────────────────────────────────────────
  describe('POST /api/task-messages', () => {
    it('body 缺 content / taskId 非法 → 400(parseOrThrow AppError)', async () => {
      const noContent = await app.inject({
        method: 'POST',
        url: '/api/task-messages',
        payload: { taskId: ID_A },
      })
      expect(noContent.statusCode).toBe(400)
      const badTask = await app.inject({
        method: 'POST',
        url: '/api/task-messages',
        payload: { taskId: 'xxx', content: 'hi' },
      })
      expect(badTask.statusCode).toBe(400)
    })

    it('任务不存在 → 404', async () => {
      store.pushSelect([])
      const res = await app.inject({
        method: 'POST',
        url: '/api/task-messages',
        payload: { taskId: ID_A, content: 'hi' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('@引用不存在 → 400(mention 按 taskId 去重后校验)', async () => {
      store.pushSelect([makeTask()])
      store.pushSelect([]) // inArray 存在性查询:未命中
      const res = await app.inject({
        method: 'POST',
        url: '/api/task-messages',
        payload: {
          taskId: ID_A,
          content: 'see @task',
          mentions: [{ type: 'task', taskId: ID_B, name: 'x' }],
        },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toBe('存在无效的 @任务引用')
    })

    it('成功 → 201,fromType=user + createdBy 审计 + mentions 落库', async () => {
      store.pushSelect([makeTask()])
      store.pushSelect([{ id: ID_B }]) // mention 存在性查询:命中
      store.insertQueue.push([makeMsg({ content: 'see @task' })])
      const res = await app.inject({
        method: 'POST',
        url: '/api/task-messages',
        payload: {
          taskId: ID_A,
          content: 'see @task',
          mentions: [{ type: 'task', taskId: ID_B, name: 'B 任务' }],
        },
      })
      expect(res.statusCode).toBe(201)
      expect(res.json().data.content).toBe('see @task')
      const values = store.insertValues[0] as Record<string, unknown>
      expect(values.taskId).toBe(ID_A)
      expect(values.fromType).toBe('user')
      expect(values.fromId).toBe('user-1')
      expect(values.createdBy).toBe('user-1')
      expect(values.mentions).toEqual([{ type: 'task', taskId: ID_B, name: 'B 任务' }])
    })

    it('mentions 缺省 → 不触发存在性查询,落库空数组', async () => {
      store.pushSelect([makeTask()]) // 仅任务可见性查询
      store.insertQueue.push([makeMsg()])
      const res = await app.inject({
        method: 'POST',
        url: '/api/task-messages',
        payload: { taskId: ID_A, content: 'plain' },
      })
      expect(res.statusCode).toBe(201)
      expect(store.selectQueue).toHaveLength(0) // mention 查询未被消费(未发起)
      const values = store.insertValues[0] as Record<string, unknown>
      expect(values.mentions).toEqual([])
    })
  })
})
