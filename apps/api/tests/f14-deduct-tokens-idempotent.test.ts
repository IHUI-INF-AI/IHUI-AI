// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).
// [IHUI-AI-PROVENANCE]:f14-deduct-tokens-idempotent

/**
 * F-14 回归锁(2026-11-11,apps/api P2)。
 *
 * 病灶:deductTokens 的幂等判定与扣减不在同一条原子写 —— 事务内先
 * `SELECT 1 FROM token_flows WHERE related_order_no=? AND op_type=1`,查不到再
 * `UPDATE user_margins ... RETURNING`,最后 `INSERT ... ON CONFLICT DO NOTHING`。
 * 同一幂等键并发两次都查不到 → 都扣减 → 后到 INSERT 命中唯一冲突 DO NOTHING,
 * 已扣余额不回滚(双扣),流水只留一条。
 *
 * 修法:先 `INSERT ... ON CONFLICT DO NOTHING RETURNING id` 抢占幂等键,插入成功才扣减;
 * 余额不足时抛错让事务整体回滚(占位流水一并消失)。
 *
 * 测试模式:内存假 DB(余额 + 流水表)+ 事务快照回滚,断言的是「写操作顺序」与副作用,
 * 不依赖真实 Postgres。测试文件豁免 any(假 DB 类型断言必需)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import Fastify from 'fastify'

// =============================================================================
// 内存假 DB
// =============================================================================
interface FlowRow {
  id: string
  opType: number
  quantity: number
  balanceAfter: number
  relatedOrderNo: string | null
}

let balance = 0
let flows: FlowRow[] = []
let flowSeq = 0
/** 实际发往假 DB 的写操作顺序(元素形如 'INSERT token_flows(claim)') */
let writeLog: string[] = []

function resetDb(initialBalance: number): void {
  balance = initialBalance
  flows = []
  flowSeq = 0
  writeLog = []
}

function snapshotState(): { balance: number; flows: FlowRow[] } {
  return { balance, flows: flows.map((f) => ({ ...f })) }
}

function restoreState(snap: { balance: number; flows: FlowRow[] }): void {
  balance = snap.balance
  flows = snap.flows
}

/** 从 drizzle `sql` 模板的 queryChunks 里取出文本与绑定参数(不依赖驱动)。 */
function parseSql(sqlObj: any): { text: string; params: unknown[] } {
  const chunks: any[] = Array.isArray(sqlObj?.queryChunks) ? sqlObj.queryChunks : []
  let text = ''
  const params: unknown[] = []
  for (const chunk of chunks) {
    if (chunk !== null && typeof chunk === 'object') {
      // StringChunk.value 是 string[];Param 才有标量 value;嵌套 SQL 只取文本判定
      if (Array.isArray(chunk.value)) {
        text += chunk.value.join('')
      } else if ('value' in chunk) {
        text += '?'
        params.push(chunk.value)
      }
      continue
    }
    // sql`` 模板把插值原样 push 进 queryChunks(字符串/数字/null)
    text += '?'
    params.push(chunk)
  }
  return { text, params }
}

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

/** getBalance → getDbBalance 的 select 链(全链返回同一 Promise 形态)。 */
function buildSelectChain(returnValue: unknown): any {
  const promise: any = Promise.resolve(returnValue)
  promise.from = vi.fn().mockReturnValue(promise)
  promise.leftJoin = vi.fn().mockReturnValue(promise)
  promise.where = vi.fn().mockReturnValue(promise)
  promise.limit = vi.fn().mockReturnValue(promise)
  return promise
}

const mockTx: any = {
  execute: vi.fn(),
  update: vi.fn(),
}

