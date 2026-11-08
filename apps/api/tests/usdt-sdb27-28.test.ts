// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SDB-27 / SDB-28 夹具。
 *
 * SDB-27(全站共用收款地址 ⇒ 抢绑他人 txHash):用「下单侧唯一金额 + 到账侧精确金额 +
 *   跳过已绑定 txHash」三步闭环。旧实现 `amount >= expected` 会让同一地址上任何一笔
 *   更大额转入命中任一订单;同额的两笔 pending 订单也会互相抢付款。
 * SDB-28(只查固定一页 ⇒ 老交易永不到账):到账检测改为向后翻页直到覆盖下单时间,
 *   页数预算耗尽则抛错留痕,不静默漏单。
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.CREDENTIALS_ENCRYPTION_KEY ??= 'a'.repeat(64)
  process.env.REDIS_URL ??= 'redis://localhost:6379'
})

const TRON_ADDR = 'TMtTpPEMduWurHLi6Fe8XjfcP5Y5AMMnbG'
const ERC_ADDR = '0x1111111111111111111111111111111111111111'

const h = vi.hoisted(() => {
  // dbRead.select 的结果队列(每次 select 取一个)
  const selectQueue: unknown[] = []
  const selectCalls: unknown[] = []
  const mockInsertValues = vi.fn<(v: unknown) => Promise<unknown>>()

  const selectChain = (value: unknown) => {
    const p: any = Promise.resolve(value)
    p.from = vi.fn(() => p)
    p.where = vi.fn(() => p)
    p.limit = vi.fn(() => p)
    p.orderBy = vi.fn(() => p)
    p.offset = vi.fn(() => p)
    return p
  }

  const dbReadSelect = vi.fn((fields?: unknown) => {
    selectCalls.push(fields)
    const value = selectQueue.length > 0 ? selectQueue.shift() : []
    return selectChain(value)
  })

  return { selectQueue, selectCalls, mockInsertValues, dbReadSelect }
})

vi.mock('../src/db/index.js', () => ({
  db: {
    insert: () => ({ values: h.mockInsertValues }),
  },
  dbRead: { select: h.dbReadSelect },
}))

vi.mock('../src/config/index.js', () => ({
  config: { USDT_CONFIRM_TRC20_MIN: 1, USDT_CONFIRM_ERC20_MIN: 1 },
}))

const { checkUsdtPaymentStatus, createUsdtPayment } =
  await import('../src/services/payment-usdt-service.js')

const T0 = Date.UTC(2026, 10, 8, 3, 0, 0)

function pendingOrder(network: 'TRC20' | 'ERC20', amount: number) {
  return {
    orderId: 'USDT-ORDER-1',
    userId: 'user-1',
    address: network === 'TRC20' ? TRON_ADDR : ERC_ADDR,
    network,
    amount: amount.toFixed(8),
    amountPaid: '0',
    txHash: null,
    status: 'pending',
    // 有效期按真实当前时刻计,避免固定 T0 让用例在 T0+30min 之后变成“已过期”而绕过到账检测
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    createdAt: new Date(T0),
    confirmedAt: null,
  }
}

function ercTx(hash: string, amount: number, tsMs: number) {
  return {
    hash,
    value: String(Math.round(amount * 1e6)),
    to: ERC_ADDR,
    from: '0x2222222222222222222222222222222222222222',
    timeStamp: String(Math.floor(tsMs / 1000)),
    tokenDecimal: '6',
    blockNumber: '100',
  }
}

/** 造一页 Etherscan 返回:100 条全额转账,无匹配金额,时间从 sinceMs 往后推 */
function fullPage(page: number) {
  const items = Array.from({ length: 100 }, (_, i) =>
    ercTx(`0x${page}${String(i).padStart(4, '0')}`, 5, T0 + 1 + i),
  )
  return { status: '1', message: 'OK', result: items }
}

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body }
}

