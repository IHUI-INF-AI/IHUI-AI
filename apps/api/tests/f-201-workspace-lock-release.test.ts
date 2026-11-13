// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-201 回归锁(2026-11-13)。
 *
 * 病灶:kanban transition 抢到工作区锁 → 之后落库失败/抛错 → 不走释放 → 心跳(每 40s)
 * 无条件续期 → 该工作区被一把无人持有却永不释放的"幽灵锁"永久占用。
 *
 * 本文件锁:
 *  ① 抢锁成功但落库抛错 → finally 立即凭 token 释放(广播 released=true),不出现永久占用;
 *  ② 心跳在持有者行不存在 / 持有者心跳超期时不再续期,并尽力归还锁;
 *  ③ 释放时 token 不匹配 → 不删除他人的锁(真实 workspace-lock 实现 + FakeRedis);
 *  ④ 正常 acquire/release 成功路径不变(真实实现),释放后可再次抢到。
 *
 * 只 mock db / redis(ioredis)/ 日志 / SSE,不连真实 PG、Redis。
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import type * as WorkspaceLock from '../src/services/workspace-lock.js'

/** 与生产同源:TICK = WORKSPACE_LOCK_TTL(120s) * 1000 / 3 */
const TICK_MS = 40_000
const WORKSPACE = '/repo/f201'
const LOCK_KEY = `ihui:workspace_lock:${WORKSPACE}`
const TASK_ID = '11111111-1111-4111-8111-111111111111'
const AGENT_ID = '22222222-2222-4222-8222-222222222222'

const mocks = vi.hoisted(() => {
  const store = new Map<string, string>()
  /** 模拟 Lua:pcall(cjson.decode) 后比较 token 字段;del / expire 两段 */
  const evalLua = async (
    script: string,
    _numkeys: number,
    key: string,
    ...args: string[]
  ): Promise<number> => {
    const raw = store.get(key)
    if (raw === undefined) return 0
    let d: { token?: unknown }
    try {
      d = JSON.parse(raw) as { token?: unknown }
    } catch {
      return 0
    }
    if (typeof d !== 'object' || d === null || d.token !== args[0]) return 0
    if (script.includes('del')) {
      store.delete(key)
      return 1
    }
    return 1
  }
  const fakeRedis = {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string, ...rest: string[]) => {
      if (rest.includes('NX') && store.has(key)) return null
      store.set(key, value)
      return 'OK'
    }),
    del: vi.fn(async (key: string) => (store.delete(key) ? 1 : 0)),
    eval: vi.fn(evalLua),
    on: vi.fn(),
    quit: vi.fn(async () => 'OK'),
  }
  return {
    store,
    fakeRedis,
    acquire: vi.fn(),
    renew: vi.fn(),
    release: vi.fn(),
    getLock: vi.fn(),
    broadcast: vi.fn(),
    dbRows: [] as unknown[],
    updateResult: [] as unknown[],
    updateError: null as Error | null,
    updateCalls: 0,
  }
})

vi.mock('ioredis', () => ({
  default: vi.fn(function () {
    return mocks.fakeRedis
  }),
}))

vi.mock('../src/config/index.js', () => ({
  config: { REDIS_URL: 'redis://localhost' },
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

vi.mock('../src/services/agent-sse-bus.js', () => ({
  broadcastSSEEvent: mocks.broadcast,
  sseEventBus: { on: vi.fn(), off: vi.fn() },
}))

vi.mock('../src/services/workspace-lock.js', () => ({
  WORKSPACE_LOCK_TTL: 120,
  acquireWorkspaceLock: mocks.acquire,
  getWorkspaceLock: mocks.getLock,
  releaseWorkspaceLock: mocks.release,
  renewWorkspaceLock: mocks.renew,
}))

vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: vi.fn(async (request: { userId?: string }) => {
    request.userId = 'f201-admin'
    return true
  }),
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: vi.fn(async () => {}),
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => mocks.dbRows,
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        // 同一个 where() 既支持 `await where()`(心跳回写)也支持 `where().returning()`(transition)
        where: () => {
          const run = async (): Promise<unknown[]> => {
            mocks.updateCalls++
            if (mocks.updateError) throw mocks.updateError
            return mocks.updateResult
          }
          return {
            returning: run,
            then: (resolve: (v: unknown[]) => unknown, reject: (e: unknown) => unknown) => {
              run().then(resolve, reject)
            },
          }
        },
      }),
    }),
  },
}))

import {
  startLockHeartbeat,
  _resetLockHeartbeats,
} from '../src/services/workspace-lock-heartbeat.js'
import { agentsKanbanRoutes } from '../src/routes/agents-kanban.js'

function readyRow(): Record<string, unknown> {
  const now = new Date()
  return {
    id: TASK_ID,
    agentId: AGENT_ID,
    name: 'F-201 任务',
    description: null,
    status: 'ready',
    priority: 0,
    payload: {},
    result: null,
    scheduledAt: null,
    startedAt: null,
    completedAt: null,
    errorMessage: null,
    workspacePath: WORKSPACE,
    teamId: null,
    lockedBy: null,
    lockedAt: null,
    createdBy: null,
    updatedBy: null,
    createdAt: now,
    updatedAt: now,
  }
}

