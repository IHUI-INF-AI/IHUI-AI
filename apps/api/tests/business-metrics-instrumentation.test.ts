// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `business_funnel_total` / `business_orders_total` / `business_payments_total` 三族
 * **实接埋点**用例(2026-10-18 立,承接零基线那一票)。
 *
 * 立因:这三族的装饰器(`server.recordFunnel` / `recordOrder` / `recordPayment`)在
 * `plugins/business-metrics.ts` 头注里被写成"路由通过 … 上报"的契约,但全仓**零调用点**
 * ⇒ Grafana `business-funnel.json` 的 stage/type/status 三块面板读到的 0 是"埋点压根
 * 没人调",不是"这段时间没发生过"。本次把埋点接到真实链路,本文件把"接上了"钉成机器可判的:
 *
 * - 每个断言都走**真实业务函数**(HTTP 注入 `POST /api/auth/register` 等三个注册端点 /
 *   `placeOrder` / `completeOrder` / `completeOrderWithSaga` / `cancelOrder` / `refundOrder`),
 *   **不经装饰器** —— 装饰器本身早有 B2 那种用例,再写一遍只会把"调用点没接"这一型
 *   继续漏掉(而那正是本次的失效型)。
 * - 事件发生**前**该键不存在(这两族标签是开放集,不开 0 基线,见渲染侧注记);
 *   事件发生**后**恰好 1;重复回调 / 并发竞态 / 幂等重放路径**不再顶数**。
 * - 观测层坏了不能把业务带崩:T5 把 orders 族的写入实现**真的**弄抛(撑爆基数上限后让
 *   `ihuiCounterInc` 去自增一枚会抛的 dropped 计数),断言业务调用照样原样返回、
 *   且异常确实发生过(冒到 `logger.warn`)—— 摘掉 `safeRecord` 的兜底即翻红。
 *   注:三族(漏斗/订单/支付)的装饰器与桥接**都只调同一个 `safeRecord` 包裹的实现**
 *   (见 business-metrics.ts 的 recordFunnelSample 段),所以 T5 证的是那一个兜底,
 *   对三个族同样成立;注册端点那一头由 T1(可装载时)+ T9(结构锁)配对钉住。
 * - 用户可控标签必须先洗:一个未转义引号会把**整次 scrape** 打回(见 sanitizeAiLabel
 *   头注同型失效),T7 用带引号/竖线/换行的 payType 钉住渲染合法性与基数上限。
 *
 * 关于 auth 那一段为什么可能被 skip:`src/routes/auth.ts` 静态 import 的
 * `src/utils/code-echo-guard.ts` **此刻被另一会话从工作树删掉了**(该删除原本是暂存态,
 * 被一次共享索引 `reset` 摘掉标记 ⇒ `heal-worktree-tracked` 明确"不代裁恢复")。
 * 本文件对此只做**探测**:探测不过就把注册端点那组用例记为 skip(不假绿、不硬拉红),
 * 并让订单/支付两组照跑。归属会话把那枚文件恢复或把 import 一并改掉后,该组自动生效。
 *
 * 测试纪律:db / logger / 三方查询全 mock,零连接(禁碰 PG 8810 与 Redis 8811,AGENTS §5);
 * 枚举清单与缺省渠道一律从源文件取(§22c:判据不得在测试里抄第二份)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type * as dbQueriesShape from '../src/db/queries.js'
