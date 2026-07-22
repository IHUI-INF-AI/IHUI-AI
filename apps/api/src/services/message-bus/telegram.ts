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
