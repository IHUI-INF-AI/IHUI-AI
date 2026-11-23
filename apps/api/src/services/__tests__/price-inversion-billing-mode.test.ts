// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { salePricePer1k } from '../model-price-resolver.js'

/**
 * 售价倒挂的计费模式边界回归(2026-11-23):
 *
 * xai `grok-imagine-image` / `grok-imagine-video` 等行 `billing_mode=per_image|per_video`,
 * 真实收费在 `ai_pricing.per_unit_price`(分/张、分/秒),token 价列恒为 0 是合法状态。
 * 零价清扫链若只按 token 列判断,会把这些行当"未定价"错误下架;三源回填链也可能把
 * 非 token 价目写进 CNY/千 token 列。三条链路必须同一边界:`billing_mode` 非 token 不参与
 * token 价扫描/回填。
 */
const resolverSrc = readFileSync(new URL('../model-price-resolver.ts', import.meta.url), 'utf8')
const adminSrc = readFileSync(new URL('../model-pricing-admin.ts', import.meta.url), 'utf8')
const seedSrc = readFileSync(
  new URL('../../../../../packages/database/seed/relay-pricing-seed.ts', import.meta.url),
  'utf8',
)

describe('售价倒挂 — 非 token 计费模式边界', () => {
  it('零价清扫扫描排除 per_call/per_image/per_video/dynamic_cost', () => {
    expect(resolverSrc).toContain(
      "billing_mode in ('dynamic_cost', 'per_call', 'per_image', 'per_video')",
    )
  })

  it('配置价回填源只认 token/null 计费模式', () => {
    expect(adminSrc).toContain("billing_mode is null or billing_mode = 'token'")
  })

  it('种子回填源只认 token/null 计费模式', () => {
    expect(seedSrc).toContain("billing_mode IS NULL OR billing_mode = 'token'")
  })
})

describe('售价倒挂 — 成本下限与官方 free 冲突', () => {
  it('售价 = max(解析成本, 本地已有成本) × 3', () => {
    expect(salePricePer1k(0.36)).toBe(1.08)
    expect(salePricePer1k(0.0432, 0.36)).toBe(1.08)
    expect(salePricePer1k(0.36, 0.0432)).toBe(1.08)
    expect(salePricePer1k(0)).toBe(0)
  })

  it('配置价回填也必须乘利润系数并落成本列', () => {
    expect(adminSrc).toContain(
      'round((greatest(coalesce(m.cost_input_price_per_1k, 0), s.pin) * ${PROFIT_FACTOR})',
    )
    expect(adminSrc).toContain('greatest(coalesce(m.cost_input_price_per_1k, 0), s.pin)')
  })

  it('官方 free 遇本地成本走保底档,不白送', () => {
    expect(resolverSrc).toContain('official-free-cost-guard')
    expect(resolverSrc).toContain('freeCostGuard')
  })
})

describe('售价倒挂 — 0x 免费档不得被目录价回填成正价', () => {
  it('配置价回填扫描与更新都排除 points_multiplier<=0', () => {
    expect(adminSrc).toContain('coalesce(m.points_multiplier, 1) > 0')
  })

  it('种子回填排除 0x 与 relay_price_multiplier=0.0000', () => {
    expect(seedSrc).toContain('coalesce(m.points_multiplier, 1) > 0')
    expect(seedSrc).toContain("coalesce(m.relay_price_multiplier, '1.0000') NOT IN ('0', '0.0000')")
  })

  it('重定价/清扫/官方价应用不得覆盖 0x 行', () => {
    expect(resolverSrc).toContain('coalesce(m.points_multiplier, 1) > 0')
    expect(resolverSrc).toContain('coalesce(points_multiplier, 1) > 0')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
