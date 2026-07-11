import { describe, it, expect } from 'vitest'
import {
  Money,
  MoneyError,
  MoneyValidator,
  sumMoney,
  splitMoney,
  type RoundingMode,
} from '../src/utils/money'

describe('Money 基础构造', () => {
  it('fromYuan 字符串解析为分', () => {
    expect(Money.fromYuan('9.99').toFen()).toBe(999n)
    expect(Money.fromYuan('0.01').toFen()).toBe(1n)
    expect(Money.fromYuan('100').toFen()).toBe(10000n)
    expect(Money.fromYuan('0.1').toFen()).toBe(10n)
  })

  it('fromYuan number 解析为分', () => {
    expect(Money.fromYuan(9.99).toFen()).toBe(999n)
    expect(Money.fromYuan(0).toFen()).toBe(0n)
  })

  it('fromFen 直接以分构造', () => {
    expect(Money.fromFen(999n).toFen()).toBe(999n)
    expect(Money.fromFen('12345').toFen()).toBe(12345n)
    expect(Money.fromFen(0).toFen()).toBe(0n)
  })

  it('负数金额正确解析', () => {
    expect(Money.fromYuan('-9.99').toFen()).toBe(-999n)
    expect(Money.fromFen(-100n).toFen()).toBe(-100n)
  })

  it('分以下精度截断 (ROUND_DOWN)', () => {
    // 1.999 元 → 199 分 (截断而非四舍五入)
    expect(Money.fromYuan('1.999').toFen()).toBe(199n)
    expect(Money.fromYuan('0.009').toFen()).toBe(0n)
  })

  it('空/非法金额抛 MoneyError', () => {
    expect(() => Money.fromYuan('')).toThrow(MoneyError)
    expect(() => Money.fromYuan('abc')).toThrow(MoneyError)
    expect(() => Money.fromFen(1.5)).toThrow(MoneyError)
    expect(() => Money.fromFen(NaN)).toThrow(MoneyError)
  })
})

describe('Money 输出格式', () => {
  it('toYuan 保留 2 位小数', () => {
    expect(Money.fromFen(999n).toYuan()).toBe('9.99')
    expect(Money.fromFen(1n).toYuan()).toBe('0.01')
    expect(Money.fromFen(10000n).toYuan()).toBe('100.00')
    expect(Money.fromFen(0n).toYuan()).toBe('0.00')
  })

  it('toYuan 负数格式', () => {
    expect(Money.fromFen(-999n).toYuan()).toBe('-9.99')
    expect(Money.fromFen(-5n).toYuan()).toBe('-0.05')
  })

  it('toFenNumber 在安全整数范围内', () => {
    expect(Money.fromYuan('100').toFenNumber()).toBe(10000)
  })

  it('toString 包含币种与金额', () => {
    expect(Money.fromYuan('9.99').toString()).toBe('CNY 9.99')
    expect(Money.fromYuan('10', 'USD').toString()).toBe('USD 10.00')
  })
})

describe('Money 算术运算', () => {
  it('add 同币种相加', () => {
    expect(Money.fromYuan('1.50').add(Money.fromYuan('2.50')).toFen()).toBe(400n)
  })

  it('sub 同币种相减', () => {
    expect(Money.fromYuan('5.00').sub(Money.fromYuan('1.50')).toFen()).toBe(350n)
  })

  it('add/sub 跨币种抛错', () => {
    const cny = Money.fromYuan('1.00', 'CNY')
    const usd = Money.fromYuan('1.00', 'USD')
    expect(() => cny.add(usd)).toThrow(MoneyError)
    expect(() => cny.sub(usd)).toThrow(MoneyError)
  })

  it('negate / abs', () => {
    const m = Money.fromYuan('-5.00')
    expect(m.negate().toFen()).toBe(500n)
    expect(m.abs().toFen()).toBe(500n)
    expect(Money.fromYuan('5.00').abs().toFen()).toBe(500n)
  })

  it('比较运算 lt/lte/gt/gte/equals', () => {
    const a = Money.fromYuan('1.00')
    const b = Money.fromYuan('2.00')
    expect(a.lt(b)).toBe(true)
    expect(a.lte(b)).toBe(true)
    expect(b.gt(a)).toBe(true)
    expect(b.gte(a)).toBe(true)
    expect(a.equals(Money.fromYuan('1.00'))).toBe(true)
  })

  it('isZero/isPositive/isNegative', () => {
    expect(Money.fromYuan('0').isZero()).toBe(true)
    expect(Money.fromYuan('1').isPositive()).toBe(true)
    expect(Money.fromYuan('-1').isNegative()).toBe(true)
  })
})

