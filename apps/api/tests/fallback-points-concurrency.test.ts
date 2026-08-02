/**
 * fallbackPoints 并发安全回归测试(2026-08-02 立)。
 *
 * 验证上轮 P0 修复:
 * - Bug: fallbackPoints 的 TOCTOU + Lost Update
 *   (并发回退同一记录时,幂等检查与写入非事务 → 重复回退;
 *    余额读取与写入非原子 → Lost Update)
 * - 修复: 幂等校验 + FOR UPDATE 锁余额行 + INSERT 全部在事务内
 *   (SELECT ... FOR UPDATE 防 Lost Update;事务内幂等校验防 TOCTOU)
 *
 * 测试模式: vi.mock db.transaction 串行化(模拟 FOR UPDATE 行锁)+ 内存状态模拟原子语义。
 * 测试文件豁免 any(mock 类型断言必需,AGENTS.md §3)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

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
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  dbRead: { select: vi.fn() },
  dbClient: {},
}))

vi.mock('@ihui/database', () => ({
  eduPointRecords: {
    id: 'id',
    memberId: 'member_id',
    point: 'point',
    balance: 'balance',
    type: 'type',
    refId: 'ref_id',
    description: 'description',
    createdAt: 'created_at',
  },
  eduPointChannels: { id: 'id', status: 'status' },
  eduPoints: { id: 'id', status: 'status' },
  eduPointChannelRelations: { id: 'id' },
}))

import { fallbackPoints } from '../src/db/point-queries.js'
import { AppError } from '../src/errors/AppError.js'

// =============================================================================
// 内存状态(模拟 DB)
// =============================================================================
let originalRecord: any
let currentBalance: number
const revertedRecords = new Set<string>()
const insertedFallbacks: any[] = []
let insertCounter = 0
let txChain: Promise<unknown> = Promise.resolve()

// =============================================================================
// mockTx:模拟事务内的原子操作
// =============================================================================
const mockTx: any = {
  select: vi.fn(),
  insert: vi.fn(),
}

/** 构建 select 链:support where/for/limit/orderBy(全部返回同一 Promise)。 */
function buildSelectChain(returnValue: unknown): any {
  const promise: any = Promise.resolve(returnValue)
  promise.where = vi.fn().mockReturnValue(promise)
  promise.for = vi.fn().mockReturnValue(promise)
  promise.limit = vi.fn().mockReturnValue(promise)
  promise.orderBy = vi.fn().mockReturnValue(promise)
  promise.offset = vi.fn().mockReturnValue(promise)
  promise.groupBy = vi.fn().mockReturnValue(promise)
  const from = vi.fn().mockReturnValue(promise)
  return { from }
}