import type * as codeStoreShape from '../src/utils/code-store.js'
import Fastify, { type FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'

// ============================================================================
// 依赖隔离(mock 面照抄 tests/success-paths.test.ts 那套已验证可用的 auth 路由 mock)
// ============================================================================
vi.mock('jose', () => ({ decodeJwt: () => ({}) }))
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}))
vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  verifyAccessToken: vi.fn().mockResolvedValue({ userId: 'u-1', roleId: 0 }),
  verifyRefreshToken: vi.fn().mockResolvedValue({ userId: 'u-1', roleId: 0 }),
  createFamilyId: vi.fn().mockReturnValue('fam-1'),
  ACCESS_TOKEN_TTL_SECONDS: 15 * 60,
  REFRESH_TOKEN_TTL_SECONDS: 30 * 24 * 60 * 60,
}))
vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))
vi.mock('../src/db/index.js', () => {
  // 只把"查询链"补齐到不会炸的程度(replayPaidSideEffects 等真实函数会走 db.select().from().where()),
  // 一律返回空行集 ⇒ 幂等判定走"未产生过"分支,不引入任何真实 IO(AGENTS §5 测试隔离)。
  const chain = (): Record<string, unknown> => {
    const c: Record<string, unknown> = {}
    for (const m of [
      'from',
      'where',
      'orderBy',
      'groupBy',
      'limit',
      'offset',
      'innerJoin',
      'leftJoin',
      'values',
      'returning',
      'set',
      'onConflict',
      'doNothing',
      'doUpdate',
    ]) {
      c[m] = vi.fn(() => c)
    }
    c.execute = vi.fn(async () => [])
    c.then = (resolve: (v: unknown[]) => unknown) => resolve([])
    return c
  }
  const stub = {
    select: vi.fn(() => chain()),
    insert: vi.fn(() => chain()),
    update: vi.fn(() => chain()),
    delete: vi.fn(() => chain()),
    query: { select: vi.fn(() => chain()) },
    execute: vi.fn(async () => []),
    transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(stub)),
  }
  return { db: stub, dbRead: stub }
})
vi.mock('../src/utils/password-crypto.js', () => ({
  hashPassword: vi.fn().mockResolvedValue('$argon2id$mockedhashvalue'),
  verifyPassword: vi.fn().mockResolvedValue(true),
  upgradeHashIfNeeded: vi.fn().mockResolvedValue(null),
}))
vi.mock('../src/services/account-lockout.js', () => ({
  getLockRemainingMs: vi.fn().mockResolvedValue(0),
  recordLoginFailure: vi.fn().mockResolvedValue(3),
  clearLoginFailures: vi.fn().mockResolvedValue(undefined),
  ACCOUNT_LOCKOUT_CONFIG: { maxFailures: 5, lockDurationSec: 900, failureWindowSec: 900 },
}))
vi.mock('../src/db/usercenter-queries.js', () => ({ getUserStatus: vi.fn().mockResolvedValue(1) }))
vi.mock('../src/db/rbac-queries.js', () => ({
  getUserPermissions: vi.fn().mockResolvedValue([]),
  checkPermission: vi.fn().mockResolvedValue(false),
  checkAnyPermission: vi.fn().mockResolvedValue(false),
  findUserRoles: vi.fn().mockResolvedValue([]),
}))
vi.mock('../src/db/promotion-queries.js', () => ({
  findInvitationByCode: vi.fn().mockResolvedValue(undefined),
  markInvitationUsed: vi.fn(),
}))
vi.mock('../src/services/points-service.js', () => ({
  earnPoints: vi.fn().mockResolvedValue({ transaction: { id: 'ptx-1' } }),
  spendPoints: vi.fn().mockResolvedValue({ transaction: { id: 'ptx-2' } }),
}))
vi.mock('../src/services/topup-discount-service.js', () => ({
  calculateTopupBonus: vi.fn().mockResolvedValue({ multiplier: 1, bonus: 0, actualCredit: 1 }),
  getTopupConfig: vi.fn(),
}))
vi.mock('../src/utils/outbox.js', () => ({ writeToOutbox: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../src/services/edu-ledger.js', () => ({
  recordPayment: vi.fn().mockResolvedValue({ ledger: { id: 'led-1' } }),
  recordRefund: vi.fn().mockResolvedValue({ ledger: { id: 'led-2' } }),
}))
// 注册端点的用户读写:只把注册链要用到的几枚换成 mock,其余保留真实实现
// (token-service / purge-user-pii 也 import 本模块,整块替掉会缺名字)
vi.mock('../src/db/queries.js', async (importOriginal) => {
  const actual = await importOriginal<typeof dbQueriesShape>()
  return {
    ...actual,
    findUserByPhone: vi.fn().mockResolvedValue(undefined),
    findUserByEmail: vi.fn().mockResolvedValue(undefined),
    findUserById: vi.fn().mockResolvedValue(undefined),
    checkPhoneExists: vi.fn().mockResolvedValue(false),
    checkEmailExists: vi.fn().mockResolvedValue(false),
    createUser: vi.fn(),
    saveRefreshToken: vi.fn().mockResolvedValue(undefined),
    findRefreshToken: vi.fn().mockResolvedValue(undefined),
    revokeRefreshToken: vi.fn().mockResolvedValue(undefined),
  }
})
vi.mock('../src/utils/code-store.js', async (importOriginal) => {
  const actual = await importOriginal<typeof codeStoreShape>()
  // G-876:注册路径先读用途场景再消费码;本文件测的是漏斗埋点,不测码校验,
  // 故无既有条目(用途锁不触发)+ 校验恒过,把变量收敛到「注册是否成功」这一维。
  return {
    ...actual,
    getCodeEntry: vi.fn().mockResolvedValue(null),
    verifyCode: vi.fn().mockResolvedValue(true),
  }
})

