// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 扩展内 `chrome.runtime` 消息来源判据(2026-11-08,同型根因 D 类统一收口)。
 *
 * 背景:MV3 下 `sender.id === chrome.runtime.id` 只等价"来自本扩展自己的上下文",
 * 仍包含**内容脚本**(它跑在任意宿主页面的隔离世界)。对高权限入口(DOM 执行、
 * 浏览器动作、凭据读取)来说,"同 id"不够,还要区分:
 * - 顶层扩展页面 / Service Worker:`sender.url` 是 `chrome-extension://<本扩展 id>/…`
 * - 内容脚本:`sender.url` 是宿主页面 URL,且 `sender.tab` 一定存在
 *
 * 本文件只放判据,不做任何 chrome API 调用,便于单测与三处监听器共用。
 */

export interface RuntimeSenderLike {
  id?: string
  url?: string
  tab?: unknown
}

/** 只认本扩展 id(最低门槛,用于不需要区分上下文的场景) */
export function isTrustedExtensionSender(
  sender: RuntimeSenderLike | undefined | null,
  runtimeId: string,
): boolean {
  return !!sender && sender.id === runtimeId
}

/** 本扩展自己的页面/Worker(排除内容脚本:其 URL 是宿主页面) */
export function isTrustedExtensionPageSender(
  sender: RuntimeSenderLike | undefined | null,
  runtimeId: string,
): boolean {
  if (!isTrustedExtensionSender(sender, runtimeId)) return false
  const url = sender?.url
  return typeof url === 'string' && url.startsWith(`chrome-extension://${runtimeId}/`)
}

/** 顶层扩展上下文(Service Worker 或扩展页面);内容脚本的 sender 必带 `tab` */
export function isTrustedTopLevelExtensionSender(
  sender: RuntimeSenderLike | undefined | null,
  runtimeId: string,
): boolean {
  return isTrustedExtensionSender(sender, runtimeId) && sender?.tab === undefined
}
