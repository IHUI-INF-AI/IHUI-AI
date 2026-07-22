/**
 * 工作展示区(extension 端)— 用浏览器新标签页打开 URL。
 * 提供 openInTab(url) 全局方法 + registerWorkPanelMessageHandler() 消息监听注册。
 *
 * 用法:在 background.ts 的 defineBackground 回调中调用 registerWorkPanelMessageHandler()。
 */
import { browser } from 'wxt/browser'

export interface OpenWorkPanelMessage {
  type: 'open-work-panel'
  url: string
}

/** 在新标签页中打开指定 URL */
export async function openInTab(url: string): Promise<void> {
  await browser.tabs.create({ url })
}

/** 注册 "open-work-panel" 消息监听器(background context 调用) */
export function registerWorkPanelMessageHandler(): void {
  browser.runtime.onMessage.addListener((msg: unknown) => {
    if (
      msg &&
      typeof msg === 'object' &&
      (msg as OpenWorkPanelMessage).type === 'open-work-panel' &&
      typeof (msg as OpenWorkPanelMessage).url === 'string'
    ) {
      const { url } = msg as OpenWorkPanelMessage
      return openInTab(url)
        .then(() => ({ ok: true }))
        .catch((err: unknown) => ({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        }))
    }
    return undefined
  })
}
