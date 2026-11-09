// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, expect, it } from 'vitest'

import { formatAmount, formatPhone } from '../format'

describe('XUI-036 formatPhone:先归一化再脱敏', () => {
  it('+86 前缀不再整串透出', () => {
    expect(formatPhone('+8613812345678')).toBe('138****5678')
  })

  it('空格/短横线分隔写法同样脱敏', () => {
    expect(formatPhone('+86 138-1234-5678')).toBe('138****5678')
    expect(formatPhone('138 1234 5678')).toBe('138****5678')
  })

  it('纯 11 位仍按原口径(阴性对照)', () => {
    expect(formatPhone('13812345678')).toBe('138****5678')
  })

  it('非 11 位不误伤,保持原串', () => {
    expect(formatPhone('12345')).toBe('12345')
    expect(formatPhone('')).toBe('')
  })
})

describe('XUI-036 formatAmount:空串不是 0', () => {
  it('空串/空白 ⇒ fallback(不再显示 0.00)', () => {
    expect(formatAmount('')).toBe('—')
    expect(formatAmount('   ')).toBe('—')
  })

  it('undefined/null ⇒ fallback;数字 0 仍显示 0.00(阴性对照)', () => {
    expect(formatAmount(undefined)).toBe('—')
    expect(formatAmount(null)).toBe('—')
    expect(formatAmount(0)).toBe('0.00')
    expect(formatAmount('0')).toBe('0.00')
  })

  it('普通金额保持千分位两位小数', () => {
    expect(formatAmount(1234.5)).toBe('1,234.50')
  })
})
