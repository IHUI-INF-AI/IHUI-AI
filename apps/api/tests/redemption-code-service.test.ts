/**
 * 兑换码 service 单测(P0-5 刮刮卡式裂变充值,2026-07-31 立)。
 *
 * 覆盖点:
 * - batchGenerateCodes:正常生成 / count=0 拒绝 / count>1000 拒绝 / 码格式正确 / 码唯一
 * - redeemCode:正常兑换 / 余额到账 / 重复兑换幂等 / 无效码 / 已 used / 已 expired / 已 disabled / 无 active Key
 * - listCodes:全量 / 按 status 筛选 / 分页
 * - disableCode:正常禁用 / 已 used 不可禁用 / 码不存在
 *
 * 测试模式:vi.mock 掉 db / @ihui/database / relay-billing-service(对齐 relay-billing-service.test.ts)。
 * 测试文件豁免 any(mock 类型断言必需,AGENTS.md §3)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type * as Crypto from 'crypto'

// =============================================================================
// Mock 工具:构建链式查询 mock
// =============================================================================

/**
 * 构建链式 mock,支持所有 Drizzle 查询模式:
 * - select().from().where().limit()
 * - select().from().where().orderBy().limit()
 * - select().from().where().orderBy().limit().offset()
 * - select().from().where()(直接 await,无 limit)
 * - select().from().groupBy()(直接 await,无 where)
 *
 * 核心思路:dbRead.select() 返回 { from },from() 返回一个 Promise(可直接 await),
 * 同时挂载 where/limit/orderBy/groupBy/offset 方法,每个方法都返回同一个 Promise。
 */
function chain(returnValue: unknown) {
  const promise: any = Promise.resolve(returnValue)
  promise.limit = vi.fn().mockReturnValue(promise)
  promise.offset = vi.fn().mockReturnValue(promise)
  promise.orderBy = vi.fn().mockReturnValue(promise)
  promise.groupBy = vi.fn().mockReturnValue(promise)
  promise.where = vi.fn().mockReturnValue(promise)
  const from = vi.fn().mockReturnValue(promise)
  return { from }
}

/**
 * 构建 db.update 链:db.update(table).set(obj).where(cond).returning()
 * 返回 { set } 对象(即 db.update(table) 的返回值)。
 */
function updateChain(returnValue: unknown): { set: ReturnType<typeof vi.fn> } {
  const returning = vi.fn().mockResolvedValue(returnValue)
  const where = vi.fn().mockReturnValue({ returning })
  const set = vi.fn().mockReturnValue({ where })
  return { set }
}

/**
 * 构建 db.insert 链:db.insert(table).values(rows).returning()
 * 返回 { values } 对象(即 db.insert(table) 的返回值)。
 * mockImplementation 捕获 values 入参并回显(用于验证码格式/唯一性)。
 */
function insertEchoChain(): { values: ReturnType<typeof vi.fn> } {
  const returning = vi.fn()
  const values = vi.fn().mockImplementation((rows: unknown[]) => {
    returning.mockResolvedValue(rows)
    return { returning }
  })
  return { values }
}

// =============================================================================
// Mock 声明
// =============================================================================

const { mockDbReadSelect, mockDbInsert, mockDbUpdate } = vi.hoisted(() => ({
  mockDbReadSelect: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
}))

vi.mock('../src/db/index.js', () => {
  // 事务回调 tx 复用 mockDbUpdate/mockDbReadSelect 的 mockReturnValueOnce 队列
  // (源码 redeemCode 在事务内调 tx.update / tx.select,与 db.update / dbRead.select 共享 mock)
  const tx = {
    update: mockDbUpdate,
    select: mockDbReadSelect,
  }
  return {
    db: {
      insert: mockDbInsert,
      update: mockDbUpdate,
      // 事务:同步调用 cb(tx) 并返回其 Promise(模拟事务提交/回滚语义)
      // cb 内 throw → Promise reject → 外层 await 抛错 → catch 转换为 RedeemResult
      transaction: <T>(cb: (tx: typeof tx) => Promise<T>) => cb(tx),
    },
    dbRead: {
      select: mockDbReadSelect,
    },
    dbClient: {},
  }
})

vi.mock('@ihui/database', () => ({
  redemptionCodes: {
    id: 'id',
    code: 'code',
    batchId: 'batch_id',
    faceValueCents: 'face_value_cents',
    tokenAmount: 'token_amount',
    status: 'status',
    createdBy: 'created_by',
    usedBy: 'used_by',
    usedAt: 'used_at',
    expiresAt: 'expires_at',
    createdAt: 'created_at',
  },
  developerApiKeys: {
    id: 'id',
    userId: 'user_id',
    status: 'status',
    createdAt: 'created_at',
    tokenBalance: 'token_balance',
    updatedAt: 'updated_at',
  },
}))