describe('SDB-27 到账归属:精确金额 + 跳过已绑定 txHash', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    h.selectQueue.length = 0
    h.selectCalls.length = 0
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mockFetch)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('他人更大额转账不再命中订单(旧实现 amount >= expected 会命中)', async () => {
    const order = pendingOrder('ERC20', 10.00025)
    h.selectQueue.push([order]) // 订单
    h.selectQueue.push([]) // 已绑定 txHash 集合
    // 唯一一笔转入比应收多 0.5 USDT
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        status: '1',
        message: 'OK',
        result: [ercTx('0xoverpay', 10.50025, T0 + 60_000)],
      }),
    )

    const r = await checkUsdtPaymentStatus(order.orderId)
    expect(r.detected).toBe(false)
    expect(r.txHash).toBeNull()
  })

  it('已被其它订单绑定的 txHash 不再计入(防重复入账)', async () => {
    const order = pendingOrder('ERC20', 10.00025)
    h.selectQueue.push([order])
    // 候选 txHash 全部已被绑定
    h.selectQueue.push([{ txHash: '0xclaimed' }])
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        status: '1',
        message: 'OK',
        result: [ercTx('0xclaimed', 10.00025, T0 + 60_000)],
      }),
    )

    const r = await checkUsdtPaymentStatus(order.orderId)
    expect(r.detected).toBe(false)
  })

  it('精确同额的未占用 txHash 正常命中', async () => {
    const order = pendingOrder('ERC20', 10.00025)
    h.selectQueue.push([order])
    h.selectQueue.push([])
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        status: '1',
        message: 'OK',
        result: [ercTx('0xfresh', 10.00025, T0 + 60_000)],
      }),
    )

    const r = await checkUsdtPaymentStatus(order.orderId)
    expect(r.detected).toBe(true)
    expect(r.txHash).toBe('0xfresh')
  })

  it('创建订单的应收金额带唯一尾差,且档位间距大于匹配容差', async () => {
    process.env.USDT_ERC20_ADDRESS = ERC_ADDR
    h.mockInsertValues.mockResolvedValue(undefined)
    h.selectQueue.push([]) // systemConfigs(空 ⇒ 默认 rate=1)

    const r = await createUsdtPayment('user-1', 1000, 'ERC20') // 10 USDT
    const tail = r.amount - 10
    expect(tail).toBeGreaterThan(0)
    expect(tail).toBeLessThanOrEqual(0.00975 + 1e-9)
    // 尾差必须是 0.00025 的整数倍(保证相邻档差 0.00025 > AMOUNT_EPS 0.0001)
    const slot = tail / 0.00025
    expect(Math.abs(slot - Math.round(slot))).toBeLessThan(1e-6)
  })
})

describe('SDB-27 并发撞档:数据库唯一索引冲突时换下一档', () => {
  beforeEach(() => {
    h.selectQueue.length = 0
    vi.clearAllMocks()
  })

  it('首次 insert 撞 23505 ⇒ 换档重试并成功', async () => {
    process.env.USDT_ERC20_ADDRESS = ERC_ADDR
    h.selectQueue.push([])
    const conflict = Object.assign(new Error('duplicate key'), {
      code: '23505',
      constraint: 'usdt_payments_pending_amount_uniq',
    })
    h.mockInsertValues.mockRejectedValueOnce(conflict).mockResolvedValueOnce(undefined)

    const r = await createUsdtPayment('user-1', 1000, 'ERC20')
    expect(r.amount).toBeGreaterThan(10)
    expect(h.mockInsertValues).toHaveBeenCalledTimes(2)
    const amounts = h.mockInsertValues.mock.calls.map((c) => (c[0] as any).amount)
    expect(amounts[0]).not.toBe(amounts[1])
    // 两笔尝试都落在同一 base 的不同尾差档上
    const tails = amounts.map((a) => Number(a) - 10)
    expect(tails.every((t) => t > 0 && t <= 0.00975 + 1e-9)).toBe(true)
  })

  it('39 档全部被占 ⇒ 明确拒绝 503,不接受模糊金额', async () => {
    process.env.USDT_ERC20_ADDRESS = ERC_ADDR
    h.selectQueue.push([])
    const conflict = Object.assign(new Error('duplicate key'), {
      code: '23505',
      constraint: 'usdt_payments_pending_amount_uniq',
    })
    h.mockInsertValues.mockRejectedValue(conflict)

    await expect(createUsdtPayment('user-1', 1000, 'ERC20')).rejects.toMatchObject({
      statusCode: 503,
    })
    // 39 个尾差档逐个试过
    expect(h.mockInsertValues).toHaveBeenCalledTimes(39)
  })

  it('非金额冲突的错误不得被当成撞档吞掉', async () => {
    process.env.USDT_ERC20_ADDRESS = ERC_ADDR
    h.selectQueue.push([])
    h.mockInsertValues.mockRejectedValueOnce(Object.assign(new Error('db down'), { code: '08006' }))

    await expect(createUsdtPayment('user-1', 1000, 'ERC20')).rejects.toThrow('db down')
    expect(h.mockInsertValues).toHaveBeenCalledTimes(1)
  })
})

