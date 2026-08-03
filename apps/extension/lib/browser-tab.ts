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

/** 在新标签页中打开指定 URL */
export async function openInTab(url: string): Promise<void> {
  await chrome.tabs.create({ url })
}

/** 注册 "open-work-panel" 消息监听器(background context 调用) */
export function registerWorkPanelMessageHandler(): void {
  chrome.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
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
