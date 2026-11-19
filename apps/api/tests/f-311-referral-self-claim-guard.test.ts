// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-311 回归锁(2026-11-14 立)。
 *
 * 病灶:claimCoupon 裂变分支只校验 referrerCoupon.couponId 相同,不校验
 * referrerCoupon.userId !== userId。用户 A 领到一张裂变券后,对同一券码反复用自己的那张 id
 * 当 referrerUserCouponId 领取 ⇒ referrerUserId === A ⇒
 *   - referrerGets='duplicate': 给自己再发一张同券(刷券)
 *   - referrerGets='credit':    给自己 API Key 直接 +referralValue(无流水刷余额)
 * perUserLimit=0(不限)时可无限放大。
 *
 * 本文件锁:
 *   ① 自荐(duplicate):分享人==领取人 ⇒ 不给任何人发 duplicate 券(无裂变 insert);
 *   ② 自荐(credit):分享人==领取人 ⇒ 不给自己 API Key 加余额;
 *   ③ 正常裂变(他人分享 duplicate):仍照发 duplicate 券(防误伤)。
 *
 * 只 mock db / @ihui/database,不连真实 PG。测试文件豁免 any(mock 类型断言必需)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockDbReadSelect, mockDbTransaction } = vi.hoisted(() => ({
  mockDbReadSelect: vi.fn(),
  mockDbTransaction: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  registerPoolTrackerCleanup: vi.fn(),
  db: { transaction: mockDbTransaction, insert: vi.fn(), update: vi.fn(), select: vi.fn() },
  dbRead: { select: mockDbReadSelect },
  dbClient: {},
}))

vi.mock('@ihui/database', () => ({
  // 2026-11-19 补:上游导出里新增 users,手抄 mock 缺它 ⇒ 模块加载期整片崩。
  // 纯表身份桩(列对象按属性名缓存,保证 eq(users.id) 两次取值同引用)。
  users: new Proxy({} as Record<string, unknown>, {
    get: (cache, prop) =>
      (cache[prop as string] ??= { name: String(prop), toString: () => String(prop) }),
  }),
  promoCoupons: {
    id: 'id',
    code: 'code',
    perUserLimit: 'per_user_limit',
    totalQuota: 'total_quota',
    issuedCount: 'issued_count',
    enabled: 'enabled',
    startsAt: 'starts_at',
    expiresAt: 'expires_at',
    type: 'type',
    referrerGets: 'referrer_gets',
    referralValue: 'referral_value',
    value: 'value',
    minSpend: 'min_spend',
    applicableModels: 'applicable_models',
  },
  userCoupons: {
    id: 'id',
    userId: 'user_id',
    couponId: 'coupon_id',
    status: 'status',
    referrerUserId: 'referrer_user_id',
    referredBy: 'referred_by',
    createdAt: 'created_at',
  },
  developerApiKeys: {
    id: 'id',
    userId: 'user_id',
    status: 'status',
    costBalanceCents: 'cost_balance_cents',
    createdAt: 'created_at',
  },
}))

import { claimCoupon } from '../src/services/coupon-service.js'

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const COUPON_ID = 'coupon-ref-1'
const OWN_REFERRER_UC_ID = 'uc-own-1' // A 自己那张裂变券
const OTHER_REFERRER_UC_ID = 'uc-other-1' // B 的裂变券

function referralCoupon(referrerGets: string) {
  return {
    id: COUPON_ID,
    code: 'IHUI-COUPON-REFTEST',
    name: '裂变券',
    type: 'referral',
    value: null,
    minSpend: null,
    referrerGets,
    referralValue: 200,
    applicableModels: null,
    applicableScope: 'relay',
    totalQuota: null,
    issuedCount: 1,
    perUserLimit: 0, // 不限 ⇒ 自荐可无限刷,正是病灶
    startsAt: new Date(Date.now() - 86_400_000),
    expiresAt: new Date(Date.now() + 86_400_000),
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

/** 记录一次写操作(用于断言"有没有发 duplicate 券 / 有没有加余额") */
interface WriteRec {
  table: string
  values: Record<string, unknown>
}

/** dbRead.select() 链式 mock:第一次调用返回券行,之后返回 referrer 的 user_coupon 行。 */
function installDbRead(referrerRow: Record<string, unknown>) {
  const coupon = referralCoupon('duplicate')
  let call = 0
  mockDbReadSelect.mockImplementation(() => {
    const rows = call++ === 0 ? [coupon] : [referrerRow]
    const chain: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'orderBy']) chain[m] = () => chain
    chain.limit = () => Promise.resolve(rows)
    chain.then = (r: (v: unknown) => unknown, j?: (e: unknown) => unknown) =>
      Promise.resolve(rows).then(r, j)
    return chain
  })
}

