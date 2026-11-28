// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 技能市场分成：默认 70% 给作者，坏配置回落默认值，金额按分向下取整。
 */
import { afterEach, describe, expect, it } from 'vitest'
import {
  computeSkillRevenueSplit,
  computeSkillSettlementTotals,
  resolveSkillAuthorShareBps,
} from '../src/services/skill-market-purchase-service.js'

const ORIGINAL = process.env.SKILL_MARKET_AUTHOR_SHARE_BPS

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.SKILL_MARKET_AUTHOR_SHARE_BPS
  else process.env.SKILL_MARKET_AUTHOR_SHARE_BPS = ORIGINAL
})

describe('skill market author share bps', () => {
  it('缺省 70%', () => {
    delete process.env.SKILL_MARKET_AUTHOR_SHARE_BPS
    expect(resolveSkillAuthorShareBps()).toBe(7000)
  })

  it('合法比例原样读取，0 是合法值', () => {
    process.env.SKILL_MARKET_AUTHOR_SHARE_BPS = '8000'
    expect(resolveSkillAuthorShareBps()).toBe(8000)
    process.env.SKILL_MARKET_AUTHOR_SHARE_BPS = '0'
    expect(resolveSkillAuthorShareBps()).toBe(0)
  })

  it.each(['-1', '10001', '1.5', 'abc', ''])('坏配置 %s 回落 70%', (value) => {
    process.env.SKILL_MARKET_AUTHOR_SHARE_BPS = value
    expect(resolveSkillAuthorShareBps()).toBe(7000)
  })
})

describe('skill market revenue split', () => {
  it('100 分按 70% 拆分', () => {
    expect(
      computeSkillRevenueSplit({ priceCents: 100, revenueShareBps: 7000, hasSeller: true }),
    ).toEqual({ authorShareCents: 70, platformShareCents: 30 })
  })

  it('无卖家时作者为 0，平台拿全部', () => {
    expect(
      computeSkillRevenueSplit({ priceCents: 100, revenueShareBps: 7000, hasSeller: false }),
    ).toEqual({ authorShareCents: 0, platformShareCents: 100 })
  })

  it('100% 给作者', () => {
    expect(
      computeSkillRevenueSplit({ priceCents: 99, revenueShareBps: 10000, hasSeller: true }),
    ).toEqual({ authorShareCents: 99, platformShareCents: 0 })
  })

  it('除不尽向下取整，平台不留小数', () => {
    expect(
      computeSkillRevenueSplit({ priceCents: 99, revenueShareBps: 7000, hasSeller: true }),
    ).toEqual({ authorShareCents: 69, platformShareCents: 30 })
  })

  it('0 元不产生金额', () => {
    expect(
      computeSkillRevenueSplit({ priceCents: 0, revenueShareBps: 7000, hasSeller: true }),
    ).toEqual({ authorShareCents: 0, platformShareCents: 0 })
  })
})

describe('skill market settlement totals', () => {
  const base = {
    paidCount: 0,
    refundedCount: 0,
    grossSalesCents: 0,
    refundedGrossCents: 0,
    authorShareEarnedCents: 0,
    authorShareOnRefundedCents: 0,
    sellerClawbackCents: 0,
    platformShareEarnedCents: 0,
    platformShareOnRefundedCents: 0,
    clawbackMissingCount: 0,
  }

  it('只有一笔在购：成交、作者、平台三账相等', () => {
    const result = computeSkillSettlementTotals({
      ...base,
      paidCount: 1,
      grossSalesCents: 100,
      authorShareEarnedCents: 70,
      platformShareEarnedCents: 30,
    })
    expect(result.netGmvCents).toBe(100)
    expect(result.authorNetCents).toBe(70)
    expect(result.platformNetCents).toBe(30)
    expect(result.authorNetCents + result.platformNetCents).toBe(result.netGmvCents)
  })

  it('全额退款且卖家全额扣回：三账归零', () => {
    const result = computeSkillSettlementTotals({
      ...base,
      paidCount: 1,
      refundedCount: 1,
      grossSalesCents: 200,
      refundedGrossCents: 100,
      authorShareEarnedCents: 140,
      authorShareOnRefundedCents: 70,
      sellerClawbackCents: 70,
      platformShareEarnedCents: 60,
      platformShareOnRefundedCents: 30,
    })
    expect(result.netGmvCents).toBe(100)
    expect(result.authorShareActiveCents).toBe(70)
    expect(result.platformShareActiveCents).toBe(30)
    expect(result.platformBorneCents).toBe(0)
    expect(result.authorNetCents).toBe(70)
    expect(result.platformNetCents).toBe(30)
    expect(result.authorNetCents + result.platformNetCents).toBe(result.netGmvCents)
  })

  it('卖家余额为 0 未扣回：平台承担全部作者分成', () => {
    const result = computeSkillSettlementTotals({
      ...base,
      paidCount: 1,
      refundedCount: 1,
      grossSalesCents: 100,
      refundedGrossCents: 100,
      authorShareEarnedCents: 70,
      authorShareOnRefundedCents: 70,
      sellerClawbackCents: 0,
      platformShareEarnedCents: 30,
      platformShareOnRefundedCents: 30,
    })
    expect(result.netGmvCents).toBe(0)
    expect(result.authorNetCents).toBe(70)
    expect(result.platformBorneCents).toBe(70)
    expect(result.platformNetCents).toBe(-70)
    expect(result.authorNetCents + result.platformNetCents).toBe(result.netGmvCents)
  })

  it('部分扣回：作者留存与平台承担相加等于退款损失', () => {
    const result = computeSkillSettlementTotals({
      ...base,
      paidCount: 1,
      refundedCount: 1,
      grossSalesCents: 100,
      refundedGrossCents: 100,
      authorShareEarnedCents: 70,
      authorShareOnRefundedCents: 70,
      sellerClawbackCents: 20,
      platformShareEarnedCents: 30,
      platformShareOnRefundedCents: 30,
    })
    expect(result.authorNetCents).toBe(50)
    expect(result.platformBorneCents).toBe(50)
    expect(result.platformNetCents).toBe(-50)
    expect(result.authorNetCents + result.platformNetCents).toBe(result.netGmvCents)
  })

  it('历史退款缺扣回记录单独计数，不被静默当成 0', () => {
    const result = computeSkillSettlementTotals({
      ...base,
      refundedCount: 1,
      grossSalesCents: 100,
      refundedGrossCents: 100,
      authorShareEarnedCents: 70,
      authorShareOnRefundedCents: 70,
      platformShareEarnedCents: 30,
      platformShareOnRefundedCents: 30,
      clawbackMissingCount: 1,
    })
    expect(result.clawbackMissingCount).toBe(1)
    expect(result.platformBorneCents).toBe(70)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
