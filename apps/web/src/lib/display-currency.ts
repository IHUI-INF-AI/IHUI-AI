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

/**
 * 偏好键:localStorage 与 cookie 同名(服务端组件也会调用本模块,不能依赖浏览器 API)。
 * cookie 让 SSR 直出就按用户所选币种渲染 —— 否则刷新后服务端只能回落到 CNY。
 */
export const DISPLAY_CURRENCY_KEY = 'ihui-display-currency'
/** 汇率快照 cookie:SSR 首屏复用上次拉到的汇率,保证刷新后金额不会回落到原币种 */
export const FX_SNAPSHOT_COOKIE = 'ihui-fx-snapshot'

let selectedCurrency: DisplayCurrency | null = null
/**
 * 是否已完成水合。水合前服务端与客户端都按 cookie 决定的口径渲染,避免同一份金额在
 * SSR/首帧出现两种币种导致 React 水合失败(整页事件失效)。
 */
let hydrated = false
/** 服务端渲染期间从 cookie 读到的偏好(客户端不读它) */
let serverCurrency: DisplayCurrency = 'auto'
/** 服务端渲染期间生效的币种(auto 已按 Accept-Language 解开) */
let serverEffective: CurrencyCode = 'CNY'

/** 由 CurrencyRuntime 在挂载后调用(客户端) */
export function markDisplayCurrencyHydrated(): void {
  hydrated = true
}

/** 校验并归一货币取值 */
export function normalizeDisplayCurrency(value: string | undefined | null): DisplayCurrency {
  return value === 'CNY' || value === 'USD' || value === 'USDT' || value === 'auto' ? value : 'auto'
}

/**
 * 根布局(服务端)与 CurrencyRuntime(客户端组件 SSR)在渲染期写入;保证 SSR 金额与首帧一致。
 * 注意 Next 的服务端组件层与客户端组件层是两个模块实例,所以 layout 与 CurrencyRuntime 各调一次。
 */
export function setServerDisplayCurrency(
  value: string | undefined | null,
  effective?: CurrencyCode | null,
): void {
  serverCurrency = normalizeDisplayCurrency(value)
  serverEffective =
    effective === 'CNY' || effective === 'USD' || effective === 'USDT'
      ? effective
      : serverCurrency === 'auto'
        ? 'CNY'
        : serverCurrency
}

/** auto 跟随浏览器语言:en* → USD,其余 → CNY(服务端按 Accept-Language 判定) */
export function resolveDisplayCurrencyByLanguage(
  selected: DisplayCurrency,
  language: string | undefined | null,
): CurrencyCode {
  if (selected !== 'auto') return selected
  return (language ?? '').trim().toLowerCase().startsWith('en') ? 'USD' : 'CNY'
}

/** 货币符号:CNY ¥ / USD $ / USDT ₮ */
export const CURRENCY_SYMBOL: Record<CurrencyCode, string> = {
  CNY: '¥',
  USD: '$',
  USDT: '₮',
}

/** 汇率快照(由 useExchangeRates 在客户端写入;SSR 期间为 null ⇒ 按原币种展示) */
let fxSnapshot: LiveFxRates | null = null

/** 展示货币/汇率变化的订阅者(CurrencyRuntime 据此就地重渲染全站金额,不再整页刷新) */
const listeners = new Set<() => void>()

function notifyDisplayCurrencyChanged(): void {
  for (const fn of listeners) fn()
}