// G-876:短信通道未配置时 register 一律 503;本文件用代理档(死端口,不会真发)点亮「已配置」判据。
process.env.SMS_API_BASE_URL ??= 'http://127.0.0.1:1'
// 订单表读写:内存状态机,精确复刻 updateOrderStatus 的 B3 条件 UPDATE 语义
const orderStore: Array<Record<string, unknown>> = []
vi.mock('../src/db/payment-queries.js', () => ({
  createOrder: vi.fn(async (input: Record<string, unknown>, operatorId: string | null) => {
    const row = {
      id: `ord-${orderStore.length + 1}`,
      orderNo: `ORD-${orderStore.length + 1}`,
      currency: 'CNY',
      status: 'pending',
      createdBy: operatorId,
      ...input,
      // 真实 createOrder 把入参 payType 落成 orders.paymentMethod 列(必须映射,
      // 否则支付渠道标签在测试里读不到值 ⇒ 测的就不是生产的那条拼装)
      paymentMethod: input.payType,
    }
    orderStore.push(row)
    return row
  }),
  findOrderByNo: vi.fn(async (orderNo: string) => {
    const o = orderStore.find((x) => x.orderNo === orderNo)
    return o ? { ...o } : undefined
  }),
  updateOrderStatus: vi.fn(async (orderNo: string, newStatus: string, fromStatus?: string) => {
    const o = orderStore.find((x) => x.orderNo === orderNo)
    if (!o) return undefined
    if (fromStatus && o.status !== fromStatus) return undefined // B3 条件 UPDATE
    o.status = newStatus
    return { ...o }
  }),
  queryPendingOrders: vi.fn().mockResolvedValue([]),
  listPaidOrdersByDate: vi.fn().mockResolvedValue([]),
}))

// ============================================================================
// 被测实现(全部从源文件取,§22c)
// ============================================================================
import businessMetricsPlugin, {
  __test__ as BM,
  FUNNEL_DEFAULT_CHANNEL,
  FUNNEL_STAGES,
} from '../src/plugins/business-metrics.js'
import {
  placeOrder,
  completeOrder,
  completeOrderWithSaga,
  cancelOrder,
  refundOrder,
} from '../src/services/order-service.js'
import { createUser } from '../src/db/queries.js'
import { logger } from '../src/utils/logger.js'

/**
 * 探测 auth 路由能否装载(见文件头注)。探测失败 ⇒ 只把注册端点那组用例记为 skip,
 * 并把原因留在用例名里可见;绝不把"没跑"写成"跑过"。
 */
const authRoutesProbe = await (async () => {
  try {
    const [a, b] = await Promise.all([
      import('../src/routes/auth.js'),
      import('../src/routes/auth-extended.js'),
    ])
    return { ok: true as const, authRoutes: a.authRoutes, authExtendedRoutes: b.authExtendedRoutes }
  } catch (e) {
    return { ok: false as const, reason: e instanceof Error ? e.message : String(e) }
  }
})()

