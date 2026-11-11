// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SDB-54 回归:导入侧的"是不是周期计划"判据必须与调度器自身解析器同一份。
 *
 * 缺陷:导入判据是一条更窄的正则(只认 FREQ 打头、只允许 BYHOUR/BYMINUTE/BYDAY),
 * `FREQ=DAILY;INTERVAL=1;BYHOUR=9` 被调度器 parseRruleParts 正常解析(忽略 INTERVAL、
 * 算出 09:00),却被导入侧判成不可映射 ⇒ 落 once + rrule=null + scheduledAt=null;
 * 放行侧又不校验 once 必须有 scheduledAt ⇒ 启用后永远不被捞起(静默失效)。
 *
 * 本文件锁三件事:
 *   ① 带 INTERVAL/BYHOUR 的 DAILY 判为 recurring、rrule 原样保留,且同一判据能算出 nextRunAt;
 *   ② 调度器排不出的 trigger 仍落 once(rrule=null)并逐条记 schedule_unmapped;
 *   ③ once 缺 scheduledAt 时 PATCH 启用被 400 拒(带 scheduledAt 时仍可启用,能力未削弱)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// 鉴权直通(只测 PATCH 的计划闸门);DB 用 thenable 链替身,不连真实依赖
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: { userId?: string }) => {
    request.userId = '00000000-0000-4000-8000-000000000fee'
  },
}))

/** 可配置结果的 thenable drizzle 链(与 automations-schedule-mutex 测试同款)。 */
vi.mock('../src/db/index.js', () => {
  const state: { rows: unknown[] } = { rows: [] }
  function createChain(): Record<string, unknown> {
    const chain: Record<string, unknown> = {
      then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(state.rows).then(resolve),
    }
    for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'set', 'returning', 'leftJoin']) {
      chain[m] = () => chain
    }
    chain['values'] = () => chain
    return chain
  }
  return {
    __setState: (rows: unknown[]) => {
      state.rows = rows
    },
    db: {
      select: vi.fn(() => createChain()),
      insert: vi.fn(() => createChain()),
      update: vi.fn(() => createChain()),
      delete: vi.fn(() => createChain()),
    },
    dbRead: { select: vi.fn(() => createChain()) },
  }
})

// parseNextRun / planRuntimeImport 一律用真实实现 —— 判据本身就是要被验证的那件事
import automationsRoutes from '../src/routes/automations.js'
import { planRuntimeImport } from '../src/services/runtime-import-plan.js'
import { parseNextRun } from '../src/services/agent-automation-scheduler.js'

const AUTH_HEADERS = { authorization: 'Bearer mock-access-token' }

function automationPlanItem(trigger: string) {
  return { name: 'n', prompt: 'p', trigger }
}

describe('SDB-54 导入判据复用调度器解析能力', () => {
  it('① FREQ=DAILY;INTERVAL=1;BYHOUR=9 ⇒ recurring + rrule 保留,且能算出 09:00 的 nextRunAt', () => {
    const trigger = 'FREQ=DAILY;INTERVAL=1;BYHOUR=9'
    const plan = planRuntimeImport({ automations: [automationPlanItem(trigger)] }, null)

    expect(plan.automations).toHaveLength(1)
    const row = plan.automations[0]
    expect(row.scheduleType).toBe('recurring')
    expect(row.rrule).toBe(trigger)
    // 导入一律 paused,到期时间由启用时 PATCH 重算(既有字段映射不变)
    expect(row.scheduledAt).toBeNull()
    expect(plan.skipped.filter((s) => s.reason === 'schedule_unmapped')).toHaveLength(0)

    // 判据 = 调度器自己的 parseNextRun:INTERVAL 被忽略,BYHOUR 是墙钟 09:00
    const next = parseNextRun(trigger, new Date('2026-11-11T00:00:00.000Z'), 'Asia/Shanghai')
    expect(next).not.toBeNull()
    expect(next!.toISOString()).toBe('2026-11-11T01:00:00.000Z')
  })

  it('② 调度器排不出的 trigger 仍落 once(rrule=null),逐条记 schedule_unmapped', () => {
    const plan = planRuntimeImport(
      {
        automations: [
          automationPlanItem('每天九点'), // 根本不是 RRULE
          automationPlanItem('FREQ=WEEKLY;BYHOUR=9'), // 旧正则放行,但调度器缺 BYDAY 排不出
        ],
      },
      null,
    )

    expect(plan.automations).toHaveLength(2)
    for (const row of plan.automations) {
      expect(row.scheduleType).toBe('once')
      expect(row.rrule).toBeNull()
      expect(row.scheduledAt).toBeNull()
    }
    expect(
      plan.skipped.filter((s) => s.dimension === 'automations' && s.reason === 'schedule_unmapped'),
    ).toEqual([
      { dimension: 'automations', index: 0, reason: 'schedule_unmapped' },
      { dimension: 'automations', index: 1, reason: 'schedule_unmapped' },
    ])
    // 与判据一致:调度器确实算不出这两条的下一次运行
    expect(parseNextRun('FREQ=WEEKLY;BYHOUR=9', new Date(), null)).toBeNull()
  })
})

describe('SDB-54 once 启用必须带 scheduledAt', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.register(automationsRoutes, { prefix: '/api/automations' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(async () => {
    const mod = (await import('../src/db/index.js')) as unknown as {
      __setState: (rows: unknown[]) => void
    }
    // 导入落库的 once 行形态:scheduledAt = null、rrule = null、paused
    mod.__setState([
      {
        id: '00000000-0000-4000-8000-000000000001',
        userId: '00000000-0000-4000-8000-000000000fee',
        scheduleType: 'once',
        rrule: null,
        scheduledAt: null,
        timezone: 'Asia/Shanghai',
        status: 'paused',
      },
    ])
  })

  it('③ once 缺 scheduledAt 时启用 ⇒ 400 且中文原因点名 scheduledAt', async () => {
    const res = await server.inject({
      method: 'PATCH',
      url: '/api/automations/00000000-0000-4000-8000-000000000001',
      headers: AUTH_HEADERS,
      payload: { status: 'active' },
    })
    expect(res.statusCode).toBe(400)
    const message = res.json().message as string
    expect(message).toContain('一次性计划')
    expect(message).toContain('scheduledAt')
  })

  it('反向回归:同时给出 scheduledAt 仍可启用(能力未削弱)', async () => {
    const res = await server.inject({
      method: 'PATCH',
      url: '/api/automations/00000000-0000-4000-8000-000000000001',
      headers: AUTH_HEADERS,
      payload: { status: 'active', scheduledAt: new Date(Date.now() + 60_000).toISOString() },
    })
    expect(res.statusCode).toBe(200)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