describe('SDB-28 到账检测必须覆盖下单至今,不能只看第一页', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    h.selectQueue.length = 0
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mockFetch)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('ERC20:匹配交易落在第 3 页时仍能到账', async () => {
    const order = pendingOrder('ERC20', 10.00025)
    h.selectQueue.push([order])
    h.selectQueue.push([])
    mockFetch
      .mockResolvedValueOnce(jsonResponse(fullPage(1)))
      .mockResolvedValueOnce(jsonResponse(fullPage(2)))
      .mockResolvedValueOnce(
        jsonResponse({
          status: '1',
          message: 'OK',
          result: [ercTx('0xpage3', 10.00025, T0 + 100)],
        }),
      )

    const r = await checkUsdtPaymentStatus(order.orderId)
    expect(mockFetch).toHaveBeenCalledTimes(3)
    expect(String(mockFetch.mock.calls[2]![0])).toContain('page=3')
    expect(r.detected).toBe(true)
    expect(r.txHash).toBe('0xpage3')
  })

  it('ERC20:页数预算耗尽仍看不到下单时间 ⇒ 记错误日志,不静默当作未到账', async () => {
    const order = pendingOrder('ERC20', 10.00025)
    h.selectQueue.push([order])
    h.selectQueue.push([])
    for (let i = 1; i <= 8; i++) mockFetch.mockResolvedValueOnce(jsonResponse(fullPage(i)))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const r = await checkUsdtPaymentStatus(order.orderId)
    expect(r.detected).toBe(false)
    expect(mockFetch).toHaveBeenCalledTimes(8)
    expect(
      errSpy.mock.calls.map((c) => String(c[0]).concat(String(c[1] ?? ''))).join('\n'),
    ).toContain('漏单风险')
    errSpy.mockRestore()
  })

  it('TRC20:沿 fingerprint 翻页,匹配交易在下一页时仍能到账', async () => {
    const order = pendingOrder('TRC20', 10.00025)
    h.selectQueue.push([order])
    h.selectQueue.push([])
    const page1 = {
      success: true,
      meta: { fingerprint: 'fp-1' },
      data: Array.from({ length: 100 }, (_, i) => ({
        transaction_id: `tron1-${i}`,
        to: TRON_ADDR,
        block_timestamp: T0 + 1 + i,
        value: String(5 * 1e6),
      })),
    }
    const page2 = {
      success: true,
      meta: {},
      data: [
        {
          transaction_id: 'tron-match',
          to: TRON_ADDR,
          block_timestamp: T0 + 100,
          value: String(10.00025 * 1e6),
        },
      ],
    }
    mockFetch.mockResolvedValueOnce(jsonResponse(page1)).mockResolvedValueOnce(jsonResponse(page2))

    const r = await checkUsdtPaymentStatus(order.orderId)
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(String(mockFetch.mock.calls[1]![0])).toContain('fingerprint=fp-1')
    // TRC20 必须带 min_timestamp 把窗口钉在下单之后
    expect(String(mockFetch.mock.calls[0]![0])).toContain(`min_timestamp=${T0}`)
    expect(r.detected).toBe(true)
    expect(r.txHash).toBe('tron-match')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