const SAMPLE_UUID = '00000000-0000-4000-8000-000000000001'
const mockUser = {
  id: SAMPLE_UUID,
  phone: '13800000001',
  email: null,
  passwordHash: '$2a$10$mockedhashvalue',
  nickname: '用户0001',
  avatar: null,
  familyId: '00000000-0000-4000-8000-000000000002',
  roleId: 0,
  status: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
}

let server: FastifyInstance | undefined

async function boot(opts: { withAuth?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(businessMetricsPlugin)
  if (opts.withAuth) {
    if (!authRoutesProbe.ok) throw new Error('auth 路由不可装载:' + authRoutesProbe.reason)
    await app.register(cookie)
    app.decorate('riskEngine', {
      evaluateRisk: () => ({ action: 'ALLOW' as const, hits: [], score: 0 }),
    })
    app.register(authRoutesProbe.authRoutes, { prefix: '/api/auth' })
    app.register(authRoutesProbe.authExtendedRoutes, { prefix: '/api' })
  }
  await app.ready()
  return app
}

async function render(app: FastifyInstance): Promise<string> {
  const res = await app.inject({ method: 'GET', url: '/business-metrics' })
  expect(res.statusCode).toBe(200)
  return res.body
}

/** 取一条样本的值(名字 + 完整标签集精确匹配,不做前缀模糊)。 */
function sample(text: string, name: string, labels: Record<string, string>): string | undefined {
  const labelSet = Object.entries(labels)
    .map(([k, v]) => `${k}="${v}"`)
    .join(',')
  const escaped = labelSet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const hit = new RegExp(`^${name}\\{${escaped}\\} (\\S+)$`, 'm').exec(text)
  return hit ? hit[1] : undefined
}

function familyLines(text: string, family: string): string[] {
  return text
    .split('\n')
    .filter((l) => l.length > 0 && !l.startsWith('#') && l.startsWith(`${family}{`))
}

/** 往内存订单表塞一行(不走 createOrder mock,便于预置已存在订单的状态)。 */
function seedOrder(over: Record<string, unknown> = {}): string {
  const orderNo = `ORDX-${orderStore.length + 1}`
  orderStore.push({
    id: `ordx-${orderStore.length + 1}`,
    orderNo,
    userId: 'u-1',
    amount: 100,
    currency: 'CNY',
    orderType: 1,
    paymentMethod: 'wechat',
    productId: null,
    status: 'pending',
    ...over,
  })
  return orderNo
}

beforeEach(() => {
  BM.resetIhuiState()
  orderStore.length = 0
  vi.mocked(createUser).mockResolvedValue(mockUser)
})

afterEach(async () => {
  if (server) {
    await server.close()
    server = undefined
  }
})

describe.skipIf(!authRoutesProbe.ok)(
  `T1 business_funnel_total{stage="register"} 由真实注册端点顶数${
    authRoutesProbe.ok ? '' : '【SKIP:auth 路由不可装载 —— ' + authRoutesProbe.reason + '】'
  }`,
  () => {
    it('注册前三档 stage 都是 0 基线;POST /api/auth/register 成功后恰好 1', async () => {
      server = await boot({ withAuth: true })
      const before = await render(server)
      for (const stage of FUNNEL_STAGES) {
        expect(
          sample(before, 'business_funnel_total', { stage, channel: FUNNEL_DEFAULT_CHANNEL }),
        ).toBe('0')
      }
      expect(familyLines(before, 'business_funnel_total')).toHaveLength(FUNNEL_STAGES.length)

      const res = await server.inject({
        method: 'POST',
        url: '/api/auth/register',
        body: { phone: '13800000001', password: 'password123', code: '123456' },
      })
      expect(res.statusCode).toBe(200)

      const after = await render(server)
      expect(
        sample(after, 'business_funnel_total', {
          stage: 'register',
          channel: FUNNEL_DEFAULT_CHANNEL,
        }),
        '注册成功没有把 register 顶成 1 ⇒ 埋点没接上或接错了地方',
      ).toBe('1')
      // 其余两档不得被连带顶数(埋点写错 stage 才会)
      expect(
        sample(after, 'business_funnel_total', {
          stage: 'activate',
          channel: FUNNEL_DEFAULT_CHANNEL,
        }),
      ).toBe('0')
      expect(
        sample(after, 'business_funnel_total', { stage: 'paid', channel: FUNNEL_DEFAULT_CHANNEL }),
      ).toBe('0')
      // 不许多出第四条 stage / 第二个 channel(编造渠道即红)
      expect(familyLines(after, 'business_funnel_total')).toHaveLength(FUNNEL_STAGES.length)
      for (const l of familyLines(after, 'business_funnel_total')) {
        expect(FUNNEL_STAGES as readonly string[]).toContain(/stage="([^"]*)"/.exec(l)?.[1] ?? '')
      }
    })

    it('注册失败的三条路径(参数错 / 手机号已存在 / createUser 抛)一律不计数', async () => {
      server = await boot({ withAuth: true })
      // ① 400:密码太短
      expect(
        (
          await server.inject({
            method: 'POST',
            url: '/api/auth/register',
            body: { phone: '13800000001', password: 'short' },
          })
        ).statusCode,
      ).toBe(400)
      // ② 409:手机号已存在
      const { findUserByPhone } = await import('../src/db/queries.js')
      vi.mocked(findUserByPhone).mockResolvedValueOnce({ ...mockUser } as never)
      expect(
        (
          await server.inject({
            method: 'POST',
            url: '/api/auth/register',
            body: { phone: '13800000001', password: 'password123', code: '123456' },
          })
        ).statusCode,
      ).toBe(409)
      // ③ createUser 抛 ⇒ 非 2xx
      vi.mocked(findUserByPhone).mockResolvedValue(undefined as never)
      vi.mocked(createUser).mockRejectedValueOnce(new Error('db down'))
      const bad = await server.inject({
        method: 'POST',
        url: '/api/auth/register',
        body: { phone: '13800000002', password: 'password123', code: '123456' },
      })
      expect(bad.statusCode).toBeGreaterThanOrEqual(400)

      const text = await render(server)
      expect(
        sample(text, 'business_funnel_total', {
          stage: 'register',
          channel: FUNNEL_DEFAULT_CHANNEL,
        }),
        '注册没成功却计了数 ⇒ 埋点接在了状态迁移之前',
      ).toBe('0')
    })

    it('另两个自助注册端点(/auth/register/email、/sms-proxy/register)同样计数', async () => {
      server = await boot({ withAuth: true })
      const emailRes = await server.inject({
        method: 'POST',
        url: '/api/auth/register/email',
        body: { email: 'a@b.com', code: '123456', password: 'password123' },
      })
      expect(emailRes.statusCode).toBe(201)
      expect(
        sample(await render(server), 'business_funnel_total', {
          stage: 'register',
          channel: FUNNEL_DEFAULT_CHANNEL,
        }),
        '邮箱注册端点没接上埋点',
      ).toBe('1')

      const smsRes = await server.inject({
        method: 'POST',
        url: '/api/sms-proxy/register',
        body: { phone: '13800000003', code: '123456', password: 'password123' },
      })
      expect(smsRes.statusCode).toBe(201)
      expect(
        sample(await render(server), 'business_funnel_total', {
          stage: 'register',
          channel: FUNNEL_DEFAULT_CHANNEL,
        }),
        '短信注册端点没接上埋点',
      ).toBe('2')
    })
  },
)