beforeEach(() => {
  mocks.store.clear()
  _resetLockHeartbeats()
  mocks.acquire.mockReset()
  mocks.renew.mockReset()
  mocks.release.mockReset()
  mocks.getLock.mockReset()
  mocks.broadcast.mockReset()
  mocks.release.mockResolvedValue(true)
  mocks.dbRows = []
  mocks.updateResult = []
  mocks.updateError = null
  mocks.updateCalls = 0
})

describe('F-201 ① transition 抢锁后落库失败必须释放锁', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(agentsKanbanRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  const transition = () =>
    app.inject({
      method: 'POST',
      url: `/api/agents/kanban/tasks/${TASK_ID}/transition`,
      payload: { taskId: TASK_ID, toStatus: 'in_progress' },
    })

  it('① 落库抛错 → 500 且凭 token 释放(广播 released=true),不留幽灵锁', async () => {
    mocks.dbRows = [readyRow()]
    mocks.acquire.mockResolvedValue({
      workspace: WORKSPACE,
      holder: `task:${TASK_ID}`,
      token: 'tok-f201',
      acquiredAt: 1,
      heartbeatAt: 1,
    })
    mocks.updateError = new Error('db write failed')

    const res = await transition()

    expect(res.statusCode).toBe(500)
    expect(mocks.release).toHaveBeenCalledTimes(1)
    expect(mocks.release).toHaveBeenCalledWith(WORKSPACE, 'tok-f201')
    expect(mocks.broadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'workspace_lock_released',
        payload: expect.objectContaining({ workspace: WORKSPACE, released: true }),
      }),
    )
  })

  it('正常路径不加锁失败也不多释放:落库成功 → 200 且不释放', async () => {
    mocks.dbRows = [readyRow()]
    mocks.acquire.mockResolvedValue({
      workspace: WORKSPACE,
      holder: `task:${TASK_ID}`,
      token: 'tok-f201',
      acquiredAt: 1,
      heartbeatAt: 1,
    })
    mocks.updateResult = [{ ...readyRow(), status: 'in_progress' }]

    const res = await transition()

    expect(res.statusCode).toBe(200)
    expect(mocks.release).not.toHaveBeenCalled()
  })
})

describe('F-201 ② 心跳只对存活持有者续期', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    _resetLockHeartbeats()
    vi.useRealTimers()
  })

  it('持有者行不存在 → 停止续期并释放锁,之后不再 renew', async () => {
    mocks.renew.mockResolvedValue(false)
    mocks.dbRows = [] // 任务行不存在(落库失败/已被删除)

    startLockHeartbeat(TASK_ID, WORKSPACE, 'tok-heartbeat')
    await vi.advanceTimersByTimeAsync(TICK_MS)

    expect(mocks.release).toHaveBeenCalledWith(WORKSPACE, 'tok-heartbeat')
    expect(mocks.broadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'workspace_lock_released',
        payload: expect.objectContaining({ reason: 'holder_missing', released: true }),
      }),
    )

    const renewCalls = mocks.renew.mock.calls.length
    await vi.advanceTimersByTimeAsync(TICK_MS * 2)
    expect(mocks.renew.mock.calls.length).toBe(renewCalls)
  })

  it('心跳连续续不上超过一个 TTL(超期)→ 停止续期并释放锁', async () => {
    mocks.renew.mockRejectedValue(new Error('redis down'))
    mocks.dbRows = []

    startLockHeartbeat(TASK_ID, WORKSPACE, 'tok-stale')
    await vi.advanceTimersByTimeAsync(TICK_MS)
    // TTL 内:只记异常、不判死
    expect(mocks.release).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(TICK_MS * 3) // 累计 > 120s
    expect(mocks.release).toHaveBeenCalledWith(WORKSPACE, 'tok-stale')

    const renewCalls = mocks.renew.mock.calls.length
    await vi.advanceTimersByTimeAsync(TICK_MS * 2)
    expect(mocks.renew.mock.calls.length).toBe(renewCalls)
  })
})

describe('F-201 ③④ 真实 workspace-lock:token 校验与正常加解锁', () => {
  it('③ token 不匹配 → 不删除他人的锁', async () => {
    const actual = await vi.importActual<typeof WorkspaceLock>('../src/services/workspace-lock.js')
    const raw = JSON.stringify({
      workspace: WORKSPACE,
      holder: 'task:other',
      token: 'tok-owner',
      acquired_at: 1,
      heartbeat_at: 1,
    })
    mocks.store.set(LOCK_KEY, raw)

    expect(await actual.releaseWorkspaceLock(WORKSPACE, 'tok-intruder')).toBe(false)
    expect(mocks.store.get(LOCK_KEY)).toBe(raw)
  })

  it('④ 正常 acquire/release 行为不变,释放后可再次抢到', async () => {
    const actual = await vi.importActual<typeof WorkspaceLock>('../src/services/workspace-lock.js')

    const info = await actual.acquireWorkspaceLock(WORKSPACE, 'api-agent')
    expect(info).not.toBeNull()
    expect(mocks.store.has(LOCK_KEY)).toBe(true)

    expect(await actual.releaseWorkspaceLock(WORKSPACE, String(info?.token))).toBe(true)
    expect(mocks.store.has(LOCK_KEY)).toBe(false)

    const again = await actual.acquireWorkspaceLock(WORKSPACE, 'api-agent')
    expect(again).not.toBeNull()
    expect(await actual.releaseWorkspaceLock(WORKSPACE, String(again?.token))).toBe(true)
    expect(mocks.store.has(LOCK_KEY)).toBe(false)
  })
})
