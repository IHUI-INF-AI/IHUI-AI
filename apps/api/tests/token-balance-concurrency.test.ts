/**
 * token-balance-service 并发安全回归测试(2026-08-02 立)。
 *
 * 验证上轮 P0 修复:
 * - Bug: deductTokens 的幂等检查与扣减非事务 + Lost Update
 *   (并发同 idempotencyKey 重复扣减 / 并发余额不足超扣)
 * - 修复: 幂等检查 + 原子 UPDATE WHERE 余额检查 + 流水写入全部包在事务内
 *   (UPDATE ... WHERE tokenQuantity >= amount RETURNING 原子语义,0 行 = 余额不足)
 *
 * 测试模式: vi.mock db.transaction 串行化(模拟 FOR UPDATE 行锁)+ 内存状态模拟原子语义。
 *   不依赖 drizzle SQL params 提取(版本兼容性差),改用 txIndex + request 列表:
 *   mockDbTransaction 在 fn 执行前(串行链内)设置 currentTxAmount/currentTxIdempotencyKey,
 *   避免 3 个 mockDbTransaction 调用同步执行时变量被覆盖。
 * 测试文件豁免 any(mock 类型断言必需,AGENTS.md §3)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import Fastify from 'fastify'

// =============================================================================
// 构建 select 链:支持 from/leftJoin/where/limit(全部返回同一 Promise)
// =============================================================================
function buildSelectChain(returnValue: unknown): any {
  const promise: any = Promise.resolve(returnValue)
  promise.from = vi.fn().mockReturnValue(promise)
  promise.leftJoin = vi.fn().mockReturnValue(promise)
  promise.where = vi.fn().mockReturnValue(promise)
  promise.limit = vi.fn().mockReturnValue(promise)
  promise.orderBy = vi.fn().mockReturnValue(promise)
  promise.offset = vi.fn().mockReturnValue(promise)
  promise.groupBy = vi.fn().mockReturnValue(promise)
  return promise
}

// =============================================================================
// 内存状态(模拟 DB)
// =============================================================================
let balance = 100
const flows = new Set<string>()
let txChain: Promise<unknown> = Promise.resolve()

// 事务上下文:由 mockDbTransaction 在 fn 执行前设置(串行,不会被覆盖)
let currentTxAmount = 0
let currentTxIdempotencyKey: string | undefined

// 每个测试场景设置:按请求顺序的 amount / idempotencyKey 列表
let requestAmounts: number[] = []
let requestIdempotencyKeys: (string | undefined)[] = []

// =============================================================================
// Mock 声明
// =============================================================================
const { mockDbSelect, mockDbTransaction } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbTransaction: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    select: mockDbSelect,
    transaction: mockDbTransaction,
  },
  dbRead: { select: vi.fn() },
  dbClient: {},
}))

vi.mock('@ihui/database', () => ({
  userMargins: {
    userId: 'user_id',
    tokenQuantity: 'token_quantity',
    updatedAt: 'updated_at',
  },
  users: {
    id: 'id',
    isVip: 'is_vip',
  },
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(),
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('../src/utils/response.js', () => ({
  success: (data: unknown) => ({ code: 0, message: 'ok', data }),
  error: (code: number, message: string) => ({ code, message, data: null }),
}))

import { tokenBalanceService } from '../src/plugins/token-balance-service.js'

// =============================================================================
// mockTx:模拟事务内的原子操作
// =============================================================================
const mockTx: any = {
  execute: vi.fn(),
  update: vi.fn(),
}

describe('token-balance-service 并发安全', () => {
  const server = Fastify({ logger: false })
  const mockRedis = {
    get: vi.fn(),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  }
  let dateSpy: ReturnType<typeof vi.spyOn>

  beforeAll(async () => {
    ;(server as any).redis = mockRedis
    await server.register(tokenBalanceService)
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    // 固定非促销期(checkPromotionPeriod 返回 false → actualAmount = amount * discountRate)
    dateSpy = vi.spyOn(Date.prototype, 'getDate').mockReturnValue(15)

    // 重置状态
    flows.clear()
    txChain = Promise.resolve()
    currentTxAmount = 0
    currentTxIdempotencyKey = undefined
    requestAmounts = []
    requestIdempotencyKeys = []

    // db.select(getDbBalance 事务外预查余额):返回当前 balance + isVip=0(普通用户 discountRate=1.0)
    // getDbBalance 在事务前调用,读到的是事务前的快照余额
    mockDbSelect.mockImplementation(() => buildSelectChain([{ tokenQuantity: balance, isVip: 0 }]))

    // mockTx.execute:用 SQL 文本特征判断幂等检查 / 写流水,用 currentTxIdempotencyKey 做 key
    // (不依赖 params 提取,避免 drizzle chunk 结构差异)
    mockTx.execute.mockImplementation((sqlObj: any) => {
      const chunks = sqlObj?.queryChunks
      const sqlText = Array.isArray(chunks)
        ? chunks
            .map((c: any) => (c && typeof c === 'object' && 'value' in c ? String(c.value) : ''))
            .join('')
        : ''
      // 幂等检查:SELECT 1 FROM "token_flows" WHERE related_order_no = key
      if (sqlText.includes('SELECT 1 FROM') || sqlText.includes('select 1 from')) {
        const key = currentTxIdempotencyKey
        return Promise.resolve(key && flows.has(key) ? [{ '?': 1 }] : [])
      }
      // 写流水:INSERT INTO "token_flows" ...
      if (sqlText.includes('INSERT INTO') || sqlText.includes('insert into')) {
        if (currentTxIdempotencyKey) flows.add(currentTxIdempotencyKey)
        return Promise.resolve([])
      }
      return Promise.resolve([])
    })

    // mockTx.update:用 currentTxAmount 做原子余额检查(不依赖 set(obj) 提取 actualAmount)
    mockTx.update.mockImplementation(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockImplementation(() => {
            // 原子 UPDATE WHERE tokenQuantity >= actualAmount
            if (balance >= currentTxAmount) {
              balance -= currentTxAmount
              return Promise.resolve([{ tokenQuantity: balance }])
            }
            return Promise.resolve([]) // 余额不足 → 0 行
          }),
        }),
      }),
    }))

    // db.transaction 串行化执行(模拟 FOR UPDATE 行锁,事务不交错)
    // 关键:在 fn 执行前(串行链内)设置 currentTxAmount/currentTxIdempotencyKey,
    // 避免 3 个 mockDbTransaction 调用同步执行时变量被覆盖
    let txCallCount = 0
    mockDbTransaction.mockImplementation(async (fn: any) => {
      const txIndex = txCallCount // 捕获当前事务序号
      txCallCount++
      const next = txChain.then(() => {
        // fn 执行前设置事务上下文(此时前面的 fn 已完成,变量可安全复用)
        currentTxAmount = requestAmounts[txIndex] ?? 0
        currentTxIdempotencyKey = requestIdempotencyKeys[txIndex]
        return fn(mockTx)
      })
      txChain = next.then(
        () => undefined,
        () => undefined,
      )
      return next
    })
  })

  afterEach(() => {
    dateSpy.mockRestore()
  })

  it('场景 1:同一 idempotencyKey 并发扣减 3 次,只扣减 1 次(幂等检查生效)', async () => {
    balance = 100
    const userId = 'user-1'
    requestAmounts = [10, 10, 10]
    requestIdempotencyKeys = ['idem-1', 'idem-1', 'idem-1']

    // Promise.all 触发竞态:3 个并发扣减,同一 idempotencyKey
    const results = await Promise.all([
      server.tokenBalance.deductTokens(userId, 10, 'test', 'idem-1'),
      server.tokenBalance.deductTokens(userId, 10, 'test', 'idem-1'),
      server.tokenBalance.deductTokens(userId, 10, 'test', 'idem-1'),
    ])

    // 修复后:幂等返回 success:true(不重复扣减),只有第 1 个真正扣减
    // 3 个都 success:true(幂等返回也算成功),但余额只减 1 次
    const allSuccess = results.every((r) => r.success)
    expect(allSuccess).toBe(true)

    // 余额 100 - 10 = 90(只扣了 1 次)
    expect(balance).toBe(90)

    // flows 只有 1 个 key(只写了 1 条流水)
    expect(flows.size).toBe(1)
    expect(flows.has('idem-1')).toBe(true)

    // 验证 mockTx.update 只被调用 1 次(幂等检查拦截了后续扣减)
    expect(mockTx.update).toHaveBeenCalledTimes(1)
  })

  it('场景 2:余额 50,并发扣减 3 次 30(不同 idempotencyKey),只有 1 个成功(防超扣)', async () => {
    balance = 50
    const userId = 'user-1'
    requestAmounts = [30, 30, 30]
    requestIdempotencyKeys = ['idem-a', 'idem-b', 'idem-c']

    const results = await Promise.all([
      server.tokenBalance.deductTokens(userId, 30, 'test', 'idem-a'),
      server.tokenBalance.deductTokens(userId, 30, 'test', 'idem-b'),
      server.tokenBalance.deductTokens(userId, 30, 'test', 'idem-c'),
    ])

    // 修复后:原子 UPDATE WHERE 余额检查,只有第 1 个成功(50>=30 → 20)
    // 后续 2 个失败(20<30 → 0 行 → success:false)
    const successCount = results.filter((r) => r.success).length
    expect(successCount).toBe(1)

    const failed = results.filter((r) => !r.success)
    expect(failed).toHaveLength(2)

    // 余额 50 - 30 = 20(只扣了 1 次)
    expect(balance).toBe(20)

    // flows 只有 1 个 key(只写了 1 条流水)
    expect(flows.size).toBe(1)
  })

  it('场景 3:无 idempotencyKey 时,并发扣减依赖原子 UPDATE WHERE 防超扣', async () => {
    balance = 50
    const userId = 'user-1'
    requestAmounts = [30, 30, 30]
    requestIdempotencyKeys = [undefined, undefined, undefined]

    // 无 idempotencyKey(第 4 参数 undefined),跳过幂等检查,纯靠原子 UPDATE WHERE
    const results = await Promise.all([
      server.tokenBalance.deductTokens(userId, 30, 'test'),
      server.tokenBalance.deductTokens(userId, 30, 'test'),
      server.tokenBalance.deductTokens(userId, 30, 'test'),
    ])

    const successCount = results.filter((r) => r.success).length
    expect(successCount).toBe(1)
    expect(balance).toBe(20)
  })
})
