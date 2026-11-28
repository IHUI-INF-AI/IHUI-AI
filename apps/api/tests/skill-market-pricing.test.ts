// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 技能市场分成：默认 70% 给作者，坏配置回落默认值，金额按分向下取整。
 */
import { afterEach, describe, expect, it } from 'vitest'
import {
  computeSkillRevenueSplit,
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
