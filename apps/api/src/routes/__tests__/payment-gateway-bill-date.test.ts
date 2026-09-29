// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 管理端三个对账端点缺省 billDate 时必须是**北京**昨日日历日。
 *
 * 立项因由:原实现 `new Date(Date.now() - 86400_000).toISOString().slice(0, 10)` 取的是
 * **UTC 日历日**,与宿主时区无关但按 UTC 归档 —— 支付宝/微信的账单是按北京时间出账的,
 * 于是每次调用落在**北京 00:00–08:00**(= UTC 16:00–24:00)窗口内,请求的就是**前天**的账单。
 *
 * 三条判据:
 *  1. 前置:证明改 process.env.TZ 真能改变 Date 本地读数(否则"三档相同"是恒绿废话)。
 *  2. **走真端点**(app.inject),断言响应里的 billDate —— 只测 helper 而端点仍用旧表达式,
 *     正是本仓反复记过的"造好没装车"。
 *  3. 硬编码北京日历日当 oracle,并留一条显式调用 billDate 的对照(证明改的不是那条路径)。
 */
import type * as AuthPluginModuleForMock from '../../plugins/auth.js'
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
})

// 只替换 authenticate(返回管理员 payload);其余导出照原样,避免把 auth 插件的其他出口抽掉。
vi.mock('../../plugins/auth.js', async (importOriginal) => {
  const actual = await importOriginal<typeof AuthPluginModuleForMock>()
  return {
    ...actual,
    authenticate: vi.fn(async () => ({ sub: '1', userId: 1, roleId: 1 })),
  }
})

import { adminPaymentGatewayRoutes } from '../payment-gateway.js'

const HOST_ZONES = ['UTC', 'Asia/Shanghai', 'America/New_York'] as const
const ORIGINAL_TZ = process.env.TZ

/** 北京 2025-11-25 03:00:00(争议窗口内;= UTC 2025-11-24 19:00)。 */
const DISPUTED_NOW = 1764010800000
/** 该瞬间"昨天"的北京日历日 —— 人工核对的 oracle。 */
const EXPECTED_BEIJING_YESTERDAY = '2025-11-24'
/** 被本票否定的旧写法在同一瞬间给出的值(UTC 日历日,等于请求前天的账单)。 */
const WRONG_UTC_DAY = '2025-11-23'

const ENDPOINTS = [
  { name: 'alipay', url: '/api/admin/payments/reconciliation/alipay' },
  { name: 'wechat', url: '/api/admin/payments/reconciliation/wechat' },
  { name: 'all', url: '/api/admin/payments/reconciliation/all' },
] as const

let app: FastifyInstance

beforeAll(async () => {
  app = Fastify({ logger: false })
  await app.register(adminPaymentGatewayRoutes, { prefix: '/api/admin' })
  await app.ready()
})

afterAll(async () => {
  await app.close()
  if (ORIGINAL_TZ === undefined) {
    delete process.env.TZ
  } else {
    process.env.TZ = ORIGINAL_TZ
  }
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('管理端对账端点的缺省 billDate — 北京日历日', () => {
  it('前置判据:改 process.env.TZ 确实改变 Date 本地读数(否则本文件全部断言都是恒绿的)', () => {
    process.env.TZ = 'UTC'
    const inUtc = new Date(DISPUTED_NOW).getHours()
    process.env.TZ = 'Asia/Shanghai'
    const inShanghai = new Date(DISPUTED_NOW).getHours()
    expect({ inUtc, inShanghai }).toEqual({ inUtc: 19, inShanghai: 3 })
  })

  it('争议窗口内三个端点都请求北京的昨日,且三档宿主时区逐字相同', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(DISPUTED_NOW)
    for (const zone of HOST_ZONES) {
      process.env.TZ = zone
      for (const { name, url } of ENDPOINTS) {
        const res = await app.inject({ method: 'GET', url })
        expect(res.statusCode).toBe(200)
        const body = res.json() as { data?: { billDate?: string } }
        expect({ zone, endpoint: name, billDate: body.data?.billDate }).toEqual({
          zone,
          endpoint: name,
          billDate: EXPECTED_BEIJING_YESTERDAY,
        })
      }
    }
  })

  it('控制组:旧写法(UTC 日历日)在同一瞬间给的是前一天 —— 本判据确实分得开对错', () => {
    const legacy = new Date(DISPUTED_NOW - 86400_000).toISOString().slice(0, 10)
    expect(legacy).toBe(WRONG_UTC_DAY)
    expect(legacy).not.toBe(EXPECTED_BEIJING_YESTERDAY)
  })

  it('显式传 billDate 时不推导、原样使用(未改动那条路径)', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(DISPUTED_NOW)
    process.env.TZ = 'America/New_York'
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/payments/reconciliation/alipay?billDate=2026-07-22',
    })
    expect(res.statusCode).toBe(200)
    expect((res.json() as { data?: { billDate?: string } }).data?.billDate).toBe('2026-07-22')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
