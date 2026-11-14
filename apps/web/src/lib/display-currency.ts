// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 展示货币换算(2026-11-14 立)。
 *
 * 机主要求:「美元 / 人民币 / USDT 一键切换,按即时汇率比例计算」。
 * 本模块是**前端展示层唯一换算出口**:
 *  - 汇率来自 `/api/exchange-rates/live`(后端实时快照,带缓存与兜底);
 *  - 纯函数读取模块级快照,因此任何格式化调用点(含 SSR 直出页面)都能复用;
 *  - 汇率未就绪时保守显示**原币种**,绝不按写死的 7.2 造假数字。
 *
 * 计费口径不受影响:扣费仍以 CNY 分为基准。
 */
import type { LiveFxRates } from '@ihui/api-client'

export type CurrencyCode = 'CNY' | 'USD' | 'USDT'
/** 'auto' = 跟随浏览器语言 */
export type DisplayCurrency = 'auto' | CurrencyCode

/** localStorage 偏好键(纯字符串,不用 zustand persist —— 服务端组件也会调用本模块) */
const STORAGE_KEY = 'ihui-display-currency'

let selectedCurrency: DisplayCurrency | null = null

/** 货币符号:CNY ¥ / USD $ / USDT ₮ */
export const CURRENCY_SYMBOL: Record<CurrencyCode, string> = {
  CNY: '¥',
  USD: '$',
  USDT: '₮',
}

/** 汇率快照(由 useExchangeRates 在客户端写入;SSR 期间为 null ⇒ 按原币种展示) */
let fxSnapshot: LiveFxRates | null = null

export function setFxSnapshot(next: LiveFxRates | null): void {
  fxSnapshot = next
}

export function getFxSnapshot(): LiveFxRates | null {
  return fxSnapshot
}

/** 读取用户显式选择的货币(客户端从 localStorage;服务端恒为 auto) */
export function getSelectedCurrency(): DisplayCurrency {
  if (selectedCurrency !== null) return selectedCurrency
  if (typeof window === 'undefined') return 'auto'
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === 'CNY' || raw === 'USD' || raw === 'USDT' || raw === 'auto') {
      selectedCurrency = raw
      return raw
    }
  } catch {
    // localStorage 被禁用时按 auto 处理
  }
  selectedCurrency = 'auto'
  return selectedCurrency
}

/** 写入偏好(CurrencySwitcher 调用;是否刷新页面由调用方决定) */
export function setSelectedCurrency(currency: DisplayCurrency): void {
  selectedCurrency = currency
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, currency)
  } catch {
    // 忽略隐私模式下的写入失败:本次会话内仍由模块变量生效
  }
}

/** 显式选择优先;auto 时英文环境用 USD,其余用 CNY */
export function resolveEffectiveCurrency(
  selected: DisplayCurrency,
  lang?: string,
): CurrencyCode {
  if (selected !== 'auto') return selected
  const l =
    lang ?? (typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'zh-CN')
  return l.toLowerCase().startsWith('en') ? 'USD' : 'CNY'
}

/** 当前生效的展示货币(可在服务端安全调用,SSR 恒为 CNY) */
export function getActiveCurrency(): CurrencyCode {
  return resolveEffectiveCurrency(getSelectedCurrency())
}

function cnyPer(currency: CurrencyCode): number | null {
  if (currency === 'CNY') return 1
  const rate = fxSnapshot?.cnyPer?.[currency]
  return typeof rate === 'number' && Number.isFinite(rate) && rate > 0 ? rate : null
}

/**
 * 金额换算:from → to。
 * 任一环节缺汇率 ⇒ 返回 null(调用方降级为原币种展示,不猜)。
 */
export function convertAmount(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
): number | null {
  if (!Number.isFinite(amount)) return null
  if (from === to) return amount
  const fromRate = cnyPer(from)
  const toRate = cnyPer(to)
  if (!fromRate || !toRate) return null
  return (amount * fromRate) / toRate
}

export interface MoneyFormatOptions {
  /** 固定小数位;缺省按量级自适应(≥1 两位、<1 四位、<0.01 六位) */
  digits?: number
  /** 是否千分位,默认 true */
  group?: boolean
}

function digitsFor(value: number): number {
  const abs = Math.abs(value)
  if (abs === 0 || abs >= 1) return 2
  if (abs >= 0.01) return 4
  return 6
}

/** 某个货币下的数值渲染(不含换算) */
export function renderMoney(
  value: number,
  currency: CurrencyCode,
  opts: MoneyFormatOptions = {},
): string {
  if (!Number.isFinite(value)) return '—'
  const digits = opts.digits ?? digitsFor(value)
  const negative = value < 0
  const abs = Math.abs(value)
  let text = abs.toFixed(digits)
  if (opts.group !== false) {
    const [head, tail] = text.split('.')
    text = `${head!.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${tail ? `.${tail}` : ''}`
  }
  return `${negative ? '-' : ''}${CURRENCY_SYMBOL[currency]}${text}`
}

/**
 * 按当前展示货币渲染金额;缺汇率时降级为原币种。
 * 例:`formatFrom(12.5, 'CNY')` → `¥12.50` / `$1.87` / `₮1.87`
 */
export function formatFrom(
  amount: number,
  from: CurrencyCode,
  opts: MoneyFormatOptions = {},
): string {
  if (!Number.isFinite(amount)) return '—'
  const target = getActiveCurrency()
  const converted = convertAmount(amount, from, target)
  if (converted === null) return renderMoney(amount, from, opts)
  return renderMoney(converted, target, opts)
}

/** 人民币「元」金额 */
export function formatCny(yuan: number, opts: MoneyFormatOptions = {}): string {
  return formatFrom(yuan, 'CNY', opts)
}

/** 人民币「分」金额(后端金额字段多为分) */
export function formatCnyCents(cents: number, opts: MoneyFormatOptions = {}): string {
  return formatFrom((Number(cents) || 0) / 100, 'CNY', opts)
}

/** 美元金额 */
export function formatUsd(usd: number, opts: MoneyFormatOptions = {}): string {
  return formatFrom(usd, 'USD', opts)
}

/** USDT 金额 */
export function formatUsdt(usdt: number, opts: MoneyFormatOptions = {}): string {
  return formatFrom(usdt, 'USDT', opts)
}

/** 汇率说明行(货币切换器/悬浮提示用);无快照时返回空串 */
export function formatRateLine(): string {
  if (!fxSnapshot) return ''
  const usd = fxSnapshot.cnyPer.USD
  const usdt = fxSnapshot.cnyPer.USDT
  const fmt = (v: number) => (v >= 1 ? v.toFixed(2) : v.toFixed(4))
  return `1 USD = ¥${fmt(usd)} · 1 USDT = ¥${fmt(usdt)}`
}
