/**
 * Money 精度工具 (bug133)。
 *
 * 迁移自旧架构 server/app/utils/bug133_money_precision.py。
 *
 * 设计要点：
 * 1. 所有金额内部以"分"(integer cent) 的 bigint 存储，彻底避免 float 精度丢失。
 * 2. 强类型 Money 包装，防止与 number 直接混算。
 * 3. 加减乘除全部基于整数分运算；乘除使用银行家舍入 (HALF_EVEN)。
 * 4. 提供 fromYuan / fromFen / toFen / toYuan / quantize / sumMoney / splitMoney。
 * 5. splitMoney 按比例分账，余数补到末项，保证 sum(parts) === total。
 */

import { AppError } from '../errors/AppError.js'

export class MoneyError extends AppError {
  constructor(message: string) {
    super(message, 400, 'INVALID_MONEY')
    this.name = 'MoneyError'
  }
}

export type RoundingMode = 'HALF_UP' | 'DOWN' | 'HALF_EVEN'

const FEN_PER_YUAN = 100n

/** 将 bigint/数字/字符串解析为整数分 (不接受小数数字, 小数请用 fromYuan)。 */
function toBigInt(value: bigint | number | string): bigint {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new MoneyError(`无效的数字: ${value}`)
    if (!Number.isInteger(value)) {
      throw new MoneyError(`期望整数分, 收到 ${value}; 请用 fromYuan 处理小数`)
    }
    return BigInt(value)
  }
  const trimmed = value.trim()
  if (!/^-?\d+$/.test(trimmed)) throw new MoneyError(`无法解析为整数分: ${value}`)
  return BigInt(trimmed)
}

/** 将元 (string | number) 解析为分 bigint, 防止 float 串入精度。 */
function parseYuanToFen(yuan: string | number): bigint {
  const s = typeof yuan === 'number' ? String(yuan) : yuan.trim()
  if (s === '') throw new MoneyError('空金额')
  const neg = s.startsWith('-')
  const positive = neg ? s.slice(1) : s
  const dotIdx = positive.indexOf('.')
  let intPart: string
  let fracPart: string
  if (dotIdx === -1) {
    intPart = positive
    fracPart = ''
  } else {
    intPart = positive.slice(0, dotIdx)
    fracPart = positive.slice(dotIdx + 1)
  }
  if (intPart === '' && fracPart === '') throw new MoneyError(`无法解析金额: ${yuan}`)
  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(fracPart)) {
    throw new MoneyError(`无法解析金额: ${yuan}`)
  }
  // 分以下精度直接截断 (与 Python ROUND_DOWN 一致)
  if (fracPart.length === 0) fracPart = '00'
  else if (fracPart.length === 1) fracPart = fracPart + '0'
  else if (fracPart.length > 2) fracPart = fracPart.slice(0, 2)
  const fen = BigInt(intPart || '0') * FEN_PER_YUAN + BigInt(fracPart)
  return neg ? -fen : fen
}

/** 将系数 (number | string) 解析为 numerator/denominator, 避免浮点误差。 */
function parseFactor(factor: number | string): { num: bigint; den: bigint } {
  const s = typeof factor === 'number' ? String(factor) : factor.trim()
  if (s === '') throw new MoneyError('空系数')
  const neg = s.startsWith('-')
  const positive = neg ? s.slice(1) : s
  const dotIdx = positive.indexOf('.')
  let intPart: string
  let fracPart: string
  if (dotIdx === -1) {
    intPart = positive
    fracPart = ''
  } else {
    intPart = positive.slice(0, dotIdx)
    fracPart = positive.slice(dotIdx + 1)
  }
  if (intPart === '' && fracPart === '') throw new MoneyError(`无法解析系数: ${factor}`)
  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(fracPart)) {
    throw new MoneyError(`无法解析系数: ${factor}`)
  }
  const den = 10n ** BigInt(fracPart.length)
  const num = BigInt(intPart || '0') * den + (fracPart ? BigInt(fracPart) : 0n)
  return { num: neg ? -num : num, den }
}

