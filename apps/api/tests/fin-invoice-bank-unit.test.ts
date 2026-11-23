// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import { normalizeInvoice } from '../src/services/fin-accounting/invoice-service.js'
import { pickMatch, type Candidate } from '../src/services/fin-accounting/bank-service.js'

const ms = (d: string) => Date.parse(`${d}T00:00:00Z`)

function invoice(over: Record<string, unknown> = {}) {
  return normalizeInvoice(
    {
      direction: 'output',
      invoiceNo: '12345678',
      invoiceDate: '2026-03-05',
      period: '2026-03',
      amountExclTax: '1000.00',
      taxRate: '0.13',
      ...over,
    } as never,
    'ledger-x',
  )
}

describe('发票:税额与价税合计容差', () => {
  it('13% 税率自动补出 130 元税额与 1130 合计', () => {
    const row = invoice()
    expect(row.taxAmount).toBe('130.00')
    expect(row.totalAmount).toBe('1130.00')
    expect(row.taxRate).toBe('0.1300')
  })

  it('自报税额与"金额×税率"差 1 分以内接受(四舍五入尾差)', () => {
    const row = invoice({ taxAmount: '129.99', totalAmount: '1129.99' })
    expect(row.taxAmount).toBe('129.99')
  })

  it('税额差 2 分拒绝', () => {
    expect(() => invoice({ taxAmount: '129.98', totalAmount: '1129.98' })).toThrow(/超过 1 分/)
  })

  it('价税合计与"金额+税额"差 2 分拒绝', () => {
    expect(() => invoice({ taxAmount: '130.00', totalAmount: '1130.02' })).toThrow(/价税合计/)
  })

  it('零税率普通发票合计等于不含税', () => {
    const row = invoice({ taxRate: '0', taxAmount: '0', totalAmount: '1000.00' })
    expect(row.taxAmount).toBe('0.00')
    expect(row.totalAmount).toBe('1000.00')
  })

  it('税率超过 1 拒绝', () => {
    expect(() => invoice({ taxRate: '1.5' })).toThrow(/taxRate/)
  })

  it('不含税金额为 0 拒绝', () => {
    expect(() => invoice({ amountExclTax: '0' })).toThrow(/必须大于 0/)
  })
})

describe('发票:日期与期间约束', () => {
  it('发票日期不在所属期间拒绝', () => {
    expect(() => invoice({ invoiceDate: '2026-02-28' })).toThrow(/不在所属期间/)
  })

  it('期间格式非法拒绝', () => {
    expect(() => invoice({ period: '2026-3' })).toThrow()
  })
})

describe('发票:可抵扣默认规则', () => {
  it('进项专用发票默认可抵扣', () => {
    expect(invoice({ direction: 'input', invoiceType: 'special' }).deductible).toBe(true)
    expect(invoice({ direction: 'input', invoiceType: 'electronic_special' }).deductible).toBe(true)
  })

  it('进项普通发票默认不可抵扣', () => {
    expect(invoice({ direction: 'input', invoiceType: 'general' }).deductible).toBe(false)
  })

  it('销项发票一律不可抵扣', () => {
    expect(invoice({ direction: 'output', invoiceType: 'special' }).deductible).toBe(false)
  })

  it('显式覆盖默认规则', () => {
    expect(
      invoice({ direction: 'input', invoiceType: 'general', deductible: true }).deductible,
    ).toBe(true)
  })
})

describe('银行对账:pickMatch 匹配判据', () => {
  const cand = (id: string, direction: 'in' | 'out', cents: number, date: string): Candidate => ({
    voucherId: id,
    voucherNo: `V-${id}`,
    direction,
    amountCents: cents,
    txnMs: ms(date),
  })

  it('金额相等 + 方向一致 + 窗口内命中', () => {
    const hit = pickMatch(
      { direction: 'in', amountCents: 100000, txnMs: ms('2026-03-05') },
      [cand('a', 'in', 100000, '2026-03-03')],
      new Set(),
      7,
    )
    expect(hit?.voucherId).toBe('a')
  })

  it('金额差 1 分不命中(不做近似匹配)', () => {
    const hit = pickMatch(
      { direction: 'in', amountCents: 100000, txnMs: ms('2026-03-05') },
      [cand('a', 'in', 99999, '2026-03-05')],
      new Set(),
      7,
    )
    expect(hit).toBeNull()
  })

  it('方向相反不命中', () => {
    const hit = pickMatch(
      { direction: 'in', amountCents: 100000, txnMs: ms('2026-03-05') },
      [cand('a', 'out', 100000, '2026-03-05')],
      new Set(),
      7,
    )
    expect(hit).toBeNull()
  })

  it('窗口外 8 天不命中,7 天内命中', () => {
    const s = { direction: 'in' as const, amountCents: 100000, txnMs: ms('2026-03-10') }
    expect(pickMatch(s, [cand('a', 'in', 100000, '2026-03-02')], new Set(), 7)).toBeNull()
    expect(pickMatch(s, [cand('a', 'in', 100000, '2026-03-03')], new Set(), 7)?.voucherId).toBe('a')
    expect(pickMatch(s, [cand('a', 'in', 100000, '2026-03-02')], new Set(), 8)?.voucherId).toBe('a')
  })

  it('多条命中取日期最近的一条', () => {
    const s = { direction: 'in' as const, amountCents: 100000, txnMs: ms('2026-03-10') }
    const hit = pickMatch(
      s,
      [
        cand('far', 'in', 100000, '2026-03-04'),
        cand('near', 'in', 100000, '2026-03-09'),
        cand('mid', 'in', 100000, '2026-03-07'),
      ],
      new Set(),
      7,
    )
    expect(hit?.voucherId).toBe('near')
  })

  it('已占用凭证跳过,顺延到下一条', () => {
    const s = { direction: 'in' as const, amountCents: 100000, txnMs: ms('2026-03-10') }
    const hit = pickMatch(
      s,
      [cand('near', 'in', 100000, '2026-03-09'), cand('far', 'in', 100000, '2026-03-04')],
      new Set(['near']),
      7,
    )
    expect(hit?.voucherId).toBe('far')
  })

  it('全部被占用或全部越窗返回 null(留在 unmatched 等人工)', () => {
    const s = { direction: 'in' as const, amountCents: 100000, txnMs: ms('2026-03-10') }
    expect(pickMatch(s, [cand('a', 'in', 100000, '2026-03-09')], new Set(['a']), 7)).toBeNull()
    expect(pickMatch(s, [], new Set(), 7)).toBeNull()
  })

  it('窗口 0 天只接受同一天', () => {
    const s = { direction: 'in' as const, amountCents: 100000, txnMs: ms('2026-03-10') }
    expect(pickMatch(s, [cand('a', 'in', 100000, '2026-03-09')], new Set(), 0)).toBeNull()
    expect(pickMatch(s, [cand('a', 'in', 100000, '2026-03-10')], new Set(), 0)?.voucherId).toBe('a')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
