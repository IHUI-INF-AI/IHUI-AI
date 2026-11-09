// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// XUI-086: 全仓唯一一张 opType 展示表；三腿（web / RN / 小程序）都只许从这里取语义。
import { describe, expect, it } from 'vitest'
import { resolveWalletFlowMeta } from './wallet-flow-meta'

describe('wallet-flow-meta 唯一表', () => {
  it('0 充值：正、金额、绿', () => {
    expect(resolveWalletFlowMeta(0, 100)).toMatchObject({
      labelKey: 'flowRecharge',
      sign: 'positive',
      kind: 'recharge',
      isMoney: true,
    })
  })

  it('1 扣减 / 2 过期 / 3 退款扣回 / 4 Relay 转账：负、金额、红', () => {
    const cases: Array<[number, string, string]> = [
      [1, 'flowDeduct', 'deduct'],
      [2, 'flowExpire', 'expire'],
      [3, 'flowRefund', 'refund'],
      [4, 'flowRelayRecharge', 'relay'],
    ]
    for (const [opType, labelKey, kind] of cases) {
      const meta = resolveWalletFlowMeta(opType, 100)
      expect(meta).toMatchObject({ labelKey, sign: 'negative', kind, isMoney: true })
      expect(meta.colorClass).toContain('red')
    }
  })

  it('5 管理员调整：看 quantity 自身符号，不写死正负', () => {
    expect(resolveWalletFlowMeta(5, 100)).toMatchObject({ sign: 'positive', isMoney: true })
    expect(resolveWalletFlowMeta(5, -100)).toMatchObject({ sign: 'negative', isMoney: true })
  })

  it('6 API 配额：配额类变动、中性、非金额（无 ±、无金额色）', () => {
    const meta = resolveWalletFlowMeta(6, 500000)
    expect(meta).toMatchObject({
      labelKey: 'flowQuota',
      sign: 'neutral',
      kind: 'quota',
      isMoney: false,
    })
    expect(meta.colorClass).toBe('text-muted-foreground')
  })

  it('未知 opType：中性兜底，不默认收入/支出', () => {
    for (const opType of [99, -1, 7]) {
      const meta = resolveWalletFlowMeta(opType, 100)
      expect(meta).toMatchObject({ labelKey: 'flowOther', sign: 'neutral', kind: 'other' })
      expect(meta.colorClass).toBe('text-muted-foreground')
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
