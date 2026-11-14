// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-509 回归锁(2026-11-13)。
 *
 * 病灶:checkUsdtPaymentStatus 的 catch 把「链上 API 5xx/响应异常」降级成普通 pending,
 * poll 的 failed 恒 0,worker 返回统计被 BullMQ 记成 completed —— 链上服务全挂时
 * 监控仍显示「每分钟成功、失败 0」,用户充值长时间不到账且无告警。
 *
 * 本文件锁:
 *   ① 查询异常(连续 503)⇒ 有限重试耗尽后 failed=1、errors 有结构化摘要,poll 抛错;
 *   ② worker 执行体据此记录结构化 error 并把错误上抛(job 不记成功),不写 info 成功日志;
 *   ③ 链上确实无交易 ⇒ 仍是业务 pending,不带 error 字段,poll 不记 failed;
 *   ④ 临时故障重试后成功 ⇒ failed=0,重试次数有界,sleep 可注入。
 *
 * mock 全局 fetch 与 db,不连真实链上节点/数据库。
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.CREDENTIALS_ENCRYPTION_KEY ??= 'a'.repeat(64)
  process.env.REDIS_URL ??= 'redis://localhost:6379'
})

const ERC_ADDR = '0x1111111111111111111111111111111111111111'
const ORDER_ID = 'USDT-F509-1'
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

const { checkUsdtPaymentStatus, pollPendingUsdtPayments, UsdtPollFailureError } = await import(
  '../src/services/payment-usdt-service.js'
)
const { runUsdtPaymentPollJob } = await import('../src/workers/usdt-payment-worker.js')

const mockFetch = vi.fn()
const noSleep = vi.fn(async () => {})

type FailureResult = {
  result: {
    checked: number
    confirmed: number
    failed: number
    errors: Array<Record<string, unknown>>
  }
}

beforeEach(() => {
  h.selectQueue.length = 0
  vi.clearAllMocks()
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function order(overrides: Record<string, unknown> = {}) {
  return {
    orderId: ORDER_ID,
    userId: 'user-1',
    address: ERC_ADDR,
    network: 'ERC20',
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

function emptyPage() {
  return {
    ok: true,
    json: async () => ({ status: '0', message: 'No transactions found', result: [] }),
  }
}

function upstreamDown() {
  return { ok: false, status: 503, json: async () => ({}) }
}

describe('F-509 链上查询故障不得吞成 pending', () => {
  it('① 查询异常 ⇒ 有限重试耗尽后 failed=1 且 poll 抛错(不返回成功统计)', async () => {
    h.selectQueue.push([{ orderId: ORDER_ID }]) // poll 取 pending 列表
    h.selectQueue.push([order()]) // 首次尝试读单
    h.selectQueue.push([order()]) // 第 1 次重试读单
    h.selectQueue.push([order()]) // 第 2 次重试读单
    mockFetch.mockResolvedValue(upstreamDown())
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const caught: unknown = await pollPendingUsdtPayments(50, {
      maxRetries: 2,
      sleep: noSleep,
    }).catch((err: unknown) => err)

    expect(caught).toBeInstanceOf(UsdtPollFailureError)
    const { result } = caught as FailureResult
    expect(result).toMatchObject({ checked: 1, confirmed: 0, failed: 1 })
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toMatchObject({
      orderId: ORDER_ID,
      network: 'ERC20',
      attempts: 3,
      timeout: false,
    })
    expect(String(result.errors[0]!.reason)).toContain('503')
    // 首发 + 2 次重试;重试间隔走注入的 sleep,不真实等待
    expect(mockFetch).toHaveBeenCalledTimes(3)
    expect(noSleep).toHaveBeenCalledTimes(2)
    // 查询失败不等于没付款:订单不得被写成 expired
    expect(h.dbUpdate).not.toHaveBeenCalled()
  })

  it('② worker 让 job 记失败:结构化 error 日志 + 上抛,不记 success', async () => {
    h.selectQueue.push([{ orderId: ORDER_ID }])
    h.selectQueue.push([order()])
    h.selectQueue.push([order()])
    mockFetch.mockResolvedValue(upstreamDown())
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const log = { info: vi.fn(), error: vi.fn() }

    const caught: unknown = await runUsdtPaymentPollJob(log, {
      maxRetries: 1,
      sleep: noSleep,
    }).catch((err: unknown) => err)

    expect(caught).toBeInstanceOf(UsdtPollFailureError)
    expect(log.info).not.toHaveBeenCalled()
    expect(log.error).toHaveBeenCalledTimes(1)
    const [fields, msg] = log.error.mock.calls[0] as [Record<string, unknown>, string]
    expect(msg).toBe('usdt-payment poll failed')
    expect(fields).toMatchObject({ checked: 1, confirmed: 0, failed: 1 })
    const failures = fields.failures as Array<Record<string, unknown>>
    expect(failures[0]).toMatchObject({ orderId: ORDER_ID, network: 'ERC20' })
  })

  it('③ 链上确实无交易 ⇒ 业务 pending(无 error),poll 不记 failed', async () => {
    h.selectQueue.push([order()])
    mockFetch.mockResolvedValueOnce(emptyPage())

    const status = await checkUsdtPaymentStatus(ORDER_ID)
    expect(status).toMatchObject({ status: 'pending', detected: false, txHash: null })
    expect(status.error).toBeUndefined()

    h.selectQueue.length = 0
    h.selectQueue.push([{ orderId: ORDER_ID }])
    h.selectQueue.push([order()])
    mockFetch.mockResolvedValueOnce(emptyPage())

    const result = await pollPendingUsdtPayments(50, { sleep: noSleep })
    expect(result).toMatchObject({ checked: 1, confirmed: 0, failed: 0, errors: [] })
  })

  it('④ 临时故障重试后成功 ⇒ failed=0,重试有界且有等待', async () => {
    h.selectQueue.push([{ orderId: ORDER_ID }])
    h.selectQueue.push([order()]) // 首次:503
    h.selectQueue.push([order()]) // 重试:已恢复正常(无交易)
    mockFetch.mockResolvedValueOnce(upstreamDown()).mockResolvedValueOnce(emptyPage())
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await pollPendingUsdtPayments(50, { maxRetries: 2, sleep: noSleep })

    expect(result).toMatchObject({ checked: 1, confirmed: 0, failed: 0 })
    expect(result.errors).toEqual([])
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(noSleep).toHaveBeenCalledTimes(1)
  })
})
