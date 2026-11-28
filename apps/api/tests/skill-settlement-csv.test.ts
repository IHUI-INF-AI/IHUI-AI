import { describe, expect, it } from 'vitest'
import type { SkillMarketSettlementResponse } from '@ihui/shared/skills/market'
import {
  buildSkillMarketSettlementCsv,
  settlementCsvFilename,
} from '../src/services/skill-settlement-csv.js'
import { getSettlementMonthBounds } from '../src/services/skill-market-purchase-service.js'

describe('settlement month bounds', () => {
  it('2026-11 按 Asia/Shanghai 自然月切到 UTC', () => {
    const { start, end } = getSettlementMonthBounds('2026-11')
    expect(start.toISOString()).toBe('2026-10-31T16:00:00.000Z')
    expect(end.toISOString()).toBe('2026-11-30T16:00:00.000Z')
  })

  it('12 月跨年终点正确', () => {
    const { start, end } = getSettlementMonthBounds('2026-12')
    expect(start.toISOString()).toBe('2026-11-30T16:00:00.000Z')
    expect(end.toISOString()).toBe('2026-12-31T16:00:00.000Z')
  })
})

describe('settlement CSV', () => {
  const data: SkillMarketSettlementResponse = {
    period: {
      month: '2026-11',
      from: '2026-10-31T16:00:00.000Z',
      to: '2026-11-30T16:00:00.000Z',
    },
    currency: 'CNY',
    summary: {
      paidCount: 2,
      refundedCount: 1,
      grossSalesCents: 300,
      refundedGrossCents: 100,
      netGmvCents: 200,
      authorShareEarnedCents: 210,
      authorShareActiveCents: 140,
      authorShareOnRefundedCents: 70,
      sellerClawbackCents: 20,
      platformBorneCents: 50,
      authorNetCents: 190,
      platformShareEarnedCents: 90,
      platformShareActiveCents: 60,
      platformShareOnRefundedCents: 30,
      platformNetCents: 10,
      clawbackMissingCount: 1,
    },
    items: [
      {
        skillName: '=SUM(A1)',
        sellerUserId: 'seller-1',
        sellerNickname: '测试,卖家',
        paidCount: 2,
        refundedCount: 1,
        grossSalesCents: 300,
        refundedGrossCents: 100,
        netGmvCents: 200,
        authorShareEarnedCents: 210,
        authorShareActiveCents: 140,
        authorShareOnRefundedCents: 70,
        sellerClawbackCents: 20,
        platformBorneCents: 50,
        authorNetCents: 190,
        platformShareEarnedCents: 90,
        platformShareActiveCents: 60,
        platformShareOnRefundedCents: 30,
        platformNetCents: 10,
        clawbackMissingCount: 1,
      },
    ],
  }

  it('带 BOM，汇总与明细都有，金额按元保留两位', () => {
    const csv = buildSkillMarketSettlementCsv(data, {
      exportedAt: new Date('2026-11-28T02:00:00.000Z'),
    })
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('账期,2026-11')
    expect(csv).toContain('净成交(元),2.00')
    expect(csv).toContain('作者净分成(元),1.90')
    expect(csv).toContain('平台净收益(元),0.10')
    expect(csv).toContain('平台承担(元),0.50')
    expect(csv).toContain('技能,卖家ID,卖家昵称')
  })

  it('公式开头文本被钝化，含逗号字段正确加引号', () => {
    const csv = buildSkillMarketSettlementCsv(data)
    expect(csv).toContain('\'=SUM(A1),seller-1,"测试,卖家"')
  })

  it('文件名按账期或全部账期', () => {
    expect(settlementCsvFilename('2026-11')).toBe('skill-market-settlement-2026-11.csv')
    expect(settlementCsvFilename(null, new Date('2026-11-28T00:00:00Z'))).toBe(
      'skill-market-settlement-all-20261128.csv',
    )
  })
})
