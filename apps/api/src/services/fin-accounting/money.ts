// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 金额运算的唯一入口(财务账套专用)。
 *
 * 为什么不用 number 直接加减:0.1 + 0.2 !== 0.3,凭证合计与试算平衡会因此"看起来不平时实际平"。
 * 本模块把金额一律转成**整数分**再运算,出口再格式化回两位小数字符串 —— 全链路零浮点误差。
 *
 * 纪律:
 *   · 数据库 numeric(16,2) 读出即字符串,不得先 Number() 再累加;
 *   · 任何金额字段的写库值必须经 fromCents() 产出;
 *   · 非法/超限输入显式抛出 MoneyError,不静默归零。
 */

import { AppError } from '../../errors/AppError.js'

/**
 * 金额非法/超限。继承 AppError ⇒ 路由层与全局 errorHandler 直接回 400,
 * 不会因为一个手输的 "1.234" 变成 500 告警。
 */
export class MoneyError extends AppError {
  constructor(message: string) {
    super(message, 400, 'FIN_MONEY_INVALID')
    this.name = 'MoneyError'
  }
}

/** numeric(16,2) 的上限:99999999999999.99 ⇒ 16 位整数分 */
const MAX_CENTS = 9_999_999_999_999_999

/** "1234.56" / "-1.5" / 1234.5 / "0" ⇒ 整数分 */
export function toCents(raw: string | number | null | undefined, where = 'amount'): number {
  if (raw === null || raw === undefined || raw === '') return 0
  const text = typeof raw === 'number' ? decimalString(raw) : raw.trim()
  if (!/^-?\d+(\.\d{0,2})?$/.test(text)) {
    throw new MoneyError(`${where} 必须是两位以内小数的金额,收到 ${JSON.stringify(raw)}`)
  }
  const negative = text.startsWith('-')
  const unsigned = negative ? text.slice(1) : text
  const [intPart = '0', fracRaw = ''] = unsigned.split('.')
  const frac = `${fracRaw}00`.slice(0, 2)
  const cents = Number(intPart) * 100 + Number(frac)
  if (!Number.isSafeInteger(cents) || cents > MAX_CENTS) {
    throw new MoneyError(`${where} 超出金额上限(16 位整数 + 2 位小数)`)
  }
  return negative ? -cents : cents
}

/** 整数分 ⇒ "1234.56"(固定两位小数,用于写库与出参) */
export function fromCents(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new MoneyError('金额分必须是安全整数')
  const negative = cents < 0
  const abs = Math.abs(cents)
  const intPart = Math.floor(abs / 100)
  const frac = String(abs % 100).padStart(2, '0')
  return `${negative ? '-' : ''}${intPart}.${frac}`
}

/** 求和(入参全是字符串/数字金额,出口是分) */
export function sumCents(values: Array<string | number | null | undefined>): number {
  let total = 0
  for (const v of values) total += toCents(v)
  return total
}

/** 四舍五入到分(仅在"除法"等必须产生小数的场景使用;用于税率/比例换算) */
export function roundCents(numerator: number, denominator: number): number {
  if (denominator === 0) throw new MoneyError('除数不能为 0')
  return Math.round(numerator / denominator)
}

/** 按比例取分:amountCents * rate(单位任意,结果四舍五入到分) */
export function applyRate(amountCents: number, rate: number): number {
  return Math.round(amountCents * rate)
}

function decimalString(n: number): string {
  if (!Number.isFinite(n)) throw new MoneyError('金额必须是有限数字')
  // 避免 1e-7 / 大数科学计数法:固定两位
  return n.toFixed(2)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