/** 订阅货币变化;返回取消订阅函数 */
export function subscribeDisplayCurrency(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** 写入汇率快照。首次拿到快照时**无论展示币种**都通知重算:
 *  页面上的美元源价格(如模型市场 $0.59)在 CNY 口径下也要立刻按快照换算,
 *  否则首屏会同时出现 $ 与 ¥ 两种单位(看起来像单位不统一)。 */
export function setFxSnapshot(next: LiveFxRates | null): void {
  const hadSnapshot = fxSnapshot !== null
  fxSnapshot = next
  if (!hadSnapshot && next) notifyDisplayCurrencyChanged()
}

export function getFxSnapshot(): LiveFxRates | null {
  return fxSnapshot
}

/** 校验汇率快照结构(cookie 由浏览器回传,可能被篡改/过期,必须验) */
function isLiveFxRates(value: unknown): value is LiveFxRates {
  if (!value || typeof value !== 'object') return false
  const rates = (value as Partial<LiveFxRates>).cnyPer
  if (!rates || typeof rates !== 'object') return false
  const ok = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n > 0
  return ok(rates.USD) && ok(rates.USDT)
}

/** 解析汇率快照串(根布局读 cookie 后调用;非法值返回 null) */
export function parseFxSnapshot(raw: string | undefined | null): LiveFxRates | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw))
    return isLiveFxRates(parsed) ? parsed : null
  } catch {
    return null
  }
}

/**
 * 写汇率快照 cookie(客户端拉取成功后调用)。
 * 有效期 1 小时:下次 SSR 首屏直接按这份汇率换算;客户端每次拉取都会覆盖续期,
 * 因此正常使用中它始终是最近一次实时值。写失败只影响下次首屏,不影响本次展示。
 */
export function writeFxSnapshotCookie(rates: LiveFxRates | null): void {
  if (typeof document === 'undefined' || !rates) return
  try {
    const payload = encodeURIComponent(JSON.stringify(rates))
    document.cookie = `${FX_SNAPSHOT_COOKIE}=${payload}; path=/; max-age=3600; samesite=lax`
  } catch {
    // 忽略:仅影响下一次 SSR 首屏
  }
}

/** 读取用户显式选择的货币(服务端读 cookie;客户端水合期读 SSR 的 data-currency) */
export function getSelectedCurrency(): DisplayCurrency {
  if (typeof window === 'undefined') return serverCurrency
  if (!hydrated) {
    // SSR 把 cookie 偏好写在 <html data-currency>,首帧照它渲染保证水合一致
    const ds = document.documentElement?.dataset?.['currency']
    if (ds) return normalizeDisplayCurrency(ds)
    return 'auto'
  }
  if (selectedCurrency !== null) return selectedCurrency
  try {
    const raw = window.localStorage.getItem(DISPLAY_CURRENCY_KEY)
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
    window.localStorage.setItem(DISPLAY_CURRENCY_KEY, currency)
  } catch {
    // 忽略隐私模式下的写入失败:本次会话内仍由模块变量生效
  }
  // 关键:同步写 cookie,让服务端 SSR 也能按所选货币渲染(否则刷新后回到 CNY)
  try {
    document.cookie = `${DISPLAY_CURRENCY_KEY}=${currency}; path=/; max-age=31536000; samesite=lax`
  } catch {
    // cookie 被禁用时降级为仅客户端换算
  }
  // 同步 <html data-currency>,便于调试与外部读取
  if (document.documentElement?.dataset) document.documentElement.dataset['currency'] = currency
  // 通知全站就地重算金额(CurrencyRuntime 以 key 重挂载内容树,避免整页刷新命中 CDN 旧 HTML)
  notifyDisplayCurrencyChanged()
}

/** 显式选择优先;auto 时英文环境用 USD,其余用 CNY */
export function resolveEffectiveCurrency(
  selected: DisplayCurrency,
  lang?: string,
): CurrencyCode {
  if (selected !== 'auto') return selected
  if (!hydrated) {
    // 水合前必须与服务端首屏一致:客户端读 <html data-currency-effective>,
    // 服务端读 layout 写入的 serverEffective(auto 已按 Accept-Language 解开)
    if (typeof window !== 'undefined') {
      const eff = document.documentElement?.dataset?.['currencyEffective']
      if (eff === 'CNY' || eff === 'USD' || eff === 'USDT') return eff
    }
    return serverEffective
  }
  const l =
    lang ?? (typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'zh-CN')
  return l.toLowerCase().startsWith('en') ? 'USD' : 'CNY'
}

/** 当前生效的展示货币(服务端按 layout 播种的 cookie 口径返回) */
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
