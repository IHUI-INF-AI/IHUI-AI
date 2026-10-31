// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * api.proxy 的目标路径判据(2026-10-31 安全强化第 19 批)。
 *
 * 病灶:`handleApiProxy` 把调用方给的 `payload.path` 原样拼上 query 交给 `callApi`,
 * 而 `packages/api-client/src/client.ts` 的 `normalizeUrl` 第一件事就是
 * `if (/^https?:\/\//i.test(url)) return url` —— 绝对 URL 直通,随后无条件挂
 * `Authorization: Bearer <token>`。于是 api.proxy 的任何调用方(含 content script
 * 上下文被页面利用的那条腿)都能让后台**带着本站凭据去任意域**,并把响应原样带回。
 *
 * 出路:代理面只认站内相对路径。现读全仓唯一消费方
 * (`entrypoints/components/NotificationBell.tsx`)传的是 `/api/notifications/unread-count`,
 * 所以这条收口不切断任何既有功能。
 */

/** 站内允许的三段前缀 —— 与 api-client normalizeUrl 的相对路径分支同形,不另立一套。 */
const ALLOWED_ORIGIN_RELATIVE_PREFIXES = ['/api/', '/uploads/', '/ws/'] as const

export interface ApiProxyPathVerdict {
  readonly ok: boolean
  readonly reason?: string
}

/**
 * 判定 path 可否作为代理目标。
 *
 * 三条都要过,顺序是"先看是不是外链,再看是不是协议相对,最后看前缀":
 *  - 绝对 URL(`http:`/`https:` 及任何 `scheme:` 形态)⇒ 拒。凭据不得离开本站源。
 *  - 协议相对 `//host/…` 与 `/\host\…` ⇒ 拒。WHATWG 在 special scheme 下把第二字符
 *    的 `/` 与 `\` 等值处理,实测 `new URL('/\\evil.com','https://aizhs.top')` 解析成
 *    `https://evil.com/` —— 只挡 `//` 会把反斜杠形态放行成跨站。
 *  - 必须命中站内前缀 ⇒ 否则连"站内相对路径"都不是。
 */
export function assertApiProxyPath(path: string): ApiProxyPathVerdict {
  if (typeof path !== 'string' || path.length === 0) {
    return { ok: false, reason: 'path 为空' }
  }
  // 任何 scheme:形态都算外链(不限 http/https —— ftp:/gopher: 之类同样不该带凭据出去)
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(path)) {
    return { ok: false, reason: '代理目标不得是绝对 URL(会带着本站凭据出站到第三方域)' }
  }
  if (path.startsWith('//') || path.startsWith('/\\')) {
    return { ok: false, reason: '代理目标不得是协议相对形态(浏览器会解析成跨站主机)' }
  }
  if (!ALLOWED_ORIGIN_RELATIVE_PREFIXES.some((p) => path.startsWith(p))) {
    return {
      ok: false,
      reason: `代理目标必须是站内前缀之一:${ALLOWED_ORIGIN_RELATIVE_PREFIXES.join(' ')}`,
    }
  }
  return { ok: true }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
