// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-633 回归锁(2026-11-14):充值赠送先按整「元」取整再折分,带角分充值会多/少送。
 *
 * 口径:actualCredit 与实付额的差必须等于真实赠送额(分),元级取整残差不得被当成赠送。
 * 默认阶梯(1.2 倍 + 20 元)下 100.50 元应到账 140.60 元 = 赠送 40.10 元(4010 分);
 * 修复前 Math.round(100.5 * 1.2) + 20 = 141 元 ⇒ 多送 40 分。
 *
 * 不连库:system_configs 查询返回空行 ⇒ 走 DEFAULT_CONFIG。
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../db/index.js', () => {
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: () => Promise.resolve([] as unknown[]),
  }
  return {
    db: { select: vi.fn(() => chain), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
    dbRead: { select: vi.fn(() => chain) },
    dbClient: {},
  }
})

vi.mock('@ihui/database', () => ({
  systemConfigs: { key: 'key', value: 'value' },
}))

import { calculateTopupBonus } from '../topup-discount-service.js'

/** 与 order-service 的赠送折算口径一致:赠送(分)= round((到账 - 实付) × 100)。 */
function bonusCentsOf(actualCredit: number, paidYuan: number): number {
  return Math.round((actualCredit - paidYuan) * 100)
}

describe('F-633 充值赠送按分取整', () => {
  it('100.50 元命中 1.2/20 档 ⇒ 到账 140.60 元,赠送 4010 分(不多送元级残差)', async () => {
    const r = await calculateTopupBonus(100.5, 'alipay')
    expect(r.multiplier).toBe(1.2)
    expect(r.bonus).toBe(20)
    expect(r.actualCredit).toBe(140.6)
    expect(bonusCentsOf(r.actualCredit, 100.5)).toBe(4010)
  })

  it('未命中档位(乘数=1)时 99.50 元 ⇒ 到账 99.50 元,赠送 0 分', async () => {
    const r = await calculateTopupBonus(99.5, 'alipay')
    expect(r.multiplier).toBe(1)
    expect(r.bonus).toBe(0)
    expect(r.actualCredit).toBe(99.5)
    expect(bonusCentsOf(r.actualCredit, 99.5)).toBe(0)
  })

  it('整元充值口径不变:500 元命中 1.5/80 档 ⇒ 到账 830 元', async () => {
    const r = await calculateTopupBonus(500, 'alipay')
    expect(r.actualCredit).toBe(830)
    expect(bonusCentsOf(r.actualCredit, 500)).toBe(33000)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
