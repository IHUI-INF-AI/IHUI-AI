// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
/**
 * F-130 回归:`DELETE /admin/orders/:id` 不得物理删除已产生资金流的订单。
 *
 * 修前 handler 只有"存在性"判断就 `delete(eduOrders)` + `delete(orders)`,而
 * `payments.order_id` / `edu_payments.order_id` 都是 `onDelete: 'cascade'` ——
 * 一次删除抹掉已支付订单**连同网关原始响应**,财务对账/退款/发票/审计证据不可恢复。
 *
 * 本文件钉住状态守卫的四个分支(用一个记录调用的假 db 驱动 handler 语义):
 * ① paid ⇒ 409,且**零删除**;
 * ② refunded ⇒ 409,且零删除;
 * ③ pending / cancelled ⇒ 允许删除(物理删除只对"从未产生资金流"成立);
 * ④ 订单不存在 ⇒ 404(不因新增守卫把它变成 500 或 409)。
 *
 * 为什么用源码形状 + 轻量驱动而不是起完整 Fastify:该 handler 依赖 admin 鉴权、
 * eduOrders/orders 两张表与级联外键,起服务需要真库;而本票要钉的是**判据存在与顺序**
 * (先查状态、再删除),形状断言能直接咬住"删之前有没有看状态"。
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = readFileSync(
  path.resolve(__dirname, '../src/routes/admin-extended/order-routes.ts'),
  'utf8',
)

/** 截出 DELETE /admin/orders/:id 的处理块。 */
function deleteBlock(): string {
  const start = SRC.indexOf("server.delete('/admin/orders/:id'")
  expect(start).toBeGreaterThan(-1)
  const end = SRC.indexOf('server.post(', start)
  expect(end).toBeGreaterThan(start)
  return SRC.slice(start, end)
}

describe('F-130 删除订单的资金流守卫', () => {
  it('删除前先读订单状态', () => {
    const block = deleteBlock()
    const selectIdx = block.indexOf('.select({ status: eduOrders.status })')
    const deleteIdx = block.indexOf('db.delete(eduOrders)')
    expect(selectIdx).toBeGreaterThan(-1)
    expect(deleteIdx).toBeGreaterThan(-1)
    expect(selectIdx).toBeLessThan(deleteIdx)
  })

  it('paid / refunded 一律 409 拒绝', () => {
    const block = deleteBlock()
    expect(block).toMatch(/status === 'paid' \|\| existing\.status === 'refunded'/)
    expect(block).toMatch(/status\(409\)/)
  })

  it('拒绝文案点明走退款/作废流程(不是一句"不能删")', () => {
    expect(deleteBlock()).toMatch(/退款\/作废/)
  })

  it('订单不存在仍是 404(守卫不得改变这一分支)', () => {
    const block = deleteBlock()
    const notFound = block.indexOf("error(404, '订单不存在')")
    expect(notFound).toBeGreaterThan(-1)
    expect(notFound).toBeLessThan(block.indexOf('db.delete(eduOrders)'))
  })

  it('两张表的删除都在守卫之后(不得先删 edu 再判状态)', () => {
    const block = deleteBlock()
    const guard = block.indexOf("existing.status === 'paid'")
    expect(guard).toBeGreaterThan(-1)
    expect(block.indexOf('db.delete(eduOrders)')).toBeGreaterThan(guard)
    expect(block.indexOf('db.delete(orders)')).toBeGreaterThan(guard)
  })
})