/** 银行家舍入 (HALF_EVEN, 四舍六入五成双) 计算 numerator / denominator。 */
function bankerRound(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new MoneyError('除数为零')
  const q = numerator / denominator
  const r = numerator - q * denominator
  const twiceR = r * 2n
  // |2r| < |denominator| → 截断
  if (twiceR < 0n ? -twiceR < denominator : twiceR < denominator) {
    return q
  }
  // |2r| > |denominator| → 远离零
  if (twiceR < 0n ? -twiceR > denominator : twiceR > denominator) {
    return numerator >= 0n ? q + 1n : q - 1n
  }
  // 恰好为一半 → 舍入到偶数
  if (q % 2n === 0n) return q
  return numerator >= 0n ? q + 1n : q - 1n
}

/** 按指定模式舍入 numerator / denominator。 */
function roundByMode(mode: RoundingMode, numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new MoneyError('除数为零')
  switch (mode) {
    case 'DOWN': {
      // bigint 除法本身向零截断
      return numerator / denominator
    }
    case 'HALF_UP': {
      const q = numerator / denominator
      const r = numerator - q * denominator
      const absTwiceR = r < 0n ? -r * 2n : r * 2n
      if (absTwiceR >= denominator) {
        return numerator >= 0n ? q + 1n : q - 1n
      }
      return q
    }
    case 'HALF_EVEN':
    default:
      return bankerRound(numerator, denominator)
  }
}

/**
 * 金额强类型包装 (内部以"分"为单位的 bigint)。
 *
 * @example
 * const price = Money.fromYuan('9.99');
 * const total = price.mul(3);            // 29.97
 * const fen = total.toFen();             // 2997n
 * const [a, b] = splitMoney(total, [1, 2]); // 按比例分账
 */
export class Money {
  readonly fen: bigint
  readonly currency: string

  constructor(fen: bigint | number | string, currency = 'CNY') {
    this.fen = toBigInt(fen)
    this.currency = currency
  }

  static zero(currency = 'CNY'): Money {
    return new Money(0n, currency)
  }

  /** 由元 (string/number) 构造, 自动转为分。 */
  static fromYuan(yuan: string | number, currency = 'CNY'): Money {
    return new Money(parseYuanToFen(yuan), currency)
  }

  /** 由分 (bigint/number/string) 构造。 */
  static fromFen(fen: bigint | number | string, currency = 'CNY'): Money {
    return new Money(toBigInt(fen), currency)
  }

  /** 返回整数分 (bigint)。 */
  toFen(): bigint {
    return this.fen
  }

  /** 返回整数分 (number), 仅在安全整数范围内使用。 */
  toFenNumber(): number {
    return Number(this.fen)
  }

  /** 返回元字符串 (保留 2 位小数), 避免浮点。 */
  toYuan(): string {
    const neg = this.fen < 0n
    const abs = neg ? -this.fen : this.fen
    const intPart = abs / FEN_PER_YUAN
    const frac = abs - intPart * FEN_PER_YUAN
    const fracStr = frac < 10n ? `0${frac.toString()}` : frac.toString()
    return `${neg ? '-' : ''}${intPart.toString()}.${fracStr}`
  }

  /** 返回元 (number), 仅用于展示/日志, 不参与计算。 */
  toYuanNumber(): number {
    return Number(this.fen) / 100
  }

  /**
   * 量化到 0.01 元 (1 分) 精度。
   * 内部已为整数分, 故直接返回等价实例; 保留该方法以兼容旧 API。
   */
  quantize(_mode: RoundingMode = 'HALF_EVEN'): Money {
    return new Money(this.fen, this.currency)
  }

  isZero(): boolean {
    return this.fen === 0n
  }

  isPositive(): boolean {
    return this.fen > 0n
  }

  isNegative(): boolean {
    return this.fen < 0n
  }