describe('T2 business_orders_total / business_payments_total 由 placeOrder 顶数', () => {
  it('下单前这两个族零样本(开放集不开 0 基线);下单后各恰好 1 条', async () => {
    server = await boot()
    const before = await render(server)
    expect(familyLines(before, 'business_orders_total')).toHaveLength(0)
    expect(familyLines(before, 'business_payments_total')).toHaveLength(0)

    const order = await placeOrder({
      userId: 'u-1',
      amount: 100,
      orderType: 1,
      payType: 'wechat',
    })
    expect(order.orderNo).toBeTruthy()

    const text = await render(server)
    expect(
      sample(text, 'business_orders_total', { type: '1', status: 'pending' }),
      'type 标签不是订单原值',
    ).toBe('1')
    expect(sample(text, 'business_payments_total', { channel: 'wechat', status: 'attempt' })).toBe(
      '1',
    )
    // 不许多出别的档口(下单不该产生 paid/success)
    expect(familyLines(text, 'business_orders_total')).toHaveLength(1)
    expect(familyLines(text, 'business_payments_total')).toHaveLength(1)
  })

  it('orderType=7 的订单在 type 标签上就是 7(整码原值,不自立第二份清单)', async () => {
    server = await boot()
    await placeOrder({ userId: 'u-1', amount: 100, orderType: 7, payType: 'alipay' })
    const text = await render(server)
    expect(sample(text, 'business_orders_total', { type: '7', status: 'pending' })).toBe('1')
    expect(sample(text, 'business_orders_total', { type: 'course', status: 'pending' })).toBe(
      undefined,
    )
  })
})

