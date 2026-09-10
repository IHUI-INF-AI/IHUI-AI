// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​​‌‌​‌‍‍​‌​​‌​​‌‍‍​‌‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​‍‍​‌​​‌‌​​​‌‌‌​‌​‍‍‌‌​​‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​‌‌​‍‍​‌​​‌​‌​‍‍​‌‌​‌‌​‍‍‌‌​‌​‌‌‌‌​‌‌​‌​‌‍‍‌​‌‌‌‍‍‌‌​‌​‌​‌‍‍‌​‌‌​‌​‌‌​‌​‍‍‌‌​‌‌​‌​‌‍‍​‌‌​‌‌​‌‍‍​‌​‌​‌​‌‍‍‌‌​‌‌​‌​‌‍‍‌‌​‌​‌​‌‌​‌​‍‍‌‌​‌​‌​‌​‌‍‍​‌‌​‌​‌‌​‌‍‍​‌‌​‌‌​‌⁠

/**
 * Agent Kanban 路由测试(2026-09-10,2-2 工作区锁 + 团队任务板)
 *
 * 覆盖:
 * 1. 鉴权:未登录 401
 * 2. workspace-lock 查询端点(held/holder/ttl;workspace 缺失 400)
 * 3. teamId 过滤:非成员 403 / 成员 200 / admin 放行(不查成员表)
 * 4. transition 进 in_progress:锁获取成功(token 入 payload,lockedBy 审计)/ 被占 409+持有者
 * 5. transition 离开 in_progress:凭 payload token 释放锁,清除审计字段
 *
 * db / 鉴权 / workspace-lock 服务均 mock,不连真实 PG 与 Redis。
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:8810/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// ─────────────────────────────────────────────────────────────
// Mock:鉴权层(authState.fail 控 401;roleId 控 admin 判定)
// ─────────────────────────────────────────────────────────────
const authState = vi.hoisted(() => ({ fail: false, userId: 'user-1', roleId: 1 }))

async function doAuth(request: Record<string, unknown>): Promise<void> {
  if (authState.fail) {
    const e = new Error('未登录') as Error & { statusCode?: number }
    e.statusCode = 401
    throw e
  }
  request.userId = authState.userId
  request.jwtPayload = { roleId: authState.roleId, sub: authState.userId }
}

vi.mock('../../plugins/auth.js', () => ({
  authenticate: doAuth,
  checkAuth: async (
    request: Record<string, unknown>,
    reply: { status: (c: number) => { send: (b: unknown) => unknown } },
  ) => {
    try {
      await doAuth(request)
      return true
    } catch (e) {
      // 必须以方法调用语法(reply.status(...).send(...))保留 this,取出后裸调用会丢失 reply 上下文
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      reply.status(statusCode).send({ code: statusCode, message: (e as Error).message })
      return false
    }
  },
}))

vi.mock('../../plugins/require-permission.js', () => ({
  requireAdmin: async (
    request: Record<string, unknown>,
    reply: { status: (c: number) => { send: (b: unknown) => unknown } },
  ) => {
    try {
      await doAuth(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      return reply.status(statusCode).send({ code: statusCode, message: (e as Error).message })
    }
    if (authState.roleId < 1) {
      return reply.status(403).send({ code: 403, message: '需要管理员权限' })
    }
  },
}))

// ─────────────────────────────────────────────────────────────
// Mock:@ihui/database(列名占位,供 drizzle 操作符引用)
// ─────────────────────────────────────────────────────────────
vi.mock('@ihui/database', () => ({
  agentTasks: {
    id: 'id',
    agentId: 'agent_id',
    ruleId: 'rule_id',
    name: 'name',
    description: 'description',
    status: 'status',
    priority: 'priority',
    payload: 'payload',
    result: 'result',
    scheduledAt: 'scheduled_at',
    startedAt: 'started_at',
    completedAt: 'completed_at',
    errorMessage: 'error_message',
    workspacePath: 'workspace_path',
    teamId: 'team_id',
    lockedBy: 'locked_by',
    lockedAt: 'locked_at',
    createdBy: 'created_by',
    updatedBy: 'updated_by',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  teamMembers: { id: 'id', teamId: 'team_id', userId: 'user_id' },
}))

// ─────────────────────────────────────────────────────────────
// Mock:db 层 — 链式 thenable builder,按队列消费预置结果
// ─────────────────────────────────────────────────────────────
const store = vi.hoisted(() => ({
  selectQueue: [] as Array<unknown[] | Error>,
  updateQueue: [] as unknown[][],
  insertQueue: [] as unknown[][],
  deleteQueue: [] as unknown[][],
  insertValues: [] as unknown[],
  updateSets: [] as unknown[],
  reset: () => {
    store.selectQueue.length = 0
    store.updateQueue.length = 0
    store.insertQueue.length = 0
    store.deleteQueue.length = 0
    store.insertValues.length = 0
    store.updateSets.length = 0
  },
  pushSelect: (r: unknown[] | Error) => store.selectQueue.push(r),
  pushUpdate: (r: unknown[]) => store.updateQueue.push(r),
}))

vi.mock('../../db/index.js', () => {
  const makeSelect = () => {
    const b: Record<string, unknown> = {}
    b.from = () => b
    b.where = () => b
    b.orderBy = () => b
    b.limit = () => b
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
    update: () => {
      const c: Record<string, unknown> = {}
      c.set = (s: unknown) => {
        store.updateSets.push(s)
        return c
      }
      c.where = () => c
      c.returning = () => Promise.resolve(store.updateQueue.shift() ?? [])
      return c
    },
    delete: () => {
      const c: Record<string, unknown> = {}
      c.where = () => c
      c.returning = () => Promise.resolve(store.deleteQueue.shift() ?? [])
      return c
    },
  }
  return { db: dbMock, dbRead: dbMock }
})

// ─────────────────────────────────────────────────────────────
// Mock:workspace-lock 服务(acquired 控获取结果;heldInfo 控查询结果)
// ─────────────────────────────────────────────────────────────
const lockState = vi.hoisted(() => ({
  acquired: true,
  heldInfo: null as null | {
    workspace: string
    holder: string
    token: string
    acquiredAt: number
    heartbeatAt: number
  },
  acquireCalls: [] as Array<{ workspace: string; holder: string }>,
  releaseCalls: [] as Array<{ workspace: string; token: string }>,
  reset: () => {
    lockState.acquired = true
    lockState.heldInfo = null
    lockState.acquireCalls.length = 0
    lockState.releaseCalls.length = 0
  },
}))

vi.mock('../../services/workspace-lock.js', () => ({
  WORKSPACE_LOCK_TTL: 120,
  acquireWorkspaceLock: async (workspace: string, holder: string) => {
    lockState.acquireCalls.push({ workspace, holder })
    if (!lockState.acquired) return null
    return { workspace, holder, token: 'tok-123', acquiredAt: 1000, heartbeatAt: 1000 }
  },
  getWorkspaceLock: async (workspace: string) =>
    lockState.heldInfo?.workspace === workspace ? lockState.heldInfo : null,
  releaseWorkspaceLock: async (workspace: string, token: string) => {
    lockState.releaseCalls.push({ workspace, token })
    return true
  },
  renewWorkspaceLock: async () => true,
  forceReleaseWorkspaceLock: async () => true,
  _resetMemoryLocks: () => {},
}))

import { agentsKanbanRoutes } from '../agents-kanban.js'

// ─────────────────────────────────────────────────────────────
// 测试数据
// ─────────────────────────────────────────────────────────────

const ID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
// 注意:'t' 非十六进制字符,会被 z.uuid() 拒绝(400),必须用 hex 字符合成 UUID
const ID_TEAM = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const AGENT_ID = '11111111-2222-4333-8444-555555555555'

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ID_A,
    agentId: AGENT_ID,
    ruleId: null,
    name: '示例任务',
    description: null,
    status: 'ready',
    priority: 0,
    payload: {},
    result: null,
    scheduledAt: null,
    startedAt: null,
    completedAt: null,
    errorMessage: null,
    workspacePath: null,
    teamId: null,
    lockedBy: null,
    lockedAt: null,
    createdBy: 'user-1',
    updatedBy: null,
    createdAt: new Date('2026-09-10T00:00:00Z'),
    updatedAt: new Date('2026-09-10T00:00:00Z'),
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────
// 套件
// ─────────────────────────────────────────────────────────────

describe('Agent Kanban 路由(2-2 工作区锁 + 团队任务板)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.setErrorHandler((err, _request, reply) => {
      const e = err as Error & { statusCode?: number }
      const statusCode = e.statusCode && e.statusCode >= 400 ? e.statusCode : 500
      reply.status(statusCode).send({ code: statusCode, message: e.message || '服务器错误' })
    })
    await app.register(agentsKanbanRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    store.reset()
    lockState.reset()
    authState.fail = false
    authState.userId = 'user-1'
    authState.roleId = 1 // 默认 admin(transition/create 为 admin 端点)
  })

  // ───────────────────────────────────────────────────────────
  // 1. 鉴权
  // ───────────────────────────────────────────────────────────
  describe('鉴权', () => {
    it('未登录 GET 任务列表 → 401', async () => {
      authState.fail = true
      const res = await app.inject({ method: 'GET', url: '/api/agents/kanban/tasks' })
      expect(res.statusCode).toBe(401)
    })

    it('未登录 POST transition → 401', async () => {
      authState.fail = true
      const res = await app.inject({
        method: 'POST',
        url: `/api/agents/kanban/tasks/${ID_A}/transition`,
        payload: { taskId: ID_A, toStatus: 'in_progress' },
      })
      expect(res.statusCode).toBe(401)
    })
  })

  // ───────────────────────────────────────────────────────────
  // 2. workspace-lock 查询端点(锁徽标数据源)
  // ───────────────────────────────────────────────────────────
  describe('GET /api/agents/kanban/workspace-lock', () => {
    it('无锁 → held:false', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/agents/kanban/workspace-lock?workspace=/ws/a',
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.held).toBe(false)
      expect(body.data.holder).toBeUndefined()
      expect(body.data.ttl).toBe(120)
    })

    it('有锁 → held:true + holder + acquiredAt', async () => {
      lockState.heldInfo = {
        workspace: '/ws/a',
        holder: 'task:other-task',
        token: 'tok-xyz',
        acquiredAt: 1, // 秒(路由端 *1000 转毫秒)
        heartbeatAt: 2,
      }
      const res = await app.inject({
        method: 'GET',
        url: '/api/agents/kanban/workspace-lock?workspace=/ws/a',
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.held).toBe(true)
      expect(body.data.holder).toBe('task:other-task')
      expect(body.data.acquiredAt).toBe('1970-01-01T00:00:01.000Z')
    })

    it('缺 workspace 参数 → 400', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/agents/kanban/workspace-lock' })
      expect(res.statusCode).toBe(400)
    })
  })

  // ───────────────────────────────────────────────────────────
  // 3. teamId 过滤(团队任务板)
  // ───────────────────────────────────────────────────────────
  describe('GET /api/agents/kanban/tasks?teamId=', () => {
    it('非 admin 且非成员 → 403', async () => {
      authState.roleId = 0
      store.pushSelect([]) // 成员查询:空
      const res = await app.inject({
        method: 'GET',
        url: `/api/agents/kanban/tasks?teamId=${ID_TEAM}`,
      })
      expect(res.statusCode).toBe(403)
    })

    it('非 admin 但为成员 → 200 返回团队任务', async () => {
      authState.roleId = 0
      store.pushSelect([{ id: 'm-1' }]) // 成员查询:命中
      store.pushSelect([makeRow({ teamId: ID_TEAM })]) // 任务查询
      const res = await app.inject({
        method: 'GET',
        url: `/api/agents/kanban/tasks?teamId=${ID_TEAM}`,
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data).toHaveLength(1)
      expect(body.data[0].teamId).toBe(ID_TEAM)
    })

    it('admin 直接放行(不查成员表)', async () => {
      authState.roleId = 1
      // 只预置任务查询结果:若误查成员表,该结果会被成员查询消费,任务列表将为空 → 断言失败
      store.pushSelect([makeRow({ teamId: ID_TEAM })])
      const res = await app.inject({
        method: 'GET',
        url: `/api/agents/kanban/tasks?teamId=${ID_TEAM}`,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data).toHaveLength(1)
    })

    it('teamId 非法(非 uuid) → 400', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/agents/kanban/tasks?teamId=xxx' })
      expect(res.statusCode).toBe(400)
    })
  })

  // ───────────────────────────────────────────────────────────
  // 4. transition 进 in_progress:锁联动
  // ───────────────────────────────────────────────────────────
  describe('transition 进 in_progress(锁获取)', () => {
    it('获取成功:token 存入 payload,lockedBy 审计写入', async () => {
      store.pushSelect([makeRow({ status: 'ready', workspacePath: '/ws/a', payload: {} })])
      store.pushUpdate([makeRow({ status: 'in_progress', workspacePath: '/ws/a' })])

      const res = await app.inject({
        method: 'POST',
        url: `/api/agents/kanban/tasks/${ID_A}/transition`,
        payload: { taskId: ID_A, toStatus: 'in_progress' },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().data.allowed).toBe(true)
      // 锁获取调用
      expect(lockState.acquireCalls).toEqual([{ workspace: '/ws/a', holder: `task:${ID_A}` }])
      // DB 更新:payload 携带 token + 审计字段
      const set = store.updateSets[0] as Record<string, unknown>
      expect((set.payload as Record<string, unknown>).workspaceLockToken).toBe('tok-123')
      expect(set.lockedBy).toBe(`task:${ID_A}`)
      expect(set.lockedAt).toBeInstanceOf(Date)
      expect(set.status).toBe('in_progress')
    })

    it('锁被其他持有者占用 → 409 + 持有者信息,不写 DB', async () => {
      lockState.acquired = false
      lockState.heldInfo = {
        workspace: '/ws/a',
        holder: 'task:other-task',
        token: 'tok-xyz',
        acquiredAt: 1000,
        heartbeatAt: 1000,
      }
      store.pushSelect([makeRow({ status: 'ready', workspacePath: '/ws/a', payload: {} })])

      const res = await app.inject({
        method: 'POST',
        url: `/api/agents/kanban/tasks/${ID_A}/transition`,
        payload: { taskId: ID_A, toStatus: 'in_progress' },
      })

      expect(res.statusCode).toBe(409)
      expect(res.json().message).toContain('task:other-task')
      // 无 DB 更新
      expect(store.updateSets).toHaveLength(0)
    })

    it('无 workspacePath 的任务 → 不走锁,直接流转', async () => {
      store.pushSelect([makeRow({ status: 'ready', workspacePath: null, payload: {} })])
      store.pushUpdate([makeRow({ status: 'in_progress' })])

      const res = await app.inject({
        method: 'POST',
        url: `/api/agents/kanban/tasks/${ID_A}/transition`,
        payload: { taskId: ID_A, toStatus: 'in_progress' },
      })

      expect(res.statusCode).toBe(200)
      expect(lockState.acquireCalls).toHaveLength(0)
      const set = store.updateSets[0] as Record<string, unknown>
      expect(set.lockedBy).toBeUndefined()
    })

    it('非法流转(ready → todo) → 409 allowed:false', async () => {
      store.pushSelect([makeRow({ status: 'ready' })])
      const res = await app.inject({
        method: 'POST',
        url: `/api/agents/kanban/tasks/${ID_A}/transition`,
        payload: { taskId: ID_A, toStatus: 'todo' },
      })
      expect(res.statusCode).toBe(409)
      expect(res.json().data.allowed).toBe(false)
      expect(store.updateSets).toHaveLength(0)
    })
  })

  // ───────────────────────────────────────────────────────────
  // 5. transition 离开 in_progress:锁释放
  // ───────────────────────────────────────────────────────────
  describe('transition 离开 in_progress(锁释放)', () => {
    it('in_progress → done:凭 payload token 释放,清除审计字段', async () => {
      store.pushSelect([
        makeRow({
          status: 'in_progress',
          workspacePath: '/ws/a',
          payload: { workspaceLockToken: 'tok-123' },
        }),
      ])
      store.pushUpdate([makeRow({ status: 'done' })])

      const res = await app.inject({
        method: 'POST',
        url: `/api/agents/kanban/tasks/${ID_A}/transition`,
        payload: { taskId: ID_A, toStatus: 'done' },
      })

      expect(res.statusCode).toBe(200)
      expect(lockState.releaseCalls).toEqual([{ workspace: '/ws/a', token: 'tok-123' }])
      const set = store.updateSets[0] as Record<string, unknown>
      expect((set.payload as Record<string, unknown>).workspaceLockToken).toBeUndefined()
      expect(set.lockedBy).toBeNull()
      expect(set.lockedAt).toBeNull()
    })

    it('payload 无 token(历史任务) → 不调 release,仍广播释放', async () => {
      store.pushSelect([makeRow({ status: 'in_progress', workspacePath: '/ws/a', payload: {} })])
      store.pushUpdate([makeRow({ status: 'blocked' })])

      const res = await app.inject({
        method: 'POST',
        url: `/api/agents/kanban/tasks/${ID_A}/transition`,
        payload: { taskId: ID_A, toStatus: 'blocked', reason: '被阻塞' },
      })

      expect(res.statusCode).toBe(200)
      expect(lockState.releaseCalls).toHaveLength(0)
      const set = store.updateSets[0] as Record<string, unknown>
      expect(set.lockedBy).toBeNull()
    })
  })

  // ───────────────────────────────────────────────────────────
  // 6. 创建任务:workspacePath / teamId 写入
  // ───────────────────────────────────────────────────────────
  describe('POST /api/agents/kanban/tasks', () => {
    it('创建携带 workspacePath + teamId', async () => {
      store.insertQueue.push([makeRow({ workspacePath: '/ws/new', teamId: ID_TEAM })])
      const res = await app.inject({
        method: 'POST',
        url: '/api/agents/kanban/tasks',
        payload: {
          agentId: AGENT_ID,
          name: '新任务',
          workspacePath: '/ws/new',
          teamId: ID_TEAM,
        },
      })
      expect(res.statusCode).toBe(201)
      const values = store.insertValues[0] as Record<string, unknown>
      expect(values.workspacePath).toBe('/ws/new')
      expect(values.teamId).toBe(ID_TEAM)
      expect(res.json().data.workspacePath).toBe('/ws/new')
      expect(res.json().data.teamId).toBe(ID_TEAM)
    })
  })
})
