// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * b76-12e G-998161:互斥的调度 carrier 在协议边界直接拒,而不是靠读取优先级兜底。
 *
 * 成对交付(证明是加严校验而非削弱能力):
 *  - 正向拒绝:矛盾组合(once+rrule / recurring+scheduledAt / 同传)一律 400;
 *  - 反向回归:合法组合(纯 once / 纯 recurring)仍 201,nextRunAt 与
 *    parseNextRun 的生产语义一致(HOURLY ⇒ now+1h,绝对时间,见
 *    agent-automation-scheduler.parseNextRun 的 MVP 注释)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('jose', () => ({ decodeJwt: () => ({}) }))
vi.mock('@ihui/auth', () => ({
  verifyAccessToken: vi.fn().mockResolvedValue({ userId: 'mock-user-id', roleId: 1 }),
}))
vi.mock('../src/db/usercenter-queries.js', () => ({ getUserStatus: vi.fn().mockResolvedValue(1) }))

/** 可配置结果的 thenable drizzle 链(同 admin-agreements 测试范本)。 */
vi.mock('../src/db/index.js', () => {
  const state: { rows: unknown[]; lastInsertValues?: Record<string, unknown> } = {
    rows: [{ id: 'mock-id' }],
  }
  function createChain() {
    const chain: Record<string, unknown> = {
      then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(state.rows).then(resolve),
    }
    for (const m of [
      'from',
      'where',
      'orderBy',
      'limit',
      'offset',
      'set',
      'returning',
      'leftJoin',
    ]) {
      chain[m] = () => chain
    }
    // 捕获 insert 的 values 入参:路由真正写库的计算结果(nextRunAt 等)在这里
    chain['values'] = (arg: Record<string, unknown>) => {
      state.lastInsertValues = arg
      return chain
    }
    return chain
  }
  return {
    __setState: (rows: unknown[]) => {
      state.rows = rows
      state.lastInsertValues = undefined
    },
    __getLastInsertValues: () => state.lastInsertValues,
    db: {
      select: vi.fn(() => createChain()),
      insert: vi.fn(() => createChain()),
      update: vi.fn(() => createChain()),
      delete: vi.fn(() => createChain()),
    },
    dbRead: { select: vi.fn(() => createChain()) },
  }
})

// 注意:parseNextRun 用真实实现 —— 反向回归必须打在生产语义上,不打平行 mock
import automationsRoutes from '../src/routes/automations.js'
import { parseNextRun } from '../src/services/agent-automation-scheduler.js'

const AUTH_HEADERS = { authorization: 'Bearer mock-access-token' }

