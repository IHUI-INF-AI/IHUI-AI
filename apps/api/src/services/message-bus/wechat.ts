/** 微信消息总线适配器 */

import { postJson, type MessageBusAdapter } from './index.js'

export const wechatAdapter: MessageBusAdapter = {
  async send(content: string, _opts?: Record<string, unknown>) {
    const webhookUrl = process.env.WECHAT_WEBHOOK_URL
    if (!webhookUrl) {
      return { success: false, error: '渠道未配置' }
    }
    return postJson(webhookUrl, { msgtype: 'text', text: { content } })
  },
}
