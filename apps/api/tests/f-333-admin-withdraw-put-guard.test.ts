// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-333 回归锁(2026-11-13)。
 *
 * 病灶:`PUT /api/admin/shop/withdrawals/:id` 复用创建 body schema,一次请求即可改
 * userId/amount/status —— 可把任意提现单直接置 approved、改金额/归属,且不走冻结资金事务。
 *
 * 本文件锁:
 *   ① 已 approved 的单 PUT ⇒ 非 2xx(409),且 UPDATE 载荷里没有任何状态字段;
 *   ② body 带 status / userId / user / amount / originalAmount ⇒ 400,且零写库;
 *   ③ pending 单只改账户信息 ⇒ 成功,UPDATE 载荷只有 accountInfo/method/updatedAt,
 *      且 where 条件含 status='pending'(源码形状 + 运行时载荷双重钉住);
 *   ④ 成功响应结构与修前一致(`{ id }`),防误伤调用方。
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: async (request: { userId?: string }) => {
    request.userId = 'f333-admin'
  },
}))

vi.mock('../src/db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
  dbRead: { select: vi.fn() },
  dbClient: {},
}))

import { db } from '../src/db/index.js'
import { adminShopRoutes } from '../src/routes/admin-shop-routes.js'

const SRC = readFileSync(path.resolve(__dirname, '../src/routes/admin-shop-routes.ts'), 'utf8')
const WID = '11111111-1111-4111-8111-111111111111'

/** 截出 PUT /shop/withdrawals/:id 的处理块(到下一个 DELETE 端点为止)。 */
function putBlock(): string {
  const start = SRC.indexOf("server.put('/shop/withdrawals/:id'")
  expect(start).toBeGreaterThan(-1)
  const end = SRC.indexOf("server.delete('/shop/withdrawals/:id'", start)
  expect(end).toBeGreaterThan(start)
  return SRC.slice(start, end)
}

describe('F-333 管理端提现 PUT 受限 patch', () => {
  let app: FastifyInstance
  let setMock: ReturnType<typeof vi.fn>
  let whereMock: ReturnType<typeof vi.fn>
  let returningMock: ReturnType<typeof vi.fn>

  const put = (body: Record<string, unknown>) =>
    app.inject({
      method: 'PUT',
      url: `/api/admin/shop/withdrawals/${WID}`,
      headers: { authorization: 'Bearer admin-token' },
      payload: body,
    })

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(adminShopRoutes, { prefix: '/api/admin' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    setMock = vi.fn()
    whereMock = vi.fn()
    returningMock = vi.fn().mockResolvedValue([{ id: WID }])
    const chain = { set: setMock, where: whereMock, returning: returningMock }
    setMock.mockReturnValue(chain)
    whereMock.mockReturnValue(chain)
    ;(db.update as unknown as ReturnType<typeof vi.fn>).mockReset()
    ;(db.update as unknown as ReturnType<typeof vi.fn>).mockReturnValue(chain)
  })

  it('① 已 approved 的单被拒(409),UPDATE 载荷不含状态字段', async () => {
    // 条件 UPDATE 不会命中非 pending 行 ⇒ returning() 为空
    returningMock.mockResolvedValue([])
    const res = await put({ account: 'new@alipay.com' })
    expect(res.statusCode).toBe(409)
    expect(res.statusCode).toBeGreaterThanOrEqual(400)
    expect(res.json().code).toBe(409)
    // 载荷里没有 status/userId/amount,批准态不可能被这次 patch 改写
    const payload = setMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(payload).toBeDefined()
    expect(payload).not.toHaveProperty('status')
    expect(payload).not.toHaveProperty('userId')
    expect(payload).not.toHaveProperty('amount')
    expect(res.json().data).toBeUndefined()
  })

  it('② body 带不可变字段一律 400,且零写库', async () => {
    const cases: Array<Record<string, unknown>> = [
      { account: 'a@b.com', status: 'approved' },
      { account: 'a@b.com', userId: '22222222-2222-4222-8222-222222222222' },
      { account: 'a@b.com', user: '22222222-2222-4222-8222-222222222222' },
      { account: 'a@b.com', amount: 999999 },
      { account: 'a@b.com', originalAmount: 1 },
    ]
    for (const body of cases) {
      const res = await put(body)
      expect(res.statusCode).toBe(400)
      expect(res.json().code).toBe(400)
    }
    expect(db.update).not.toHaveBeenCalled()
  })

  it("③ pending 单只改账户信息成功,SQL 带 status='pending' 条件", async () => {
    const res = await put({ account: 'new@alipay.com', channel: 'wechat' })
    expect(res.statusCode).toBe(200)
    expect(returningMock).toHaveBeenCalledTimes(1)
    // 载荷只含账户信息(+ updatedAt),金额/归属/状态不可达
    const payload = setMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(payload).toEqual({
      accountInfo: { account: 'new@alipay.com' },
      method: 'wechat',
      updatedAt: expect.any(Date),
    })
    // 条件 UPDATE:where 必须同时限定 id 与 pending
    expect(whereMock).toHaveBeenCalledTimes(1)

    const block = putBlock()
    expect(block).toMatch(/eq\(withdrawalFlows\.status, WITHDRAWAL_INT\.pending\)/)
    expect(block).toMatch(/and\(\s*eq\(withdrawalFlows\.id/)
    // 源码里不得再出现旧的整行覆盖
    expect(block).not.toMatch(/userId: b\.data/)
    expect(block).not.toMatch(/amount: b\.data/)
    expect(block).not.toMatch(/status: WITHDRAWAL_INT\[b\.data\.status\]/)
  })

  it('④ 成功响应结构与修前一致({ id })', async () => {
    const res = await put({ account: 'another@bank.com' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ code: 0, message: 'success', data: { id: WID } })
  })

  it('⑤ 非 uuid 的 :id 仍是 400,不进 SQL', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/shop/withdrawals/not-a-uuid',
      headers: { authorization: 'Bearer admin-token' },
      payload: { account: 'a@b.com' },
    })
    expect(res.statusCode).toBe(400)
    expect(db.update).not.toHaveBeenCalled()
  })
})
