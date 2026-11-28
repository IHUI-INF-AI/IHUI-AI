// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * BankCard 写存储纯函数夹具（2026-11-27）。
 * 数据库路径由 API typecheck + 路由测试覆盖；这里锁定卡号归一化/掩码/合并的边界。
 */
import { describe, expect, it } from 'vitest'
import {
  mergeBankCards,
  maskBankCardNumber,
  normalizeBankCardNumber,
  passesLuhn,
  sortStoredBankCards,
  toBankCardItem,
  type StoredBankCard,
} from '../bank-card-store.js'

const valid = '4111 1111 1111 1111'

function card(overrides: Partial<StoredBankCard> = {}): StoredBankCard {
  return {
    id: 'c1',
    number: '4111111111111111',
    holder: '张三',
    bankName: '测试银行',
    isDefault: false,
    createdAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('normalizeBankCardNumber / passesLuhn', () => {
  it('接受带空格/连字符的合法 Luhn 卡号', () => {
    expect(normalizeBankCardNumber(valid)).toBe('4111111111111111')
    expect(normalizeBankCardNumber('4111-1111-1111-1111')).toBe('4111111111111111')
  })

  it('拒绝非数字、过短/过长、Luhn 不合法', () => {
    expect(normalizeBankCardNumber('4111 1111 1111 111X')).toBeNull()
    expect(normalizeBankCardNumber('12345678901')).toBeNull()
    expect(normalizeBankCardNumber('41111111111111111111')).toBeNull()
    expect(normalizeBankCardNumber('4111111111111112')).toBeNull()
    expect(passesLuhn('4111111111111111')).toBe(true)
  })
})

describe('maskBankCardNumber / toBankCardItem', () => {
  it('只回传末四位，不泄露完整卡号', () => {
    expect(maskBankCardNumber('4111111111111111')).toBe('**** **** **** 1111')
    const dto = toBankCardItem(card())
    expect(dto).toEqual({
      id: 'c1',
      number: '**** **** **** 1111',
      holder: '张三',
      bankName: '测试银行',
      isDefault: false,
    })
    expect(JSON.stringify(dto)).not.toContain('4111111111111111')
  })
})

describe('mergeBankCards / sortStoredBankCards', () => {
  it('默认卡排最前，历史投影按掩码卡号去重', () => {
    const stored = [
      card({ id: 'a', isDefault: false, createdAt: '2026-11-02T00:00:00.000Z' }),
      card({ id: 'b', isDefault: true, createdAt: '2026-11-01T00:00:00.000Z' }),
    ]
    const projected = [
      {
        id: 'history-a',
        number: '**** **** **** 1111',
        holder: '张三',
        bankName: '测试银行',
        isDefault: false,
      },
      {
        id: 'history-c',
        number: '**** **** **** 2222',
        holder: '李四',
        bankName: '另一银行',
        isDefault: false,
      },
    ]
    const merged = mergeBankCards(stored, projected, 3)
    expect(merged.map((item) => item.id)).toEqual(['b', 'a', 'history-c'])
  })

  it('容量上限按合并后截断，排序默认优先且新卡在前', () => {
    const cards = [
      card({ id: 'old', isDefault: false, createdAt: '2026-11-01T00:00:00.000Z' }),
      card({ id: 'new', isDefault: false, createdAt: '2026-11-03T00:00:00.000Z' }),
      card({ id: 'def', isDefault: true, createdAt: '2026-10-01T00:00:00.000Z' }),
    ]
    expect(sortStoredBankCards(cards).map((item) => item.id)).toEqual(['def', 'new', 'old'])
    expect(mergeBankCards(cards, [], 2).map((item) => item.id)).toEqual(['def', 'new'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
