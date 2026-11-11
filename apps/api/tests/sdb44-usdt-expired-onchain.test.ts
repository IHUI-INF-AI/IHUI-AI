// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SDB-44 夹具:订单越过 expiresAt 后必须先查链,不能"没查就说没付款"。
 * 覆盖:
 * 1) 已过期 + 链上有效交易 ⇒ 先查链命中,不落 expired,并完成入账;
 * 2) 已过期 + 链上无交易 ⇒ expired;
 * 3) 已过期 + 链上查询失败 ⇒ 保持 pending(不得写成 expired);
 * 4) 未过期路径行为不变;refunded 等其它终态不被放宽。
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
const T0 = Date.UTC(2026, 10, 8, 3, 0, 0)
const ORDER_ID = 'USDT-EXPIRED-1'
const TX_HASH = '0xpay'

const h = vi.hoisted(() => {
  // dbRead.select 的结果队列(每次 select 取一个)
  const selectQueue: unknown[] = []
  const selectChain = (value: unknown) => {
    const p: any = Promise.resolve(value)
    p.from = vi.fn(() => p)
    p.where = vi.fn(() => p)
    p.limit = vi.fn(() => p)
    p.orderBy = vi.fn(() => p)
    p.offset = vi.fn(() => p)
    return p
  }
  const dbReadSelect = vi.fn(() => selectChain(selectQueue.length > 0 ? selectQueue.shift() : []))

  // update/insert 共用:同时兼容「直接 await」与「.returning() 取行」
  const writeChain = (rows: unknown[]) => {
    const p: any = Promise.resolve(rows)
    p.set = vi.fn(() => p)
    p.where = vi.fn(() => p)
    p.returning = vi.fn(() => p)
    p.onConflictDoUpdate = vi.fn(() => p)
    return p
  }

  const dbUpdate = vi.fn(() => writeChain([{ orderId: ORDER_ID }]))
  const tx = {
    select: vi.fn(() => selectChain([])),
    update: vi.fn(() => writeChain([{ id: 1, userId: 'user-1' }])),
    insert: vi.fn(() => ({ values: vi.fn(() => writeChain([{ tokenQuantity: '1000' }])) })),
  }
  const transaction = vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx))

  return { selectQueue, dbReadSelect, dbUpdate, tx, transaction }
})

vi.mock('../src/db/index.js', () => ({
  db: {
    update: h.dbUpdate,
    insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
    transaction: h.transaction,
  },
  dbRead: { select: h.dbReadSelect },
}))

vi.mock('../src/config/index.js', () => ({
  config: { USDT_CONFIRM_TRC20_MIN: 1, USDT_CONFIRM_ERC20_MIN: 1 },
}))

const { checkUsdtPaymentStatus, confirmUsdtPaymentWithOnChainCheck } = await import(
  '../src/services/payment-usdt-service.js'
)

const mockFetch = vi.fn()

beforeEach(() => {
  h.selectQueue.length = 0
  vi.clearAllMocks()
  vi.stubGlobal('fetch', mockFetch)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body }
}

/** 一笔与订单金额精确相等的平台地址转入(下游还需要它通过 verifyErc20OnChain) */
const paidTx = {
  hash: TX_HASH,
  value: String(Math.round(10.00025 * 1e6)),
  to: ERC_ADDR,
  from: '0x2222222222222222222222222222222222222222',
  timeStamp: String(Math.floor((T0 + 60_000) / 1000)),
  tokenDecimal: '6',
  blockNumber: '100',
}

function txPage(items: unknown[]) {
  return { status: '1', message: 'OK', result: items }
}

const emptyPage = { status: '0', message: 'No transactions found', result: [] }

function ercOrder(overrides: Record<string, unknown> = {}) {
  return {
    orderId: ORDER_ID,
    userId: 'user-1',
    address: ERC_ADDR,
    network: 'ERC20',
    amount: '10.00025',
    amountPaid: '0',
    txHash: null,
    status: 'pending',
    expiresAt: new Date(Date.now() - 60_000),
    createdAt: new Date(T0),
    confirmedAt: null,
    ...overrides,
  }
}

/** 让 verifyErc20OnChain 通过:交易列表 + 最新区块号(100 → 106,确认数 7 ≥ 1) */
function mockVerifyOk() {
  mockFetch
    .mockResolvedValueOnce(jsonResponse(txPage([paidTx])))
    .mockResolvedValueOnce(jsonResponse({ result: '0x6a' }))
}

