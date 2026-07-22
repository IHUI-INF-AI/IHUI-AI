/** 飞书消息总线适配器 */

import { postJson, type MessageBusAdapter } from './index.js'

export const feishuAdapter: MessageBusAdapter = {
  async send(content: string, _opts?: Record<string, unknown>) {
    const webhookUrl = process.env.FEISHU_WEBHOOK_URL
    if (!webhookUrl) {
      return { success: false, error: '渠道未配置' }
    }
    return postJson(webhookUrl, { msg_type: 'text', content: { text: content } })
  },
}
