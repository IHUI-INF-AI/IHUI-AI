// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-508 回归锁(2026-11-13)。
 *
 * 病灶:USDT 链上 RPC 六处裸 fetch 无 AbortSignal,一次上游抖动就能让分钟级
 * poll 挂数小时,独占 concurrency=1 的 worker,后续订单无人轮询。
 *
 * 本文件锁:
 *   ① 每次链上 RPC fetch 都带 signal(AbortSignal);
 *   ② 超时抛错后 poll 记 warn 且整轮返回失败(不标记成功,任务可重试);
 *   ③ 正常响应解析结果不变(TRC20/ERC20 命中与空结果);
 *   ④ 源锁:两个文件内不存在未带 signal 的裸 fetch。
 *
 * mock 全局 fetch 与 db,不连节点/数据库。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.CREDENTIALS_ENCRYPTION_KEY ??= 'a'.repeat(64)
  process.env.REDIS_URL ??= 'redis://localhost:6379'
})

const TRC_ADDR = 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf'
const ERC_ADDR = '0x1111111111111111111111111111111111111111'
const ORDER_ID = 'USDT-F508-1'
const TX_HASH = '0xf508'
const T0 = Date.UTC(2026, 10, 13, 3, 0, 0)

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
  const dbUpdate = vi.fn(() => selectChain([{ orderId: ORDER_ID }]))
  return { selectQueue, dbReadSelect, dbUpdate }
})

vi.mock('../src/db/index.js', () => ({
  db: { update: h.dbUpdate, insert: vi.fn(), transaction: vi.fn() },
  dbRead: { select: h.dbReadSelect },
}))

vi.mock('../src/config/index.js', () => ({
  config: { USDT_CONFIRM_TRC20_MIN: 1, USDT_CONFIRM_ERC20_MIN: 1 },
}))

const { checkUsdtPaymentStatus, pollPendingUsdtPayments } = await import(
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
  vi.restoreAllMocks()
})

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body }
}

const trcPaidTx = {
  transaction_id: TX_HASH,
  value: String(Math.round(10.00025 * 1e6)),
  to: TRC_ADDR,
  from: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
  block_timestamp: T0 + 60_000,
  block_number: 100,
}

const ercPaidTx = {
  hash: TX_HASH,
  value: String(Math.round(10.00025 * 1e6)),
  to: ERC_ADDR,
  from: '0x2222222222222222222222222222222222222222',
  timeStamp: String(Math.floor((T0 + 60_000) / 1000)),
  tokenDecimal: '6',
  blockNumber: '100',
}

function order(overrides: Record<string, unknown> = {}) {
  return {
    orderId: ORDER_ID,
    userId: 'user-1',
    address: TRC_ADDR,
    network: 'TRC20',
    amount: '10.00025',
    amountPaid: '0',
    txHash: null,
    status: 'pending',
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    createdAt: new Date(T0),
    confirmedAt: null,
    ...overrides,
  }
}

/** 取 mock fetch 每次调用的 init,断言 signal 均存在且为 AbortSignal */
function expectEveryFetchHasSignal() {
  expect(mockFetch.mock.calls.length).toBeGreaterThan(0)
  for (const call of mockFetch.mock.calls) {
    const init = call[1] as RequestInit | undefined
    expect(init?.signal).toBeInstanceOf(AbortSignal)
  }
}

describe('F-508 USDT 链上 RPC 超时', () => {
  it('① TRC20/ERC20 每次 RPC fetch 都带 signal', async () => {
    h.selectQueue.push([order()])
    h.selectQueue.push([])
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: [trcPaidTx] }),
    })
    const trc = await checkUsdtPaymentStatus(ORDER_ID)
    expect(trc.detected).toBe(true)
    expectEveryFetchHasSignal()

    h.selectQueue.length = 0
    mockFetch.mockClear()
    h.selectQueue.push([order({ network: 'ERC20', address: ERC_ADDR })])
    mockFetch.mockResolvedValueOnce(jsonResponse({ status: '0', message: 'No transactions found', result: [] }))
    const erc = await checkUsdtPaymentStatus(ORDER_ID)
    expect(erc.detected).toBe(false)
    expectEveryFetchHasSignal()
  })

  it('② RPC 超时 ⇒ poll 记 warn 并整体失败(不返回成功统计)', async () => {
    h.selectQueue.push([{ orderId: ORDER_ID }]) // poll 取 pending 列表
    h.selectQueue.push([order()]) // checkUsdtPaymentStatus 读订单
    mockFetch.mockRejectedValue(new DOMException('The operation timed out', 'TimeoutError'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(pollPendingUsdtPayments()).rejects.toThrow(/RPC 超时/)
    expect(mockFetch.mock.calls.length).toBeGreaterThan(0)
    expectEveryFetchHasSignal()
    expect(warnSpy.mock.calls.map((c) => c.join(' ')).join('\n')).toContain(ORDER_ID)
    // 订单不能被写成 expired,保持 pending 等下一轮
    expect(h.dbUpdate).not.toHaveBeenCalled()
  })

  it('③ 正常响应解析结果不变', async () => {
    h.selectQueue.push([order()])
    h.selectQueue.push([]) // pickUnclaimedCandidate:无已绑定 txHash
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: [trcPaidTx] }),
    })
    const trc = await checkUsdtPaymentStatus(ORDER_ID)
    expect(trc).toMatchObject({
      orderId: ORDER_ID,
      status: 'pending',
      detected: true,
      txHash: TX_HASH,
      amountPaid: 10.00025,
    })

    h.selectQueue.length = 0
    mockFetch.mockClear()
    h.selectQueue.push([order({ network: 'ERC20', address: ERC_ADDR })])
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: '1', message: 'OK', result: [ercPaidTx] }),
    })
    h.selectQueue.push([]) // pickUnclaimedCandidate
    const erc = await checkUsdtPaymentStatus(ORDER_ID)
    expect(erc).toMatchObject({
      status: 'pending',
      detected: true,
      txHash: TX_HASH,
      amountPaid: 10.00025,
    })
  })

  it('④ 源锁:两个文件内无未带 signal 的裸 fetch', () => {
    const serviceSrc = readFileSync(
      fileURLToPath(new URL('../src/services/payment-usdt-service.ts', import.meta.url)),
      'utf8',
    )
    const workerSrc = readFileSync(
      fileURLToPath(new URL('../src/workers/usdt-payment-worker.ts', import.meta.url)),
      'utf8',
    )

    // 唯一一次裸 fetch 必须在 rpcFetch 包装内部
    expect(serviceSrc.match(/\bfetch\s*\(/g) ?? []).toHaveLength(1)
    const wrapperStart = serviceSrc.indexOf('async function rpcFetch')
    expect(wrapperStart).toBeGreaterThan(-1)
    const wrapperBody = serviceSrc.slice(wrapperStart, serviceSrc.indexOf('\n}', wrapperStart))
    expect(wrapperBody).toContain('signal: AbortSignal.timeout(')
    // 六处链上调用全部改走包装
    expect(serviceSrc.match(/await rpcFetch\(/g) ?? []).toHaveLength(6)
    // worker 不直接发链上请求
    expect(workerSrc).not.toMatch(/\bfetch\s*\(/)
  })
})
