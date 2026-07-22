/** Slack 消息总线适配器 */

import { postJson, type MessageBusAdapter } from './index.js'

export const slackAdapter: MessageBusAdapter = {
  async send(content: string, _opts?: Record<string, unknown>) {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL
    if (!webhookUrl) {
      return { success: false, error: '渠道未配置' }
    }
    return postJson(webhookUrl, { text: content })
  },
}
