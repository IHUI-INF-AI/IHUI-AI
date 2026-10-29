// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 回源鉴权守卫(2026-10-29 立)—— 治「知道源站 IP 就能绕过 EdgeOne 直连」。
 *
 * 为什么不能只靠防火墙 IP 白名单(逐条读腾讯云文档 1552/76086,2026-09-03 版):
 *   ① 回源 IP 段**只对付费套餐**开放,免费版拿不到;
 *   ② 平均 3-6 个月变一次,变更通知窗口 14 天 —— 漏一次更新就是整站回源失败;
 *   ③ 文档自己写明「回源 IP 网段内也可能存在少数不归属于 EdgeOne 的 IP」,并**建议叠加
 *      回源鉴权(回源时携带自定义鉴权信息,由源站校验通过后再响应)形成多层防护**。
 *   本模块就是那第二层:EdgeOne 控制台「规则引擎 → 修改 HTTP 回源请求头」注入一个密钥头,
 *   源站只放行带头且值匹配的请求。
 *
 * 三档,默认 `off` —— 线上关键路径上新装一个 403 开关,默认必须是「什么都不做」:
 *   · off     :完全不校验(现状,零风险);
 *   · observe :只统计不拦。**上线第一步必须走这一档**:先跑几天确认所有正常流量都带头,
 *               否则直接 enforce 会把「控制台还没配」变成全站 403 —— 那是自己把自己打瘫;
 *   · enforce :不带头 / 头不匹配 ⇒ 403。
 *
 * 回环豁免:本机健康检查、部署脚本、内部服务调用都从 127.0.0.1 进来,永远不带回源头。
 * 不豁免的话,开启 enforce 的瞬间部署环自己先死。
 */

const HEADER = 'x-ihui-edge-secret'

/** 三档取值归一。任何认不出的值一律回落 `off` —— 失效方向恒为「少拦一次」。 */
export function resolveEdgeGuardMode(raw) {
  const v = String(raw ?? '').trim().toLowerCase()
  if (v === 'enforce') return 'enforce'
  if (v === 'observe') return 'observe'
  return 'off'
}

/**
 * 判定一个请求是否放行。
 *
 * @param {object} input
 * @param {string} input.mode       resolveEdgeGuardMode 的结果
 * @param {string} input.secret     期望的密钥值;空串 ⇒ 守卫未配置,一律放行
 * @param {boolean} input.loopback  是否回环来源
 * @param {Record<string, unknown>} input.headers 请求头(小写键或大小写混写都认)
 * @returns {{action: 'pass'|'observe'|'deny', reason: string}}
 */
export function decideEdgeGuard({ mode, secret, loopback, headers }) {
  if (mode === 'off') return { action: 'pass', reason: 'off' }
  if (!secret) {
    // 配了 observe/enforce 却没给密钥 = 配置错。这里**放行**而不是全拦:
    // 一个手滑漏填 env 不该让整站 403,而且 observe 档的存在就是为了先发现这类问题。
    return { action: 'pass', reason: 'no-secret-configured' }
  }
  if (loopback) return { action: 'pass', reason: 'loopback' }

  const raw = headerValue(headers, HEADER)
  if (raw && timingSafeEqual(raw, secret)) return { action: 'pass', reason: 'match' }
  if (mode === 'observe') {
    return { action: 'observe', reason: raw ? 'mismatch' : 'missing' }
  }
  return { action: 'deny', reason: raw ? 'mismatch' : 'missing' }
}

/** 大小写不敏感取头(Node 的 req.headers 本来就是小写键,但测试/复用时不假定)。 */
function headerValue(headers, name) {
  if (!headers || typeof headers !== 'object') return ''
  const direct = headers[name]
  if (typeof direct === 'string') return direct.trim()
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === name) return typeof v === 'string' ? v.trim() : ''
  }
  return ''
}

/**
 * 定长比较,避免按字节短路泄漏密钥前缀。
 * 长度不同直接 false(长度本身不是秘密,且 crypto.timingSafeEqual 要求等长)。
 */
function timingSafeEqual(a, b) {
  const x = Buffer.from(String(a), 'utf8')
  const y = Buffer.from(String(b), 'utf8')
  if (x.length !== y.length) return false
  let diff = 0
  for (let i = 0; i < x.length; i += 1) diff |= x[i] ^ y[i]
  return diff === 0
}
