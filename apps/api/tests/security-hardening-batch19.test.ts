// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 安全强化第 19 批(2026-10-31)修复钉住。
 *
 * 覆盖:
 * - F1(高危)支付下单金额客户端可写:orderType=6(API 订阅)此前直接落客户端
 *   金额 —— 0.01 元订单回调后按 planId 激活整档 token 配额。现按 plans 表反查
 *   覆盖(isForSale=false 一并拒),与 VIP/Developer 同口径。
 * - F2(中高)弹幕 REST 腿转义:escapeHtml 为 WS/REST 两腿共用单出口。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const dbMock = vi.hoisted(() => ({
  selectResult: [] as Array<Record<string, unknown>>,
  select: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    select: dbMock.select,
    insert: vi.fn(),
    execute: vi.fn(),
  },
  dbRead: { select: vi.fn() },
}))

vi.mock('../src/plugins/auth.js', () => ({ authenticate: vi.fn() }))
vi.mock('../src/services/topup-discount-service.js', () => ({
  calculateTopupBonus: vi.fn(),
}))
vi.mock('../src/services/api-subscription-service.js', () => ({
  activateApiSubscription: vi.fn(),
}))

import { resolveProductAmountCents } from '../src/routes/payment-gateway.js'
import { escapeHtml } from '../src/websocket/chat-server.js'

// resolveProductAmountCents 的 select 链:select(...).from(...).where(...).limit(1)
function chainFor(rows: Array<Record<string, unknown>>) {
  const chain: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve),
  }
  for (const m of ['from', 'where', 'limit', 'offset', 'orderBy']) {
    chain[m] = () => chain
  }
  return chain
}

const log = { warn: vi.fn(), error: vi.fn() } as never

describe('支付下单金额服务端反查(第 19 批 F1)', () => {
  beforeEach(() => {
    dbMock.select.mockReset()
  })

  it('orderType=6 按 plans.price 覆盖客户端金额(不采信 0.01)', async () => {
    dbMock.select.mockImplementation(() =>
      chainFor([{ price: 99000, isActive: true, isForSale: true }]),
    )
    const cents = await resolveProductAmountCents(6, 'plan-uuid-1', 1, log, 'user-1')
    expect(cents).toBe(99000)
  })

  it('下架套餐(isForSale=false)→ null(低价扫尾拒)', async () => {
    dbMock.select.mockImplementation(() => chainFor([]))
    const cents = await resolveProductAmountCents(6, 'plan-uuid-2', 99000, log, 'user-1')
    expect(cents).toBeNull()
  })

  it('orderType=6 金额一致时同样返回 DB 金额(幂等)', async () => {
    dbMock.select.mockImplementation(() =>
      chainFor([{ price: 99000, isActive: true, isForSale: true }]),
    )
    const cents = await resolveProductAmountCents(6, 'plan-uuid-1', 99000, log, 'user-1')
    expect(cents).toBe(99000)
  })

  it('无 productId → null(维持原语义)', async () => {
    const cents = await resolveProductAmountCents(6, undefined, 1, log, 'user-1')
    expect(cents).toBeNull()
  })
})

describe('弹幕转义单出口(第 19 批 F2/F3)', () => {
  it('escapeHtml 覆盖五类 HTML 特殊字符', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;')
    expect(escapeHtml('a&b"c\'d')).toBe('a&amp;b&quot;c&#39;d')
  })

  it('正常文本不改变(不删不改)', () => {
    expect(escapeHtml('你好世界 hello 123')).toBe('你好世界 hello 123')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
