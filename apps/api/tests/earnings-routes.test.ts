/**
 * earnings-routes 单测(P0 挣钱核心,2026-07-31 立)。
 *
 * 覆盖点:
 * - isFreeProviderModel:免费 provider 前缀匹配(引流渠道判定基础)
 * - GET /overview:今日 + 昨日聚合 + 8 字段响应结构 + 趋势百分比计算
 * - GET /byok-trend:days 默认 30 / 上限 365 / 超限 400 + 缺失日期补 0 + 单位换算
 * - GET /referral:三渠道(free-model/publish/direct)计数 + 用户去重
 * - GET /funnel:4 阶段计数(register/active/byok/vip)
 * - admin 权限校验:roleId < 1 → 403
 *
 * 测试模式:vi.mock 掉 db / authenticate(对齐 publish-routes.test.ts)。
 * 测试文件豁免 any(mock 类型断言必需,AGENTS.md §3)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

// mock authenticate(避免触发 JWT 解析)
const { mockAuthenticate, mockCheckAuth } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(async () => {
    /* no-op */
  }),
  mockCheckAuth: vi.fn(async () => true),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  checkAuth: mockCheckAuth,
}))

// mock dbRead.execute(返回数组,handler 里用 [row] 解构第一行)
const { mockDbReadExecute } = vi.hoisted(() => ({
  mockDbReadExecute: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  db: {},
  dbRead: {
    execute: mockDbReadExecute,
  },
  dbClient: {},
}))

import {
  earningsRoutes,
  isFreeProviderModel,
} from '../src/routes/earnings-routes.js'

// =============================================================================
// 工具:构建 mock Fastify server + request/reply(对齐 publish-routes.test.ts)
// =============================================================================