/**
 * 造一个轻量 tx:insert 记录写入并返回被分享人的新券;update 记录写入。
 * lockedCoupon 由 referrerGets 决定。
 */
function makeTx(records: WriteRec[], referrerGets: string) {
  const locked = referralCoupon(referrerGets)
  const tx = {
    select: () => ({
      from: () => ({
        where: () => ({
          for: () => Promise.resolve([locked]),
          limit: () => Promise.resolve([{ id: COUPON_ID, perUserLimit: 0, totalQuota: null }]),
          orderBy: () => ({ limit: () => Promise.resolve([{ id: 'key-1' }]) }),
        }),
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: () => ({
          returning: () => {
            records.push({ table: 'update', values })
            return Promise.resolve([{ id: COUPON_ID }])
          },
        }),
      }),
    }),
    insert: (t: string) => ({
      values: (values: Record<string, unknown>) => {
        records.push({ table: t, values })
        return {
          returning: () =>
            Promise.resolve([
              { id: 'uc-new', userId: USER_A, couponId: COUPON_ID, status: 'unused' },
            ]),
        }
      },
    }),
  }
  return tx
}

describe('F-311 裂变券自荐守卫', () => {
  beforeEach(() => {
    mockDbReadSelect.mockReset()
    mockDbTransaction.mockReset()
  })

  it('① 自荐(duplicate):分享人==领取人 ⇒ 不发 duplicate 券给任何人', async () => {
    installDbRead({ id: OWN_REFERRER_UC_ID, userId: USER_A, couponId: COUPON_ID })
    const records: WriteRec[] = []
    mockDbTransaction.mockImplementation(async (body: (tx: unknown) => Promise<unknown>) =>
      body(makeTx(records, 'duplicate')),
    )

    const r = await claimCoupon(USER_A, 'IHUI-COUPON-REFTEST', OWN_REFERRER_UC_ID)
    expect(r.success).toBe(true)
    // 用户券 insert 只有一条(被分享人自己那张),不得有给 referrer 的 duplicate 裂变券
    const ucInserts = records.filter((x) => x.table !== 'update' && 'userId' in x.values)
    expect(ucInserts).toHaveLength(1)
    expect(ucInserts[0]!.values.userId).toBe(USER_A)
  })

  it('② 自荐(credit):分享人==领取人 ⇒ 不给自己 API Key 加余额', async () => {
    installDbRead({ id: OWN_REFERRER_UC_ID, userId: USER_A, couponId: COUPON_ID })
    const records: WriteRec[] = []
    mockDbTransaction.mockImplementation(async (body: (tx: unknown) => Promise<unknown>) =>
      body(makeTx(records, 'credit')),
    )

    const r = await claimCoupon(USER_A, 'IHUI-COUPON-REFTEST', OWN_REFERRER_UC_ID)
    expect(r.success).toBe(true)
    // credit 路径不得出现 costBalanceCents 递增(developerApiKeys 的 update)
    const balanceUpdates = records.filter(
      (x) => x.table === 'update' && 'costBalanceCents' in x.values,
    )
    expect(balanceUpdates).toHaveLength(0)
  })

  it('③ 正常裂变(他人分享 duplicate):仍照发 duplicate 券给分享人(防误伤)', async () => {
    installDbRead({ id: OTHER_REFERRER_UC_ID, userId: USER_B, couponId: COUPON_ID })
    const records: WriteRec[] = []
    mockDbTransaction.mockImplementation(async (body: (tx: unknown) => Promise<unknown>) =>
      body(makeTx(records, 'duplicate')),
    )

    const r = await claimCoupon(USER_A, 'IHUI-COUPON-REFTEST', OTHER_REFERRER_UC_ID)
    expect(r.success).toBe(true)
    // 两条 userCoupon insert:被分享人 A 一张 + 给分享人 B 的 duplicate 一张
    const ucInserts = records.filter((x) => x.table !== 'update' && 'userId' in x.values)
    expect(ucInserts).toHaveLength(2)
    expect(ucInserts[1]!.values.userId).toBe(USER_B)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
