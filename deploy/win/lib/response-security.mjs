// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * API 上游响应安全头(2026-10-29 变更 C)。
 *
 * 立因:此前真实代码(api / ai-service)完全没有任何安全响应头
 * (HSTS / X-Frame-Options / X-Content-Type-Options / CSP / Referrer-Policy)。web 已由
 * next.config 自理,且其 WorkPanel 用同源 iframe 嵌页面 ⇒ 不能再叠 frame 类头;故本模块
 * 只在 **API 上游实例**(ihui-api-router 监听 127.0.0.1)注入,web 实例(监听 0.0.0.0)不加。
 *
 * 合并语义:只补「上游没设的」,绝不覆盖上游已设的安全头 —— 否则未来 api 自行加 CSP 会变成
 * 双份 CSP,浏览器行为不可预测。API 当前零安全头 ⇒ 全部是净增量;合并逻辑是为未来兜底。
 *
 * 判定抽成纯函数 + 同目录测试(与 edge-admission.mjs 同构):「加没加对」是可断言的用例,
 * 而不是靠读代码确认。
 */

/**
 * API 是纯 JSON 后端:永不内嵌脚本、从不被 iframe、不需要地理位置/摄像头等浏览器特性。
 * 故用最严集合,与 web 的「SAMEORIGIN + 宽松 CSP」刻意不同 —— API 没有任何需要放宽的理由。
 */
export const API_SECURITY_HEADERS = Object.freeze([
  ['Strict-Transport-Security', 'max-age=31536000; includeSubDomains'],
  ['X-Content-Type-Options', 'nosniff'],
  ['X-Frame-Options', 'DENY'],
  ['Referrer-Policy', 'no-referrer'],
  ['Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"],
  [
    'Permissions-Policy',
    'geolocation=(), camera=(), microphone=(), payment=(), usb=(), interest-cohort=()',
  ],
])

/**
 * 是否给上游响应补安全头。
 *
 * 优先级:env `IHUI_BG_SECURITY_HEADERS` 显式 on/off 最高;缺省按**监听面**推断 ——
 * 回环(127.0.0.1 / ::1 / localhost)⇒ API 实例 ⇒ 加;0.0.0.0 ⇒ web 实例 ⇒ 不加
 * (web 的安全头由 next.config 自理,且同域 iframe 不能被 frame 类头破坏)。
 *
 * 用监听面而非新增 role 标记:web 必须绑 0.0.0.0 是已落地的硬约束(EdgeOne 回源直填公网 IP),
 * API 必须绑回环是拓扑铁律,二者天然互斥,无需再引入第二个真相源。
 *
 * @param {unknown} raw  env IHUI_BG_SECURITY_HEADERS 原始值
 * @param {string} listenHost  本 router 实际监听的地址
 * @returns {boolean}
 */
export function resolveSecurityHeaderMode(raw, listenHost) {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (v === 'on') return true
  if (v === 'off') return false
  const host = typeof listenHost === 'string' ? listenHost : ''
  return host === '127.0.0.1' || host === '::1' || host === 'localhost'
}

function _hasHeader(headers, lowerKey) {
  const obj = headers || {}
  for (const k of Object.keys(obj)) {
    if (k.toLowerCase() === lowerKey) return true
  }
  return false
}

/**
 * 把安全头合并进上游响应头。**不修改入参**,返回新对象;只补上游没设的键。
 *
 * @param {Record<string, unknown>} upstreamHeaders  http.IncomingMessage.headers(键已小写)
 * @param {boolean} enabled  resolveSecurityHeaderMode 的结果
 * @returns {Record<string, unknown>}
 */
export function applySecurityHeaders(upstreamHeaders, enabled) {
  if (!enabled) return upstreamHeaders
  const out = { ...(upstreamHeaders || {}) }
  for (const [k, v] of API_SECURITY_HEADERS) {
    if (!_hasHeader(out, k.toLowerCase())) out[k] = v
  }
  return out
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