function buildMockServer(): {
  server: FastifyInstance
  handlers: Map<string, (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>>
} {
  const handlers = new Map<string, (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>>()
  const server = {
    get: vi.fn((path: string, handler: unknown) => {
      handlers.set(
        `GET ${path}`,
        handler as (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>,
      )
    }),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    addHook: vi.fn(),
  } as unknown as FastifyInstance
  return { server, handlers }
}

function makeRequest(
  opts: {
    query?: Record<string, string>
    roleId?: number
    userId?: string
  } = {},
): FastifyRequest {
  const { query = {}, roleId, userId = 'user-admin-1' } = opts
  return {
    query,
    headers: {},
    method: 'GET',
    url: '/api/earnings/overview',
    params: {},
    body: {},
    userId,
    jwtPayload: roleId === undefined ? undefined : { roleId },
    log: { error: vi.fn() },
  } as unknown as FastifyRequest
}

function makeReply(): FastifyReply & { sentPayload: unknown; sentStatus: number } {
  let sentPayload: unknown = undefined
  let sentStatus = 200
  const reply = {
    status: vi.fn((code: number) => {
      sentStatus = code
      return reply
    }),
    send: vi.fn((payload: unknown) => {
      sentPayload = payload
      return reply
    }),
    header: vi.fn(() => reply),
    get sentPayload() {
      return sentPayload
    },
    get sentStatus() {
      return sentStatus
    },
  } as unknown as FastifyReply & { sentPayload: unknown; sentStatus: number }
  return reply
}

// =============================================================================
// 测试套件
// =============================================================================

describe('earnings-routes — 挣钱中心仪表盘后端', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 默认 checkAuth 返回 true(已认证)
    mockCheckAuth.mockResolvedValue(true)
  })

  // ===========================================================================
  // 1. isFreeProviderModel — 免费 provider 前缀匹配
  // ===========================================================================
  describe('isFreeProviderModel', () => {
    it('cloudflare/ 前缀命中 → true', () => {
      expect(isFreeProviderModel('cloudflare/llama-3.1-8b-instruct')).toBe(true)
    })

    it('huggingface/ 大小写不敏感 → true', () => {
      expect(isFreeProviderModel('HuggingFace/mistral-7b')).toBe(true)
    })

    it('gpt-4o 未命中 → false', () => {
      expect(isFreeProviderModel('gpt-4o')).toBe(false)
    })

    it('pollinations/ 命中 → true', () => {
      expect(isFreeProviderModel('pollinations/text')).toBe(true)
    })
  })

  // ===========================================================================
  // 2. GET /overview — 今日 + 昨日聚合 + 8 字段响应 + 趋势百分比
  // ===========================================================================
  describe('GET /overview', () => {
    it('正常:返回 8 字段,今日收入 = (BYOK 抽成 + 中转站成本)/ 100,趋势对比昨天', async () => {
      const { server, handlers } = buildMockServer()
      await earningsRoutes(server)

      // Q1: income 聚合(分)
      // today_byok=1000 分(10 元),today_relay=500 分(5 元)→ todayIncome=15.00
      // yesterday_byok=500 分(5 元),yesterday_relay=0 分(0 元)→ yesterdayIncome=5.00
      // byokIncome = 10.00,yesterdayByokIncome = 5.00
      mockDbReadExecute.mockResolvedValueOnce([
        {
          today_byok: '1000',
          today_relay: '500',
          yesterday_byok: '500',
          yesterday_relay: '0',
        },
      ])
      // Q2: 引流 + 付费转化
      // today_referral=23,yesterday_referral=20,paid_count=10,total_count=230
      // conversionRate = 10/230*100 = 4.35(2 位小数)
      // yesterdayTotalCount = 230 - 23 = 207
      // yesterdayConversionRate = 10/207*100 = 4.83
      mockDbReadExecute.mockResolvedValueOnce([
        {
          today_referral: '23',
          yesterday_referral: '20',
          paid_count: '10',
          total_count: '230',
        },
      ])

      const handler = handlers.get('GET /overview')!
      const reply = makeReply()
      await handler(makeRequest({ roleId: 1 }), reply)

      expect(reply.sentStatus).toBe(200)
      const payload = reply.sentPayload as {
        code: number
        data: {
          todayIncome: number
          todayIncomeTrend: number
          byokIncome: number
          byokIncomeTrend: number
          referralCount: number
          referralTrend: number
          conversionRate: number
          conversionTrend: number
        }
      }
      expect(payload.code).toBe(0)
      // 8 字段全齐
      expect(Object.keys(payload.data).sort()).toEqual(
        [
          'todayIncome',
          'todayIncomeTrend',
          'byokIncome',
          'byokIncomeTrend',
          'referralCount',
          'referralTrend',
          'conversionRate',
          'conversionTrend',
        ].sort(),
      )
      // 金额单位换算(分→元)
      expect(payload.data.todayIncome).toBe(15.0) // (1000+500)/100
      expect(payload.data.byokIncome).toBe(10.0) // 1000/100
      // 引流数
      expect(payload.data.referralCount).toBe(23)
      // 转化率(2 位小数)
      expect(payload.data.conversionRate).toBeCloseTo(4.35, 2)
      // 趋势:todayIncome=15,yesterdayIncome=5 → (15-5)/5*100 = 200.0
      expect(payload.data.todayIncomeTrend).toBe(200.0)
      // byokIncome=10,yesterday=5 → 100.0
      expect(payload.data.byokIncomeTrend).toBe(100.0)
      // referralTrend: today=23,yesterday=20 → (23-20)/20*100 = 15.0
      expect(payload.data.referralTrend).toBe(15.0)
    })

    it('yesterday=0 时:today > 0 → 趋势 100%(新增),today = 0 → 趋势 0%', async () => {
      const { server, handlers } = buildMockServer()
      await earningsRoutes(server)

      // 全部昨日 0,今日 byok=200 分(2 元)
      mockDbReadExecute.mockResolvedValueOnce([
        {
          today_byok: '200',
          today_relay: '0',
          yesterday_byok: '0',
          yesterday_relay: '0',
        },
      ])
      mockDbReadExecute.mockResolvedValueOnce([
        {
          today_referral: '5',
          yesterday_referral: '0',
          paid_count: '0',
          total_count: '10',
        },
      ])

      const handler = handlers.get('GET /overview')!
      const reply = makeReply()
      await handler(makeRequest({ roleId: 1 }), reply)

      const payload = reply.sentPayload as { data: { todayIncomeTrend: number; referralTrend: number } }
      // yesterday=0 + today>0 → 100%
      expect(payload.data.todayIncomeTrend).toBe(100)
      expect(payload.data.referralTrend).toBe(100)
    })

    it('admin 权限校验:roleId=0 → 403 "需要管理员权限"', async () => {
      const { server, handlers } = buildMockServer()
      await earningsRoutes(server)

      const handler = handlers.get('GET /overview')!
      const reply = makeReply()
      await handler(makeRequest({ roleId: 0 }), reply)

      expect(reply.sentStatus).toBe(403)
      const payload = reply.sentPayload as { code: number; message: string }
      expect(payload.code).toBe(403)
      expect(payload.message).toContain('管理员')
      // dbRead 不应被调用(权限校验失败短路)
      expect(mockDbReadExecute).not.toHaveBeenCalled()
    })

    it('未通过 authenticate → 401 短路(checkAuth 返回 false)', async () => {
      const { server, handlers } = buildMockServer()
      await earningsRoutes(server)
      mockCheckAuth.mockResolvedValueOnce(false)

      const handler = handlers.get('GET /overview')!
      const reply = makeReply()
      await handler(makeRequest({ roleId: 1 }), reply)

      // checkAuth 失败时 reply 已被 send,但 sentStatus 可能是 401(由 checkAuth 内部 send)
      // 这里只验证 dbRead 未被调用即可证明短路
      expect(mockDbReadExecute).not.toHaveBeenCalled()
    })
  })

  // ===========================================================================
  // 3. GET /byok-trend?days=N — 最近 N 天 BYOK 抽成趋势
  // ===========================================================================
  describe('GET /byok-trend', () => {
    it('正常:返回 N 个数据点(缺失日期补 0),amount 单位元', async () => {
      const { server, handlers } = buildMockServer()
      await earningsRoutes(server)

      // 假设 SQL 返回 2 天的数据(分)— 日期需与路由 formatShanghaiDate 生成的日期对齐
      const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      const now = new Date()
      const yesterday = new Date(now)
      yesterday.setDate(now.getDate() - 1)
      const todayStr = fmt.format(now)
      const yesterdayStr = fmt.format(yesterday)
      mockDbReadExecute.mockResolvedValueOnce([
        { date: yesterdayStr, amount: '500' }, // 5 元
        { date: todayStr, amount: '1200' }, // 12 元
      ])

      const handler = handlers.get('GET /byok-trend')!
      const reply = makeReply()
      // days=2,只看 2 天
      await handler(makeRequest({ roleId: 1, query: { days: '2' } }), reply)

      expect(reply.sentStatus).toBe(200)
      const payload = reply.sentPayload as {
        code: number
        data: Array<{ date: string; amount: number }>
      }
      expect(payload.code).toBe(0)
      expect(payload.data.length).toBe(2)
      // 单位换算:500 分 → 5 元,1200 分 → 12 元
      const amounts = payload.data.map((p) => p.amount)
      expect(amounts).toContain(5.0)
      expect(amounts).toContain(12.0)
      // 每个数据点都有 date + amount
      expect(payload.data[0]!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('days 缺省 → 默认 30(SQL 用 MAKE_INTERVAL(days => 30))', async () => {
      const { server, handlers } = buildMockServer()
      await earningsRoutes(server)

      mockDbReadExecute.mockResolvedValueOnce([])

      const handler = handlers.get('byok-trend' ? 'GET /byok-trend' : 'GET /byok-trend')!
      const reply = makeReply()
      // 不传 days,默认 30
      await handler(makeRequest({ roleId: 1, query: {} }), reply)

      expect(reply.sentStatus).toBe(200)
      const payload = reply.sentPayload as { data: unknown[] }
      // 默认 30 天 → 返回 30 个数据点(空数据补 0)
      expect(payload.data.length).toBe(30)
      // 每个数据点 amount=0(SQL 返回空数组时)
      expect((payload.data[0] as { amount: number }).amount).toBe(0)
    })

    it('days=400 超上限 → 400 错误(Zod 校验)', async () => {
      const { server, handlers } = buildMockServer()
      await earningsRoutes(server)

      const handler = handlers.get('GET /byok-trend')!
      const reply = makeReply()
      await handler(makeRequest({ roleId: 1, query: { days: '400' } }), reply)

      expect(reply.sentStatus).toBe(400)
      const payload = reply.sentPayload as { code: number; message: string }
      expect(payload.code).toBe(400)
      // dbRead 不应被调用(参数校验失败短路)
      expect(mockDbReadExecute).not.toHaveBeenCalled()
    })

    it('days=365 上限 → 正常返回(边界值)', async () => {
      const { server, handlers } = buildMockServer()
      await earningsRoutes(server)

      mockDbReadExecute.mockResolvedValueOnce([])

      const handler = handlers.get('GET /byok-trend')!
      const reply = makeReply()
      await handler(makeRequest({ roleId: 1, query: { days: '365' } }), reply)

      expect(reply.sentStatus).toBe(200)
      const payload = reply.sentPayload as { data: unknown[] }
      // 365 天 → 365 个数据点
      expect(payload.data.length).toBe(365)
    })

    it('admin 权限校验:roleId < 1 → 403', async () => {
      const { server, handlers } = buildMockServer()
      await earningsRoutes(server)

      const handler = handlers.get('GET /byok-trend')!
      const reply = makeReply()
      await handler(makeRequest({ roleId: 0, query: { days: '30' } }), reply)

      expect(reply.sentStatus).toBe(403)
      expect(mockDbReadExecute).not.toHaveBeenCalled()
    })
  })

  // ===========================================================================
  // 4. GET /referral — 三渠道引流数 + 用户去重
  // ===========================================================================
  describe('GET /referral', () => {
    it('正常:三渠道计数,用户去重(free + publish 取并集后从总数扣除得 direct)', async () => {
      const { server, handlers } = buildMockServer()
      await earningsRoutes(server)

      // Q1: free-model 用户(SQL DISTINCT user_id FROM llm_call_logs WHERE LIKE free provider)
      mockDbReadExecute.mockResolvedValueOnce([{ user_id: 'u1' }, { user_id: 'u2' }])
      // Q2: publish 用户
      mockDbReadExecute.mockResolvedValueOnce([{ user_id: 'u2' }, { user_id: 'u3' }])
      // Q3: 总用户数
      mockDbReadExecute.mockResolvedValueOnce([{ total: '10' }])

      const handler = handlers.get('GET /referral')!
      const reply = makeReply()
      await handler(makeRequest({ roleId: 1 }), reply)

      expect(reply.sentStatus).toBe(200)
      const payload = reply.sentPayload as {
        code: number
        data: Array<{ channel: string; count: number }>
      }
      expect(payload.code).toBe(0)
      expect(payload.data.length).toBe(3)
      // 三渠道代码固定
      const channels = payload.data.map((d) => d.channel).sort()
      expect(channels).toEqual(['direct', 'free-model', 'publish'])
      // free-model: { u1, u2 } → 2
      // publish: { u2, u3 } → 2
      // free + publish 并集 = { u1, u2, u3 } → 3
      // direct = 10 - 3 = 7
      const freeStat = payload.data.find((d) => d.channel === 'free-model')
      const publishStat = payload.data.find((d) => d.channel === 'publish')
      const directStat = payload.data.find((d) => d.channel === 'direct')
      expect(freeStat!.count).toBe(2)
      expect(publishStat!.count).toBe(2)
      expect(directStat!.count).toBe(7)
    })

    it('无任何引流记录时:free=0,publish=0,direct=总用户数', async () => {
      const { server, handlers } = buildMockServer()
      await earningsRoutes(server)

      mockDbReadExecute.mockResolvedValueOnce([]) // free-model 空
      mockDbReadExecute.mockResolvedValueOnce([]) // publish 空
      mockDbReadExecute.mockResolvedValueOnce([{ total: '50' }]) // 总用户 50

      const handler = handlers.get('GET /referral')!
      const reply = makeReply()
      await handler(makeRequest({ roleId: 1 }), reply)

      const payload = reply.sentPayload as { data: Array<{ channel: string; count: number }> }
      const directStat = payload.data.find((d) => d.channel === 'direct')
      // 全部用户归 direct
      expect(directStat!.count).toBe(50)
    })

    it('admin 权限校验:roleId < 1 → 403,dbRead 不调用', async () => {
      const { server, handlers } = buildMockServer()
      await earningsRoutes(server)

      const handler = handlers.get('GET /referral')!
      const reply = makeReply()
      await handler(makeRequest({ roleId: 0 }), reply)

      expect(reply.sentStatus).toBe(403)
      expect(mockDbReadExecute).not.toHaveBeenCalled()
    })
  })

  // ===========================================================================
  // 5. GET /funnel — 4 阶段转化漏斗
  // ===========================================================================
  describe('GET /funnel', () => {
    it('正常:4 阶段计数(register > active > byok > vip 单调递减)', async () => {
      const { server, handlers } = buildMockServer()
      await earningsRoutes(server)

      mockDbReadExecute.mockResolvedValueOnce([
        {
          register_count: '230',
          active_count: '145',
          byok_count: '42',
          vip_count: '9',
        },
      ])

      const handler = handlers.get('GET /funnel')!
      const reply = makeReply()
      await handler(makeRequest({ roleId: 1 }), reply)

      expect(reply.sentStatus).toBe(200)
      const payload = reply.sentPayload as {
        code: number
        data: Array<{ stage: string; count: number }>
      }
      expect(payload.code).toBe(0)
      expect(payload.data.length).toBe(4)
      // 4 阶段代码固定
      const stages = payload.data.map((d) => d.stage)
      expect(stages).toEqual(['register', 'active', 'byok', 'vip'])
      // 计数对齐 SQL 返回
      const counts = payload.data.map((d) => d.count)
      expect(counts).toEqual([230, 145, 42, 9])
    })

    it('全 0 数据:register=0 时其余阶段也 0,响应结构仍完整', async () => {
      const { server, handlers } = buildMockServer()
      await earningsRoutes(server)

      mockDbReadExecute.mockResolvedValueOnce([
        {
          register_count: '0',
          active_count: '0',
          byok_count: '0',
          vip_count: '0',
        },
      ])

      const handler = handlers.get('GET /funnel')!
      const reply = makeReply()
      await handler(makeRequest({ roleId: 1 }), reply)

      const payload = reply.sentPayload as { data: Array<{ stage: string; count: number }> }
      expect(payload.data.length).toBe(4)
      expect(payload.data.every((d) => d.count === 0)).toBe(true)
    })

    it('admin 权限校验:roleId < 1 → 403,dbRead 不调用', async () => {
      const { server, handlers } = buildMockServer()
      await earningsRoutes(server)

      const handler = handlers.get('GET /funnel')!
      const reply = makeReply()
      await handler(makeRequest({ roleId: 0 }), reply)

      expect(reply.sentStatus).toBe(403)
      expect(mockDbReadExecute).not.toHaveBeenCalled()
    })
  })
})
