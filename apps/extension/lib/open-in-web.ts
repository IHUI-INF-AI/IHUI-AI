/**
 * open-in-web — sidepanel/UI 上下文跳转 web 端统一入口(2026-07-27 立)。
 *
 * 收敛 sidepanel/pages 下 18 处 chrome.tabs.create 调用与 14+ 处 WEB_BASE 重复定义。
 * - WEB_BASE: web 端基址(re-export 自 @ihui/shared/constants,跨端单一来源)
 * - openInWeb(path): 接收相对路径(如 '/articles/123'),内部拼接 WEB_BASE + path
 * - openWebUrl(url): 接收完整 URL,直接打开
 *
 * 注意:本 helper 直接使用全局 chrome.tabs.create(sidepanel/UI 上下文),
 * 与 background 的 browser polyfill 不同,故不引入 platform 实例。
 */
import { WEB_BASE } from '@ihui/shared/constants'

export { WEB_BASE }

export function openInWeb(path: string): void {
  void chrome.tabs.create({ url: WEB_BASE + path })
}

export function openWebUrl(url: string): void {
  void chrome.tabs.create({ url })
}