  private checkCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new MoneyError(`币种不一致: ${this.currency} vs ${other.currency}`)
    }
  }

  add(other: Money): Money {
    this.checkCurrency(other)
    return new Money(this.fen + other.fen, this.currency)
  }

  sub(other: Money): Money {
    this.checkCurrency(other)
    return new Money(this.fen - other.fen, this.currency)
  }

  /**
   * 乘以系数。factor 支持数字 (如 0.85) 或字符串 (如 "0.85")。
   * 默认银行家舍入到 1 分。
   */
  mul(factor: number | string, mode: RoundingMode = 'HALF_EVEN'): Money {
    const { num, den } = parseFactor(factor)
    return new Money(roundByMode(mode, this.fen * num, den), this.currency)
  }

  /**
   * 除以系数。divisor 支持数字或字符串。
   * 默认银行家舍入到 1 分。
   */
  div(divisor: number | string, mode: RoundingMode = 'HALF_EVEN'): Money {
    const { num, den } = parseFactor(divisor)
    if (num === 0n) throw new MoneyError('除数为零')
    return new Money(roundByMode(mode, this.fen * den, num), this.currency)
  }

  negate(): Money {
    return new Money(-this.fen, this.currency)
  }

  abs(): Money {
    return new Money(this.fen < 0n ? -this.fen : this.fen, this.currency)
  }

  lt(other: Money): boolean {
    this.checkCurrency(other)
    return this.fen < other.fen
  }

  lte(other: Money): boolean {
    this.checkCurrency(other)
    return this.fen <= other.fen
  }

  gt(other: Money): boolean {
    this.checkCurrency(other)
    return this.fen > other.fen
  }

  gte(other: Money): boolean {
    this.checkCurrency(other)
    return this.fen >= other.fen
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.fen === other.fen
  }

  toString(): string {
    return `${this.currency} ${this.toYuan()}`
  }
}

/** 金额合法范围。 */
export interface MoneyRange {
  min: Money
  max: Money
}

/**
 * 金额校验器。
 *
 * @example
 * const v = new MoneyValidator({ min: Money.fromYuan('0.01'), allowZero: false });
 * v.validate(Money.fromYuan('10')); // true
 */
export class MoneyValidator {
  private readonly min?: Money
  private readonly max?: Money
  private readonly allowZero: boolean
  private readonly allowNegative: boolean
  private stats = { checked: 0, rejected: 0 }

  constructor(
    options: {
      min?: Money
      max?: Money
      allowZero?: boolean
      allowNegative?: boolean
    } = {},
  ) {
    this.min = options.min
    this.max = options.max
    this.allowZero = options.allowZero ?? false
    this.allowNegative = options.allowNegative ?? false
  }

  validate(m: Money): boolean {
    this.stats.checked++
    if (!this.allowZero && m.isZero()) {
      this.stats.rejected++
      return false
    }
    if (!this.allowNegative && m.isNegative()) {
      this.stats.rejected++
      return false
    }
    if (this.min && m.lt(this.min)) {
      this.stats.rejected++
      return false
    }
    if (this.max && m.gt(this.max)) {
      this.stats.rejected++
      return false
    }
    return true
  }

  getStats(): { checked: number; rejected: number } {
    return { ...this.stats }
  }
}

/**
 * 金额数组求和 (同币种)。
 */
export function sumMoney(items: Iterable<Money>, currency = 'CNY'): Money {
  let total = 0n
  for (const it of items) {
    if (it.currency !== currency) {
      throw new MoneyError(`币种不一致: ${it.currency} vs ${currency}`)
    }
    total += it.fen
  }
  return new Money(total, currency)
}

/**
 * 按比例分账。余数补到末项, 保证 sum(parts) === total。
 * ratios 无需归一化, 内部按和归一化。
 *
 * @example
 * splitMoney(Money.fromYuan('100'), [1, 2, 3]); // 16.67, 33.33, 50.00
 */
export function splitMoney(total: Money, ratios: Array<number | string>): Money[] {
  if (ratios.length === 0) throw new MoneyError('ratios 不能为空')
  const parsed = ratios.map(parseFactor)
  // 公分母 = 所有分母之积, 将每个 ratio 转换到同一分母
  const commonDen = parsed.reduce((acc, r) => acc * r.den, 1n)
  const nums = parsed.map((r) => r.num * (commonDen / r.den))
  const sumNum = nums.reduce((a, b) => a + b, 0n)
  if (sumNum <= 0n) throw new MoneyError('ratios 之和必须 > 0')

  const parts: Money[] = []
  let allocated = 0n
  // 前 n-1 项按比例计算, 末项拿剩余
  for (let i = 0; i < nums.length - 1; i++) {
    const fen = bankerRound(total.fen * nums[i]!, sumNum)
    parts.push(new Money(fen, total.currency))
    allocated += fen
  }
  parts.push(new Money(total.fen - allocated, total.currency))
  return parts
}