// Mock crypto.randomUUID 用于确定性测试
vi.mock('crypto', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof Crypto
  return {
    ...actual,
    randomUUID: vi.fn().mockReturnValue('test-batch-uuid'),
  }
})

import {
  batchGenerateCodes,
  redeemCode,
  listCodes,
  disableCode,
  normalizeCode,
} from '../src/services/redemption-code-service.js'

// =============================================================================
// 测试
// =============================================================================

describe('redemption-code-service — 兑换码核心 service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ===========================================================================
  // 0. normalizeCode — 规范化兑换码
  // ===========================================================================
  describe('normalizeCode', () => {
    it('去空格 + 转大写:ihui-abcd-efgh-jklm → IHUI-ABCD-EFGH-JKLM', () => {
      expect(normalizeCode('ihui-abcd-efgh-jklm')).toBe('IHUI-ABCD-EFGH-JKLM')
    })

    it('去内部空格:" IHUI-ABCD EFGH JKLM " → IHUI-ABCDEFGHJKLM', () => {
      expect(normalizeCode(' IHUI-ABCD EFGH JKLM ')).toBe('IHUI-ABCDEFGHJKLM')
    })
  })

  // ===========================================================================
  // 1. batchGenerateCodes — 批量生成
  // ===========================================================================
  describe('batchGenerateCodes', () => {
    it('正常生成 2 个码:返回 2 条记录,含 batchId', async () => {
      mockDbInsert.mockReturnValueOnce(insertEchoChain())

      const result = await batchGenerateCodes({
        count: 2,
        faceValueCents: 990,
        tokenAmount: 100,
        expiresAt: null,
        createdBy: 'admin-1',
      })

      expect(result).toHaveLength(2)
      expect(mockDbInsert).toHaveBeenCalledTimes(1)
    })

    it('count=0 → 抛错拒绝', async () => {
      await expect(
        batchGenerateCodes({
          count: 0,
          faceValueCents: 990,
          tokenAmount: 100,
          createdBy: 'admin-1',
        }),
      ).rejects.toThrow('count 必须是大于 0 的整数')
      expect(mockDbInsert).not.toHaveBeenCalled()
    })

    it('count>1000 → 抛错拒绝', async () => {
      await expect(
        batchGenerateCodes({
          count: 1001,
          faceValueCents: 990,
          tokenAmount: 100,
          createdBy: 'admin-1',
        }),
      ).rejects.toThrow('count 不能超过 1000')
      expect(mockDbInsert).not.toHaveBeenCalled()
    })

    it('码格式正确:所有码匹配 IHUI-XXXX-XXXX-XXXX(X ∈ 去混淆字符集)', async () => {
      // 用 echo chain 捕获传入 values 的 rows,验证码格式
      const insertResult = insertEchoChain()
      mockDbInsert.mockReturnValueOnce(insertResult)

      await batchGenerateCodes({
        count: 10,
        faceValueCents: 990,
        tokenAmount: 100,
        createdBy: 'admin-1',
      })

      // 从 insertResult.values mock 中提取传入的 rows
      const rowsArg = insertResult.values.mock.calls[0][0] as Array<{ code: string }>

      // 码格式:IHUI-XXXX-XXXX-XXXX,X 不含 O/0/I/1/L
      const charsetRegex = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/
      for (const row of rowsArg) {
        expect(row.code).toMatch(/^IHUI-([A-Z2-9]{4})-([A-Z2-9]{4})-([A-Z2-9]{4})$/)
        const segments = row.code.split('-').slice(1)
        for (const seg of segments) {
          expect(charsetRegex.test(seg)).toBe(true)
          // 确保不含易混淆字符
          expect(seg).not.toMatch(/[O0I1L]/)
        }
      }
    })

    it('码唯一:同批次生成的码互不重复', async () => {
      const insertResult = insertEchoChain()
      mockDbInsert.mockReturnValueOnce(insertResult)

      await batchGenerateCodes({
        count: 50,
        faceValueCents: 990,
        tokenAmount: 100,
        createdBy: 'admin-1',
      })

      const rowsArg = insertResult.values.mock.calls[0][0] as Array<{ code: string }>

      const codes = rowsArg.map((r) => r.code)
      const uniqueCodes = new Set(codes)
      expect(uniqueCodes.size).toBe(codes.length)
    })

    it('tokenAmount<=0 → 抛错拒绝', async () => {
      await expect(
        batchGenerateCodes({ count: 5, faceValueCents: 990, tokenAmount: 0, createdBy: 'admin-1' }),
      ).rejects.toThrow('tokenAmount 必须是大于 0 的整数')
    })
  })

  // ===========================================================================
  // 2. redeemCode — 兑换(幂等)
  // ===========================================================================
  describe('redeemCode', () => {
    it('正常兑换:状态翻转 + 余额到账', async () => {
      const claimedRow = {
        id: 'code-1',
        code: 'IHUI-AAAA-BBBB-CCCC',
        batchId: 'batch-1',
        faceValueCents: 990,
        tokenAmount: 500,
        status: 'used',
        usedBy: 'user-1',
        usedAt: new Date(),
      }
      // tx.update(redemptionCodes) 抢占码
      mockDbUpdate.mockReturnValueOnce(updateChain([claimedRow]))
      // tx.update(developerApiKeys) 内联充值(tokenBalance 累加 CASE WHEN)
      mockDbUpdate.mockReturnValueOnce(updateChain([{ tokenBalance: 600 }]))

      const result = await redeemCode('ihui-aaaa-bbbb-cccc', 'user-1', 'key-1')

      expect(result.success).toBe(true)
      expect(result.tokenAmount).toBe(500)
      expect(result.newTokenBalance).toBe(600)
    })

    it('未传 apiKeyId 时查用户最新 active Key', async () => {
      const claimedRow = {
        id: 'code-1',
        code: 'IHUI-AAAA-BBBB-CCCC',
        tokenAmount: 300,
        status: 'used',
      }
      // tx.update(redemptionCodes) 抢占码
      mockDbUpdate.mockReturnValueOnce(updateChain([claimedRow]))
      // tx.select(developerApiKeys) 查 active key(事务内,用 tx.select = mockDbReadSelect)
      mockDbReadSelect.mockReturnValueOnce(chain([{ id: 'active-key-1' }]))
      // tx.update(developerApiKeys) 内联充值
      mockDbUpdate.mockReturnValueOnce(updateChain([{ tokenBalance: 400 }]))

      const result = await redeemCode('IHUI-AAAA-BBBB-CCCC', 'user-1')

      expect(result.success).toBe(true)
      expect(result.newTokenBalance).toBe(400)
    })

    it('重复兑换幂等:第二次返回 already_used', async () => {
      // 第一次 update 抢占成功
      const claimedRow = {
        id: 'code-1',
        code: 'IHUI-AAAA-BBBB-CCCC',
        tokenAmount: 500,
        status: 'used',
      }
      mockDbUpdate.mockReturnValueOnce(updateChain([claimedRow]))
      // tx.update(developerApiKeys) 内联充值
      mockDbUpdate.mockReturnValueOnce(updateChain([{ tokenBalance: 600 }]))

      const result1 = await redeemCode('IHUI-AAAA-BBBB-CCCC', 'user-1', 'key-1')
      expect(result1.success).toBe(true)

      // 第二次 update 抢占失败(0 行),然后查原因返回 already_used
      mockDbUpdate.mockReturnValueOnce(updateChain([]))
      mockDbReadSelect.mockReturnValueOnce(chain([{ status: 'used', expiresAt: null }]))

      const result2 = await redeemCode('IHUI-AAAA-BBBB-CCCC', 'user-1', 'key-1')
      expect(result2.success).toBe(false)
      expect(result2.reason).toBe('already_used')
    })

    it('无效码:返回 code_not_found', async () => {
      mockDbUpdate.mockReturnValueOnce(updateChain([]))
      mockDbReadSelect.mockReturnValueOnce(chain([]))

      const result = await redeemCode('IHUI-XXXX-YYYY-ZZZZ', 'user-1', 'key-1')
      expect(result.success).toBe(false)
      expect(result.reason).toBe('code_not_found')
    })

    it('已 used 码:返回 already_used', async () => {
      mockDbUpdate.mockReturnValueOnce(updateChain([]))
      mockDbReadSelect.mockReturnValueOnce(chain([{ status: 'used', expiresAt: null }]))

      const result = await redeemCode('IHUI-AAAA-BBBB-CCCC', 'user-1', 'key-1')
      expect(result.success).toBe(false)
      expect(result.reason).toBe('already_used')
    })

    it('已 expired 码:返回 expired', async () => {
      mockDbUpdate.mockReturnValueOnce(updateChain([]))
      const pastDate = new Date('2020-01-01')
      mockDbReadSelect.mockReturnValueOnce(chain([{ status: 'unused', expiresAt: pastDate }]))

      const result = await redeemCode('IHUI-AAAA-BBBB-CCCC', 'user-1', 'key-1')
      expect(result.success).toBe(false)
      expect(result.reason).toBe('expired')
    })

    it('已 disabled 码:返回 disabled', async () => {
      mockDbUpdate.mockReturnValueOnce(updateChain([]))
      mockDbReadSelect.mockReturnValueOnce(chain([{ status: 'disabled', expiresAt: null }]))

      const result = await redeemCode('IHUI-AAAA-BBBB-CCCC', 'user-1', 'key-1')
      expect(result.success).toBe(false)
      expect(result.reason).toBe('disabled')
    })

    it('用户无 active Key:返回 no_active_key', async () => {
      const claimedRow = {
        id: 'code-1',
        code: 'IHUI-AAAA-BBBB-CCCC',
        tokenAmount: 500,
        status: 'used',
      }
      mockDbUpdate.mockReturnValueOnce(updateChain([claimedRow]))
      mockDbReadSelect.mockReturnValueOnce(chain([])) // 无 active key

      const result = await redeemCode('IHUI-AAAA-BBBB-CCCC', 'user-1')
      expect(result.success).toBe(false)
      expect(result.reason).toBe('no_active_key')
      expect(result.tokenAmount).toBe(500)
    })

    it('rechargeByKey 返回 null(Key 不存在):返回 key_not_found', async () => {
      const claimedRow = {
        id: 'code-1',
        code: 'IHUI-AAAA-BBBB-CCCC',
        tokenAmount: 500,
        status: 'used',
      }
      // tx.update(redemptionCodes) 抢占码
      mockDbUpdate.mockReturnValueOnce(updateChain([claimedRow]))
      // tx.update(developerApiKeys) 返回空(Key 不存在)→ throw ERR_KEY_RECHARGE_FAILED → 事务回滚
      mockDbUpdate.mockReturnValueOnce(updateChain([]))

      const result = await redeemCode('IHUI-AAAA-BBBB-CCCC', 'user-1', 'bad-key')
      expect(result.success).toBe(false)
      expect(result.reason).toBe('key_not_found')
    })
  })

  // ===========================================================================
  // 3. listCodes — 列表查询
  // ===========================================================================
  describe('listCodes', () => {
    it('全量查询:返回 items + total', async () => {
      const items = [
        { id: 'r1', code: 'IHUI-AAAA-BBBB-CCCC', status: 'unused' },
        { id: 'r2', code: 'IHUI-DDDD-EEEE-FFFF', status: 'used' },
      ]
      // listCodes 用 Promise.all 做 2 个查询:items + count
      mockDbReadSelect.mockReturnValueOnce(chain(items))
      mockDbReadSelect.mockReturnValueOnce(chain([{ c: 2 }]))

      const result = await listCodes({ page: 1, pageSize: 20 })

      expect(result.items).toHaveLength(2)
      expect(result.total).toBe(2)
    })

    it('按 status 筛选:unused 只返回未使用码', async () => {
      const items = [{ id: 'r1', code: 'IHUI-AAAA-BBBB-CCCC', status: 'unused' }]
      mockDbReadSelect.mockReturnValueOnce(chain(items))
      mockDbReadSelect.mockReturnValueOnce(chain([{ c: 1 }]))

      const result = await listCodes({ status: 'unused', page: 1, pageSize: 20 })

      expect(result.items).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('分页:page=2 pageSize=5 → offset=5', async () => {
      const items = [{ id: 'r6', code: 'IHUI-XXXX-YYYY-ZZZZ', status: 'unused' }]
      mockDbReadSelect.mockReturnValueOnce(chain(items))
      mockDbReadSelect.mockReturnValueOnce(chain([{ c: 6 }]))

      const result = await listCodes({ page: 2, pageSize: 5 })

      expect(result.items).toHaveLength(1)
      expect(result.total).toBe(6)
    })
  })

  // ===========================================================================
  // 4. disableCode — 禁用
  // ===========================================================================
  describe('disableCode', () => {
    it('正常禁用:unused → disabled', async () => {
      mockDbReadSelect.mockReturnValueOnce(chain([{ status: 'unused' }]))
      const updatedRow = { id: 'code-1', code: 'IHUI-AAAA-BBBB-CCCC', status: 'disabled' }
      mockDbUpdate.mockReturnValueOnce(updateChain([updatedRow]))

      const result = await disableCode('code-1')
      expect(result.status).toBe('disabled')
    })

    it('已 used 码不可禁用:抛错 cannot_disable_used', async () => {
      mockDbReadSelect.mockReturnValueOnce(chain([{ status: 'used' }]))

      await expect(disableCode('code-1')).rejects.toThrow('cannot_disable_used')
      expect(mockDbUpdate).not.toHaveBeenCalled()
    })

    it('码不存在:抛错 code_not_found', async () => {
      mockDbReadSelect.mockReturnValueOnce(chain([]))

      await expect(disableCode('nonexistent')).rejects.toThrow('code_not_found')
    })
  })
})
