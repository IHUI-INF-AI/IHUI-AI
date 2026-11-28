// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 发布计费单价解析：免费期默认 0，坏配置必须回落 0，不能把负数/NaN 写进账本。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { resolvePublishUnitPriceCents } from '../src/services/publish-usage-service.js'

const ORIGINAL = process.env.PUBLISH_TASK_UNIT_PRICE_CENTS

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.PUBLISH_TASK_UNIT_PRICE_CENTS
  else process.env.PUBLISH_TASK_UNIT_PRICE_CENTS = ORIGINAL
})

describe('publish usage pricing', () => {
  it('免费期默认 0 分', () => {
    delete process.env.PUBLISH_TASK_UNIT_PRICE_CENTS
    expect(resolvePublishUnitPriceCents()).toBe(0)
  })

  it('合法正整数按分读取', () => {
    process.env.PUBLISH_TASK_UNIT_PRICE_CENTS = '5'
    expect(resolvePublishUnitPriceCents()).toBe(5)
  })

  it.each(['-1', '1.5', 'abc', ''])('坏配置 %s 回落 0', (value) => {
    process.env.PUBLISH_TASK_UNIT_PRICE_CENTS = value
    expect(resolvePublishUnitPriceCents()).toBe(0)
  })
})
