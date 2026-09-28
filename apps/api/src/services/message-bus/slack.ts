// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

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