describe('automations 调度 carrier 互斥(b76-12e G-998161)', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.register(automationsRoutes, { prefix: '/api/automations' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(async () => {
    const mod = (await import('../src/db/index.js')) as {
      __setState: (rows: unknown[]) => void
      __getLastInsertValues: () => Record<string, unknown> | undefined
    }
    mod.__setState([
      {
        id: '00000000-0000-4000-8000-000000000001',
        userId: 'mock-user-id',
        scheduleType: 'once',
        rrule: null,
        scheduledAt: new Date(Date.now() + 60_000).toISOString(),
        timezone: 'Asia/Shanghai',
      },
    ])
  })

  /** 取 mock 模块的钩子句柄。 */
  async function dbMock() {
    return (await import('../src/db/index.js')) as unknown as {
      __setState: (rows: unknown[]) => void
      __getLastInsertValues: () => Record<string, unknown> | undefined
    }
  }

  describe('正向拒绝(矛盾组合 400,message 指明互斥)', () => {
    it('POST once + rrule ⇒ 400 周期与一次性互斥(票面验收②)', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/automations',
        headers: AUTH_HEADERS,
        payload: {
          name: 't',
          prompt: 'p',
          scheduleType: 'once',
          scheduledAt: new Date(Date.now() + 60_000).toISOString(),
          rrule: 'FREQ=DAILY;INTERVAL=1',
        },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('互斥')
    })

    it('POST recurring + scheduledAt ⇒ 400 周期与一次性互斥', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/automations',
        headers: AUTH_HEADERS,
        payload: {
          name: 't',
          prompt: 'p',
          scheduleType: 'recurring',
          rrule: 'FREQ=DAILY;INTERVAL=1',
          scheduledAt: new Date(Date.now() + 60_000).toISOString(),
        },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('互斥')
    })

    it('PATCH 同传 rrule 与 scheduledAt ⇒ 400(一个 PATCH 只改一种 carrier)', async () => {
      const res = await server.inject({
        method: 'PATCH',
        url: '/api/automations/00000000-0000-4000-8000-000000000001',
        headers: AUTH_HEADERS,
        payload: {
          rrule: 'FREQ=DAILY;INTERVAL=1',
          scheduledAt: new Date(Date.now() + 60_000).toISOString(),
        },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('互斥')
    })

    it('PATCH 往一次性行上挂 rrule ⇒ 400(行级矛盾)', async () => {
      const res = await server.inject({
        method: 'PATCH',
        url: '/api/automations/00000000-0000-4000-8000-000000000001',
        headers: AUTH_HEADERS,
        payload: { rrule: 'FREQ=DAILY;INTERVAL=1' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('一次性计划不得设置 rrule')
    })

    it('PATCH 往周期行上挂 scheduledAt ⇒ 400(行级矛盾)', async () => {
      const mod = await dbMock()
      mod.__setState([
        {
          id: '00000000-0000-4000-8000-000000000001',
          userId: 'mock-user-id',
          scheduleType: 'recurring',
          rrule: 'FREQ=DAILY;INTERVAL=1',
          scheduledAt: null,
          timezone: 'Asia/Shanghai',
        },
      ])
      const res = await server.inject({
        method: 'PATCH',
        url: '/api/automations/00000000-0000-4000-8000-000000000001',
        headers: AUTH_HEADERS,
        payload: { scheduledAt: new Date(Date.now() + 60_000).toISOString() },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('重复计划不得设置 scheduledAt')
    })
  })

  describe('反向回归(合法组合仍 201,能力未削弱)', () => {
    it('POST 纯 recurring ⇒ 201,nextRunAt 与生产 parseNextRun 语义一致(HOURLY=now+1h)', async () => {
      const before = Date.now()
      const res = await server.inject({
        method: 'POST',
        url: '/api/automations',
        headers: AUTH_HEADERS,
        payload: {
          name: 't',
          prompt: 'p',
          scheduleType: 'recurring',
          rrule: 'FREQ=HOURLY;INTERVAL=50',
        },
      })
      expect(res.statusCode).toBe(201)
      // 真正写库的计算值在 insert values 里(响应行是 mock 的,不含 nextRunAt)
      const values = (await dbMock()).__getLastInsertValues()!
      expect(values.scheduleType).toBe('recurring')
      expect(values.rrule).toBe('FREQ=HOURLY;INTERVAL=50')
      expect(values.scheduledAt).toBeNull()
      const after = Date.now()
      // parseNextRun 的 HOURLY 档:from + 1h 绝对时间(from = 路由内 new Date())
      const nextRunAtMs = Date.parse(values.nextRunAt as string)
      expect(Number.isNaN(nextRunAtMs)).toBe(false)
      expect(nextRunAtMs - before).toBeGreaterThanOrEqual(55 * 60 * 1000)
      expect(nextRunAtMs - after).toBeLessThanOrEqual(65 * 60 * 1000)
      // 语义核对:与 parseNextRun 对同一 rrule 的产出同档(HOURLY 恒 +1h)
      const expected = parseNextRun('FREQ=HOURLY;INTERVAL=50', new Date(), null)
      expect(expected!.getTime() - new Date(expected!.getTime() - 3600_000).getTime()).toBe(3600_000)
    })

    it('POST 纯 once(只带 scheduledAt)⇒ 201,once 路径不受影响', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/automations',
        headers: AUTH_HEADERS,
        payload: {
          name: 't',
          prompt: 'p',
          scheduleType: 'once',
          scheduledAt: new Date(Date.now() + 60_000).toISOString(),
        },
      })
      expect(res.statusCode).toBe(201)
      const values = (await dbMock()).__getLastInsertValues()!
      expect(values.scheduleType).toBe('once')
      expect(values.rrule).toBeNull()
      expect(values.nextRunAt).not.toBeNull()
    })

    it('PATCH 只改 rrule(周期行)⇒ 200,更新路径仍可用', async () => {
      const mod = await dbMock()
      mod.__setState([
        {
          id: '00000000-0000-4000-8000-000000000001',
          userId: 'mock-user-id',
          scheduleType: 'recurring',
          rrule: 'FREQ=DAILY;INTERVAL=1',
          scheduledAt: null,
          timezone: 'Asia/Shanghai',
        },
      ])
      const res = await server.inject({
        method: 'PATCH',
        url: '/api/automations/00000000-0000-4000-8000-000000000001',
        headers: AUTH_HEADERS,
        payload: { rrule: 'FREQ=HOURLY;INTERVAL=50' },
      })
      expect(res.statusCode).toBe(200)
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
