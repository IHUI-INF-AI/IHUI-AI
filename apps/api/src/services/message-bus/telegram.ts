// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/** Telegram 消息总线适配器 */

import { postJson, type MessageBusAdapter } from './index.js'

export const telegramAdapter: MessageBusAdapter = {
  async send(content: string, opts?: Record<string, unknown>) {
    const token = process.env.TELEGRAM_BOT_TOKEN
    const chatId = (opts?.chat_id as string | undefined) ?? process.env.TELEGRAM_CHAT_ID
    if (!token || !chatId) {
      return { success: false, error: '渠道未配置' }
    }
    const url = `https://api.telegram.org/bot${token}/sendMessage`
    return postJson(url, { chat_id: chatId, text: content })
  },
}
