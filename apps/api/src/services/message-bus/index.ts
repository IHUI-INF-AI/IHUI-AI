/**
 * 多通道消息总线适配器工厂(Wave 3 W3-2)。
 * 根据 channel 返回对应渠道适配器,统一 MessageBusAdapter 接口。
 */

import type { MessageBusSendResult } from '@ihui/types'
import { feishuAdapter } from './feishu.js'
import { dingtalkAdapter } from './dingtalk.js'
import { telegramAdapter } from './telegram.js'
import { slackAdapter } from './slack.js'
import { discordAdapter } from './discord.js'
import { wechatAdapter } from './wechat.js'

/** 消息总线适配器接口:各渠道统一实现 */
export interface MessageBusAdapter {
  send(content: string, opts?: Record<string, unknown>): Promise<MessageBusSendResult>
}

/** 通用 POST JSON + 10s 超时辅助函数,各适配器共享 */
export async function postJson(
  url: string,
  body: unknown,
  timeoutMs = 10000,
): Promise<MessageBusSendResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!resp.ok) {
      return { success: false, error: `HTTP ${resp.status}` }
    }
    const text = await resp.text()
    let messageId: string | undefined
    if (text) {
      try {
        const json = JSON.parse(text) as Record<string, unknown>
        messageId =
          (json.message_id as string | undefined) ??
          (json.messageId as string | undefined) ??
          (json.id as string | undefined)
      } catch {
        // 非 JSON 响应,忽略
      }
    }
    return { success: true, messageId }
  } catch (e) {
    const err = e as Error
    return {
      success: false,
      error: err.name === 'AbortError' ? '请求超时' : err.message || '发送失败',
    }
  } finally {
    clearTimeout(timer)
  }
}

const adapters: Record<string, MessageBusAdapter> = {
  feishu: feishuAdapter,
  dingtalk: dingtalkAdapter,
  telegram: telegramAdapter,
  slack: slackAdapter,
  discord: discordAdapter,
  wechat: wechatAdapter,
}

/** 根据 channel 名称返回对应适配器,未匹配返回 null */
export function getMessageBusAdapter(channel: string): MessageBusAdapter | null {
  return adapters[channel] ?? null
}