describe('SDB-44 过期订单先查链再判过期', () => {
  it('① 已过期 + 链上有效交易 ⇒ 先查链命中,不落 expired,并完成入账', async () => {
    const order = ercOrder()
    h.selectQueue.push([order]) // checkUsdtPaymentStatus 读订单
    h.selectQueue.push([]) // pickUnclaimedCandidate:已绑定 txHash 集合
    mockFetch.mockResolvedValueOnce(jsonResponse(txPage([paidTx])))

    const status = await checkUsdtPaymentStatus(ORDER_ID)
    expect(status.status).toBe('pending')
    expect(status.detected).toBe(true)
    expect(status.txHash).toBe(TX_HASH)
    // 命中交易时绝不能先落 expired
    expect(h.dbUpdate).not.toHaveBeenCalled()

    // 轮询命中后走确认入账
    h.selectQueue.push([order]) // confirmWithOnChainCheck 读订单
    h.selectQueue.push([order]) // confirmUsdtPayment 读订单
    h.selectQueue.push([{ key: 'usdt_payment.rate', value: '1' }])
    mockVerifyOk()

    const r = await confirmUsdtPaymentWithOnChainCheck(ORDER_ID, TX_HASH)
    expect(r.status).toBe('confirmed')
    expect(r.tokensCredited).toBe(1000)
    expect(h.dbUpdate).not.toHaveBeenCalled()
  })

  it('①b 已过期(status=expired)+ 链上取证有效 ⇒ 补救通道允许 confirm 入账', async () => {
    const order = ercOrder({ status: 'expired' })
    h.selectQueue.push([order]) // confirmWithOnChainCheck 读订单
    mockVerifyOk()
    // 回拨 expired → pending 后,confirmUsdtPayment 重新读一次订单
    h.selectQueue.push([ercOrder({ status: 'pending' })])
    h.selectQueue.push([{ key: 'usdt_payment.rate', value: '1' }])

    const r = await confirmUsdtPaymentWithOnChainCheck(ORDER_ID, TX_HASH)
    expect(r.status).toBe('confirmed')
    expect(r.tokensCredited).toBe(1000)
    // 只回拨过这一次 expired → pending
    expect(h.dbUpdate).toHaveBeenCalledTimes(1)
  })

  it('② 已过期 + 链上确无交易 ⇒ 才落 expired', async () => {
    h.selectQueue.push([ercOrder()])
    mockFetch.mockResolvedValueOnce(jsonResponse(emptyPage))

    const r = await checkUsdtPaymentStatus(ORDER_ID)
    expect(r.status).toBe('expired')
    expect(r.detected).toBe(false)
    expect(h.dbUpdate).toHaveBeenCalledTimes(1)
  })

  it('③ 已过期 + 链上查询失败 ⇒ 保持 pending 并记录错误,不落 expired', async () => {
    h.selectQueue.push([ercOrder()])
    mockFetch.mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({}) })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const r = await checkUsdtPaymentStatus(ORDER_ID)
    expect(r.status).toBe('pending')
    expect(r.detected).toBe(false)
    expect(h.dbUpdate).not.toHaveBeenCalled()
    expect(errSpy.mock.calls.map((c) => c.join(' ')).join('\n')).toContain(ORDER_ID)
    errSpy.mockRestore()
  })

  it('④ 未过期路径行为不变:无交易保持 pending,有交易仍 detected', async () => {
    const order = ercOrder({ expiresAt: new Date(Date.now() + 30 * 60 * 1000) })

    h.selectQueue.push([order])
    mockFetch.mockResolvedValueOnce(jsonResponse(emptyPage))
    const r1 = await checkUsdtPaymentStatus(ORDER_ID)
    expect(r1.status).toBe('pending')
    expect(r1.detected).toBe(false)

    h.selectQueue.push([order])
    h.selectQueue.push([])
    mockFetch.mockResolvedValueOnce(jsonResponse(txPage([paidTx])))
    const r2 = await checkUsdtPaymentStatus(ORDER_ID)
    expect(r2.status).toBe('pending')
    expect(r2.detected).toBe(true)
    expect(h.dbUpdate).not.toHaveBeenCalled()
  })

  it('⑤ refunded 等其它终态不被放宽(仍拒绝确认)', async () => {
    const order = ercOrder({ status: 'refunded' })
    h.selectQueue.push([order])
    h.selectQueue.push([order]) // confirmUsdtPayment 读订单后抛 400

    await expect(confirmUsdtPaymentWithOnChainCheck(ORDER_ID, TX_HASH)).rejects.toMatchObject({
      statusCode: 400,
    })
    expect(mockFetch).not.toHaveBeenCalled()
    expect(h.dbUpdate).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
