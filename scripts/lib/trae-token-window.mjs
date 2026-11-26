// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Trae 客户端「票窗」判据 —— 单源(2026-11-26 立)。
 *
 * 逐字对齐客户端 `resources/app/out/main.js` 里 authUtil 的 `MS()`:
 *   r = Date.parse(expiredAt) - Date.now()                     // 票还剩多久
 *   n = tokenReleaseAt ? (expiredAt - tokenReleaseAt)/3 > r : false  // 总寿命的 1/3 是否已耗掉
 *   r <= 0        ⇒ NEED_LOGIN      (票已过期,客户端要重新登录)
 *   n || r <= 24h ⇒ NEED_REFRESH    (客户端启动会**先拿 refreshToken 换票**,不用现成票)
 *   否则           ⇒ VALID_TOKEN    (直接用现成票,rt 不参与)
 *
 * 为什么必须单源:切号预检原来只验 `CheckLogin`(IsLogin=true) 就放行,等于假设"票有效 ⇒
 * 写回后能登"。这句话在票窗 ≤24h 时是**假的** —— 客户端会先换票,而 rt 已经废了(20403/10101),
 * 于是当场清空登录信封。2026-11-26 两次切号失败(15978545189 那枚、以及后面用 8h web 票再试一次)
 * 都栽在这一格:票是好的,判据漏了"客户端会不会用它"。
 *
 * 语义约定:
 *   valid        → 现成票可用,rt 不必验证(不轮换,不动池)
 *   need-refresh → 必须真换一次票;换不出来就不能写回客户端
 *   need-login   → 没有票/票已过期,连换票都不必试
 */

export const TRAE_CLIENT_TOKEN_WINDOW_MS = 24 * 60 * 60 * 1000

export const TRAE_TOKEN_VERDICT = {
  VALID: 'valid',
  NEED_REFRESH: 'need-refresh',
  NEED_LOGIN: 'need-login',
}

const toMs = (v) => {
  if (v instanceof Date) return v.getTime()
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v) {
    const ms = Date.parse(v)
    return Number.isFinite(ms) ? ms : NaN
  }
  return NaN
}

/**
 * 客户端同款判据。
 * @param {{token?: string, expiresAt?: string|Date|number|null, tokenReleaseAt?: string|Date|number|null}} input
 * @param {number} nowMs
 * @returns {'valid'|'need-refresh'|'need-login'}
 */
export function traeTokenVerdict(input, nowMs = Date.now()) {
  const token = typeof input?.token === 'string' ? input.token : ''
  if (!token) return TRAE_TOKEN_VERDICT.NEED_LOGIN
  const expMs = toMs(input?.expiresAt)
  if (!Number.isFinite(expMs)) return TRAE_TOKEN_VERDICT.NEED_LOGIN
  const leftMs = expMs - nowMs
  if (leftMs <= 0) return TRAE_TOKEN_VERDICT.NEED_LOGIN
  const relMs = toMs(input?.tokenReleaseAt)
  const thirdMs = Number.isFinite(relMs) ? (expMs - relMs) / 3 : 0
  if (thirdMs > 0 && thirdMs > leftMs) return TRAE_TOKEN_VERDICT.NEED_REFRESH
  if (leftMs <= TRAE_CLIENT_TOKEN_WINDOW_MS) return TRAE_TOKEN_VERDICT.NEED_REFRESH
  return TRAE_TOKEN_VERDICT.VALID
}

/** 票窗剩余毫秒(解不出 → null,解出但已过期 → 负数) */
export function traeTokenLeftMs(input, nowMs = Date.now()) {
  const expMs = toMs(input?.expiresAt)
  return Number.isFinite(expMs) ? expMs - nowMs : null
}

/** 票窗剩余小时(解不出 → null)。用于展示面一句话。 */
export function traeTokenLeftHours(input, nowMs = Date.now()) {
  const left = traeTokenLeftMs(input, nowMs)
  return left === null ? null : left / 3600000
}

/**
 * 展示面标签:只在"客户端不会用现成票"时才说话,valid 返回空串(不打扰)。
 * 文案给的是**后果**而不是判据术语 —— 看图的人只要知道"切过去会不会当场登出"。
 */
export function traeTokenWindowTag(input, nowMs = Date.now()) {
  const verdict = traeTokenVerdict(input, nowMs)
  if (verdict === TRAE_TOKEN_VERDICT.VALID) return ''
  if (verdict === TRAE_TOKEN_VERDICT.NEED_LOGIN) return ' ⚠票已过期(客户端要重登)'
  const hours = traeTokenLeftHours(input, nowMs)
  const left = Number.isFinite(hours) ? `${Math.max(hours, 0).toFixed(1)}h` : '?'
  return ` ⚠票窗仅剩${left}(客户端会先换票)`
}

/**
 * 只凭"到期时刻 + 发签时刻"出标签(不需要 token 本身)。
 * 展示面(账号列表)只拿得到 tokenExpiresAt,但仍要与切号预检同一判据 —— 否则列表说没事、
 * 预检说必须换票,两处口径打架。
 */
export function traeTicketWindowTag(input, nowMs = Date.now()) {
  const expMs = toMs(input?.expiresAt)
  if (!Number.isFinite(expMs)) return ' ⚠到期时刻解不出'
  const leftMs = expMs - nowMs
  if (leftMs <= 0) return ' ⚠票已过期(客户端要重登)'
  const relMs = toMs(input?.tokenReleaseAt)
  const thirdMs = Number.isFinite(relMs) ? (expMs - relMs) / 3 : 0
  if (thirdMs > 0 && thirdMs > leftMs) {
    return ` ⚠票窗仅剩${(leftMs / 3600000).toFixed(1)}h(客户端会先换票)`
  }
  if (leftMs <= TRAE_CLIENT_TOKEN_WINDOW_MS) {
    return ` ⚠票窗仅剩${(leftMs / 3600000).toFixed(1)}h(客户端会先换票)`
  }
  return ''
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