describe('fallbackPoints 并发安全', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    revertedRecords.clear()
    insertedFallbacks.length = 0
    insertCounter = 0
    txChain = Promise.resolve()

    // 原始积分记录(被回退的):type='increase', point=10, memberId='user-1'
    originalRecord = {
      id: 'record-1',
      memberId: 'user-1',
      point: 10,
      balance: 100,
      type: 'increase',
      description: '原始奖励',
      createdAt: new Date('2026-07-01'),
    }
    currentBalance = 100

    // db.select(findRecordById 事务外预查):返回 originalRecord
    mockDbSelect.mockImplementation(() => buildSelectChain([originalRecord]))

    // mockTx.select:区分"幂等校验"和"FOR UPDATE 锁余额行"
    mockTx.select.mockImplementation((cols?: any) => {
      const colsKeys = cols ? Object.keys(cols) : []
      // 幂等校验:select({id}).from().where(eq(refId, recordId), eq(type, 'fallback')).limit(1)
      if (colsKeys.includes('id')) {
        // revertedRecords 非空 → 已回退(返回 1 行);空 → 未回退(返回 [])
        const result = revertedRecords.size > 0 ? [{ id: 'fallback-exists' }] : []
        return buildSelectChain(result)
      }
      // 锁余额行:select({balance}).from().where(eq(memberId)).orderBy(desc(createdAt)).limit(1).for('update')
      if (colsKeys.includes('balance')) {
        return buildSelectChain([{ balance: currentBalance }])
      }
      // 默认:空结果
      return buildSelectChain([])
    })

    // mockTx.insert:插入 fallback 记录,更新余额 + 标记已回退
    mockTx.insert.mockImplementation(() => ({
      values: vi.fn().mockImplementation((obj: any) => {
        insertCounter++
        // obj.balance = afterBalance(回退后的新余额)
        currentBalance = obj.balance
        // 标记 recordId 已回退
        revertedRecords.add(originalRecord.id)
        const newRecord = {
          id: `fallback-${insertCounter}`,
          ...obj,
          createdAt: new Date(),
        }
        insertedFallbacks.push(newRecord)
        return { returning: vi.fn().mockResolvedValue([newRecord]) }
      }),
    }))

    // db.transaction 串行化执行(模拟 FOR UPDATE 行锁,事务不交错)
    mockDbTransaction.mockImplementation(async (fn: any) => {
      const next = txChain.then(() => fn(mockTx))
      txChain = next.then(
        () => undefined,
        () => undefined,
      )
      return next
    })
  })

  it('场景 1:同一 recordId 并发回退 3 次,只成功 1 次(防 TOCTOU 重复回退)', async () => {
    // Promise.all 触发竞态:3 个并发回退同一 recordId
    // fallbackPoints 抛错(不返回 {success:false}),用 catch 捕获
    const results = await Promise.all([
      fallbackPoints('record-1').catch((e: unknown) => e),
      fallbackPoints('record-1').catch((e: unknown) => e),
      fallbackPoints('record-1').catch((e: unknown) => e),
    ])

    // 修复后:事务内幂等校验(FOR UPDATE 锁行后)
    // 请求1:revertedRecords 空 → 通过 → INSERT(标记已回退)
    // 请求2:revertedRecords 非空 → throw AppError(409, CONFLICT)
    // 请求3:同上
    const success = results.filter((r) => !(r instanceof Error))
    const errors = results.filter((r) => r instanceof Error)

    expect(success).toHaveLength(1)
    expect(errors).toHaveLength(2)

    // 失败的应该是 AppError(409, CONFLICT)
    expect(errors.every((e) => e instanceof AppError)).toBe(true)
    expect(errors.every((e) => (e as AppError).statusCode === 409)).toBe(true)

    // 余额 100 + (-10) = 90(只回退了 1 次)
    expect(currentBalance).toBe(90)
    // 只插入了 1 条 fallback 记录
    expect(insertedFallbacks).toHaveLength(1)
    expect(insertedFallbacks[0].type).toBe('fallback')
    expect(insertedFallbacks[0].refId).toBe('record-1')
  })

  it('场景 2:不同 recordId 并发回退,各自独立成功(不互相干扰)', async () => {
    // 准备 2 个不同的原始记录
    const record1 = { ...originalRecord, id: 'record-a', point: 10 }
    const record2 = { ...originalRecord, id: 'record-b', point: 20 }

    // 3 个请求顺序:record-a, record-b, record-a(第 3 个重复)
    const requestRecordIds = ['record-a', 'record-b', 'record-a']
    const records: any[] = [record1, record2, record1]

    // mockDbSelect(findRecordById 事务外预查):按调用顺序返回对应 record
    let mockDbSelectCallCount = 0
    mockDbSelect.mockImplementation(() => {
      const rec = records[mockDbSelectCallCount % records.length]
      mockDbSelectCallCount++
      return buildSelectChain([rec])
    })

    // mockTx.insert 按 obj.refId 标记回退
    revertedRecords.clear()
    mockTx.insert.mockImplementation(() => ({
      values: vi.fn().mockImplementation((obj: any) => {
        insertCounter++
        currentBalance = obj.balance
        revertedRecords.add(obj.refId)
        const newRecord = { id: `fallback-${insertCounter}`, ...obj, createdAt: new Date() }
        insertedFallbacks.push(newRecord)
        return { returning: vi.fn().mockResolvedValue([newRecord]) }
      }),
    }))

    // 事务内 currentTxRecordId:按事务序号从 requestRecordIds 取,让幂等校验能区分 recordId
    // 关键:在 fn 执行前(串行链内)设置 currentTxRecordId,
    // 避免 3 个 mockDbTransaction 调用同步执行时变量被覆盖
    let txCallCount = 0
    let currentTxRecordId = ''
    mockDbTransaction.mockImplementation(async (fn: any) => {
      const txIndex = txCallCount // 捕获当前事务序号
      txCallCount++
      const next = txChain.then(() => {
        // fn 执行前设置事务上下文(此时前面的 fn 已完成,变量可安全复用)
        currentTxRecordId = requestRecordIds[txIndex]!
        return fn(mockTx)
      })
      txChain = next.then(
        () => undefined,
        () => undefined,
      )
      return next
    })

    // mockTx.select 幂等校验:用 currentTxRecordId 判断是否已回退(区分 recordId)
    mockTx.select.mockImplementation((cols?: any) => {
      const colsKeys = cols ? Object.keys(cols) : []
      if (colsKeys.includes('id')) {
        const result = revertedRecords.has(currentTxRecordId) ? [{ id: 'fallback-exists' }] : []
        return buildSelectChain(result)
      }
      if (colsKeys.includes('balance')) {
        return buildSelectChain([{ balance: currentBalance }])
      }
      return buildSelectChain([])
    })

    // 3 个请求:record-a, record-b, record-a(第 3 个重复)
    const results = await Promise.all([
      fallbackPoints('record-a').catch((e: unknown) => e),
      fallbackPoints('record-b').catch((e: unknown) => e),
      fallbackPoints('record-a').catch((e: unknown) => e),
    ])

    const success = results.filter((r) => !(r instanceof Error))
    const errors = results.filter((r) => r instanceof Error)

    // record-a 和 record-b 各成功 1 次,第 3 个 record-a 重复 → 失败(409 CONFLICT)
    expect(success).toHaveLength(2)
    expect(errors).toHaveLength(1)
    expect(errors.every((e) => e instanceof AppError)).toBe(true)
    expect(errors.every((e) => (e as AppError).statusCode === 409)).toBe(true)
  })

  it('场景 3:回退后余额不足 → 抛 AppError(400)', async () => {
    // 原始记录 point=200,当前余额 100 → 回退后 100-200=-100 < 0 → 失败
    originalRecord.point = 200
    currentBalance = 100

    await expect(fallbackPoints('record-1')).rejects.toThrow(AppError)
    const err = await fallbackPoints('record-1').catch((e: unknown) => e)
    expect((err as AppError).statusCode).toBe(400)
    expect((err as AppError).message).toContain('余额不足')
  })
})
