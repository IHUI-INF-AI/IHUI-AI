// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工作展示区(extension 端)— 用浏览器新标签页打开 URL。
 * 提供 openInTab(url) 全局方法 + registerWorkPanelMessageHandler() 消息监听注册。
 *
 * 用法:在 background.ts 的 defineBackground 回调中调用 registerWorkPanelMessageHandler()。
 */
// 2026-08-03 wxt 0.21 升级:webextension-polyfill 已移除,browser.runtime.onMessage
// 不再支持返回 Promise 发送异步响应。改用 chrome.* 全局(与 entrypoints/background.ts、
// content.ts 一致),chrome 类型(@types/chrome)在 v0.19/v0.21 都接受 boolean 返回 +
// sendResponse 异步回调,无需 wxt/browser 的 polyfill 抽象。

export interface OpenWorkPanelMessage {
  type: 'open-work-panel'
  url: string
}

/** 只允许 http(s) 绝对 URL:挡掉 javascript: / file: / data: 等可执行或本地文件协议。 */
function isSafeTabUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/** 在新标签页中打开指定 URL(带协议白名单) */
export async function openInTab(url: string): Promise<void> {
  if (!isSafeTabUrl(url)) {
    throw new Error(`拒绝打开非 http(s) URL: ${url}`)
  }
  await chrome.tabs.create({ url })
}

/** 注册 "open-work-panel" 消息监听器(background context 调用) */
export function registerWorkPanelMessageHandler(): void {
  chrome.runtime.onMessage.addListener((msg: unknown, sender, sendResponse) => {
    // 与 entrypoints/background.ts 的 registerMessageListener 同一口径:只接受本扩展
    // 自己的上下文(popup/sidepanel/options/已注入 content script),外部扩展或网页的
    // sender.id 是对方的 id,一律丢弃。
    if (sender.id !== chrome.runtime.id) return false
    if (
      msg &&
      typeof msg === 'object' &&
      (msg as OpenWorkPanelMessage).type === 'open-work-panel' &&
      typeof (msg as OpenWorkPanelMessage).url === 'string'
    ) {
      const { url } = msg as OpenWorkPanelMessage
      void openInTab(url)
        .then(() => sendResponse({ ok: true }))
        .catch((err: unknown) =>
          sendResponse({
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          }),
        )
      return true // 异步响应:保持 sendResponse 通道打开
    }
    return false
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