describe('F-14 deductTokens 幂等键抢占先于扣减', () => {
  const server = Fastify({ logger: false })
  const mockRedis = {
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  }

  beforeAll(async () => {
    ;(server as any).redis = mockRedis
    await server.register(tokenBalanceService)
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    // 钉死非促销日(促销期会额外 8 折,让断言不随运行日期漂移)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-11T10:00:00+08:00'))

    resetDb(0)
    mockRedis.get.mockResolvedValue(null)
    mockDbSelect.mockClear()
    mockTx.execute.mockClear()
    mockTx.update.mockClear()

    mockDbSelect.mockImplementation(() =>
      buildSelectChain([{ tokenQuantity: balance, isVip: 0 }]),
    )

    // 流水表写入/回填:唯一键 (related_order_no, op_type) 冲突即 0 行
    mockTx.execute.mockImplementation((sqlObj: any) => {
      const { text, params } = parseSql(sqlObj)
      if (text.includes('INSERT INTO "token_flows"')) {
        if (text.includes('RETURNING "id"')) {
          // 占位:VALUES (${userId}, 1, ${quantity}, ${remark}, ${idempotencyKey}, now())
          const quantity = Number(params[1])
          const relatedOrderNo = String(params[3])
          if (flows.some((f) => f.relatedOrderNo === relatedOrderNo && f.opType === 1)) {
            return Promise.resolve([]) // ON CONFLICT DO NOTHING
          }
          flowSeq += 1
          const id = `flow-${flowSeq}`
          flows.push({ id, opType: 1, quantity, balanceAfter: 0, relatedOrderNo })
          writeLog.push('INSERT token_flows(claim)')
          return Promise.resolve([{ id }])
        }
        // 无幂等键时的普通流水(扣减后写)
        // VALUES (${userId}, 1, ${quantity}, ${balanceAfter}, ${remark}, ${null}, now())
        const quantity = Number(params[1])
        const balanceAfter = Number(params[2])
        const relatedOrderNo = params[4] === null ? null : String(params[4])
        flowSeq += 1
        flows.push({ id: `flow-${flowSeq}`, opType: 1, quantity, balanceAfter, relatedOrderNo })
        writeLog.push('INSERT token_flows')
        return Promise.resolve([])
      }
      if (text.includes('UPDATE "token_flows" SET "balance_after"')) {
        const newBalance = Number(params[0])
        const id = String(params[1])
        const row = flows.find((f) => f.id === id)
        if (row) row.balanceAfter = newBalance
        writeLog.push('UPDATE token_flows(balance_after)')
        return Promise.resolve([])
      }
      return Promise.resolve([])
    })

    // user_margins 原子 UPDATE:WHERE token_quantity >= amount → 0 行即余额不足
    mockTx.update.mockImplementation(() => ({
      set: (values: any) => ({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockImplementation(() => {
            const { params } = parseSql(values.tokenQuantity)
            const amount = Number(params[1])
            writeLog.push('UPDATE user_margins')
            if (balance >= amount) {
              balance -= amount
              return Promise.resolve([{ tokenQuantity: balance }])
            }
            return Promise.resolve([])
          }),
        }),
      }),
    }))

    // 事务:成功即保留写入;抛错回滚到进入事务前的快照
    mockDbTransaction.mockImplementation(async (fn: any) => {
      const snap = snapshotState()
      try {
        return await fn(mockTx)
      } catch (e) {
        restoreState(snap)
        throw e
      }
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('① 同一幂等键第二次调用不再扣余额(余额只减一次)', async () => {
    resetDb(100)
    const userId = 'user-1'

    const first = await server.tokenBalance.deductTokens(userId, 10, 'crew:1', 'crew:1')
    const second = await server.tokenBalance.deductTokens(userId, 10, 'crew:1', 'crew:1')

    expect(first).toEqual({ success: true, remaining: 90 })
    expect(second).toEqual({ success: true, remaining: 90 })
    expect(balance).toBe(90)
    expect(flows).toHaveLength(1)
    expect(flows[0]!.quantity).toBe(10)
    // 第二次命中占位冲突,不应再出现第二条 UPDATE user_margins
    expect(writeLog.filter((w) => w === 'UPDATE user_margins')).toHaveLength(1)
  })

  it('①b 同一幂等键并发两次,余额仍只减一次', async () => {
    resetDb(100)
    const userId = 'user-1'

    const results = await Promise.all([
      server.tokenBalance.deductTokens(userId, 10, 'crew:2', 'crew:2'),
      server.tokenBalance.deductTokens(userId, 10, 'crew:2', 'crew:2'),
    ])

    expect(results.every((r) => r.success)).toBe(true)
    expect(balance).toBe(90)
    expect(flows).toHaveLength(1)
    expect(writeLog.filter((w) => w === 'UPDATE user_margins')).toHaveLength(1)
  })

  it('② 不同幂等键正常各扣一次', async () => {
    resetDb(100)
    const userId = 'user-1'

    const a = await server.tokenBalance.deductTokens(userId, 10, 'crew:a', 'crew:a')
    const b = await server.tokenBalance.deductTokens(userId, 10, 'crew:b', 'crew:b')

    expect(a).toEqual({ success: true, remaining: 90 })
    expect(b).toEqual({ success: true, remaining: 80 })
    expect(balance).toBe(80)
    expect(flows).toHaveLength(2)
    expect(flows.map((f) => f.relatedOrderNo)).toEqual(['crew:a', 'crew:b'])
  })

  it('③ 余额不足时占位流水随事务回滚,余额不变', async () => {
    resetDb(5)
    const userId = 'user-1'

    const result = await server.tokenBalance.deductTokens(userId, 10, 'crew:c', 'crew:c')

    expect(result).toEqual({ success: false, remaining: 5 })
    expect(balance).toBe(5)
    // 占位 INSERT 曾经发生过,但被回滚 —— 库里不留流水,重试不会被误判成「已处理」
    expect(writeLog).toContain('INSERT token_flows(claim)')
    expect(flows).toHaveLength(0)

    // 占位没留下,同一幂等键在余额补足后可以正常扣减一次
    resetDb(100)
    const retry = await server.tokenBalance.deductTokens(userId, 10, 'crew:c', 'crew:c')
    expect(retry).toEqual({ success: true, remaining: 90 })
    expect(flows).toHaveLength(1)
  })

  it('④ 写操作顺序:抢先 INSERT 占位,再 UPDATE 扣减,最后回填 balance_after', async () => {
    resetDb(100)
    const userId = 'user-1'

    await server.tokenBalance.deductTokens(userId, 10, 'crew:d', 'crew:d')

    const claimIdx = writeLog.indexOf('INSERT token_flows(claim)')
    const deductIdx = writeLog.indexOf('UPDATE user_margins')
    expect(claimIdx).toBeGreaterThanOrEqual(0)
    expect(deductIdx).toBeGreaterThan(claimIdx)
    expect(writeLog).toEqual([
      'INSERT token_flows(claim)',
      'UPDATE user_margins',
      'UPDATE token_flows(balance_after)',
    ])
    expect(flows[0]!.balanceAfter).toBe(90)
  })
})