describe('T3 completeOrder 的真实状态迁移才计数,幂等重放不重复计', () => {
  it('pending→paid:orders 顶成 1、payments success 顶成 1;再调一次(已 paid)不再顶数', async () => {
    server = await boot()
    const orderNo = seedOrder({ orderType: 1, paymentMethod: 'alipay' })

    const first = await completeOrder(orderNo, 'TRADE-1')
    expect(first.success).toBe(true)
    let text = await render(server)
    expect(sample(text, 'business_orders_total', { type: '1', status: 'paid' })).toBe('1')
    expect(sample(text, 'business_payments_total', { channel: 'alipay', status: 'success' })).toBe(
      '1',
    )

    // 幂等重放(状态已是 paid 的分支):业务仍返回成功,但计数不得再动
    const again = await completeOrder(orderNo, 'TRADE-1')
    expect(again.success).toBe(true)
    text = await render(server)
    expect(
      sample(text, 'business_orders_total', { type: '1', status: 'paid' }),
      '重复回调把 paid 顶成 2 ⇒ 幂等重放路径也在计数',
    ).toBe('1')
    expect(sample(text, 'business_payments_total', { channel: 'alipay', status: 'success' })).toBe(
      '1',
    )
    // pending 那条也不该被顶数(completeOrder 不走 placeOrder)
    expect(sample(text, 'business_orders_total', { type: '1', status: 'pending' })).toBeUndefined()
  })

  it('订单不存在 ⇒ 不产生任何样本', async () => {
    server = await boot()
    const r = await completeOrder('ORD-NOT-EXIST')
    expect(r.success).toBe(false)
    const text = await render(server)
    expect(familyLines(text, 'business_orders_total')).toHaveLength(0)
    expect(familyLines(text, 'business_payments_total')).toHaveLength(0)
  })
})

describe('T4 completeOrderWithSaga 的真实完成才计数', () => {
  it('saga 成功后 orders=paid / payments=success 各 1;重放不再顶数', async () => {
    server = await boot()
    const orderNo = seedOrder({ orderType: 1, paymentMethod: 'wechat', amount: 1000 })

    const res = await completeOrderWithSaga(orderNo, 'PAY-1')
    expect(res.success).toBe(true)
    let text = await render(server)
    expect(sample(text, 'business_orders_total', { type: '1', status: 'paid' })).toBe('1')
    expect(sample(text, 'business_payments_total', { channel: 'wechat', status: 'success' })).toBe(
      '1',
    )

    const replay = await completeOrderWithSaga(orderNo, 'PAY-1')
    expect(replay.success).toBe(true)
    text = await render(server)
    expect(
      sample(text, 'business_orders_total', { type: '1', status: 'paid' }),
      'saga 重放路径也在计数',
    ).toBe('1')
    expect(sample(text, 'business_payments_total', { channel: 'wechat', status: 'success' })).toBe(
      '1',
    )
  })
})

