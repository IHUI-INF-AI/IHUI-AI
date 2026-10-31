// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 浏览器导航 URL 的协议白名单 —— 单一真相源。
 *
 * 为什么需要(2026-10-31 安全强化第 21 批):
 * `browser_navigate` 的 url 来自 LLM 工具参数(可被页面内容/间接提示注入操纵),
 * 此前原样送进 CDP `Page.navigate`。`file:///C:/Users/.../settings.json` 会被
 * Chrome 正常渲染,随后 `browser_snapshot` 把本地文件正文当"页面文本"回传给模型
 * —— 一条完整的本地任意文件读链。同面还有 `chrome://`(历史/书签/版本)、
 * `javascript:`、`data:`。浏览器扩展侧 `createTab`/`navigateTab` 同缺校验。
 *
 * 判据放在 `@ihui/shared` 而非各端:CLI 走 CDP 直连、extension 走 chrome.tabs,
 * 两条实现路径,协议判据只许一份(§0.6 同类判据第二份必然漂移)。
 * 协议表复用 ssrf-guard 的 `ALLOWED_FETCH_PROTOCOLS`,不另抄一份 http/https。
 */
import { ALLOWED_FETCH_PROTOCOLS } from './ssrf-guard.js'

/**
 * 除 http/https 外唯一允许的导航目标:空白占位页。
 * 它是浏览器内部页而非网络协议,`about:blank` 由 CLI 自己用于建新标签
 * (`/json/new?url=about:blank`),拦掉会让开标签流程失败。
 */
export const NAVIGABLE_INTERNAL_URLS = ['about:blank'] as const

export interface NavigableUrlOk {
  ok: true
  /** 归一化后的 URL(about:blank 原样返回) */
  url: string
}

export interface NavigableUrlRejected {
  ok: false
  /** 面向用户/模型的可行动原因(点名协议) */
  reason: string
  /** 被拒协议(解析失败时为空串) */
  protocol: string
}

export type NavigableUrlDecision = NavigableUrlOk | NavigableUrlRejected

/**
 * 判定一个 URL 是否可作为浏览器导航目标。
 *
 * 纯函数、无副作用、不抛错:调用方(CLI 工具层 / 扩展实现层)自行决定
 * 是把 reason 作为工具失败返回,还是抛错。
 */
export function checkNavigableUrl(raw: unknown): NavigableUrlDecision {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { ok: false, reason: 'URL 不能为空', protocol: '' }
  }
  const trimmed = raw.trim()

  if ((NAVIGABLE_INTERNAL_URLS as readonly string[]).includes(trimmed)) {
    return { ok: true, url: trimmed }
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { ok: false, reason: '不是合法 URL(需含协议,如 https://)', protocol: '' }
  }

  if (!(ALLOWED_FETCH_PROTOCOLS as readonly string[]).includes(parsed.protocol)) {
    return {
      ok: false,
      reason: `协议 ${parsed.protocol} 不允许导航(仅 http/https)`,
      protocol: parsed.protocol,
    }
  }

  return { ok: true, url: parsed.toString() }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
