// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

/** 在 @ihui/types 的 MessageBusSendResult 上追加业务码(新增可选字段,向后兼容) */
export type MessageBusSendResultWithCode = MessageBusSendResult & {
  /** 渠道返回的原始业务码(仅失败且渠道有业务码时回填,便于上游按码分派告警) */
  code?: number
}

/** 消息总线适配器接口:各渠道统一实现 */
export interface MessageBusAdapter {
  send(content: string, opts?: Record<string, unknown>): Promise<MessageBusSendResultWithCode>
}

/** postJson 的渠道附加判据:由适配器传入,postJson 本身不靠字段名猜渠道 */
export interface PostJsonOptions {
  /** 超时,默认 10s */
  timeoutMs?: number
  /** 从响应体取业务码;返回 undefined 表示该响应没有业务码(按成功处理) */
  businessCode?: (json: Record<string, unknown>) => number | undefined
  /** 业务失败时从响应体取渠道自带错误文案 */
  businessError?: (json: Record<string, unknown>) => string | undefined
}

/** 通用 POST JSON + 10s 超时辅助函数,各适配器共享 */
export async function postJson(
  url: string,
  body: unknown,
  opts: PostJsonOptions = {},
): Promise<MessageBusSendResultWithCode> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10000)
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
    let json: Record<string, unknown> | undefined
    if (text) {
      try {
        json = JSON.parse(text) as Record<string, unknown>
      } catch {
        // 非 JSON 响应,忽略
      }
    }
    if (json && opts.businessCode) {
      const code = opts.businessCode(json)
      // 飞书/钉钉/企微被限频或签名校验失败时协议仍回 HTTP 200,只在业务码里体现失败
      if (typeof code === 'number' && code !== 0) {
        return {
          success: false,
          error: opts.businessError?.(json) ?? `渠道返回业务码 ${code}`,
          code,
        }
      }
    }
    const messageId = json
      ? ((json.message_id as string | undefined) ??
        (json.messageId as string | undefined) ??
        (json.id as string | undefined))
      : undefined
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