describe('T6 cancelOrder / refundOrder 的状态迁移', () => {
  it('取消 pending 订单:orders cancelled 顶 1,且不写 payments(取消不是支付事件)', async () => {
    server = await boot()
    const orderNo = seedOrder({ orderType: 1, paymentMethod: 'wechat' })
    const r = await cancelOrder(orderNo)
    expect(r.success).toBe(true)
    let text = await render(server)
    expect(sample(text, 'business_orders_total', { type: '1', status: 'cancelled' })).toBe('1')
    expect(familyLines(text, 'business_payments_total')).toHaveLength(0)

    // 已取消的订单再取消:条件 UPDATE 0 行 ⇒ 不重复计数
    expect((await cancelOrder(orderNo)).success).toBe(false)
    text = await render(server)
    expect(sample(text, 'business_orders_total', { type: '1', status: 'cancelled' })).toBe('1')
  })

  it('退款:orders refunded 与 payments refund 各 1', async () => {
    server = await boot()
    const orderNo = seedOrder({ orderType: 1, paymentMethod: 'fund' })
    expect((await completeOrder(orderNo)).success).toBe(true)
    const r = await refundOrder(orderNo)
    expect(r.success).toBe(true)
    const text = await render(server)
    expect(sample(text, 'business_orders_total', { type: '1', status: 'refunded' })).toBe('1')
    expect(sample(text, 'business_payments_total', { channel: 'fund', status: 'refund' })).toBe('1')
  })
})

describe('T5 观测层坏了不能把业务链路带崩', () => {
  it('写入实现真的抛 ⇒ placeOrder 仍原样返回订单,异常被记成 warn', async () => {
    server = await boot()
    vi.mocked(logger.warn).mockClear()

    // 把 orders 族撑到基数上限(走公开装饰器,键格式与生产一致),再让"超限丢弃计数"
    // 这一步真的抛 —— 这就是"埋点内部坏了"那一型:safeRecord 必须吞掉它。
    for (let i = 0; i < BM.IHUI_SERIES_CAP; i++) {
      server.recordOrder(`filler${i}`, 'pending')
    }
    const before = await render(server)
    expect(familyLines(before, 'business_orders_total')).toHaveLength(BM.IHUI_SERIES_CAP)

    const originalDropped = BM.ihuiState.seriesDroppedTotal
    let armed = false
    Object.defineProperty(BM.ihuiState, 'seriesDroppedTotal', {
      configurable: true,
      get() {
        if (armed) throw new Error('boom: 观测层内部故障')
        return 0
      },
      set() {
        /* 吞掉写入,测试结束后还原成普通数据属性 */
      },
    })

    let order: { orderNo: string } | undefined
    try {
      armed = true
      // 新键 + 已满的族 ⇒ ihuiCounterInc 走进"超限"分支 ⇒ 命中上面那枚会抛的 getter
      order = await placeOrder({
        userId: 'u-1',
        amount: 100,
        orderType: 77,
        payType: 'wechat',
      })
    } finally {
      armed = false
      Reflect.deleteProperty(BM.ihuiState, 'seriesDroppedTotal')
      BM.ihuiState.seriesDroppedTotal = originalDropped
    }

    // ① 业务调用没被带崩:订单照常创建出来
    expect(order?.orderNo).toMatch(/^ORD-/)
    // ② 异常确实发生过并且是被兜底吃掉的(不是"压根没抛")
    const warned = vi
      .mocked(logger.warn)
      .mock.calls.map((c) => String(c[0]))
      .filter((s) => s.includes('recordOrderSample'))
    expect(
      warned.length,
      '埋点异常没有冒到 warn ⇒ 要么没真的抛(用例失去意义),要么兜底被摘掉(应判红)',
    ).toBeGreaterThan(0)
    // ③ 端点仍然可渲染、既有样本没被打坏
    const after = await render(server)
    expect(familyLines(after, 'business_orders_total')).toHaveLength(BM.IHUI_SERIES_CAP)
    expect(sample(after, 'business_orders_total', { type: 'filler0', status: 'pending' })).toBe('1')
  })
})

