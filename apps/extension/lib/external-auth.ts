// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 第三方登录 token 回传通道(2026-11-11 DBG-66 立)。
 *
 * 8 平台登录只 `chrome.tabs.create` 打开 web 端 OAuth 页,此前没有任何 token 回传链路
 * ⇒ web 端登录成功,回到扩展仍停在登录页。本模块定义回传协议与纯判据:
 * web 回调页(与 manifest externally_connectable 白名单同源)通过
 * `chrome.runtime.sendMessage(extensionId, { type, accessToken, ... })` 把 token 对
 * 送回扩展;background 的 `chrome.runtime.onMessageExternal` 用本判据校验后落 tokenStore。
 *
 * 判据(全部满足才采纳):
 * 1. sender.url 命中白名单:https://aizhs.top / https://*.aizhs.top(生产,与
 *    host_permissions 同域)+ http://localhost|127.0.0.1|::1(开发,与 lib/config.ts
 *    DBG-72 的 API 基址白名单同形)。manifest 的 externally_connectable 已在 Chrome
 *    层拦一道,这里是纵深防御 —— sender.url 由 Chrome 写入,页面不可伪造。
 * 2. type 精确等于 EXTERNAL_AUTH_MESSAGE_TYPE。
 * 3. accessToken 为非空字符串;refreshToken/expiresIn 可选,类型不符一律丢弃而非拒绝
 *    (web 端字段缺省时不该让整条登录失败)。
 */
import type { TokenPair } from '@ihui/types'

/** web → 扩展的 token 回传消息类型(非 ExtMessage 族,走 onMessageExternal 独立通道)。 */
export const EXTERNAL_AUTH_MESSAGE_TYPE = 'ihui.ext_auth.token'

/** 回传来源白名单(判据 1)。 */
export function isAllowedExternalAuthSenderUrl(rawUrl: string | undefined | null): boolean {
  if (!rawUrl) return false
  try {
    const u = new URL(rawUrl)
    if (u.protocol === 'https:' && (u.hostname === 'aizhs.top' || u.hostname.endsWith('.aizhs.top'))) {
      return true
    }
    if (
      u.protocol === 'http:' &&
      (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]' || u.hostname === '::1')
    ) {
      return true
    }
    return false
  } catch {
    return false
  }
}

/**
 * 校验并提取外部回传的 token 对。任一硬判据不过返回 null(调用方不回执、不落库)。
 * 纯函数,不触 chrome.*,便于单测直驱。
 */
export function parseExternalAuthTokenMessage(
  msg: unknown,
  senderUrl: string | undefined | null,
): TokenPair | null {
  if (!isAllowedExternalAuthSenderUrl(senderUrl)) return null
  if (!msg || typeof msg !== 'object') return null
  const m = msg as { type?: unknown; accessToken?: unknown; refreshToken?: unknown; expiresIn?: unknown }
  if (m.type !== EXTERNAL_AUTH_MESSAGE_TYPE) return null
  const accessToken = typeof m.accessToken === 'string' ? m.accessToken.trim() : ''
  if (!accessToken) return null
  const refreshToken =
    typeof m.refreshToken === 'string' && m.refreshToken.trim().length > 0
      ? m.refreshToken.trim()
      : undefined
  const expiresIn =
    typeof m.expiresIn === 'number' && Number.isFinite(m.expiresIn) && m.expiresIn > 0
      ? m.expiresIn
      : undefined
  return {
    accessToken,
    ...(refreshToken !== undefined ? { refreshToken } : {}),
    ...(expiresIn !== undefined ? { expiresIn } : {}),
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
