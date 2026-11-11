// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * SDB-27 夹具:USDT 全站共用单一收款地址,检测阶段必须
 * 1) 只接受金额**精确相等**的转账(不再 `amount >= expected` 取首笔);
 * 2) 跳过已被其它订单绑定的 txHash(与 confirmUsdtPayment 的查重同一数据面 usdt_payments.tx_hash);
 * 3) 候选不合格时继续向后遍历,而不是首笔不合格就判未到账。
 * 链上查询用全局 fetch 注入假响应(与 usdt-sdb27-28.test.ts 同一手法),不连节点/数据库。
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.CREDENTIALS_ENCRYPTION_KEY ??= 'a'.repeat(64)
  process.env.REDIS_URL ??= 'redis://localhost:6379'
})

const ERC_ADDR = '0x1111111111111111111111111111111111111111'
const TRON_ADDR = 'TMtTpPEMduWurHLi6Fe8XjfcP5Y5AMMnbG'
const ORDER_ID = 'USDT-SDB27-1'
const AMOUNT = 10.00025
const T0 = Date.UTC(2026, 10, 8, 3, 0, 0)

const h = vi.hoisted(() => {
  /** dbRead.select 的结果队列(每次 select 取一个) */
  const selectQueue: unknown[] = []
  const dbReadSelect = vi.fn(() => {
    const value = selectQueue.length > 0 ? selectQueue.shift() : []
    const p = Promise.resolve(value) as Promise<unknown> & Record<string, () => unknown>
    p.from = () => p
    p.where = () => p
    p.limit = () => p
    return p
  })
  return { selectQueue, dbReadSelect }
})

vi.mock('../src/db/index.js', () => ({
  db: { update: () => ({ set: () => ({ where: () => Promise.resolve(undefined) }) }) },
  dbRead: { select: h.dbReadSelect },
}))

vi.mock('../src/config/index.js', () => ({
  config: { USDT_CONFIRM_TRC20_MIN: 1, USDT_CONFIRM_ERC20_MIN: 1 },
}))

const { checkUsdtPaymentStatus } = await import('../src/services/payment-usdt-service.js')

function pendingOrder(network: 'TRC20' | 'ERC20', amount: number) {
  return {
    orderId: ORDER_ID,
    userId: 'user-a',
    address: network === 'TRC20' ? TRON_ADDR : ERC_ADDR,
    network,
    amount: amount.toFixed(8),
    amountPaid: '0',
    txHash: null,
    status: 'pending',
    // 用真实当前时刻算有效期,避免用例在固定 T0 之后被当成已过期而绕开检测
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    createdAt: new Date(T0),
    confirmedAt: null,
  }
}

function ercTx(hash: string, amount: number) {
  return {
    hash,
    value: String(Math.round(amount * 1e6)),
    to: ERC_ADDR,
    from: '0x2222222222222222222222222222222222222222',
    timeStamp: String(Math.floor((T0 + 60_000) / 1000)),
    tokenDecimal: '6',
    blockNumber: '100',
  }
}

function tronTx(hash: string, amount: number) {
  return {
    transaction_id: hash,
    to: TRON_ADDR,
    block_timestamp: T0 + 60_000,
    value: String(Math.round(amount * 1e6)),
  }
}

function ercPage(hashes: Array<{ hash: string; amount: number }>) {
  return { status: '1', message: 'OK', result: hashes.map((x) => ercTx(x.hash, x.amount)) }
}

function tronPage(hashes: Array<{ hash: string; amount: number }>) {
  return { success: true, meta: {}, data: hashes.map((x) => tronTx(x.hash, x.amount)) }
}

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body }
}

describe('SDB-27 到账归属:精确金额 + 跳过已占用 txHash', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    h.selectQueue.length = 0
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mockFetch)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('① 同金额但 txHash 已被其它订单占用 ⇒ 不命中', async () => {
    const order = pendingOrder('ERC20', AMOUNT)
    h.selectQueue.push([order]) // 订单
    h.selectQueue.push([{ txHash: '0xclaimed-by-b' }]) // 已被其它订单绑定
    mockFetch.mockResolvedValueOnce(jsonResponse(ercPage([{ hash: '0xclaimed-by-b', amount: AMOUNT }])))

    const r = await checkUsdtPaymentStatus(order.orderId)

    expect(r.detected).toBe(false)
    expect(r.txHash).toBeNull()
    expect(r.status).toBe('pending')
  })

  it('② 只有更大额的他人付款 ⇒ 不记入(旧实现 amount >= expected 会命中)', async () => {
    const order = pendingOrder('ERC20', AMOUNT)
    h.selectQueue.push([order])
    mockFetch.mockResolvedValueOnce(jsonResponse(ercPage([{ hash: '0xoverpay', amount: AMOUNT + 0.5 }])))

    const r = await checkUsdtPaymentStatus(order.orderId)

    expect(r.detected).toBe(false)
    expect(r.txHash).toBeNull()
    // 没有合格候选时不该去查 txHash 占用表(第二个 select 属于 pickUnclaimedCandidate)
    expect(h.dbReadSelect).toHaveBeenCalledTimes(1)
  })

  it('③ 首笔候选被占用时继续向后遍历,命中后面那笔精确金额', async () => {
    const order = pendingOrder('ERC20', AMOUNT)
    h.selectQueue.push([order])
    h.selectQueue.push([{ txHash: '0xclaimed-by-b' }])
    mockFetch.mockResolvedValueOnce(
      jsonResponse(
        ercPage([
          { hash: '0xclaimed-by-b', amount: AMOUNT },
          { hash: '0xfresh-exact', amount: AMOUNT },
        ]),
      ),
    )

    const r = await checkUsdtPaymentStatus(order.orderId)

    expect(r.detected).toBe(true)
    expect(r.txHash).toBe('0xfresh-exact')
    expect(r.amountPaid).toBeCloseTo(AMOUNT, 6)
  })

  it('④ TRC20 同型:超付与被占用都不算命中', async () => {
    const order = pendingOrder('TRC20', AMOUNT)
    h.selectQueue.push([order])
    h.selectQueue.push([{ txHash: 'tron-claimed' }])
    mockFetch.mockResolvedValueOnce(
      jsonResponse(
        tronPage([
          { hash: 'tron-overpay', amount: AMOUNT + 5 },
          { hash: 'tron-claimed', amount: AMOUNT },
        ]),
      ),
    )

    const r = await checkUsdtPaymentStatus(order.orderId)

    expect(r.detected).toBe(false)
    expect(r.txHash).toBeNull()
  })
})
