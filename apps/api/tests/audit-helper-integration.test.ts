/**
 * G13 端到端集成测试:验证 query 函数 insert 操作时 createdBy + updatedBy
 * 正确注入到 DB 调用的 values 中(链路:createOrder/applyWithdrawal/createCommissionFlow
 * → withAuditBoth → db.insert().values())。
 *
 * 用 vi.mock 拦截 drizzle-orm 的 db 实例,捕获 insert() 收到的 values 对象并断言审计字段。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// hoisted:env 在所有 import 前注入
vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
})

// 捕获每次 insert 调用的 values 与 returning
const capturedInserts: Array<{ values: unknown; table: string }> = []

vi.mock('../src/db/index.js', () => {
  // 模拟 db.insert(table).values(x).returning() 链式调用
  // 使用宽松的 table 形参类型(实际 drizzle pgTable 没有 _ 属性),通过 try-catch 提取名称
  const makeInsert = (table: unknown) => ({
    values: (v: unknown) => ({
      returning: async () => {
        let name = 'unknown'
        try {
          // drizzle pgTable 有 [Symbol(...)] 或 ._.name 等内部结构,逐个尝试
          const t = table as Record<string, unknown> & { _?: { name?: string } }
          name =
            (t && typeof t === 'object' && t._ && typeof t._ === 'object' && t._.name) ||
            (t && typeof t === 'object' && (t as { name?: string }).name) ||
            'unknown'
        } catch {
          name = 'unknown'
        }
        capturedInserts.push({ values: v, table: name })
        return [{ id: 'mock-id' }]
      },
    }),
  })
  return {
    db: { insert: makeInsert },
    dbRead: { insert: makeInsert },
  }
})

// 在 mock 之后 import,这样 createOrder 等 query 函数会拿到 mocked db
import { createOrder } from '../src/db/payment-queries.js'
import { createCommissionFlow, applyWithdrawal } from '../src/db/commission-queries.js'

describe('G13 端到端审计字段注入 (query → db.insert)', () => {
  beforeEach(() => {
    capturedInserts.length = 0
  })

  it('createOrder:route handler operatorId=req.userId → values 含 createdBy + updatedBy', async () => {
    const operatorId = 'user-route-123'
    await createOrder(
      {
        userId: 'user-abc',
        amount: 9900,
        orderType: 1,
        payType: 'wechat',
      },
      operatorId,
    )
    expect(capturedInserts).toHaveLength(1)
    const values = capturedInserts[0]!.values as Record<string, unknown>
    expect(values.createdBy).toBe(operatorId)
    expect(values.updatedBy).toBe(operatorId)
    expect(values.orderNo).toMatch(/^WX/) // 微信订单号前缀
    expect(values.status).toBe('pending')
  })

  it('createOrder:系统异步任务 operatorId=null → createdBy + updatedBy 都为 null', async () => {
    await createOrder(
      { userId: 'user-abc', amount: 9900, orderType: 1, payType: 'alipay' },
      null,
    )
    const values = capturedInserts[0]!.values as Record<string, unknown>
    expect(values.createdBy).toBeNull()
    expect(values.updatedBy).toBeNull()
  })

  it('applyWithdrawal:用户提现 operatorId=user → createdBy + updatedBy = user', async () => {
    const userId = 'user-withdraw-001'
    await applyWithdrawal(
      { userId, amount: 10000, method: 'wechat', accountInfo: { openId: 'oxxx' } },
      userId, // route handler 传 request.userId ?? null
    )
    const values = capturedInserts[0]!.values as Record<string, unknown>
    expect(values.createdBy).toBe(userId)
    expect(values.updatedBy).toBe(userId)
    expect(values.userId).toBe(userId)
    expect(values.status).toBe(0) // pending
    expect(values.amount).toBe(9800) // 10000 - 2% fee
  })

  it('createCommissionFlow:系统自动分佣 operatorId=null → createdBy + updatedBy 都为 null', async () => {
    await createCommissionFlow(
      {
        beneficiaryId: 'beneficiary-1',
        invitedUserId: 'invited-1',
        orderId: 'order-1',
        amount: 500,
        token: 0,
        type: 1,
        remark: 'VIP 返佣',
      },
      null, // commission-service.ts 系统调用
    )
    const values = capturedInserts[0]!.values as Record<string, unknown>
    expect(values.createdBy).toBeNull()
    expect(values.updatedBy).toBeNull()
    expect(values.beneficiaryId).toBe('beneficiary-1')
    expect(values.amount).toBe(500)
  })

  it('createCommissionFlow:管理员手动补发 operatorId=admin → createdBy + updatedBy = admin', async () => {
    const adminId = 'admin-007'
    await createCommissionFlow(
      {
        beneficiaryId: 'beneficiary-2',
        amount: 100,
        token: 0,
        type: 1,
      },
      adminId,
    )
    const values = capturedInserts[0]!.values as Record<string, unknown>
    expect(values.createdBy).toBe(adminId)
    expect(values.updatedBy).toBe(adminId)
  })
})