describe('Money 乘除法与银行家舍入', () => {
  it('mul 整数系数', () => {
    expect(Money.fromYuan('10.00').mul(3).toFen()).toBe(3000n)
  })

  it('mul 小数系数 HALF_EVEN (银行家舍入)', () => {
    // 10.00 * 0.85 = 8.50
    expect(Money.fromYuan('10.00').mul('0.85').toYuan()).toBe('8.50')
    // 10.05 * 0.85 = 8.5425 → 银行家舍入到 8.54 (偶数)
    expect(Money.fromYuan('10.05').mul('0.85').toYuan()).toBe('8.54')
  })

  it('mul HALF_UP 模式', () => {
    // 10.05 * 0.85 = 8.5425 → HALF_UP → 8.54 (0.425 < 0.5 截断)
    expect(
      Money.fromYuan('10.05')
        .mul('0.85', 'HALF_UP' as RoundingMode)
        .toYuan(),
    ).toBe('8.54')
    // 10.06 * 0.85 = 8.551 → HALF_UP → 8.55 (0.51 > 0.5 进位)
    expect(
      Money.fromYuan('10.06')
        .mul('0.85', 'HALF_UP' as RoundingMode)
        .toYuan(),
    ).toBe('8.55')
  })

  it('mul DOWN 模式 (截断)', () => {
    // 10.99 * 0.85 = 9.3415 → DOWN → 9.34
    expect(
      Money.fromYuan('10.99')
        .mul('0.85', 'DOWN' as RoundingMode)
        .toYuan(),
    ).toBe('9.34')
  })

  it('div 除法', () => {
    // 10.00 / 3 = 3.333... → 银行家舍入 → 3.33
    expect(Money.fromYuan('10.00').div(3).toYuan()).toBe('3.33')
    // 10.00 / 4 = 2.50
    expect(Money.fromYuan('10.00').div(4).toYuan()).toBe('2.50')
  })

  it('div 除数为零抛错', () => {
    expect(() => Money.fromYuan('10.00').div(0)).toThrow(MoneyError)
  })

  it('银行家舍入: 0.5 舍入到偶数', () => {
    // 5 分 / 2 = 2.5 分 → HALF_EVEN → 2 (偶数)
    expect(Money.fromFen(5n).div(2).toFen()).toBe(2n)
    // 7 分 / 2 = 3.5 分 → HALF_EVEN → 4 (偶数)
    expect(Money.fromFen(7n).div(2).toFen()).toBe(4n)
  })
})

describe('sumMoney', () => {
  it('同币种求和', () => {
    const items = [Money.fromYuan('1.00'), Money.fromYuan('2.50'), Money.fromYuan('0.50')]
    expect(sumMoney(items).toFen()).toBe(400n)
  })

  it('空数组返回零', () => {
    expect(sumMoney([]).toFen()).toBe(0n)
  })

  it('跨币种抛错', () => {
    const items = [Money.fromYuan('1.00', 'CNY'), Money.fromYuan('1.00', 'USD')]
    expect(() => sumMoney(items)).toThrow(MoneyError)
  })
})

describe('splitMoney 分账', () => {
  it('按比例分账，余数补末项', () => {
    // 100 元 按 1:2:3 分 → 16.67 + 33.33 + 50.00 = 100.00
    const parts = splitMoney(Money.fromYuan('100'), [1, 2, 3])
    expect(parts).toHaveLength(3)
    const total = parts.reduce((acc, p) => acc.add(p), Money.zero())
    expect(total.toFen()).toBe(10000n)
  })

  it('分账总和等于原金额 (无精度丢失)', () => {
    // 10 元 按 1:1:1 分 → 3.33 + 3.33 + 3.34 = 10.00
    const parts = splitMoney(Money.fromYuan('10'), [1, 1, 1])
    const total = parts.reduce((acc, p) => acc.add(p), Money.zero())
    expect(total.toFen()).toBe(1000n)
  })

  it('单个比例全额返回', () => {
    const parts = splitMoney(Money.fromYuan('99.99'), [1])
    expect(parts).toHaveLength(1)
    expect(parts[0].toFen()).toBe(9999n)
  })

  it('空比例抛错', () => {
    expect(() => splitMoney(Money.fromYuan('100'), [])).toThrow(MoneyError)
  })

  it('比例之和为 0 抛错', () => {
    expect(() => splitMoney(Money.fromYuan('100'), [0, 0])).toThrow(MoneyError)
  })

  it('非归一化比例正确分账', () => {
    // 100 元 按 30:70 分 (未归一化)
    const parts = splitMoney(Money.fromYuan('100'), [30, 70])
    expect(parts[0].toYuan()).toBe('30.00')
    expect(parts[1].toYuan()).toBe('70.00')
  })
})

describe('MoneyValidator', () => {
  it('默认拒绝零和负数', () => {
    const v = new MoneyValidator()
    expect(v.validate(Money.fromYuan('0'))).toBe(false)
    expect(v.validate(Money.fromYuan('-1'))).toBe(false)
    expect(v.validate(Money.fromYuan('1'))).toBe(true)
  })

  it('allowZero 允许零', () => {
    const v = new MoneyValidator({ allowZero: true })
    expect(v.validate(Money.fromYuan('0'))).toBe(true)
  })

  it('allowNegative 允许负数', () => {
    const v = new MoneyValidator({ allowNegative: true })
    expect(v.validate(Money.fromYuan('-5'))).toBe(true)
  })

  it('min/max 范围校验', () => {
    const v = new MoneyValidator({
      min: Money.fromYuan('1.00'),
      max: Money.fromYuan('100.00'),
    })
    expect(v.validate(Money.fromYuan('0.50'))).toBe(false)
    expect(v.validate(Money.fromYuan('50.00'))).toBe(true)
    expect(v.validate(Money.fromYuan('150.00'))).toBe(false)
  })

  it('统计 checked/rejected', () => {
    const v = new MoneyValidator({ min: Money.fromYuan('1.00') })
    v.validate(Money.fromYuan('0.50'))
    v.validate(Money.fromYuan('5.00'))
    const stats = v.getStats()
    expect(stats.checked).toBe(2)
    expect(stats.rejected).toBe(1)
  })
})

describe('Money quantize', () => {
  it('quantize 返回等价实例 (内部已为整数分)', () => {
    const m = Money.fromYuan('9.99')
    const q = m.quantize()
    expect(q.toFen()).toBe(m.toFen())
  })
})