describe('T7 标签注入护栏(用户可控值不得写坏整次 scrape,也不得炸基数)', () => {
  it('payType 带引号/竖线/换行时仍渲染出合法样本行', async () => {
    server = await boot()
    await placeOrder({
      userId: 'u-1',
      amount: 100,
      orderType: 1,
      payType: 'a"b|c\nd',
    })
    const text = await render(server)
    const lines = familyLines(text, 'business_payments_total')
    expect(lines.length).toBeGreaterThan(0)
    // 每一行都必须是合法样本行(未转义引号/换行会把整次 scrape 打回)
    for (const l of lines) {
      expect(l, `渲染出的样本行不合法: ${l}`).toMatch(
        /^business_payments_total\{channel="[^"\n]*",status="[^"\n]*"\} \d+$/,
      )
    }
    expect(text).not.toContain('channel="a"b')
    expect(familyLines(text, 'business_orders_total')).toHaveLength(1)
  })

  it('渠道基数有上限:超上限的新序列不录', async () => {
    server = await boot()
    for (let i = 0; i < BM.IHUI_SERIES_CAP + 5; i++) {
      await placeOrder({ userId: 'u-1', amount: 1, orderType: 1, payType: `ch${i}` })
    }
    const text = await render(server)
    expect(familyLines(text, 'business_payments_total').length).toBeLessThanOrEqual(
      BM.IHUI_SERIES_CAP,
    )
  })
})

describe('T8 缺省渠道不得被编造', () => {
  it('渲染里出现的唯一 channel 就是源文件那枚 FUNNEL_DEFAULT_CHANNEL', async () => {
    server = await boot()
    expect(FUNNEL_DEFAULT_CHANNEL).toBe(BM.FUNNEL_DEFAULT_CHANNEL)
    server.recordFunnel('register')
    const text = await render(server)
    const channels = new Set(
      familyLines(text, 'business_funnel_total').map((l) => /channel="([^"]*)"/.exec(l)?.[1] ?? ''),
    )
    expect([...channels]).toEqual([FUNNEL_DEFAULT_CHANNEL])
  })
})

/**
 * T9 注册端点埋点的**结构锁**(承 T1 的临时兜底,不是 T1 的替身)。
 *
 * 为什么需要它:T1 那组用例走真实 HTTP 注入,而 `src/routes/auth.ts` 此刻在**本工作树**
 * 里装载不起来(它静态 import 的 `src/utils/code-echo-guard.ts` 被另一会话删掉了,
 * 而那枚删除原本是暂存态 ⇒ `heal-worktree-tracked` 明令"分不清误删还是有意删除 ⇒ 不代裁"
 * ⇒ 我不去替别人恢复它)。T1 因此记为 skip,而 skip 不等于绿(AGENTS §0.3)。
 * 这组用例用"读源码"这一条最弱也最不依赖他人的判据,先把三件事钉住:
 * ① 三处注册成功点各自都**有**埋点(摘掉任一处即红);② 埋点落在 `await createUser(` **之后**
 * (挪到用户创建之前就红);③ stage 字面量必须属于源文件那份封闭枚举(不许自立第四档)。
 * T1 一旦能跑就与这组互相对账;两组都绿才算这一族真的接上了。
 */
describe('T9 注册端点埋点结构锁(T1 装载不起来时的兜底判据)', () => {
  const srcRoot = new URL('../src/', import.meta.url)
  const SITES = [
    { file: 'routes/auth.ts', expectedCalls: 1 },
    { file: 'routes/auth-extended.ts', expectedCalls: 2 },
  ] as const

  it.each(SITES)(
    '$file 里 recordFunnel("register") 恰有 $expectedCalls 处且都在 createUser 之后',
    async ({ file, expectedCalls }) => {
      const { readFile } = await import('node:fs/promises')
      const source = await readFile(new URL(file, srcRoot), 'utf8')
      const callRe = /server\.recordFunnel\('([a-z]+)'\)/g
      const hits: Array<{ index: number; stage: string }> = []
      for (let m = callRe.exec(source); m !== null; m = callRe.exec(source)) {
        hits.push({ index: m.index, stage: m[1] ?? '' })
      }
      expect(hits, `埋点枚数不对(被摘或被多加): ${file}`).toHaveLength(expectedCalls)
      for (const h of hits) {
        expect(FUNNEL_STAGES as readonly string[], `stage 不在源文件那份封闭枚举里`).toContain(
          h.stage,
        )
        const window = source.slice(Math.max(0, h.index - 600), h.index)
        expect(
          window.includes('await createUser('),
          `埋点没有紧跟在用户创建成功之后(${file}):可能是接在了状态迁移之前`,
        ).toBe(true)
      }
    },
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
